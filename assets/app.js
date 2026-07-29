"use strict";

const DATA_URL = "data/dashboard.json";

const EVENT_TYPES = [
    { key: "zkouska", label: "Zkoušky", keywords: ["zkouška", "zkouska"] },
    { key: "studio", label: "Studio", keywords: ["studio"] },
    { key: "koncert", label: "Koncerty", keywords: ["koncert"] }
];

const state = {
    data: null,
    selectedEventTypes: new Set(),
    selectedYears: new Set()
};

document.addEventListener("DOMContentLoaded", init);


/* =========================================================
   INICIALIZACE
========================================================= */

async function init() {
    initializeCollapsibleSections();

    try {
        const response = await fetch(DATA_URL, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        validateData(data);

        state.data = data;

        renderLastUpdate(data.updated_at);
        initializeFilters(data.events || []);
        renderSchedules();
        renderTasks(data.tasks || []);
    } catch (error) {
        console.error("Nepodařilo se načíst dashboard:", error);
        showLoadError();
    }
}


/* =========================================================
   SBALOVÁNÍ / ROZBALOVÁNÍ SEKCE
========================================================= */

function initializeCollapsibleSections() {
    setupCollapsibleSection({
        sectionId: "schedules-section",
        toggleId: "schedules-toggle",
        contentId: "schedules-content"
    });

    setupCollapsibleSection({
        sectionId: "tasks-section",
        toggleId: "tasks-toggle",
        contentId: "tasks-content"
    });
}


function setupCollapsibleSection({
    sectionId,
    toggleId,
    contentId
}) {
    const section = document.getElementById(sectionId);
    const toggle = document.getElementById(toggleId);
    const content = document.getElementById(contentId);

    if (!section || !toggle || !content) {
        return;
    }

    /*
        Výchozí stav je vždy rozbalený.
    */
    setSectionExpanded({
        section,
        toggle,
        content,
        expanded: true
    });

    toggle.addEventListener("click", () => {
        const currentlyExpanded =
            toggle.getAttribute("aria-expanded") === "true";

        setSectionExpanded({
            section,
            toggle,
            content,
            expanded: !currentlyExpanded
        });
    });
}


function setSectionExpanded({
    section,
    toggle,
    content,
    expanded
}) {
    const icon = toggle.querySelector(".section-toggle-icon");
    const label = toggle.querySelector(".section-toggle-label");

    toggle.setAttribute(
        "aria-expanded",
        expanded ? "true" : "false"
    );

    content.hidden = !expanded;

    section.classList.toggle(
        "is-collapsed",
        !expanded
    );

    if (icon) {
        icon.textContent = expanded ? "−" : "+";
    }

    if (label) {
        label.textContent = expanded
            ? "Sbalit"
            : "Rozbalit";
    }
}


/* =========================================================
   VALIDACE
========================================================= */

function validateData(data) {
    if (!data || typeof data !== "object") {
        throw new Error("Neplatný formát dashboard.json");
    }

    if (!Array.isArray(data.events)) {
        data.events = [];
    }

    if (!Array.isArray(data.tasks)) {
        data.tasks = [];
    }
}


/* =========================================================
   POSLEDNÍ AKTUALIZACE
========================================================= */

function renderLastUpdate(updatedAt) {
    const element =
        document.getElementById("last-update-value");

    if (!element) {
        return;
    }

    if (!updatedAt) {
        element.textContent = "Není k dispozici";
        return;
    }

    element.textContent = updatedAt;
}


/* =========================================================
   FILTRY
========================================================= */

function initializeFilters(events) {
    const eventFilterContainer =
        document.getElementById("event-type-filters");

    const yearFilterContainer =
        document.getElementById("year-filters");

    if (!eventFilterContainer || !yearFilterContainer) {
        return;
    }

    eventFilterContainer.innerHTML = "";
    yearFilterContainer.innerHTML = "";

    state.selectedEventTypes.clear();
    state.selectedYears.clear();


    /*
        TYPY UDÁLOSTÍ
    */

    EVENT_TYPES.forEach((type) => {
        state.selectedEventTypes.add(type.key);

        const filter = createFilterPill({
            value: type.key,
            label: type.label,
            checked: true,

            onChange: (checked) => {
                if (checked) {
                    state.selectedEventTypes.add(type.key);
                } else {
                    state.selectedEventTypes.delete(type.key);
                }

                renderSchedules();
            }
        });

        eventFilterContainer.appendChild(filter);
    });


    /*
        ROKY
    */

    const years = [
        ...new Set(
            events
                .map((event) => getEventYear(event))
                .filter((year) => Number.isInteger(year))
        )
    ].sort((a, b) => a - b);

    years.forEach((year) => {
        state.selectedYears.add(year);

        const filter = createFilterPill({
            value: String(year),
            label: String(year),
            checked: true,

            onChange: (checked) => {
                if (checked) {
                    state.selectedYears.add(year);
                } else {
                    state.selectedYears.delete(year);
                }

                renderSchedules();
            }
        });

        yearFilterContainer.appendChild(filter);
    });
}


function createFilterPill({
    value,
    label,
    checked,
    onChange
}) {
    const wrapper =
        document.createElement("label");

    wrapper.className = "filter-pill";


    const input =
        document.createElement("input");

    input.type = "checkbox";
    input.value = value;
    input.checked = checked;


    input.addEventListener("change", () => {
        onChange(input.checked);
    });


    const text =
        document.createElement("span");

    text.textContent = label;


    wrapper.appendChild(input);
    wrapper.appendChild(text);

    return wrapper;
}


/* =========================================================
   TERMÍNY
========================================================= */

function renderSchedules() {
    const container =
        document.getElementById("schedule-container");

    const emptyState =
        document.getElementById("schedule-empty");

    if (!container || !emptyState || !state.data) {
        return;
    }

    const events = state.data.events
        .map(normalizeEvent)
        .filter((event) => event.date !== null)
        .sort((a, b) => {
            return a.date.getTime() - b.date.getTime();
        });


    const filteredEvents =
        events.filter((event) => {
            return (
                state.selectedEventTypes.has(event.type) &&
                state.selectedYears.has(event.year)
            );
        });


    container.innerHTML = "";


    if (filteredEvents.length === 0) {
        emptyState.hidden = false;
        return;
    }


    emptyState.hidden = true;


    const grouped =
        groupByYear(filteredEvents);


    [...grouped.keys()]
        .sort((a, b) => a - b)
        .forEach((year) => {

            const yearSection =
                document.createElement("section");

            yearSection.className =
                "schedule-year";


            const yearHeading =
                document.createElement("h3");

            yearHeading.className =
                "schedule-year-heading";

            yearHeading.textContent = year;


            const items =
                document.createElement("div");

            items.className =
                "schedule-year-items";


            const yearEvents =
                grouped
                    .get(year)
                    .sort((a, b) => {
                        return (
                            a.date.getTime() -
                            b.date.getTime()
                        );
                    });


            yearEvents.forEach((event) => {
                items.appendChild(
                    createScheduleCard(event)
                );
            });


            yearSection.appendChild(yearHeading);
            yearSection.appendChild(items);

            container.appendChild(yearSection);
        });
}


/* =========================================================
   NORMALIZACE TERMÍNU
========================================================= */

function normalizeEvent(rawEvent) {
    const eventName =
        cleanString(rawEvent.event);

    const type =
        detectEventType(eventName);

    const tentative =
        /\(\?\)/.test(eventName);

    const cleanEventName =
        eventName
            .replace(/\s*\(\?\)\s*/g, " ")
            .replace(/\s+/g, " ")
            .trim();

    const date =
        parseDate(rawEvent.date);

    const year =
        date
            ? date.getFullYear()
            : null;

    return {
        date,
        year,

        dateDisplay:
            cleanString(rawEvent.date_display) ||
            formatDate(date),

        day:
            cleanString(rawEvent.day),

        event:
            cleanEventName,

        originalEvent:
            eventName,

        type,
        tentative,

        pickup:
            cleanString(rawEvent.pickup),

        note:
            cleanString(rawEvent.note)
    };
}


/* =========================================================
   KARTA TERMÍNU
========================================================= */

function createScheduleCard(event) {
    const template =
        document.getElementById(
            "schedule-card-template"
        );

    const fragment =
        template.content.cloneNode(true);

    const card =
        fragment.querySelector(
            ".schedule-card"
        );

    const dateValue =
        fragment.querySelector(
            ".schedule-date-value"
        );

    const dayValue =
        fragment.querySelector(
            ".schedule-day"
        );

    const eventValue =
        fragment.querySelector(
            ".schedule-event"
        );

    const tentativeBadge =
        fragment.querySelector(
            ".tentative-badge"
        );

    const noteElement =
        fragment.querySelector(
            ".schedule-note"
        );

    const pickupInfo =
        fragment.querySelector(
            ".pickup-info"
        );

    const pickupValue =
        fragment.querySelector(
            ".pickup-value"
        );


    dateValue.textContent =
        event.dateDisplay;

    dayValue.textContent =
        event.day;

    eventValue.textContent =
        event.event || "Událost";

    card.dataset.eventType =
        event.type;


    if (event.tentative) {
        card.classList.add(
            "is-tentative"
        );

        tentativeBadge.hidden =
            false;
    }


    if (event.note) {
        noteElement.textContent =
            event.note;

        noteElement.hidden =
            false;
    }


    if (
        event.type === "zkouska" &&
        event.pickup
    ) {
        pickupValue.textContent =
            event.pickup;

        pickupInfo.hidden =
            false;
    }


    return fragment;
}


/* =========================================================
   DETEKCE TYPU UDÁLOSTI
========================================================= */

function detectEventType(eventName) {
    const normalized =
        normalizeText(eventName);

    for (const type of EVENT_TYPES) {
        const matches =
            type.keywords.some(
                (keyword) =>
                    normalized.includes(
                        normalizeText(keyword)
                    )
            );

        if (matches) {
            return type.key;
        }
    }

    return "other";
}


/* =========================================================
   SESKUPENÍ TERMÍNŮ PODLE ROKU
========================================================= */

function groupByYear(events) {
    const grouped =
        new Map();

    events.forEach((event) => {
        if (!grouped.has(event.year)) {
            grouped.set(
                event.year,
                []
            );
        }

        grouped
            .get(event.year)
            .push(event);
    });

    return grouped;
}


function getEventYear(event) {
    const date =
        parseDate(event.date);

    return date
        ? date.getFullYear()
        : null;
}


/* =========================================================
   ÚKOLY
========================================================= */

function renderTasks(rawTasks) {
    const container =
        document.getElementById(
            "tasks-container"
        );

    const emptyState =
        document.getElementById(
            "tasks-empty"
        );

    if (!container || !emptyState) {
        return;
    }

    container.innerHTML = "";


    const tasks =
        rawTasks
            .map(normalizeTask)
            .filter(
                (task) =>
                    task.title &&
                    task.assignee
            );


    if (tasks.length === 0) {
        emptyState.hidden = false;
        return;
    }


    emptyState.hidden = true;


    const grouped =
        groupTasksByAssignee(tasks);


    [...grouped.entries()]
        .sort(
            ([nameA], [nameB]) =>
                nameA.localeCompare(
                    nameB,
                    "cs",
                    {
                        sensitivity: "base"
                    }
                )
        )
        .forEach(
            ([
                assignee,
                assigneeTasks
            ]) => {

                container.appendChild(
                    createTaskPersonSection(
                        assignee,
                        sortTasks(
                            assigneeTasks
                        )
                    )
                );
            }
        );
}


/* =========================================================
   NORMALIZACE ÚKOLU
========================================================= */

function normalizeTask(
    rawTask,
    index
) {
    const createdDate =
        parseDate(
            rawTask.created
        );

    const deadlineDate =
        parseDate(
            rawTask.deadline
        );

    return {
        title:
            cleanString(
                rawTask.task
            ),

        assignee:
            cleanString(
                rawTask.assignee
            ),

        createdDate,
        deadlineDate,

        createdDisplay:
            cleanString(
                rawTask.created_display
            ) ||
            formatDate(
                createdDate
            ),

        deadlineDisplay:
            cleanString(
                rawTask.deadline_display
            ) ||
            formatDate(
                deadlineDate
            ),

        note:
            cleanString(
                rawTask.note
            ),

        originalIndex:
            index,

        overdue:
            isOverdue(
                deadlineDate
            )
    };
}


/* =========================================================
   SESKUPENÍ ÚKOLŮ
========================================================= */

function groupTasksByAssignee(tasks) {
    const grouped =
        new Map();

    tasks.forEach((task) => {
        if (
            !grouped.has(
                task.assignee
            )
        ) {
            grouped.set(
                task.assignee,
                []
            );
        }

        grouped
            .get(task.assignee)
            .push(task);
    });

    return grouped;
}


/* =========================================================
   ŘAZENÍ ÚKOLŮ
========================================================= */

function sortTasks(tasks) {
    return [...tasks].sort(
        (a, b) => {

            const aHasDeadline =
                Boolean(
                    a.deadlineDate
                );

            const bHasDeadline =
                Boolean(
                    b.deadlineDate
                );


            /*
                1. Oba mají termín splnění.
                Nejbližší deadline je nahoře.
            */

            if (
                aHasDeadline &&
                bHasDeadline
            ) {
                const deadlineDifference =
                    a.deadlineDate.getTime() -
                    b.deadlineDate.getTime();

                if (
                    deadlineDifference !== 0
                ) {
                    return deadlineDifference;
                }

                return compareCreatedDatesNewestFirst(
                    a,
                    b
                );
            }


            /*
                Úkol s termínem splnění má přednost
                před úkolem bez termínu.
            */

            if (aHasDeadline) {
                return -1;
            }

            if (bHasDeadline) {
                return 1;
            }


            /*
                2. Ani jeden nemá deadline.

                Pokud mají Zadáno,
                nejnovější je nahoře.
            */

            const aHasCreated =
                Boolean(
                    a.createdDate
                );

            const bHasCreated =
                Boolean(
                    b.createdDate
                );


            if (
                aHasCreated &&
                bHasCreated
            ) {
                return (
                    b.createdDate.getTime() -
                    a.createdDate.getTime()
                );
            }


            if (aHasCreated) {
                return -1;
            }

            if (bHasCreated) {
                return 1;
            }


            /*
                3. Bez obou datumů.
                Zachováme pořadí z Google Sheets.
            */

            return (
                a.originalIndex -
                b.originalIndex
            );
        }
    );
}


function compareCreatedDatesNewestFirst(
    a,
    b
) {
    if (
        a.createdDate &&
        b.createdDate
    ) {
        return (
            b.createdDate.getTime() -
            a.createdDate.getTime()
        );
    }

    if (a.createdDate) {
        return -1;
    }

    if (b.createdDate) {
        return 1;
    }

    return (
        a.originalIndex -
        b.originalIndex
    );
}


/* =========================================================
   SEKCE ŘEŠITELE
========================================================= */

function createTaskPersonSection(
    assignee,
    tasks
) {
    const template =
        document.getElementById(
            "task-person-template"
        );

    const fragment =
        template.content.cloneNode(
            true
        );

    const nameElement =
        fragment.querySelector(
            ".task-person-name"
        );

    const countElement =
        fragment.querySelector(
            ".task-count"
        );

    const listElement =
        fragment.querySelector(
            ".task-list"
        );


    nameElement.textContent =
        assignee;

    countElement.textContent =
        formatTaskCount(
            tasks.length
        );


    tasks.forEach((task) => {
        listElement.appendChild(
            createTaskCard(task)
        );
    });


    return fragment;
}


/* =========================================================
   KARTA ÚKOLU
========================================================= */

function createTaskCard(task) {
    const template =
        document.getElementById(
            "task-card-template"
        );

    const fragment =
        template.content.cloneNode(
            true
        );

    const card =
        fragment.querySelector(
            ".task-card"
        );

    const title =
        fragment.querySelector(
            ".task-title"
        );

    const overdueBadge =
        fragment.querySelector(
            ".overdue-badge"
        );

    const dates =
        fragment.querySelector(
            ".task-dates"
        );

    const created =
        fragment.querySelector(
            ".task-created"
        );

    const createdValue =
        fragment.querySelector(
            ".task-created-value"
        );

    const deadline =
        fragment.querySelector(
            ".task-deadline"
        );

    const deadlineValue =
        fragment.querySelector(
            ".task-deadline-value"
        );

    const note =
        fragment.querySelector(
            ".task-note"
        );


    title.textContent =
        task.title;


    /*
        PO TERMÍNU
    */

    if (task.overdue) {
        card.classList.add(
            "is-overdue"
        );

        overdueBadge.hidden =
            false;
    }


    /*
        ZADÁNO
    */

    if (task.createdDate) {
        createdValue.textContent =
            task.createdDisplay;

        created.hidden =
            false;

        dates.hidden =
            false;
    }


    /*
        TERMÍN SPLNĚNÍ

        Funguje i samostatně bez Zadáno.
    */

    if (task.deadlineDate) {
        deadlineValue.textContent =
            task.deadlineDisplay;

        deadline.hidden =
            false;

        dates.hidden =
            false;
    }


    /*
        POZNÁMKA
    */

    if (task.note) {
        note.textContent =
            task.note;

        note.hidden =
            false;
    }


    return fragment;
}


/* =========================================================
   ČESKÝ POČET ÚKOLŮ
========================================================= */

function formatTaskCount(count) {
    if (count === 1) {
        return "1 úkol";
    }

    if (
        count >= 2 &&
        count <= 4
    ) {
        return `${count} úkoly`;
    }

    return `${count} úkolů`;
}


/* =========================================================
   DATUMY
========================================================= */

function parseDate(value) {
    if (!value) {
        return null;
    }

    if (
        value instanceof Date &&
        !Number.isNaN(
            value.getTime()
        )
    ) {
        return value;
    }

    const text =
        String(value).trim();

    if (!text) {
        return null;
    }


    /*
        YYYY-MM-DD
    */

    let match =
        text.match(
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/
        );

    if (match) {
        const [
            ,
            year,
            month,
            day
        ] = match;

        return createLocalDate(
            Number(year),
            Number(month),
            Number(day)
        );
    }


    /*
        DD.MM.YYYY
        DD. MM. YYYY
    */

    match =
        text.match(
            /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/
        );

    if (match) {
        const [
            ,
            day,
            month,
            year
        ] = match;

        return createLocalDate(
            Number(year),
            Number(month),
            Number(day)
        );
    }


    /*
        DD/MM/YYYY
    */

    match =
        text.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
        );

    if (match) {
        const [
            ,
            day,
            month,
            year
        ] = match;

        return createLocalDate(
            Number(year),
            Number(month),
            Number(day)
        );
    }


    const parsed =
        new Date(text);

    return Number.isNaN(
        parsed.getTime()
    )
        ? null
        : parsed;
}


/* =========================================================
   BEZPEČNÉ VYTVOŘENÍ DATUMU
========================================================= */

function createLocalDate(
    year,
    month,
    day
) {
    const date =
        new Date(
            year,
            month - 1,
            day
        );

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}


/* =========================================================
   FORMÁT DATUMU
========================================================= */

function formatDate(date) {
    if (!date) {
        return "";
    }

    return new Intl.DateTimeFormat(
        "cs-CZ",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    ).format(date);
}


/* =========================================================
   PO TERMÍNU
========================================================= */

function isOverdue(deadlineDate) {
    if (!deadlineDate) {
        return false;
    }

    const todayParts =
        getPragueTodayParts();

    const today =
        createLocalDate(
            todayParts.year,
            todayParts.month,
            todayParts.day
        );

    const deadline =
        createLocalDate(
            deadlineDate.getFullYear(),
            deadlineDate.getMonth() + 1,
            deadlineDate.getDate()
        );

    return deadline < today;
}


/* =========================================================
   AKTUÁLNÍ DATUM V PRAZE
========================================================= */

function getPragueTodayParts() {
    const formatter =
        new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone:
                    "Europe/Prague",

                year:
                    "numeric",

                month:
                    "2-digit",

                day:
                    "2-digit"
            }
        );

    const parts =
        formatter.formatToParts(
            new Date()
        );

    const values = {};

    parts.forEach((part) => {
        if (
            part.type !== "literal"
        ) {
            values[part.type] =
                Number(
                    part.value
                );
        }
    });

    return {
        year:
            values.year,

        month:
            values.month,

        day:
            values.day
    };
}


/* =========================================================
   TEXT
========================================================= */

function cleanString(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value).trim();
}


function normalizeText(value) {
    return cleanString(value)
        .toLocaleLowerCase(
            "cs-CZ"
        )
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        );
}


/* =========================================================
   CHYBA NAČTENÍ
========================================================= */

function showLoadError() {
    const updateElement =
        document.getElementById(
            "last-update-value"
        );

    const scheduleContainer =
        document.getElementById(
            "schedule-container"
        );

    const tasksContainer =
        document.getElementById(
            "tasks-container"
        );


    if (updateElement) {
        updateElement.textContent =
            "Data se nepodařilo načíst";
    }


    if (scheduleContainer) {
        scheduleContainer.innerHTML = `
            <div class="empty-state">
                Termíny se nepodařilo načíst.
            </div>
        `;
    }


    if (tasksContainer) {
        tasksContainer.innerHTML = `
            <div class="empty-state">
                Úkoly se nepodařilo načíst.
            </div>
        `;
    }
}
