/** @param {string} value dd/mm/yyyy, dd-mm-yyyy, or yyyy-mm-dd */
export function parseFlexibleDate(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(`${s.slice(0, 10)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null;

  const day = Number(m[1]);
  const month = Number(m[2]) - 1;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(year, month, day, 12, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dateSortKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 0;
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export function ukDateSortKey(value) {
  return dateSortKey(parseFlexibleDate(value));
}

const ALL_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function weekdayName(date) {
  if (!(date instanceof Date)) return "";
  return ALL_WEEKDAYS[date.getDay()] || "";
}

export function weekCommencingMonday(date) {
  if (!(date instanceof Date)) return null;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function formatUkDate(date) {
  if (!(date instanceof Date)) return "";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatShortDate(date) {
  if (!(date instanceof Date)) return "";
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function parseTestWeekNumber(value) {
  const n = parseInt(String(value ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}
