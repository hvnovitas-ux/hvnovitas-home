import ICAL from "https://cdn.jsdelivr.net/npm/ical.js@2.2.1/+esm";

const FEED_URL = "https://novitas-agenda.hvnovitas.workers.dev/";
const DAYS_AHEAD = 14;
const statusElement = document.getElementById("agendaStatus");
const listElement = document.getElementById("agendaList");

loadAgenda();

async function loadAgenda() {
  setStatus("Agenda laden...", "");

  try {
    const response = await fetch(FEED_URL, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Agenda-server gaf HTTP ${response.status}`);
    }

    const icsText = await response.text();

    if (!icsText || !icsText.includes("BEGIN:VCALENDAR")) {
      throw new Error("Ongeldige agenda ontvangen.");
    }

    renderAgenda(parseCalendar(icsText));
  } catch (error) {
    console.error("Agenda fout:", error);
    listElement.innerHTML = "";

    const errorElement = document.createElement("div");
    errorElement.className = "agenda-empty";
    errorElement.textContent =
      "De agenda kan op dit moment niet worden geladen.";

    listElement.appendChild(errorElement);
    setStatus("Agenda niet beschikbaar.", "error");
  }
}

function parseCalendar(icsText) {
  const parsed = ICAL.parse(icsText);
  const component = new ICAL.Component(parsed);
  const vevents = component.getAllSubcomponents("vevent");

  const today = startOfDay(new Date());
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + DAYS_AHEAD);

  const groups = new Map();

  for (const vevent of vevents) {
    try {
      const event = new ICAL.Event(vevent);

      if (event.isRecurring()) {
        processRecurringEvent(event, today, endDate, groups);
      } else {
        processSingleEvent(event, today, endDate, groups);
      }
    } catch (eventError) {
      console.warn("Agenda-item overgeslagen:", eventError);
    }
  }

  return groups;
}

function processSingleEvent(event, today, endDate, groups) {
  if (!event.startDate) return;

  const start = event.startDate.toJSDate();

  if (start < today || start >= endDate) return;

  const end = event.endDate ? event.endDate.toJSDate() : null;

  addOccurrence(
    event,
    start,
    end,
    groups,
    event.startDate.isDate
  );
}

function processRecurringEvent(event, today, endDate, groups) {
  const iterator = event.iterator();
  let next;
  let guard = 0;

  while (guard < 5000 && (next = iterator.next())) {
    guard++;

    const occurrenceDate = next.toJSDate();

    if (occurrenceDate >= endDate) break;
    if (occurrenceDate < today) continue;

    let details = null;

    try {
      details = event.getOccurrenceDetails(next);
    } catch (error) {
      console.warn(
        "Occurrence-details konden niet worden gelezen:",
        error
      );
    }

    let start = occurrenceDate;
    let end = null;
    let isAllDay = false;

    if (details && details.startDate) {
      start = details.startDate.toJSDate();
      isAllDay = !!details.startDate.isDate;

      if (details.endDate) {
        end = details.endDate.toJSDate();
      }
    }

    if (!end && event.startDate && event.endDate) {
      const duration =
        event.endDate.toJSDate().getTime() -
        event.startDate.toJSDate().getTime();

      if (duration > 0) {
        end = new Date(start.getTime() + duration);
      }
    }

    if (start < today || start >= endDate) continue;

    addOccurrence(
      event,
      start,
      end,
      groups,
      isAllDay
    );
  }
}

function addOccurrence(event, start, end, groups, isAllDay = false) {
  const dateKey = getDateKey(start);

  const title = cleanText(
    event.summary || "Activiteit"
  );

  const location = cleanText(
    event.location || ""
  );

  const item = {
    title,
    location,
    start,
    end,
    isAllDay,
    type: getEventType(title)
  };

  if (!groups.has(dateKey)) {
    groups.set(dateKey, []);
  }

  const existing = groups.get(dateKey);

  const duplicate = existing.some(
    entry =>
      entry.title === item.title &&
      entry.start.getTime() === item.start.getTime()
  );

  if (!duplicate) {
    existing.push(item);
  }
}

function getEventType(title) {
  const normalized = title.toLowerCase();

  if (
    normalized.includes("training") ||
    normalized.includes("trainen")
  ) {
    return "training";
  }

  if (
    normalized.includes("wedstrijd") ||
    normalized.includes("competitie") ||
    normalized.includes("toernooi") ||
    normalized.includes("novitas")
  ) {
    return "match";
  }

  return "other";
}

function renderAgenda(groups) {
  listElement.innerHTML = "";

  if (groups.size === 0) {
    const empty = document.createElement("div");
    empty.className = "agenda-empty";
    empty.textContent =
      "Er staan de komende 14 dagen geen activiteiten in de agenda.";

    listElement.appendChild(empty);
    setStatus(
      "Geen activiteiten de komende 14 dagen.",
      "success"
    );
    return;
  }

  const sortedDays = Array.from(groups.entries()).sort(
    (a, b) => a[0].localeCompare(b[0])
  );

  let totalEvents = 0;

  for (const [dateKey, events] of sortedDays) {
    events.sort((a, b) => a.start - b.start);
    totalEvents += events.length;

    listElement.appendChild(
      createDayElement(dateKey, events)
    );
  }

  setStatus(
    `${totalEvents} activiteit${totalEvents === 1 ? "" : "en"} gevonden.`,
    "success"
  );
}

function createDayElement(dateKey, events) {
  const date = parseDateKey(dateKey);

  const day = document.createElement("section");
  day.className = "agenda-day";

  const header = document.createElement("header");
  header.className = "agenda-day-header";

  const dateBlock = document.createElement("div");
  dateBlock.className = "agenda-date";

  const number = document.createElement("div");
  number.className = "agenda-date-number";
  number.textContent = date.getDate();

  const month = document.createElement("div");
  month.className = "agenda-date-month";
  month.textContent =
    new Intl.DateTimeFormat("nl-NL", {
      month: "long"
    }).format(date);

  dateBlock.append(number, month);

  const titleBlock = document.createElement("div");
  titleBlock.className = "agenda-day-title";

  const weekday = document.createElement("div");
  weekday.className = "agenda-weekday";
  weekday.textContent =
    new Intl.DateTimeFormat("nl-NL", {
      weekday: "long"
    }).format(date);

  const fullDate = document.createElement("div");
  fullDate.className = "agenda-full-date";
  fullDate.textContent =
    new Intl.DateTimeFormat("nl-NL", {
      day: "numeric",
      month: "long"
    }).format(date);

  titleBlock.append(weekday, fullDate);
  header.append(dateBlock, titleBlock);
  day.appendChild(header);

  for (const event of events) {
    day.appendChild(createEventElement(event));
  }

  return day;
}

function createEventElement(event) {
  const article = document.createElement("article");
  article.className = `agenda-event ${event.type}`;

  const dot = document.createElement("span");
  dot.className = "agenda-event-dot";
  dot.setAttribute("aria-hidden", "true");

  const time = document.createElement("div");
  time.className = "agenda-event-time";
  time.textContent = formatTime(event);

  const main = document.createElement("div");
  main.className = "agenda-event-main";

  const title = document.createElement("div");
  title.className = "agenda-event-title";
  title.textContent = event.title;

  main.appendChild(title);

  if (event.location) {
    const location = document.createElement("div");
    location.className = "agenda-event-location";

    const icon = document.createElement("span");
    icon.className = "agenda-location-icon";
    icon.textContent = "📍";

    const text = document.createElement("span");
    text.textContent = event.location;

    location.append(icon, text);
    main.appendChild(location);
  }

  article.append(dot, time, main);

  return article;
}

function formatTime(event) {
  if (event.isAllDay) {
    return "Hele dag";
  }

  const startText = formatClock(event.start);

  if (!event.end) {
    return startText;
  }

  return `${startText} – ${formatClock(event.end)}`;
}

function formatClock(date) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function setStatus(text, type) {
  statusElement.textContent = text;
  statusElement.className = "agenda-status";

  if (type) {
    statusElement.classList.add(type);
  }
}
