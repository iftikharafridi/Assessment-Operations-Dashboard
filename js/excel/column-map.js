import {
  COLUMN_ALIASES,
  REQUIRED_TIMETABLE_FIELDS,
  TIMETABLE_COLUMNS,
} from "../config/constants.js";
import { assignSessionIds } from "../utils/session-id.js";
import { formatExcelTime } from "../utils/time.js";

function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ");
}

/** Build a lookup from normalized header -> canonical field name */
export function buildHeaderMap(headers) {
  const map = {};
  const aliasToCanonical = {};
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    aliasToCanonical[normalizeKey(canonical)] = canonical;
    for (const alias of aliases) {
      aliasToCanonical[normalizeKey(alias)] = canonical;
    }
  }
  for (const header of headers) {
    const key = normalizeKey(header);
    if (aliasToCanonical[key]) map[header] = aliasToCanonical[key];
  }
  return map;
}

export function validateTimetableHeaders(headers) {
  const headerMap = buildHeaderMap(headers);
  const found = new Set(Object.values(headerMap));
  const missing = REQUIRED_TIMETABLE_FIELDS.filter((f) => !found.has(f));
  const hasTime = found.has("Start time") || found.has("End time") || found.has("Activity");
  if (!hasTime && !found.has("Activity")) {
    missing.push("Start time or Activity");
  }
  return {
    ok: missing.length === 0,
    missing,
    headerMap,
    warnings: missing.length
      ? [`Some expected columns were not found: ${missing.join(", ")}. We will try to continue where possible.`]
      : [],
  };
}

function inferType(row) {
  const explicit = String(row.Type || "").trim();
  if (explicit) return explicit;
  const activity = String(row.Activity || "").toUpperCase();
  if (/\bSEM\b/.test(activity)) return "Seminar";
  if (/\bLEC\b/.test(activity)) return "Lecture";
  return explicit;
}

function inferWeekday(value) {
  const day = String(value || "").trim();
  if (!day) return "";
  const match = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].find(
    (d) => d.toLowerCase().startsWith(day.toLowerCase().slice(0, 3))
  );
  return match || day;
}

/**
 * Map a raw Excel row to canonical timetable fields while preserving extras.
 */
export function mapTimetableRow(rawRow, headerMap, rowIndex) {
  const canonical = {};
  const extra = {};
  const usedHeaders = new Set();

  for (const [header, value] of Object.entries(rawRow)) {
    const field = headerMap[header];
    if (field) {
      canonical[field] = value;
      usedHeaders.add(header);
    } else if (header && !header.startsWith("_")) {
      extra[header] = value;
    }
  }

  const row = {};
  for (const col of TIMETABLE_COLUMNS) {
    let value = canonical[col] ?? "";
    if (col === "Start time" || col === "End time") value = formatExcelTime(value);
    if (col === "Weekday") value = inferWeekday(value);
    if (col === "Type") value = inferType({ ...canonical, Type: value, Activity: canonical.Activity });
    if (col === "Campus" || col === "Module code" || col === "Module name" || col === "Staff") {
      value = String(value ?? "").trim();
    }
    if (col === "ID") {
      value = value === "" ? `auto-${rowIndex + 1}` : Number(value) || value;
    }
    if (col === "Size") value = value === "" ? 0 : Number(value) || 0;
    row[col] = value;
  }

  if (!row.Type) row.Type = inferType(row);
  row._extra = extra;
  return row;
}

export function mapTimetableRows(rawRows, headers) {
  const validation = validateTimetableHeaders(headers);
  const rows = rawRows
    .map((raw, i) => mapTimetableRow(raw, validation.headerMap, i))
    .filter((r) => r["Module code"] && r.Campus);
  return { rows: assignSessionIds(rows), validation };
}
