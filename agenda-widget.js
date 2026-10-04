const FEED_URL = "https://novitas-agenda.hvnovitas.workers.dev/";
const DAYS_AHEAD = 14;

const statusElement = document.getElementById("agendaStatus");
const listElement = document.getElementById("agendaList");

loadAgenda();

async function loadAgenda() {
  setStatus("Agenda laden...", "");

  try {
    const response = await fetch(FEED_URL, { cache: "no-store" });

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

/*
 * Belangrijk:
 * Google Agenda kan een verwijderde of gewijzigde herhaling exporteren als
 * een apart VEVENT met dezelfde UID en een RECURRENCE-ID.
 *
 * Voorbeeld:
 *   UID:...
 *   RECURRENCE-ID:20261005T180000Z
 *   STATUS:CANCELLED
 *
 * De oude parser negeerde deze uitzonderingen. Daardoor werd de normale
 * wekelijkse afspraak voor 5 oktober opnieuw gegenereerd.
 *
 * Deze parser:
 * 1. leest EXDATE;
 * 2. leest RECURRENCE-ID;
 * 3. leest STATUS:CANCELLED;
 * 4. gebruikt gewijzigde uitzonderingen als override;
 * 5. verwijdert dubbele zichtbare afspraken.
 */
function parseCalendar(icsText) {
  const lines = unfoldICS(icsText);
  const events = [];
  let current = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {
        exdate: []
      };
      continue;
    }

    if (line === "END:VEVENT") {
      if (current && current.dtstart) {
        events.push(current);
      }
      current = null;
      continue;
    }

    if (!current) continue;

    const colon = line.indexOf(":");
    if (colon < 0) continue;

    const rawKey = line.slice(0, colon);
    const value = line.slice(colon + 1);

    const parts = rawKey.split(";");
    const key = parts.shift().toUpperCase();
    const params = {};

    for (const part of parts) {
      const eq = part.indexOf("=");
      if (eq > 0) {
        params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
      }
    }

    if (key === "UID") {
      current.uid = unescapeICS(value);
    } else if (key === "DTSTART") {
      current.dtstart = parseICSDate(value, params);
    } else if (key === "DTEND") {
      current.dtend = parseICSDate(value, params);
    } else if (key === "SUMMARY") {
      current.summary = unescapeICS(value);
    } else if (key === "LOCATION") {
      current.location = unescapeICS(value);
    } else if (key === "RRULE") {
      current.rrule = value;
    } else if (key === "STATUS") {
      current.status = String(value || "").toUpperCase();
    } else if (key === "RECURRENCE-ID") {
      current.recurrenceId = parseICSDate(value, params);
    } else if (key === "EXDATE") {
      current.exdate.push(
        ...value
          .split(",")
          .map(v => parseICSDate(v, params))
          .filter(Boolean)
      );
    }
  }

  const today = startOfDay(new Date());
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + DAYS_AHEAD);

  /*
   * Verzamel alle uitzonderingen voordat we de terugkerende hoofdafspraken
   * uitwerken.
   */
  const cancelledOccurrences = new Set();
  const overrides = new Map();

  for (const event of events) {
    if (!event.recurrenceId) continue;

    const key = exceptionKey(event.uid, event.recurrenceId.date);

    if (event.status === "CANCELLED") {
      cancelledOccurrences.add(key);
    } else {
      overrides.set(key, event);
    }
  }

  const groups = new Map();

  for (const event of events) {
    try {
      /*
       * Een RECURRENCE-ID-VEVENT is een uitzondering en wordt niet als
       * zelfstandige afspraak toegevoegd. Hij wordt hieronder verwerkt
       * vanuit de hoofdafspraak.
       */
      if (event.recurrenceId) continue;

      if (event.status === "CANCELLED") continue;

      if (event.rrule) {
        addRecurringEvent(
          event,
          today,
          endDate,
          groups,
          cancelledOccurrences,
          overrides
        );
      } else {
        addSingleEvent(event, today, endDate, groups);
      }
    } catch (e) {
      console.warn("Agenda-item overgeslagen:", e);
    }
  }

  return groups;
}

function unfoldICS(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .reduce((out, line) => {
      if (
        (line.startsWith(" ") || line.startsWith("\t")) &&
        out.length
      ) {
        out[out.length - 1] += line.slice(1);
      } else {
        out.push(line.trimEnd());
      }

      return out;
    }, [])
    .filter(Boolean);
}

function unescapeICS(value) {
  return String(value)
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .replace(/\s+/g, " ")
    .trim();
}

function parseICSDate(value, params = {}) {
  if (!value) return null;

  const isDateOnly =
    params.VALUE === "DATE" || /^\d{8}$/.test(value);

  if (isDateOnly) {
    const y = Number(value.slice(0, 4));
    const m = Number(value.slice(4, 6)) - 1;
    const d = Number(value.slice(6, 8));

    return {
      date: new Date(y, m, d),
      isDate: true
    };
  }

  const clean = value.replace(/[^\dTZ]/g, "");

  const match = clean.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/
  );

  if (!match) return null;

  const y = Number(match[1]);
  const mo = Number(match[2]) - 1;
  const d = Number(match[3]);
  const h = Number(match[4]);
  const mi = Number(match[5]);
  const s = Number(match[6] || 0);
  const isUTC = Boolean(match[7]);

  const date = isUTC
    ? new Date(Date.UTC(y, mo, d, h, mi, s))
    : new Date(y, mo, d, h, mi, s);

  return {
    date,
    isDate: false
  };
}

function addSingleEvent(event, today, endDate, groups) {
  if (!event.dtstart) return;

  const start = event.dtstart.date;

  if (start < today || start >= endDate) return;

  let end = event.dtend ? event.dtend.date : null;

  if (!end && event.dtstart.isDate) {
    end = new Date(
      start.getTime() + 24 * 60 * 60 * 1000
    );
  }

  addOccurrence(
    event,
    start,
    end,
    groups,
    event.dtstart.isDate
  );
}

function addRecurringEvent(
  event,
  today,
  endDate,
  groups,
  cancelledOccurrences,
  overrides
) {
  const rule = parseRRule(event.rrule);

  if (!rule || !rule.FREQ) {
    addSingleEvent(event, today, endDate, groups);
    return;
  }

  const originalStart = event.dtstart.date;

  const duration =
    event.dtend && event.dtstart
      ? event.dtend.date.getTime() -
        originalStart.getTime()
      : event.dtstart.isDate
        ? 24 * 60 * 60 * 1000
        : 60 * 60 * 1000;

  const exdates = new Set(
    (event.exdate || [])
      .filter(Boolean)
      .map(x => dateTimeKey(x.date))
  );

  let cursor = new Date(originalStart);
  let count = 0;
  const max = 5000;

  while (count < max && cursor < endDate) {
    count++;

    const occurrenceKey =
      exceptionKey(event.uid, cursor);

    const cancelledByExdate =
      exdates.has(dateTimeKey(cursor));

    const cancelledByException =
      cancelledOccurrences.has(occurrenceKey);

    if (
      cursor >= today &&
      !cancelledByExdate &&
      !cancelledByException &&
      matchesRule(cursor, originalStart, rule)
    ) {
      const override =
        overrides.get(occurrenceKey);

      if (override && override.dtstart) {
        /*
         * Een gewijzigde losse herhaling krijgt de DTSTART/DTEND
         * van het exception-VEVENT.
         */
        const overrideStart =
          override.dtstart.date;

        const overrideEnd =
          override.dtend
            ? override.dtend.date
            : new Date(
                overrideStart.getTime() +
                duration
              );

        if (
          overrideStart >= today &&
          overrideStart < endDate
        ) {
          addOccurrence(
            {
              ...event,
              ...override,
              uid: event.uid
            },
            overrideStart,
            overrideEnd,
            groups,
            override.dtstart.isDate
          );
        }
      } else {
        addOccurrence(
          event,
          new Date(cursor),
          new Date(cursor.getTime() + duration),
          groups,
          event.dtstart.isDate
        );
      }
    }

    cursor = advanceOneDay(cursor);

    if (rule.UNTIL) {
      const until = parseRuleUntil(rule.UNTIL);

      if (until && cursor > until) {
        break;
      }
    }

    /*
     * COUNT is counted from the original recurrence set.
     * The 366 safety margin prevents an endless loop when DTSTART
     * is far in the past and the visible window starts later.
     */
    if (
      rule.COUNT &&
      count >= Number(rule.COUNT) + 366
    ) {
      break;
    }
  }
}

function parseRRule(value) {
  const rule = {};

  for (const part of value.split(";")) {
    const eq = part.indexOf("=");

    if (eq > 0) {
      rule[
        part.slice(0, eq).toUpperCase()
      ] = part.slice(eq + 1);
    }
  }

  return rule;
}

function matchesRule(date, original, rule) {
  const freq =
    String(rule.FREQ || "").toUpperCase();

  const interval =
    Math.max(1, Number(rule.INTERVAL || 1));

  const dayDiff = Math.floor(
    (
      startOfDay(date) -
      startOfDay(original)
    ) / 86400000
  );

  if (dayDiff < 0) return false;

  if (freq === "DAILY") {
    return dayDiff % interval === 0;
  }

  if (freq === "WEEKLY") {
    const weekDiff =
      Math.floor(dayDiff / 7);

    if (weekDiff % interval !== 0) {
      return false;
    }

    if (rule.BYDAY) {
      const days = rule.BYDAY
        .split(",")
        .map(dayCodeToNumber);

      return days.includes(date.getDay());
    }

    return date.getDay() === original.getDay();
  }

  if (freq === "MONTHLY") {
    const monthDiff =
      (
        date.getFullYear() -
        original.getFullYear()
      ) * 12 +
      date.getMonth() -
      original.getMonth();

    if (
      monthDiff < 0 ||
      monthDiff % interval !== 0
    ) {
      return false;
    }

    if (rule.BYMONTHDAY) {
      return rule.BYMONTHDAY
        .split(",")
        .map(Number)
        .includes(date.getDate());
    }

    return date.getDate() === original.getDate();
  }

  if (freq === "YEARLY") {
    const yearDiff =
      date.getFullYear() -
      original.getFullYear();

    if (
      yearDiff < 0 ||
      yearDiff % interval !== 0
    ) {
      return false;
    }

    return (
      date.getMonth() === original.getMonth() &&
      date.getDate() === original.getDate()
    );
  }

  return false;
}

function dayCodeToNumber(code) {
  return {
    SU: 0,
    MO: 1,
    TU: 2,
    WE: 3,
    TH: 4,
    FR: 5,
    SA: 6
  }[code.replace(/[+-]?\d+$/, "")];
}

function parseRuleUntil(value) {
  if (!value) return null;

  const parsed =
    parseICSDate(value, {});

  return parsed
    ? parsed.date
    : null;
}

function advanceOneDay(date) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next;
}

function addOccurrence(
  event,
  start,
  end,
  groups,
  isAllDay = false
) {
  const dateKey =
    getDateKey(start);

  const item = {
    uid: event.uid || "",
    title: cleanText(
      event.summary || "Activiteit"
    ),
    location: cleanText(
      event.location || ""
    ),
    start,
    end,
    isAllDay,
    type: getEventType(
      event.summary || ""
    )
  };

  if (!groups.has(dateKey)) {
    groups.set(dateKey, []);
  }

  const existing =
    groups.get(dateKey);

  const duplicate =
    existing.some(entry => {
      const sameUid =
        entry.uid &&
        item.uid &&
        entry.uid === item.uid &&
        entry.start.getTime() ===
          item.start.getTime();

      const sameVisibleActivity =
        normalizeTitle(entry.title) ===
          normalizeTitle(item.title) &&
        minuteKey(entry.start) ===
          minuteKey(item.start) &&
        normalizeTitle(entry.location) ===
          normalizeTitle(item.location);

      return (
        sameUid ||
        sameVisibleActivity
      );
    });

  if (!duplicate) {
    existing.push(item);
  }
}

function exceptionKey(uid, date) {
  return `${uid || ""}|${date.getTime()}`;
}

function normalizeTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function minuteKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0")
  ].join("");
}

function getEventType(title) {
  const normalized =
    String(title).toLowerCase();

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
    const empty =
      document.createElement("div");

    empty.className =
      "agenda-empty";

    empty.textContent =
      "Er staan de komende 14 dagen geen activiteiten in de agenda.";

    listElement.appendChild(empty);

    setStatus(
      "Geen activiteiten de komende 14 dagen.",
      "success"
    );

    return;
  }

  const sortedDays =
    Array.from(groups.entries())
      .sort((a, b) =>
        a[0].localeCompare(b[0])
      );

  let totalEvents = 0;

  for (const [dateKey, events] of sortedDays) {
    events.sort(
      (a, b) => a.start - b.start
    );

    totalEvents +=
      events.length;

    listElement.appendChild(
      createDayElement(
        dateKey,
        events
      )
    );
  }

  setStatus(
    `${totalEvents} activiteit${totalEvents === 1 ? "" : "en"} gevonden.`,
    "success"
  );
}

function createDayElement(
  dateKey,
  events
) {
  const date =
    parseDateKey(dateKey);

  const day =
    document.createElement("section");

  day.className =
    "agenda-day";

  const header =
    document.createElement("header");

  header.className =
    "agenda-day-header";

  const dateBlock =
    document.createElement("div");

  dateBlock.className =
    "agenda-date";

  const number =
    document.createElement("div");

  number.className =
    "agenda-date-number";

  number.textContent =
    date.getDate();

  const month =
    document.createElement("div");

  month.className =
    "agenda-date-month";

  month.textContent =
    new Intl.DateTimeFormat(
      "nl-NL",
      { month: "long" }
    ).format(date);

  dateBlock.append(
    number,
    month
  );

  const titleBlock =
    document.createElement("div");

  titleBlock.className =
    "agenda-day-title";

  const weekday =
    document.createElement("div");

  weekday.className =
    "agenda-weekday";

  weekday.textContent =
    new Intl.DateTimeFormat(
      "nl-NL",
      { weekday: "long" }
    ).format(date);

  const fullDate =
    document.createElement("div");

  fullDate.className =
    "agenda-full-date";

  fullDate.textContent =
    new Intl.DateTimeFormat(
      "nl-NL",
      {
        day: "numeric",
        month: "long"
      }
    ).format(date);

  titleBlock.append(
    weekday,
    fullDate
  );

  header.append(
    dateBlock,
    titleBlock
  );

  day.appendChild(header);

  for (const event of events) {
    day.appendChild(
      createEventElement(event)
    );
  }

  return day;
}

function createEventElement(event) {
  const article =
    document.createElement("article");

  article.className =
    `agenda-event ${event.type}`;

  const dot =
    document.createElement("span");

  dot.className =
    "agenda-event-dot";

  dot.setAttribute(
    "aria-hidden",
    "true"
  );

  const time =
    document.createElement("div");

  time.className =
    "agenda-event-time";

  time.textContent =
    formatTime(event);

  const main =
    document.createElement("div");

  main.className =
    "agenda-event-main";

  const title =
    document.createElement("div");

  title.className =
    "agenda-event-title";

  title.textContent =
    event.title;

  main.appendChild(title);

  if (event.location) {
    const location =
      document.createElement("div");

    location.className =
      "agenda-event-location";

    const icon =
      document.createElement("span");

    icon.className =
      "agenda-location-icon";

    icon.textContent =
      "📍";

    const text =
      document.createElement("span");

    text.textContent =
      event.location;

    location.append(
      icon,
      text
    );

    main.appendChild(location);
  }

  article.append(
    dot,
    time,
    main
  );

  return article;
}

function formatTime(event) {
  if (event.isAllDay) {
    return "Hele dag";
  }

  const startText =
    formatClock(event.start);

  if (!event.end) {
    return startText;
  }

  return `${startText} – ${formatClock(event.end)}`;
}

function formatClock(date) {
  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(date);
}

function startOfDay(date) {
  const result =
    new Date(date);

  result.setHours(
    0,
    0,
    0,
    0
  );

  return result;
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(key) {
  const [
    year,
    month,
    day
  ] = key.split("-").map(Number);

  return new Date(
    year,
    month - 1,
    day
  );
}

function dateTimeKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0")
  ].join("");
}

function cleanText(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function setStatus(text, type) {
  statusElement.textContent =
    text;

  statusElement.className =
    "agenda-status";

  if (type) {
    statusElement.classList.add(type);
  }
}
