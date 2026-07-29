const SEOUL_TIME_ZONE = 'Asia/Seoul';

function partsFor(date, options) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: SEOUL_TIME_ZONE,
      ...options
    }).formatToParts(date).map((part) => [part.type, part.value])
  );
}

export function getSeoulNow(date = new Date()) {
  const parts = partsFor(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  return {
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
    dateLabel: `${parts.year}/${parts.month}/${parts.day}`,
    timeLabel: `${parts.hour}:${parts.minute}:${parts.second}`,
    minuteKey: `${parts.hour}:${parts.minute}`,
    weekday: formatWeekday(parts.weekday)
  };
}

export function selectTripDay(itinerary = [], date = new Date()) {
  if (!itinerary.length) return { day: null, index: -1, phase: 'empty', daysUntil: 0 };

  const seoulNow = getSeoulNow(date);
  const normalized = itinerary.map((day) => ({ ...day, isoDate: normalizeTripDate(day.date) }));
  const exactIndex = normalized.findIndex((day) => day.isoDate === seoulNow.isoDate);
  if (exactIndex >= 0) {
    return { day: itinerary[exactIndex], index: exactIndex, phase: 'today', daysUntil: 0 };
  }

  const firstDate = normalized[0].isoDate;
  const lastDate = normalized[normalized.length - 1].isoDate;
  if (firstDate && seoulNow.isoDate < firstDate) {
    return {
      day: itinerary[0],
      index: 0,
      phase: 'upcoming',
      daysUntil: calendarDayDifference(seoulNow.isoDate, firstDate)
    };
  }

  if (lastDate && seoulNow.isoDate > lastDate) {
    return {
      day: itinerary[itinerary.length - 1],
      index: itinerary.length - 1,
      phase: 'finished',
      daysUntil: 0
    };
  }

  const nextIndex = normalized.findIndex((day) => day.isoDate && day.isoDate > seoulNow.isoDate);
  const safeIndex = nextIndex >= 0 ? nextIndex : 0;
  return {
    day: itinerary[safeIndex],
    index: safeIndex,
    phase: 'upcoming',
    daysUntil: calendarDayDifference(seoulNow.isoDate, normalized[safeIndex].isoDate)
  };
}

export function findNextStop(day, date = new Date(), phase = 'today') {
  if (!day?.stops?.length) return null;
  if (phase === 'upcoming') return day.stops[0];
  if (phase === 'finished') return null;

  const nowTime = getSeoulNow(date).minuteKey;
  return [...day.stops]
    .filter((stop) => /^\d{2}:\d{2}$/.test(stop.time || ''))
    .sort((left, right) => left.time.localeCompare(right.time))
    .find((stop) => stop.time >= nowTime) || null;
}

export function deriveTripDuration(dateRange, fallback = '') {
  const matched = String(dateRange || '').match(
    /(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s*[–—~-]\s*(?:(\d{4})[/-])?(\d{1,2})[/-](\d{1,2})/
  );
  if (!matched) return fallback;

  const startYear = Number(matched[1]);
  const endYear = Number(matched[4] || matched[1]);
  const start = Date.UTC(startYear, Number(matched[2]) - 1, Number(matched[3]));
  const end = Date.UTC(endYear, Number(matched[5]) - 1, Number(matched[6]));
  const nights = Math.round((end - start) / 86400000);
  return nights >= 0 ? `${nights + 1} 天 ${nights} 夜` : fallback;
}

function normalizeTripDate(value = '') {
  const matched = String(value).match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!matched) return '';
  return `${matched[1]}-${matched[2].padStart(2, '0')}-${matched[3].padStart(2, '0')}`;
}

function calendarDayDifference(fromIso, toIso) {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.max(0, Math.round((to - from) / 86400000));
}

function formatWeekday(value = '') {
  const labels = {
    Mon: '星期一',
    Tue: '星期二',
    Wed: '星期三',
    Thu: '星期四',
    Fri: '星期五',
    Sat: '星期六',
    Sun: '星期日'
  };
  return labels[value] || value;
}
