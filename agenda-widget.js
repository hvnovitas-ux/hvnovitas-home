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
     De oorspronkelijke Google Agenda-tijd bewaren.
     Bijvoorbeeld:
     19:00 - 20:00
  */

  const originalStart =
    event.startDate;


  const originalEnd =
    event.endDate;


  const startHour =
    originalStart
      ? originalStart.hour
      : 0;


  const startMinute =
    originalStart
      ? originalStart.minute
      : 0;


  const startSecond =
    originalStart
      ? originalStart.second
      : 0;


  let duration =
    0;


  if (
    originalStart &&
    originalEnd
  ) {

    duration =
      originalEnd.toJSDate().getTime() -
      originalStart.toJSDate().getTime();

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
       Alleen kijken naar de recurrence-datum.
    */

    if (
      next.compare(
        rangeEnd
      ) >= 0
    ) {

      break;

    }


    /*
       Datum van de recurrence.
       Tijd nemen we NIET uit next.
    */

    const start =
      new Date(
        next.year,
        next.month - 1,
        next.day,
        startHour,
        startMinute,
        startSecond
      );


    /*
       Buiten de 14 dagen?
    */

    if (
      start < today ||
      start >= endDate
    ) {

      continue;

    }


    /*
       Eindtijd berekenen vanuit de
       oorspronkelijke duur.
    */

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
       All-day blijft all-day.
    */

    const isAllDay =
      originalStart
        ? originalStart.isDate
        : false;


    addOccurrence(
      event,
      null,
      start,
      end,
      groups,
      isAllDay
    );

  }

}
