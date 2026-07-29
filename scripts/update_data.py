import csv
import io
import json
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


PUBLISHED_SHEET_BASE_URL = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vTkPYBVr28qzkcrYQkclmd3WphmMHXYUcn-uMFT9zUG5-PNYjPtz2pW0mQJBuhBGtQaF3wZNbqm5v68"
    "/pub"
)

TERMINY_GID = "0"
TASKS_GID = "396059144"

OUTPUT_FILE = Path("data/dashboard.json")

PRAGUE_TZ = ZoneInfo("Europe/Prague")


def get_csv_url(gid: str) -> str:
    return f"{PUBLISHED_SHEET_BASE_URL}?output=csv&gid={gid}"


def download_csv(sheet_name: str, gid: str) -> list[dict[str, str]]:
    url = get_csv_url(gid)

    print(f"Načítám list: {sheet_name} (gid={gid})")

    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 DOTS-Dashboard/1.0"
        },
    )

    try:
        with urlopen(request, timeout=30) as response:
            content = response.read().decode("utf-8-sig")
    except Exception as exc:
        raise RuntimeError(
            f"Nepodařilo se načíst list '{sheet_name}': {exc}"
        ) from exc

    reader = csv.DictReader(io.StringIO(content))
    rows = []

    for raw_row in reader:
        row = {}

        for key, value in raw_row.items():
            if key is None:
                continue

            clean_key = str(key).strip()
            clean_value = "" if value is None else str(value).strip()

            row[clean_key] = clean_value

        if any(row.values()):
            rows.append(row)

    print(f"  Načteno řádků: {len(rows)}")

    return rows


def parse_date(value: str) -> datetime | None:
    value = value.strip()

    if not value:
        return None

    formats = (
        "%d.%m.%Y",
        "%d. %m. %Y",
        "%Y-%m-%d",
        "%d/%m/%Y",
    )

    for date_format in formats:
        try:
            return datetime.strptime(value, date_format)
        except ValueError:
            continue

    return None


def iso_date(value: str) -> str:
    parsed = parse_date(value)

    if parsed is None:
        return ""

    return parsed.strftime("%Y-%m-%d")


def display_date(value: str) -> str:
    parsed = parse_date(value)

    if parsed is None:
        return value.strip()

    return parsed.strftime("%d.%m.%Y")


def get_value(
    row: dict[str, str],
    *possible_names: str,
) -> str:
    normalized_row = {
        key.casefold().strip(): value.strip()
        for key, value in row.items()
    }

    for name in possible_names:
        key = name.casefold().strip()

        if key in normalized_row:
            return normalized_row[key]

    return ""


def build_events(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    events = []

    for row in rows:
        date_raw = get_value(row, "Datum")
        day = get_value(row, "Den týdne")
        event = get_value(row, "Událost")
        pickup = get_value(row, "Vyzvednutí Skalka")
        note = get_value(row, "Poznámka")

        if not date_raw or not event:
            continue

        parsed_date = iso_date(date_raw)

        if not parsed_date:
            print(
                f"VAROVÁNÍ: Neznámý formát data v Termínech: "
                f"{date_raw!r}"
            )
            continue

        events.append(
            {
                "date": parsed_date,
                "date_display": display_date(date_raw),
                "day": day,
                "event": event,
                "pickup": pickup,
                "note": note,
            }
        )

    events.sort(key=lambda item: item["date"])

    return events


def build_tasks(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    tasks = []

    for row in rows:
        task = get_value(row, "Úkol")
        assignee = get_value(row, "Řešitel")
        created_raw = get_value(row, "Zadáno")
        deadline_raw = get_value(row, "Termín splnění")
        note = get_value(row, "Poznámka")

        if not task or not assignee:
            continue

        created_iso = ""
        created_display = ""

        if created_raw:
            created_iso = iso_date(created_raw)
            created_display = display_date(created_raw)

            if not created_iso:
                print(
                    f"VAROVÁNÍ: Neznámý formát data 'Zadáno' "
                    f"u úkolu {task!r}: {created_raw!r}"
                )

        deadline_iso = ""
        deadline_display = ""

        if deadline_raw:
            deadline_iso = iso_date(deadline_raw)
            deadline_display = display_date(deadline_raw)

            if not deadline_iso:
                print(
                    f"VAROVÁNÍ: Neznámý formát data 'Termín splnění' "
                    f"u úkolu {task!r}: {deadline_raw!r}"
                )

        tasks.append(
            {
                "task": task,
                "assignee": assignee,
                "created": created_iso,
                "created_display": created_display,
                "deadline": deadline_iso,
                "deadline_display": deadline_display,
                "note": note,
            }
        )

    return tasks


def get_updated_at() -> str:
    now = datetime.now(PRAGUE_TZ)
    return now.strftime("%d.%m.%Y %H:%M")


def load_existing_dashboard() -> dict:
    if not OUTPUT_FILE.exists():
        return {}

    try:
        return json.loads(
            OUTPUT_FILE.read_text(encoding="utf-8")
        )
    except (json.JSONDecodeError, OSError) as exc:
        print(
            "VAROVÁNÍ: Stávající dashboard.json se nepodařilo "
            f"načíst: {exc}"
        )
        return {}


def dashboard_data_changed(
    existing: dict,
    events: list[dict[str, str]],
    tasks: list[dict[str, str]],
) -> bool:
    existing_events = existing.get("events", [])
    existing_tasks = existing.get("tasks", [])

    return (
        existing_events != events
        or existing_tasks != tasks
    )


def main() -> None:
    print("Generuji DOTS Dashboard data")

    terminy_rows = download_csv(
        "Termíny",
        TERMINY_GID,
    )

    task_rows = download_csv(
        "Aktuální úkoly",
        TASKS_GID,
    )

    events = build_events(terminy_rows)
    tasks = build_tasks(task_rows)

    existing_dashboard = load_existing_dashboard()

    print()
    print(f"Termíny: {len(events)}")
    print(f"Úkoly: {len(tasks)}")

    if not dashboard_data_changed(
        existing_dashboard,
        events,
        tasks,
    ):
        print("Data se nezměnila.")
        print("dashboard.json ponechávám beze změny.")
        return

    dashboard = {
        "updated_at": get_updated_at(),
        "events": events,
        "tasks": tasks,
    }

    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    OUTPUT_FILE.write_text(
        json.dumps(
            dashboard,
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print("Data se změnila.")
    print(f"Výstup: {OUTPUT_FILE}")
    print(f"Aktualizováno: {dashboard['updated_at']}")


if __name__ == "__main__":
    main()
