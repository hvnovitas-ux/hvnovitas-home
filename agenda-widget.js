import ICAL from "https://cdn.jsdelivr.net/npm/ical.js@2.2.1/+esm";


/* =====================================================
   INSTELLINGEN
   ===================================================== */

const FEED_URL =
  "https://novitas-agenda.hvnovitas.workers.dev/";

const DAYS_AHEAD =
  14;


/* =====================================================
   ELEMENTEN
   ===================================================== */

const statusElement =
  document.getElementById(
    "agendaStatus"
  );

const listElement =
  document.getElementById(
    "agendaList"
  );


/* =====================================================
   START
   ===================================================== */

loadAgenda();


/* =====================================================
   AGENDA LADEN
   ===================================================== */

async function loadAgenda() {

  setStatus(
    "Agenda laden...",
    ""
  );

  try {

    const response =
      await fetch(
        FEED_URL,
        {
          method: "GET",
          cache: "no-store"
        }
      );


    if (!response.ok) {

      throw new Error(
        `Agenda-server gaf HTTP ${response.status}`
      );

    }


    const icsText =
      await response.text();


    if (
      !icsText ||
      !icsText.includes(
        "BEGIN:VCALENDAR"
      )
    ) {

      throw new Error(
        "Ongeldige agenda ontvangen."
      );

    }


    const groups =
      parseCalendar(
        icsText
      );


    renderAgenda(
      groups
    );


  } catch (error) {

    console.error(
      "Agenda fout:",
      error
    );


    listElement.innerHTML =
      "";


    const errorElement =
      document.createElement(
        "div"
      );


    errorElement.className =
      "agenda-empty";


    errorElement.textContent =
      "De agenda kan op dit moment niet worden geladen.";


    listElement.appendChild(
      errorElement
    );


    setStatus(
      "Agenda niet beschikbaar.",
      "error"
    );

  }

}


/* =====================================================
   ICS VERWERKEN
   ===================================================== */

function parseCalendar(
  icsText
) {

  const parsed =
    ICAL.parse(
      icsText
    );


  const component =
    new ICAL.Component(
      parsed
    );


  const vevents =
    component.getAllSubcomponents(
      "vevent"
    );


  const today =
    startOfDay(
      new Date()
    );


  const endDate =
    new Date(
      today
    );


  endDate.setDate(
    endDate.getDate() +
    DAYS_AHEAD
  );


  const rangeStart =
    ICAL.Time.fromJSDate(
      today,
      true
    );


  const rangeEnd =
    ICAL.Time.fromJSDate(
      endDate,
      true
    );


  const groups =
    new Map();


  for (
    const vevent
    of vevents
  ) {

    try {

      const event =
        new ICAL.Event(
          vevent
        );


      if (
        event.isRecurring()
      ) {

        processRecurringEvent(
          event,
          rangeStart,
          rangeEnd,
          today,
          endDate,
          groups
        );


      } else {

        processSingleEvent(
          event,
          today,
          endDate,
          groups
        );

      }


    } catch (
      eventError
    ) {

      console.warn(
        "Agenda-item overgeslagen:",
        eventError
      );

    }

  }


  return groups;

}


/* =====================================================
   EENMALIG EVENT
   ===================================================== */

function processSingleEvent(
  event,
  today,
  endDate,
  groups
) {

  if (
    !event.startDate
  ) {

    return;

  }


  const start =
    event.startDate.toJSDate();


  if (
    start < today ||
    start >= endDate
  ) {

    return;

  }


  const end =
    event.endDate
      ? event.endDate.toJSDate()
      : null;


  addOccurrence(
    event,
    null,
    start,
    end,
    groups,
    event.startDate.isDate
  );

}


/* =====================================================
   TERUGKEREND EVENT
   ===================================================== */

function processRecurringEvent(
  event,
  rangeStart,
  rangeEnd,
  today,
  endDate,
  groups
) {

  const iterator =
    event.iterator(
      rangeStart
    );


  /*
     Bewaar de oorspronkelijke duur van het event.
     Hierdoor blijft bijvoorbeeld 19:00–20:00 behouden
     voor iedere recurrence.
  */

  let duration = 0;


  if (
    event.startDate &&
    event.endDate
  ) {

    duration =
      event.endDate.toJSDate().getTime() -
      event.startDate.toJSDate().getTime();

  }


  let next;

  let guard = 0;


  while (
    guard < 1000 &&
    (
      next =
        iterator.next()
    )
  ) {

    guard++;


    /*
       Buiten het venster stoppen.
    */

    if (
      next.compare(
        rangeEnd
      ) >= 0
    ) {

      break;

    }


    /*
       BELANGRIJK:
       Gebruik de recurrence-tijd rechtstreeks.
       Niet details.startDate, omdat die bij sommige
       Google recurring events naar 00:00 wordt gezet.
    */

    const start =
      next.toJSDate();


    if (
      start < today ||
      start >= endDate
    ) {

      continue;

    }


    let end =
      null;


    if (
      duration > 0
    ) {

      end =
        new Date(
          start.getTime() +
          duration
        );

    }


    /*
       We gebruiken details alleen nog voor
       occurrence-specifieke informatie.
    */

    let details =
      null;


    try {

      details =
        event.getOccurrenceDetails(
          next
        );

    } catch (
      occurrenceError
    ) {

      /*
         Niet fataal:
         de occurrence-tijd komt rechtstreeks
         uit "next".
      */

      console.warn(
        "Occurrence-details konden niet worden gelezen:",
        occurrenceError
      );

    }


    addOccurrence(
      event,
      details,
      start,
      end,
      groups,
      event.startDate
        ? event.startDate.isDate
        : false
    );

  }

}


/* =====================================================
   OCCURRENCE TOEVOEGEN
   ===================================================== */

function addOccurrence(
  event,
  details,
  start,
  end,
  groups,
  isAllDay = false
) {

  const dateKey =
    getDateKey(
      start
    );


  /*
     Gebruik rechtstreeks de gegevens van ICAL.Event.
     Niet details.item.getFirstPropertyValue().
  */

  const title =
    cleanText(
      event.summary ||
      "Activiteit"
    );


  const location =
    cleanText(
      event.location ||
      ""
    );


  const item = {

    title,

    location,

    start,

    end,

    isAllDay,

    type:
      getEventType(
        title
      )

  };


  if (
    !groups.has(
      dateKey
    )
  ) {

    groups.set(
      dateKey,
      []
    );

  }


  const existing =
    groups.get(
      dateKey
    );


  const duplicate =
    existing.some(
      entry =>

        entry.title ===
        item.title &&

        entry.start.getTime() ===
        item.start.getTime()

    );


  if (
    !duplicate
  ) {

    existing.push(
      item
    );

  }

}


/* =====================================================
   EVENT TYPE
   ===================================================== */

function getEventType(
  title
) {

  const normalized =
    title.toLowerCase();


  if (
    normalized.includes(
      "training"
    ) ||
    normalized.includes(
      "trainen"
    )
  ) {

    return "training";

  }


  if (
    normalized.includes(
      "wedstrijd"
    ) ||
    normalized.includes(
      "competitie"
    ) ||
    normalized.includes(
      "toernooi"
    ) ||
    normalized.includes(
      "novitas"
    )
  ) {

    return "match";

  }


  return "other";

}


/* =====================================================
   RENDEREN
   ===================================================== */

function renderAgenda(
  groups
) {

  listElement.innerHTML =
    "";


  if (
    groups.size === 0
  ) {

    const empty =
      document.createElement(
        "div"
      );


    empty.className =
      "agenda-empty";


    empty.textContent =
      "Er staan de komende 14 dagen geen activiteiten in de agenda.";


    listElement.appendChild(
      empty
    );


    setStatus(
      "Geen activiteiten de komende 14 dagen.",
      "success"
    );


    return;

  }


  const sortedDays =
    Array.from(
      groups.entries()
    ).sort(
      (a, b) =>
        a[0].localeCompare(
          b[0]
        )
    );


  let totalEvents =
    0;


  for (
    const [
      dateKey,
      events
    ]
    of sortedDays
  ) {

    events.sort(
      (a, b) =>
        a.start - b.start
    );


    totalEvents +=
      events.length;


    const dayElement =
      createDayElement(
        dateKey,
        events
      );


    listElement.appendChild(
      dayElement
    );

  }


  setStatus(

    `${totalEvents} activiteit${totalEvents === 1 ? "" : "en"} gevonden.`,

    "success"

  );

}


/* =====================================================
   DAG ELEMENT
   ===================================================== */

function createDayElement(
  dateKey,
  events
) {

  const date =
    parseDateKey(
      dateKey
    );


  const day =
    document.createElement(
      "section"
    );


  day.className =
    "agenda-day";


  const header =
    document.createElement(
      "header"
    );


  header.className =
    "agenda-day-header";


  const dateBlock =
    document.createElement(
      "div"
    );


  dateBlock.className =
    "agenda-date";


  const number =
    document.createElement(
      "div"
    );


  number.className =
    "agenda-date-number";


  number.textContent =
    date.getDate();


  const month =
    document.createElement(
      "div"
    );


  month.className =
    "agenda-date-month";


  month.textContent =
    new Intl.DateTimeFormat(
      "nl-NL",
      {
        month:
          "long"
      }
    ).format(
      date
    );


  dateBlock.append(
    number,
    month
  );


  const titleBlock =
    document.createElement(
      "div"
    );


  titleBlock.className =
    "agenda-day-title";


  const weekday =
    document.createElement(
      "div"
    );


  weekday.className =
    "agenda-weekday";


  weekday.textContent =
    new Intl.DateTimeFormat(
      "nl-NL",
      {
        weekday:
          "long"
      }
    ).format(
      date
    );


  const fullDate =
    document.createElement(
      "div"
    );


  fullDate.className =
    "agenda-full-date";


  fullDate.textContent =
    new Intl.DateTimeFormat(
      "nl-NL",
      {
        day:
          "numeric",

        month:
          "long"
      }
    ).format(
      date
    );


  titleBlock.append(
    weekday,
    fullDate
  );


  header.append(
    dateBlock,
    titleBlock
  );


  day.appendChild(
    header
  );


  for (
    const event
    of events
  ) {

    day.appendChild(
      createEventElement(
        event
      )
    );

  }


  return day;

}


/* =====================================================
   EVENT ELEMENT
   ===================================================== */

function createEventElement(
  event
) {

  const article =
    document.createElement(
      "article"
    );


  article.className =
    `agenda-event ${event.type}`;


  const dot =
    document.createElement(
      "span"
    );


  dot.className =
    "agenda-event-dot";


  dot.setAttribute(
    "aria-hidden",
    "true"
  );


  const time =
    document.createElement(
      "div"
    );


  time.className =
    "agenda-event-time";


  time.textContent =
    formatTime(
      event
    );


  const main =
    document.createElement(
      "div"
    );


  main.className =
    "agenda-event-main";


  const title =
    document.createElement(
      "div"
    );


  title.className =
    "agenda-event-title";


  title.textContent =
    event.title;


  main.appendChild(
    title
  );


  if (
    event.location
  ) {

    const location =
      document.createElement(
        "div"
      );


    location.className =
      "agenda-event-location";


    const icon =
      document.createElement(
        "span"
      );


    icon.className =
      "agenda-location-icon";


    icon.textContent =
      "📍";


    const text =
      document.createElement(
        "span"
      );


    text.textContent =
      event.location;


    location.append(
      icon,
      text
    );


    main.appendChild(
      location
    );

  }


  article.append(
    dot,
    time,
    main
  );


  return article;

}


/* =====================================================
   TIJD
   ===================================================== */

function formatTime(
  event
) {

  if (
    event.isAllDay
  ) {

    return "Hele dag";

  }


  const start =
    event.start;


  const startText =
    formatClock(
      start
    );


  if (
    !event.end
  ) {

    return startText;

  }


  const sameDay =
    start.toDateString() ===
    event.end.toDateString();


  if (
    !sameDay
  ) {

    return (
      `${startText} – ` +
      `${formatClock(event.end)}`
    );

  }


  const endText =
    formatClock(
      event.end
    );


  return (
    `${startText} – ${endText}`
  );

}


/* =====================================================
   KLOK
   ===================================================== */

function formatClock(
  date
) {

  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      hour:
        "2-digit",

      minute:
        "2-digit"
    }
  ).format(
    date
  );

}


/* =====================================================
   DATUM
   ===================================================== */

function startOfDay(
  date
) {

  const result =
    new Date(
      date
    );


  result.setHours(
    0,
    0,
    0,
    0
  );


  return result;

}


function getDateKey(
  date
) {

  const year =
    date.getFullYear();


  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );


  return (
    `${year}-${month}-${day}`
  );

}


function parseDateKey(
  key
) {

  const [
    year,
    month,
    day
  ] =
    key
      .split("-")
      .map(Number);


  return new Date(
    year,
    month - 1,
    day
  );

}


/* =====================================================
   TEKST OPSCHONEN
   ===================================================== */

function cleanText(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return "";

  }


  return String(
    value
  )
    .replace(
      /\n/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


/* =====================================================
   STATUS
   ===================================================== */

function setStatus(
  text,
  type
) {

  statusElement.textContent =
    text;


  statusElement.className =
    "agenda-status";


  if (
    type
  ) {

    statusElement.classList.add(
      type
    );

  }

}
