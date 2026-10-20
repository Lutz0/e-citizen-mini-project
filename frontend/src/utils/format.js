const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const shortDayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const toDate = (value) => (value instanceof Date ? value : new Date(value));

export function formatDate(value) {
  return value ? dateFormat.format(toDate(value)) : "-";
}

export function formatDateTime(value) {
  return value ? dateTimeFormat.format(toDate(value)) : "-";
}

/** "2026-10-19" (a calendar day, no time zone) -> "19 Oct" */
export function formatDayLabel(isoDay) {
  const [year, month, day] = isoDay.split("-").map(Number);
  return shortDayFormat.format(new Date(year, month - 1, day));
}

const UNITS = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "3 days ago", "yesterday", "in 2 hours", "just now" */
export function formatRelative(value, now = Date.now()) {
  const seconds = Math.round((toDate(value).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relativeFormat.format(Math.trunc(seconds / size), unit);
  }
  return "just now";
}

export function formatHours(hours) {
  if (hours === null || hours === undefined) return "-";
  if (hours < 1) return "under 1 hour";
  if (hours < 48) return `${Math.round(hours)} hours`;
  return `${(hours / 24).toFixed(1)} days`;
}

export const plural = (count, singular, pluralForm = `${singular}s`) => `${count} ${count === 1 ? singular : pluralForm}`;

export const truncate = (text, max = 110) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
