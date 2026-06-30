/** Parse QAHE matrix-style assessment schedule sheets into normalised events. */

const MODULE_CODE_RE = /^[A-Z]{3}\d{3}[A-Z]?$/i;
const WEEK_ROW_RE = /^Week\s*(\d+)/i;

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
  const raw = String(text ?? "").trim();
  if (!raw) return "";

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;

  const match = raw.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/i);
  if (!match) return "";

  const months = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  };
  const month = months[match[2].toLowerCase()];
  if (!month) return "";
  const day = String(match[1]).padStart(2, "0");
  const monthStr = String(month).padStart(2, "0");
  return `${match[3]}-${monthStr}-${day}`;
}

export function classifyAssessmentType(text) {
  const t = String(text ?? "").toLowerCase();
  if (/practical skills|during week \d+ lab|week \d+ lab class|lab class/i.test(t)) {
    return "classTest";
  }
  if (/set exercise/i.test(t) && /lab|during week \d+/i.test(t)) {
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
  return /during week \d+ lab|week \d+ lab classes|practical skills assessment/i.test(t);
}

function parseAssessmentBlock(rawText, context) {
  const text = String(rawText ?? "").trim();
  if (!text) return null;

  const assessmentCode = (text.match(/^(CW\d[ab]?)/i) || text.match(/\b(CW\d[ab]?)\b/i))?.[1]?.toUpperCase() || "";
  const weightMatch = text.match(/\((\d+(?:\.\d+)?)\s*%\)/);
  const weight = weightMatch ? `${weightMatch[1]}%` : "";
  const dueMatch = text.match(/Due:\s*([\s\S]*?)(?:\n\s*Feedback:|$)/i);
  const feedbackMatch = text.match(/Feedback(?::|\s+by)?\s*([\s\S]*?)$/i);
  const dueText = dueMatch ? dueMatch[1].trim().replace(/\s+/g, " ") : "";
  const feedbackText = feedbackMatch ? feedbackMatch[1].trim().replace(/\s+/g, " ") : "";
  const titleLine = text.split("\n").map((l) => l.trim()).find(Boolean) || text.slice(0, 120);
  const assessmentType = classifyAssessmentType(text);
  const classTest = suggestsClassTest(assessmentType, text);

  let dueDate = parseUkDateFragment(dueText);
  if (!dueDate && /during week \d+ lab/i.test(dueText)) {
    dueDate = context.weekCommencing || "";
  }

  const id = [
    context.moduleCode,
    context.weekLabel,
    assessmentCode || titleLine.slice(0, 20),
    context.col,
  ].join("|");

  return {
    id,
    moduleCode: context.moduleCode,
    moduleName: context.moduleName,
    semester: context.semester,
    scheduleTitle: context.scheduleTitle,
    weekLabel: context.weekLabel,
    weekNumber: context.weekNumber,
    weekCommencing: context.weekCommencing,
    assessmentCode,
    assessmentType,
    title: titleLine,
    weight,
    dueText,
    dueDate,
    feedbackText,
    feedbackDate: parseUkDateFragment(feedbackText),
    rawText: text,
    suggestsClassTest: classTest,
    sheetName: context.sheetName,
  };
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

function semesterAt(grid, rowIndex, colIndex) {
  for (let r = rowIndex; r >= Math.max(0, rowIndex - 4); r--) {
    for (let c = colIndex; c >= 0; c--) {
      const text = cellText(grid[r][c]);
      const match = text.match(/Semester\s*["']?(One|Two|Three)/i);
      if (match) return match[1];
    }
  }
  return "";
}

function findModuleColumns(grid) {
  /** @type {Array<{col:number, row:number, code:string, name:string, semester:string}>} */
  const modules = [];

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] || [];
    for (let c = 0; c < row.length; c++) {
      if (!/^Module Code$/i.test(cellText(row[c]))) continue;

      let nameRow = -1;
      for (let nr = r + 1; nr < Math.min(grid.length, r + 6); nr++) {
        if (/^Module Name$/i.test(cellText(grid[nr]?.[c]))) {
          nameRow = nr;
          break;
        }
      }

      for (let mc = c + 1; mc < row.length; mc++) {
        const code = cellText(row[mc]).toUpperCase();
        if (!code) {
          if (modules.length && modules[modules.length - 1].row === r) break;
          continue;
        }
        if (/^Module Code$/i.test(code) || /^Semester/i.test(code)) break;

        if (!MODULE_CODE_RE.test(code)) continue;

        const moduleName = nameRow >= 0 ? cellText(grid[nameRow][mc]) : "";
        modules.push({
          col: mc,
          row: r,
          code,
          name: moduleName,
          semester: semesterAt(grid, r, mc),
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
        });
        if (event) events.push(event);
      }
    }
  }

  return events.sort(
    (a, b) =>
      a.moduleCode.localeCompare(b.moduleCode) ||
      a.weekNumber - b.weekNumber ||
      a.assessmentCode.localeCompare(b.assessmentCode)
  );
}

/**
 * @param {import('./xlsx.js').XLSX} XLSX
 * @param {object} sheet
 * @param {string} sheetName
 */
export function parseAssessmentSheet(XLSX, sheet, sheetName) {
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
  const events = parseAssessmentGrid(grid, sheetName);
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
export function parseAssessmentEventsFromExportRows(rows, sheetName = "") {
  const events = [];
  for (const row of rows) {
    const moduleCode = String(row["Module code"] ?? "").trim().toUpperCase();
    if (!moduleCode) continue;

    const weekLabel = String(row.Week ?? row["Test week"] ?? "").trim();
    const weekMatch = weekLabel.match(/Week\s*(\d+)/i);
    const weekNumber = weekMatch ? Number(weekMatch[1]) : 0;
    const assessmentType = normalizeExportType(row.Type);
    const rawText = String(row.Details ?? row.Due ?? row.Assessment ?? "").trim();
    const assessmentCode = extractAssessmentCode(row.Assessment) || extractAssessmentCode(rawText);

    const event = {
      id: String(row["Event ID"] ?? "").trim() || `${moduleCode}|${weekLabel}|${assessmentCode}|${sheetName}`,
      moduleCode,
      moduleName: String(row["Module name"] ?? "").trim(),
      semester: String(row.Semester ?? "").trim(),
      scheduleTitle: "",
      weekLabel: weekLabel || (weekNumber ? `Week ${weekNumber}` : ""),
      weekNumber,
      weekCommencing: String(row["Week commencing"] ?? "").slice(0, 10),
      assessmentCode,
      assessmentType,
      title: String(row.Assessment ?? rawText).split("\n")[0].trim(),
      weight: String(row.Weight ?? "").trim(),
      dueText: String(row.Due ?? "").trim(),
      dueDate: String(row["Due date"] ?? "").slice(0, 10),
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

  return {
    events,
    rows: events.map(eventToRow),
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
  "Week",
  "Week commencing",
  "Assessment",
  "Type",
  "Weight",
  "Due",
  "Due date",
  "Feedback",
  "Class test candidate",
  "Details",
  "Sheet",
];

function eventToRow(event) {
  return {
    "Module code": event.moduleCode,
    "Module name": event.moduleName,
    Semester: event.semester,
    Week: event.weekLabel,
    "Week commencing": event.weekCommencing,
    Assessment: event.assessmentCode || event.title,
    Type: event.assessmentType,
    Weight: event.weight,
    Due: event.dueText,
    "Due date": event.dueDate,
    Feedback: event.feedbackText,
    "Class test candidate": event.suggestsClassTest ? "Yes" : "",
    Details: event.rawText,
    Sheet: event.sheetName,
  };
}

export { eventToRow };
