/** Parse QAHE matrix-style assessment schedule sheets into normalised events. */

import {
  deriveAssessmentFormat,
  enrichAssessmentEvent,
  enrichAssessmentEvents,
  extractDueAndFeedback,
  extractMainTitleLine,
  parseUkDateFragment as parseUkDateFragmentFmt,
  resolveAssessmentDateFields as resolveAssessmentDateFieldsFmt,
  resolveSchedulingBasis,
} from "./assessment-format.js";

export {
  deriveAssessmentFormat,
  enrichAssessmentEvent,
  enrichAssessmentEvents,
  resolveSchedulingBasis,
};

const MODULE_CODE_RE = /^[A-Z]{3}\d{3}[A-Z]?$/i;
const WEEK_ROW_RE = /^Week\s*(-?\d+)/i;

/**
 * @typedef {Object} AssessmentEvent
 * @property {string} id
 * @property {string} moduleCode
 * @property {string} moduleName
 * @property {string} semester
 * @property {string} scheduleTitle
 * @property {string} weekLabel
 * @property {number} weekNumber
 * @property {string} weekCommencing
 * @property {string} assessmentCode
 * @property {string} assessmentType
 * @property {string} assessmentFormat
 * @property {"weekCommencing"|"fixedDeadline"|"mixed"|"notSpecified"} schedulingBasis
 * @property {string} exactDueDate
 * @property {string} title
 * @property {string} weight
 * @property {string} dueText
 * @property {string} dueDate
 * @property {string} feedbackText
 * @property {string} feedbackDate
 * @property {string} rawText
 * @property {boolean} suggestsClassTest
 * @property {string} sheetName
 */

function cellText(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatIsoDate(value);
  }
  return String(value ?? "").trim();
}

function formatIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseUkDateFragment(text) {
  return parseUkDateFragmentFmt(text);
}

export function classifyAssessmentType(text) {
  const t = String(text ?? "").toLowerCase();
  if (/practical skills|during week \d+ lab|week \d+ lab class|lab class/i.test(t)) {
    return "classTest";
  }
  if (/set exercise/i.test(t) && /lab|during week \d+/i.test(t)) {
    return "classTest";
  }
  if (/set exercise/i.test(t) && !/\bdue:\s*(?:\d{1,2}(?:st|nd|rd|th)?\s+\w+|\d{4})/i.test(t)) {
    return "classTest";
  }
  if (/presentation|viva|oral examination|oral exam/i.test(t)) {
    return "presentation";
  }
  if (/report|written assignment|project|portfolio|essay|submission|deadline|supplementary material|research paper/i.test(t)) {
    return "submission";
  }
  if (/\bexam\b/i.test(t)) return "exam";
  return "other";
}

export function suggestsClassTest(type, text) {
  if (type === "classTest") return true;
  const t = String(text ?? "").toLowerCase();
  if (/set exercise/i.test(t) && !/\bdue:\s*(?:\d{1,2}(?:st|nd|rd|th)?\s+\w+|\d{4})/i.test(t)) {
    return true;
  }
  return /during week \d+ lab|week \d+ lab classes|practical skills assessment/i.test(t);
}

function parseAssessmentBlock(rawText, context) {
  const text = String(rawText ?? "").trim();
  if (!text) return null;

  const assessmentCode = (text.match(/^(CW\d[ab]?)/i) || text.match(/\b(CW\d[ab]?)\b/i))?.[1]?.toUpperCase() || "";
  const weightMatch = text.match(/\((\d+(?:\.\d+)?)\s*%\)/);
  const weight = weightMatch ? `${weightMatch[1]}%` : "";
  const { dueText, dueParts, feedbackText } = extractDueAndFeedback(text);
  const titleLine = extractMainTitleLine(text);
  const assessmentType = classifyAssessmentType(text);
  const classTest = suggestsClassTest(assessmentType, text);
  const assessmentFormat = deriveAssessmentFormat(text, titleLine, assessmentCode);
  const exactFromDue = dueParts.map(parseUkDateFragment).find(Boolean) || parseUkDateFragment(dueText);

  const id = [
    context.moduleCode,
    context.weekLabel,
    assessmentCode || titleLine.slice(0, 20),
    context.col,
  ].join("|");

  const base = {
    id,
    moduleCode: context.moduleCode,
    moduleName: context.moduleName,
    semester: normalizeSemesterNumber(context.semester),
    scheduleTitle: context.scheduleTitle,
    weekLabel: context.weekLabel,
    weekNumber: context.weekNumber,
    weekCommencing: context.weekCommencing || "",
    assessmentCode,
    assessmentType,
    assessmentFormat,
    title: titleLine,
    weight,
    dueText,
    dueDate: exactFromDue || "",
    feedbackText,
    feedbackDate: parseUkDateFragment(feedbackText),
    rawText: text,
    suggestsClassTest: classTest,
    sheetName: context.sheetName,
    course: context.course || "",
    crn: context.crn || "",
    moduleCoordinator: context.moduleCoordinator || "",
    qaheModuleLeader: context.qaheModuleLeader || "",
  };

  return enrichAssessmentEvent(base);
}

function splitAssessmentBlocks(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return [];
  const parts = raw.split(/\n(?=\s*CW\d)/i).map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts : [raw];
}

function findScheduleTitle(grid) {
  for (let r = 0; r < Math.min(grid.length, 3); r++) {
    for (const cell of grid[r] || []) {
      const text = cellText(cell);
      if (/assessment schedule/i.test(text)) return text;
    }
  }
  return "";
}

/** Map "One"/"Two"/… or "Semester 1" → numeric string "1", "2", … */
export function normalizeSemesterNumber(value) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  if (/^\d+$/.test(s)) return s;

  const words = {
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    first: "1",
    second: "2",
    third: "3",
  };

  const lower = s.toLowerCase().replace(/^semester\s*/i, "").replace(/["']/g, "").trim();
  if (words[lower]) return words[lower];
  if (/^\d+$/.test(lower)) return lower;

  const match = s.match(/semester\s*["']?(one|two|three|four|five|\d+)/i);
  if (match) return words[match[1].toLowerCase()] || match[1];

  return s;
}

function semesterAt(grid, rowIndex, colIndex) {
  for (let r = rowIndex; r >= Math.max(0, rowIndex - 4); r--) {
    for (let c = colIndex; c >= 0; c--) {
      const text = cellText(grid[r][c]);
      const match = text.match(/Semester\s*["']?(One|Two|Three|Four|Five|\d+)/i);
      if (match) return normalizeSemesterNumber(match[1]);
    }
  }
  return "";
}

const MODULE_META_LABELS = [
  { key: "course", re: /^(course|programme|program|course\s*\/\s*programme)$/i },
  { key: "crn", re: /^crn$/i },
  { key: "moduleCoordinator", re: /^(module\s*coordinator|coordinator)$/i },
  { key: "qaheModuleLeader", re: /^(qahe\s*module\s*leader|module\s*leader)$/i },
];

/** Scan nearby label cells in the Module Code column for course/CRN/coordinator rows. */
function findModuleMetaRows(grid, labelCol, codeRow) {
  /** @type {Record<string, number>} */
  const rows = { name: -1 };
  const from = Math.max(0, codeRow - 2);
  const to = Math.min(grid.length - 1, codeRow + 12);
  for (let r = from; r <= to; r++) {
    const label = cellText(grid[r]?.[labelCol]);
    if (!label) continue;
    if (/^Module Name$/i.test(label)) rows.name = r;
    for (const meta of MODULE_META_LABELS) {
      if (meta.re.test(label)) rows[meta.key] = r;
    }
  }
  return rows;
}

function findModuleColumns(grid) {
  /** @type {Array<{col:number, row:number, code:string, name:string, semester:string, course:string, crn:string, moduleCoordinator:string, qaheModuleLeader:string}>} */
  const modules = [];

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] || [];
    for (let c = 0; c < row.length; c++) {
      if (!/^Module Code$/i.test(cellText(row[c]))) continue;

      const metaRows = findModuleMetaRows(grid, c, r);

      for (let mc = c + 1; mc < row.length; mc++) {
        const code = cellText(row[mc]).toUpperCase();
        if (!code) {
          if (modules.length && modules[modules.length - 1].row === r) break;
          continue;
        }
        if (/^Module Code$/i.test(code) || /^Semester/i.test(code)) break;

        if (!MODULE_CODE_RE.test(code)) continue;

        const moduleName = metaRows.name >= 0 ? cellText(grid[metaRows.name][mc]) : "";
        modules.push({
          col: mc,
          row: r,
          code,
          name: moduleName,
          semester: semesterAt(grid, r, mc),
          course: metaRows.course >= 0 ? cellText(grid[metaRows.course][mc]) : "",
          crn: metaRows.crn >= 0 ? cellText(grid[metaRows.crn][mc]) : "",
          moduleCoordinator:
            metaRows.moduleCoordinator >= 0 ? cellText(grid[metaRows.moduleCoordinator][mc]) : "",
          qaheModuleLeader:
            metaRows.qaheModuleLeader >= 0 ? cellText(grid[metaRows.qaheModuleLeader][mc]) : "",
        });
      }
    }
  }

  const seen = new Set();
  return modules.filter((m) => {
    const key = `${m.code}|${m.col}|${m.semester}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseWeekRow(row) {
  const label = cellText(row[0]) || cellText(row[1]);
  const weekMatch = label.match(WEEK_ROW_RE);
  if (!weekMatch) return null;

  const weekNumber = Number(weekMatch[1]);
  const weekLabel = `Week ${weekNumber}`;
  let weekCommencing = "";

  for (let c = 1; c < Math.min(row.length, 4); c++) {
    const text = cellText(row[c]);
    if (WEEK_ROW_RE.test(text)) continue;
    const parsed = parseUkDateFragment(text) || (row[c] instanceof Date ? formatIsoDate(row[c]) : "");
    if (parsed) {
      weekCommencing = parsed;
      break;
    }
  }

  return { weekLabel, weekNumber, weekCommencing };
}

/**
 * @param {unknown[][]} grid
 * @param {string} sheetName
 * @returns {AssessmentEvent[]}
 */
export function parseAssessmentGrid(grid, sheetName = "") {
  if (!grid?.length) return [];

  const scheduleTitle = findScheduleTitle(grid);
  const modules = findModuleColumns(grid);
  /** @type {AssessmentEvent[]} */
  const events = [];

  for (let r = 0; r < grid.length; r++) {
    const week = parseWeekRow(grid[r] || []);
    if (!week) continue;

    for (const mod of modules) {
      const cell = cellText(grid[r]?.[mod.col]);
      if (!cell) continue;

      for (const block of splitAssessmentBlocks(cell)) {
        const event = parseAssessmentBlock(block, {
          moduleCode: mod.code,
          moduleName: mod.name,
          semester: mod.semester,
          scheduleTitle,
          weekLabel: week.weekLabel,
          weekNumber: week.weekNumber,
          weekCommencing: week.weekCommencing,
          sheetName,
          col: mod.col,
          course: mod.course || "",
          crn: mod.crn || "",
          moduleCoordinator: mod.moduleCoordinator || "",
          qaheModuleLeader: mod.qaheModuleLeader || "",
        });
        if (event) events.push(event);
      }
    }
  }

  return enrichAssessmentEvents(events).sort(
    (a, b) =>
      a.moduleCode.localeCompare(b.moduleCode) ||
      a.weekNumber - b.weekNumber ||
      a.assessmentCode.localeCompare(b.assessmentCode)
  );
}

/** One row per module + week + assessment code — prefer the cohort that matches the teaching semester. */
export function dedupeAssessmentEvents(events, { semesterStart = "" } = {}) {
  if (!events?.length) return [];

  const startYear = semesterStart ? Number(String(semesterStart).slice(0, 4)) : null;
  const byKey = new Map();

  for (const event of events) {
    const key = assessmentEventKey(event);
    const existing = byKey.get(key);
    byKey.set(key, existing ? pickPreferredAssessmentEvent(existing, event, startYear) : event);
  }

  return [...byKey.values()]
    .map((event) => ({ ...event, id: canonicalAssessmentEventId(event) }))
    .sort(
      (a, b) =>
        a.moduleCode.localeCompare(b.moduleCode) ||
        a.weekNumber - b.weekNumber ||
        a.assessmentCode.localeCompare(b.assessmentCode)
    );
}

export function assessmentEventKey(event) {
  const code = String(event.moduleCode ?? "").trim().toUpperCase();
  const week = String(event.weekLabel ?? "").trim() || (event.weekNumber ? `Week ${event.weekNumber}` : "");
  const assessment = String(event.assessmentCode ?? "").trim().toUpperCase() || extractAssessmentCode(event.title);
  return `${code}|${week}|${assessment}`;
}

export function canonicalAssessmentEventId(event) {
  return `${assessmentEventKey(event)}|Assessment Events`;
}

function scoreAssessmentEvent(event, startYear) {
  let score = 0;
  const dueYear = event.dueDate ? Number(String(event.dueDate).slice(0, 4)) : 0;
  const weekYear = event.weekCommencing ? Number(String(event.weekCommencing).slice(0, 4)) : 0;

  if (startYear) {
    if (dueYear === startYear) score += 12;
    else if (dueYear && dueYear < startYear - 1) score -= 15;
    else if (dueYear && dueYear < startYear) score -= 8;
    if (weekYear === startYear) score += 6;
  }

  const sheet = String(event.sheetName ?? "");
  if (/S2|S3/i.test(sheet)) score += 5;
  if (/^"?S1"?/i.test(sheet) && !/S2|S3/i.test(sheet)) score -= 4;

  if (event.dueDate) score += 2;
  if (String(event.rawText ?? "").length > 40) score += 1;
  if (event.suggestsClassTest) score += 1;
  return score;
}

function pickPreferredAssessmentEvent(a, b, startYear) {
  const sa = scoreAssessmentEvent(a, startYear);
  const sb = scoreAssessmentEvent(b, startYear);
  if (sb !== sa) return sb > sa ? b : a;
  return String(b.rawText ?? "").length >= String(a.rawText ?? "").length ? b : a;
}

/**
 * @param {import('./xlsx.js').XLSX} XLSX
 * @param {object} sheet
 * @param {string} sheetName
 */
export function parseAssessmentSheet(XLSX, sheet, sheetName, options = {}) {
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
  const events = dedupeAssessmentEvents(parseAssessmentGrid(grid, sheetName), options);
  return {
    events,
    rows: events.map(eventToRow),
    headers: ASSESSMENT_EXPORT_COLUMNS,
  };
}

/** True when sheet uses dashboard export columns (saved workbook), not the matrix layout. */
export function isNormalizedAssessmentExport(headers) {
  const lower = headers.map((h) => String(h ?? "").trim().toLowerCase());
  return lower.includes("module code") && (lower.includes("week") || lower.includes("assessment"));
}

function extractAssessmentCode(value) {
  const match = String(value ?? "").match(/\b(CW\d[ab]?)\b/i);
  return match ? match[1].toUpperCase() : "";
}

function normalizeExportType(value) {
  const t = String(value ?? "").trim();
  const lower = t.toLowerCase();
  if (["classTest", "presentation", "submission", "exam", "other"].includes(t)) return t;
  if (lower.includes("class test") || lower.includes("lab")) return "classTest";
  if (lower.includes("presentation")) return "presentation";
  if (lower.includes("submission")) return "submission";
  if (lower.includes("exam")) return "exam";
  return "other";
}

function truthyExport(value) {
  const s = String(value ?? "").trim().toLowerCase();
  return s === "yes" || s === "true" || s === "1" || s === "y";
}

/** Restore assessment events from Assessment Events sheet or exported module sheets. */
export function parseAssessmentEventsFromExportRows(rows, sheetName = "", options = {}) {
  const events = [];
  for (const row of rows) {
    const moduleCode = String(row["Module code"] ?? "").trim().toUpperCase();
    if (!moduleCode) continue;

    const weekLabel = String(row["Teaching week"] ?? row.Week ?? row["Test week"] ?? "").trim();
    const weekMatch = weekLabel.match(/Week\s*(\d+)/i);
    const weekNumber = weekMatch ? Number(weekMatch[1]) : 0;
    const assessmentType = normalizeExportType(row.Type);
    const rawText = String(row.Details ?? row.Due ?? row.Assessment ?? "").trim();
    const assessmentCode = extractAssessmentCode(row.Assessment) || extractAssessmentCode(rawText);

    const event = {
      id: String(row["Event ID"] ?? "").trim() || `${moduleCode}|${weekLabel}|${assessmentCode}|${sheetName}`,
      moduleCode,
      moduleName: String(row["Module name"] ?? "").trim(),
      semester: normalizeSemesterNumber(row.Semester ?? ""),
      scheduleTitle: "",
      weekLabel: weekLabel || (weekNumber ? `Week ${weekNumber}` : ""),
      weekNumber,
      weekCommencing: String(row["Week commencing"] ?? "").slice(0, 10),
      assessmentCode,
      assessmentType,
      assessmentFormat: String(row["Assessment format"] ?? row.Type ?? "").trim(),
      schedulingBasis: String(row["Scheduling basis"] ?? "").trim(),
      title: String(row.Assessment ?? rawText).split("\n")[0].trim(),
      weight: String(row.Weight ?? "").trim(),
      dueText: String(row["Due (source text)"] ?? row.Due ?? "").trim(),
      dueDate: String(row["Exact due date"] ?? row["Due date"] ?? row["Planning date"] ?? "").slice(0, 10),
      exactDueDate: String(row["Exact due date"] ?? "").slice(0, 10),
      feedbackText: String(row.Feedback ?? "").trim(),
      feedbackDate: "",
      rawText: rawText || String(row.Assessment ?? "").trim(),
      suggestsClassTest: truthyExport(row["Class test candidate"]) || assessmentType === "classTest",
      sheetName: String(row.Sheet ?? sheetName).trim(),
    };
    if (!event.suggestsClassTest && rawText) {
      event.suggestsClassTest = suggestsClassTest(event.assessmentType, rawText);
    }
    if (!event.assessmentType || event.assessmentType === "other") {
      event.assessmentType = classifyAssessmentType(event.rawText || event.title);
    }
    events.push(event);
  }

  const deduped = enrichAssessmentEvents(dedupeAssessmentEvents(events, options));
  return {
    events: deduped,
    rows: deduped.map(eventToRow),
    headers: ASSESSMENT_EXPORT_COLUMNS,
  };
}

/** Skip duplicate assessment copies created when saving a workbook. */
export function isDuplicateAssessmentExportSheet(sheetName) {
  return isAssessmentMatrixSheetName(sheetName);
}

/** QAHE matrix tabs and renamed copies — not needed in saved workbooks. */
export function isAssessmentMatrixSheetName(sheetName) {
  const n = String(sheetName ?? "").trim();
  if (!n) return false;
  if (/modules\s*\(/i.test(n)) return true;
  if (/^"S\d/i.test(n) && /modules/i.test(n)) return true;
  if (/^S\d/i.test(n) && /modules/i.test(n)) return true;
  return false;
}

/** Prior-save assessment copies (keep canonical Assessment Events only). */
export function isRedundantAssessmentExportSheet(sheetName) {
  const n = String(sheetName ?? "").trim();
  if (n === "Assessment Events") return false;
  if (/^Assessment Events\s*\(/i.test(n)) return true;
  return isAssessmentMatrixSheetName(n);
}

export const ASSESSMENT_EXPORT_COLUMNS = [
  "Module code",
  "Module name",
  "Semester",
  "Teaching week",
  "Week commencing",
  "Assessment",
  "Type",
  "Assessment format",
  "Scheduling basis",
  "Weight",
  "Exact due date",
  "Date type",
  "Planning date",
  "Due (source text)",
  "Feedback",
  "Class test candidate",
  "Details",
  "Sheet",
];

export function resolveAssessmentDateFields(event) {
  return resolveAssessmentDateFieldsFmt(event);
}

function eventToRow(event) {
  const enriched = enrichAssessmentEvent(event);
  const dates = resolveAssessmentDateFields(enriched);
  return {
    "Module code": enriched.moduleCode,
    "Module name": enriched.moduleName,
    Semester: normalizeSemesterNumber(enriched.semester),
    "Teaching week": enriched.weekLabel,
    "Week commencing": dates.weekCommencing,
    Assessment: enriched.assessmentCode || enriched.title,
    Type: enriched.assessmentFormat || enriched.assessmentType,
    "Assessment format": enriched.assessmentFormat,
    "Scheduling basis": enriched.schedulingBasis,
    Weight: enriched.weight,
    "Exact due date": dates.exactDueDate,
    "Date type": dates.dateType,
    "Planning date": dates.planningDate,
    "Due (source text)": enriched.dueText,
    Feedback: enriched.feedbackText,
    "Class test candidate": enriched.suggestsClassTest ? "Yes" : "",
    Details: enriched.rawText,
    Sheet: enriched.sheetName,
  };
}

export { eventToRow };
