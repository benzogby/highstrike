// The NYSE calendar the homepage needs: which days are sessions, which session
// a morning price snapshot belongs to, and when the next bell rings. Holidays
// and 1 p.m. closes are from nyse.com/markets/hours-calendars; add each new
// year's dates here. Past the listed years every weekday counts as a session.

const HOLIDAYS = new Set([
  // 2026
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
  "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  // 2027
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31",
  "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);

const EARLY_CLOSES = new Set(["2026-11-27", "2026-12-24", "2027-11-26"]);

const ZONE = "America/New_York";

export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isSession(iso: string) {
  const day = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6 && !HOLIDAYS.has(iso);
}

// price_history is snapshotted each morning by the generate-setups cron, so a
// row dated D holds the close of the last session before D.
export function sessionBefore(iso: string) {
  let d = addDays(iso, -1);
  while (!isSession(d)) d = addDays(d, -1);
  return d;
}

// The New York wall clock at an instant, as a date and minutes past midnight.
function newYork(at: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute) + Number(parts.second) / 60,
  };
}

// The instant of a New York wall-clock time on a given date: read the wall time
// as if it were UTC, see what New York shows then, and shift by the difference.
function instant(iso: string, minutes: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minutes);
  const shown = newYork(wall);
  const [sy, sm, sd] = shown.date.split("-").map(Number);
  return wall + (wall - (Date.UTC(sy, sm - 1, sd) + shown.minutes * 60000));
}

const OPEN = 9 * 60 + 30;

export type Bell = {
  kind: "open" | "close";
  // when it rings
  at: number;
  // the session's date in New York
  day: string;
  // "9:30", "4:00" or "1:00", New York time
  time: string;
};

// The next opening or closing bell after `now`.
export function nextBell(now: number): Bell {
  const { date, minutes } = newYork(now);
  if (isSession(date)) {
    const close = EARLY_CLOSES.has(date) ? 13 * 60 : 16 * 60;
    if (minutes < OPEN) return { kind: "open", at: instant(date, OPEN), day: date, time: "9:30" };
    if (minutes < close) return { kind: "close", at: instant(date, close), day: date, time: close === 13 * 60 ? "1:00" : "4:00" };
  }
  let day = addDays(date, 1);
  while (!isSession(day)) day = addDays(day, 1);
  return { kind: "open", at: instant(day, OPEN), day, time: "9:30" };
}

export function newYorkDate(now: number) {
  return newYork(now).date;
}
