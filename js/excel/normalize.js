import { GENERATED_SHEETS, REQUIRED_TIMETABLE_FIELDS } from "../config/constants.js";
import { buildHeaderMap, validateTimetableHeaders, mapTimetableRows } from "./column-map.js";
import { XLSX } from "./xlsx.js";

const STAFF_HINTS = ["staff", "tutor", "employee"];
const ROOM_HINTS = ["room", "venue", "capacity"];
const ASSESSMENT_HINTS = ["assessment", "exam", "schedule"];

export function normalizeHeader(value) {
  return String(value ?? "").trim();
}

export function sheetToRows(sheet) {
  if (!sheet || !sheet["!ref"]) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  return rows.map((row) => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = value;
    }
    return normalized;
  });
}

export function headersFromSheet(sheet) {
  if (!sheet || !sheet["!ref"]) return [];
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c })];
    headers.push(normalizeHeader(cell?.v ?? ""));
  }
  return headers.filter(Boolean);
}

function hasMappedFields(headers, fields) {
  const map = buildHeaderMap(headers);
  const found = new Set(Object.values(map));
  return fields.every((f) => found.has(f));
}

export function classifySheet(headers, sheetName, filename) {
  const name = `${sheetName} ${filename}`.toLowerCase();
  if (hasMappedFields(headers, REQUIRED_TIMETABLE_FIELDS)) return "timetable";
  if (STAFF_HINTS.some((h) => name.includes(h)) && hasMappedFields(headers, ["Staff"])) return "staff";
  if (ROOM_HINTS.some((h) => name.includes(h)) && hasMappedFields(headers, ["Room", "Campus"])) return "rooms";
  if (ASSESSMENT_HINTS.some((h) => name.includes(h))) return "assessmentSchedule";
  if (name.includes("timetable")) return "timetable";
  if (name.includes("staff")) return "staff";
  if (name.includes("room")) return "rooms";
  return "unknown";
}

export function normalizeTimetableRows(rows, headers) {
  return mapTimetableRows(rows, headers);
}

export function pickBestSheet(workbook, filename) {
  let best = { sheetName: workbook.SheetNames[0], type: "unknown", score: 0, headers: [] };
  for (const sheetName of workbook.SheetNames) {
    if (sheetName.startsWith("_") || GENERATED_SHEETS.has(sheetName)) continue;
    const headers = headersFromSheet(workbook.Sheets[sheetName]);
    const type = classifySheet(headers, sheetName, filename);
    const validation = type === "timetable" ? validateTimetableHeaders(headers) : { ok: type !== "unknown" };
    let score =
      type === "timetable" ? (validation.ok ? 12 : 8) :
      type === "staff" ? 5 :
      type === "rooms" ? 5 :
      type === "assessmentSchedule" ? 5 : 1;
    if (sheetName.toLowerCase().includes("timetable")) score += 2;
    if (score > best.score) best = { sheetName, type, score, headers, validation };
  }
  return best;
}

export { validateTimetableHeaders, buildHeaderMap };
