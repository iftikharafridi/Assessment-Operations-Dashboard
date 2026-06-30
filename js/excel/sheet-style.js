import { XLSX } from "./xlsx.js";
import { TIMETABLE_COLUMNS } from "../config/constants.js";

const HEADER_FILL = "1E3A8F";
const HEADER_FONT = "FFFFFF";
const ZEBRA_FILL = "F8FAFC";
const SETTINGS_LABEL_FILL = "E0E7FF";

const PLAN_STATUS_FILLS = {
  "Not Planned": "F1F5F9",
  Planning: "DBEAFE",
  "Invigilator Needed": "FEF3C7",
  Ready: "DCFCE7",
  Completed: "E0E7FF",
  Issue: "FEE2E2",
};

const ASSESSMENT_STATUS_FILLS = {
  "Not started": "F8FAFC",
  Planning: "DBEAFE",
  "In progress": "E0E7FF",
  Ready: "DCFCE7",
  Submitted: "F3E8FF",
  Completed: "E0E7FF",
  Issue: "FEE2E2",
};

const TYPE_FILLS = {
  lecture: "DBEAFE",
  seminar: "DCFCE7",
  classtest: "FEF9C3",
  presentation: "E0E7FF",
  submission: "FCE7F3",
  exam: "FEE2E2",
  other: "F3F4F6",
};

const INVIGILATION_FILLS = {
  Available: "DCFCE7",
  "Busy / conflict": "FEE2E2",
  "Not assigned": "FEF3C7",
};

function cellStyle({ fill, font = "1E293B", bold = false } = {}) {
  const style = {
    font: { name: "Calibri", sz: 10, color: { rgb: font }, bold },
    alignment: { vertical: "top", wrapText: true },
  };
  if (fill) {
    style.fill = { patternType: "solid", fgColor: { rgb: fill } };
  }
  return style;
}

function setCellStyle(sheet, r, c, style) {
  const ref = XLSX.utils.encode_cell({ r, c });
  if (!sheet[ref]) sheet[ref] = { t: "s", v: "" };
  sheet[ref].s = style;
}

function styleHeaderRow(sheet, range) {
  for (let c = range.s.c; c <= range.e.c; c++) {
    setCellStyle(sheet, range.s.r, c, cellStyle({ fill: HEADER_FILL, font: HEADER_FONT, bold: true }));
  }
}

function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function rowFillForSheet(kind, row) {
  if (kind === "plans" || kind === "class-test-schedule") {
    const status = row.Status || row.status;
    if (status && PLAN_STATUS_FILLS[status]) return PLAN_STATUS_FILLS[status];
    if (String(row["Class test"] ?? "").toLowerCase() === "yes") return "FEF9C3";
    return null;
  }
  if (kind === "invigilation") {
    const avail = row.Availability;
    if (avail && INVIGILATION_FILLS[avail]) return INVIGILATION_FILLS[avail];
    const status = row.Status || row.status;
    if (status && PLAN_STATUS_FILLS[status]) return PLAN_STATUS_FILLS[status];
    return null;
  }
  if (kind === "missing-invigilators") return "FEF3C7";
  if (kind === "assessment-events") {
    const type = normalizeKey(row.Type);
    if (type.includes("classtest") || type.includes("class test")) return TYPE_FILLS.classtest;
    if (type.includes("presentation")) return TYPE_FILLS.presentation;
    if (type.includes("submission")) return TYPE_FILLS.submission;
    if (type.includes("exam")) return TYPE_FILLS.exam;
    if (String(row["Class test candidate"] ?? "").toLowerCase() === "yes") return TYPE_FILLS.classtest;
    return null;
  }
  if (kind === "assessment-tracking") {
    const status = row.Status || row.status;
    if (status && ASSESSMENT_STATUS_FILLS[status]) return ASSESSMENT_STATUS_FILLS[status];
    return null;
  }
  if (kind === "timetable") {
    const type = normalizeKey(row.Type);
    if (type === "lecture") return TYPE_FILLS.lecture;
    if (type === "seminar") return TYPE_FILLS.seminar;
    return null;
  }
  return null;
}

function applyZebraRows(sheet, rowCount, range, skipRow = () => false) {
  for (let i = 0; i < rowCount; i++) {
    if (i % 2 !== 1 || skipRow(i)) continue;
    const r = range.s.r + 1 + i;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!sheet[ref]) continue;
      setCellStyle(sheet, r, c, cellStyle({ fill: ZEBRA_FILL }));
    }
  }
}

function applyRowColors(sheet, rows, kind) {
  if (!sheet?.["!ref"] || !rows?.length) return sheet;
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  styleHeaderRow(sheet, range);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const r = range.s.r + 1 + i;
    const statusFill = rowFillForSheet(kind, row);
    const zebra = i % 2 === 1 ? ZEBRA_FILL : null;
    const fill = statusFill || zebra;

    for (let c = range.s.c; c <= range.e.c; c++) {
      const existing = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!existing) continue;
      setCellStyle(sheet, r, c, cellStyle({ fill }));
    }
  }
  return sheet;
}

function applySettingsSheetStyle(sheet, rows) {
  if (!sheet?.["!ref"]) return sheet;
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  styleHeaderRow(sheet, range);
  for (let i = 0; i < rows.length; i++) {
    const r = range.s.r + 1 + i;
    setCellStyle(sheet, r, range.s.c, cellStyle({ fill: SETTINGS_LABEL_FILL, bold: true }));
    for (let c = range.s.c + 1; c <= range.e.c; c++) {
      const existing = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!existing) continue;
      setCellStyle(sheet, r, c, cellStyle({ fill: i % 2 === 1 ? ZEBRA_FILL : null }));
    }
  }
  return sheet;
}

/** Apply readable widths, frozen header row, and auto-filter to exported sheets. */
export function styleWorksheet(sheet) {
  if (!sheet || !sheet["!ref"]) return sheet;

  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const colCount = range.e.c - range.s.c + 1;
  sheet["!cols"] = Array.from({ length: colCount }, (_, c) => {
    let max = 10;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      const len = cell?.v != null ? String(cell.v).length : 0;
      max = Math.max(max, Math.min(len + 2, 48));
    }
    return { wch: max };
  });

  if (range.e.r > range.s.r) {
    sheet["!autofilter"] = { ref: sheet["!ref"] };
  }
  sheet["!views"] = [{ state: "frozen", ySplit: 1, topLeftCell: "A2", activeCell: "A2" }];
  return sheet;
}

const COLORED_KINDS = new Set([
  "timetable",
  "plans",
  "class-test-schedule",
  "invigilation",
  "missing-invigilators",
  "assessment-events",
  "assessment-tracking",
]);

/** Excel limits sheet names to 31 characters; avoid duplicate-name crashes on export. */
export function uniqueSheetName(wb, desired) {
  const taken = new Set(wb.SheetNames);
  const base = String(desired || "Sheet").slice(0, 31);
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const suffix = ` (${i})`;
    const candidate = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`.slice(0, 31);
    if (!taken.has(candidate)) return candidate;
  }
  return `Sheet${Date.now() % 1e7}`.slice(0, 31);
}

/**
 * @param {'default'|'timetable'|'plans'|'class-test-schedule'|'invigilation'|'missing-invigilators'|'assessment-events'|'assessment-tracking'|'summary'|'settings'|'auxiliary'|'meta'} sheetKind
 */
export function appendStyledSheet(wb, rows, sheetName, header, sheetKind = "default") {
  const safeRows = rows?.length ? rows : [{ Note: "No rows to export." }];
  const sheet = XLSX.utils.json_to_sheet(safeRows, header?.length ? { header } : undefined);
  styleWorksheet(sheet);

  if (sheetKind === "settings") {
    applySettingsSheetStyle(sheet, safeRows);
  } else if (sheetKind === "meta") {
    styleHeaderRow(sheet, XLSX.utils.decode_range(sheet["!ref"]));
  } else if (COLORED_KINDS.has(sheetKind)) {
    applyRowColors(sheet, safeRows, sheetKind);
  } else {
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    styleHeaderRow(sheet, range);
    applyZebraRows(sheet, safeRows.length, range);
  }

  XLSX.utils.book_append_sheet(wb, sheet, uniqueSheetName(wb, sheetName));
}

export function formatExportTimestamp() {
  return new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export { TIMETABLE_COLUMNS };
