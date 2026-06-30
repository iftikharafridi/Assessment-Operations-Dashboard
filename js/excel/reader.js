import { XLSX } from "./xlsx.js";
import { createEmptyProject } from "../model/project.js";
import { finalizeProject } from "../model/finalize.js";
import {
  GENERATED_SHEETS,
  INVIGILATION_SHEET,
  META_SHEET,
  PLAN_SHEET,
  ASSESSMENT_TRACKING_SHEET,
  DASHBOARD_SETTINGS_SHEET,
  REPORT_ASSESSMENT_EVENTS,
  REPORT_CLASS_TEST_SCHEDULE,
} from "../config/constants.js";
import { classifySheet, headersFromSheet, pickBestSheet, sheetToRows } from "./normalize.js";
import { mapTimetableRows } from "./column-map.js";
import {
  parseAssessmentSheet,
  parseAssessmentEventsFromExportRows,
  isNormalizedAssessmentExport,
  isDuplicateAssessmentExportSheet,
  isRedundantAssessmentExportSheet,
  dedupeAssessmentEvents,
  eventToRow,
  ASSESSMENT_EXPORT_COLUMNS,
} from "./assessment-parser.js";
import { parseAssessmentTrackingFromSheet, normalizeSemesterStartDate, fillMissingTestWeeksFromSchedule } from "../analytics/assessment.js";
import { parseDashboardSettingsFromRows } from "./dashboard-settings.js";
import { normalizePlan, planKey } from "../planner/plans.js";
import { seminarLookupKey } from "../utils/seminar-match.js";

export { pickBestSheet, sheetToRows, headersFromSheet };

export function readWorkbook(buffer, filename) {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  return { workbook, filename };
}

function truthy(value) {
  if (typeof value === "boolean") return value;
  const s = String(value ?? "").trim().toLowerCase();
  return s === "yes" || s === "true" || s === "1" || s === "y";
}

export function parsePlansFromSheet(sheet) {
  const rows = sheetToRows(sheet);
  const plans = {};
  for (const row of rows) {
    const stableId = String(row["Stable session ID"] ?? "").trim();
    const legacyId = String(row["Session ID"] ?? row.ID ?? "").trim();
    const id = stableId || legacyId;
    if (!id) continue;
    plans[id] = normalizePlan({
      planned: truthy(row["Class test"] ?? row.Planned),
      testWeek: row["Test week"] ?? row["Test week/date"] ?? "",
      testDate: row["Test date"] ?? "",
      testStartTime: row["Test start time"] ?? "",
      testEndTime: row["Test end time"] ?? "",
      testDuration: row["Test duration"] ?? row["Test time"] ?? "",
      durationMinutes: row["Duration (minutes)"] ?? "",
      room: row.Room ?? "",
      roomConfirmed: truthy(row["Room confirmed"]),
      leadTutor: row["Lead tutor"] ?? "",
      invigilator: row.Invigilator ?? row["2nd invigilator"] ?? "",
      paperReady: truthy(row["Paper ready"]),
      lodReady: truthy(row["LOD/software ready"]),
      status: row.Status || "Not Planned",
      notes: row.Notes ?? "",
      _moduleCode: row["Module code"] ?? "",
    });
  }
  return plans;
}

/** Merge invigilator names saved on the Invigilation Plan sheet (legacy Session ID key). */
export function parseInvigilationPlanFromSheet(sheet) {
  const rows = sheetToRows(sheet);
  const updates = {};
  for (const row of rows) {
    const id = String(row["Session ID"] ?? row.ID ?? "").trim();
    const invigilator = String(row.Invigilator ?? row["2nd invigilator"] ?? "").trim();
    if (!id || !invigilator) continue;
    updates[id] = { invigilator, planned: true };
  }
  return updates;
}

function mergeInvigilationPlan(project, sheet) {
  if (!sheet) return 0;
  let restored = 0;
  const updates = parseInvigilationPlanFromSheet(sheet);
  for (const [id, partial] of Object.entries(updates)) {
    const current = normalizePlan(project.plans[id] || {});
    if (current.invigilator) continue;
    project.plans[id] = normalizePlan({
      ...current,
      ...partial,
      planned: current.planned || partial.planned,
    });
    restored++;
  }
  return restored;
}

export function parseClassTestScheduleInvigilators(sheet) {
  const rows = sheetToRows(sheet);
  const map = {};
  for (const row of rows) {
    const invigilator = String(row.Invigilator ?? row["2nd invigilator"] ?? "").trim();
    if (!invigilator) continue;
    const timeCell = row.Time ?? row["Seminar slot"] ?? "";
    const start = String(timeCell).match(/(\d{1,2}:\d{2})/)?.[1] || "";
    const weekday = row.Day ?? row.Weekday ?? "";
    const key = seminarLookupKey(row["Module code"], row.Campus, weekday, start);
    if (!key.replace(/\|/g, "")) continue;
    map[key] = { invigilator, planned: true };
  }
  return map;
}

function mergeScheduleInvigilators(project, sheet) {
  if (!sheet) return;
  const updates = parseClassTestScheduleInvigilators(sheet);
  if (!Object.keys(updates).length) return;
  project._scheduleInvigilators = { ...(project._scheduleInvigilators || {}), ...updates };
}

export function parseMetaFromSheet(sheet) {
  if (!sheet) return null;
  const rows = sheetToRows(sheet);
  const row = rows[0];
  if (!row?.payload) return null;
  try {
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

function assessmentDedupeOptions(project) {
  return { semesterStart: project.getSemesterStartDate() || "" };
}

function upsertAssessmentSchedule(project, filename, sheetName, events, rows, headers = ASSESSMENT_EXPORT_COLUMNS) {
  const merged = dedupeAssessmentEvents(
    [...project.getAssessmentEvents(), ...events],
    assessmentDedupeOptions(project)
  );
  const payload = {
    rows: merged.map(eventToRow),
    headers,
    events: merged,
  };

  const existing = project.datasets.assessmentSchedule[0];
  if (existing) {
    Object.assign(existing, payload);
    if (!String(existing.sheetName).includes(sheetName)) {
      existing.sheetName = `${existing.sheetName} + ${sheetName}`;
    }
    project.touch();
    return merged;
  }

  project.addDataset("assessmentSchedule", {
    filename,
    fileType: "assessmentSchedule",
    sheetName,
    uploadedAt: new Date().toISOString(),
    ...payload,
  });
  return merged;
}

export function ingestWorkbooks(files) {
  const project = createEmptyProject(deriveProjectName(files));
  const warnings = [];

  for (const { workbook, filename } of files) {
    const plansSheet = workbook.Sheets[PLAN_SHEET];
    const metaSheet = workbook.Sheets[META_SHEET];

    let invigilatorsRestored = 0;
    if (plansSheet) Object.assign(project.plans, parsePlansFromSheet(plansSheet));
    invigilatorsRestored += mergeInvigilationPlan(project, workbook.Sheets[INVIGILATION_SHEET]);
    mergeScheduleInvigilators(project, workbook.Sheets[REPORT_CLASS_TEST_SCHEDULE]);
    if (invigilatorsRestored) project._invigilatorsRestored = (project._invigilatorsRestored || 0) + invigilatorsRestored;

    const assessmentEventsSheet = workbook.Sheets[REPORT_ASSESSMENT_EVENTS];
    if (assessmentEventsSheet) {
      const exportRows = sheetToRows(assessmentEventsSheet);
      const parsed = parseAssessmentEventsFromExportRows(
        exportRows,
        REPORT_ASSESSMENT_EVENTS,
        assessmentDedupeOptions(project)
      );
      if (parsed.events.length) {
        const merged = upsertAssessmentSchedule(
          project,
          filename,
          REPORT_ASSESSMENT_EVENTS,
          parsed.events,
          parsed.rows,
          parsed.headers
        );
        warnings.push(`Restored ${merged.length} assessment items from saved "${REPORT_ASSESSMENT_EVENTS}" sheet.`);
      }
    }

    const trackingSheet = workbook.Sheets[ASSESSMENT_TRACKING_SHEET];
    if (trackingSheet) {
      const tracking = parseAssessmentTrackingFromSheet(sheetToRows(trackingSheet));
      project.assessmentTracking = {
        semesterStartDate: tracking.semesterStartDate || project.assessmentTracking.semesterStartDate,
        records: { ...project.assessmentTracking.records, ...tracking.records },
      };
    }
    if (metaSheet) {
      const meta = parseMetaFromSheet(metaSheet);
      if (meta) {
        project.name = meta.name || project.name;
        project.modules = { ...project.modules, ...(meta.modules || {}) };
        project.primaryFilename = meta.primaryFilename || filename;
        if (meta.assessmentTracking) {
          project.assessmentTracking = {
            semesterStartDate:
              normalizeSemesterStartDate(meta.assessmentTracking.semesterStartDate) ||
              project.assessmentTracking.semesterStartDate,
            records: { ...meta.assessmentTracking.records, ...project.assessmentTracking.records },
          };
        }
      }
    }

    const settingsSheet = workbook.Sheets[DASHBOARD_SETTINGS_SHEET];
    if (settingsSheet) {
      const settings = parseDashboardSettingsFromRows(sheetToRows(settingsSheet));
      if (settings.semesterStartDate) {
        project.assessmentTracking.semesterStartDate = settings.semesterStartDate;
        project._semesterStartRestored = settings.semesterStartDate;
      }
    }

    let fileLoaded = false;

    for (const sheetName of workbook.SheetNames) {
      if (GENERATED_SHEETS.has(sheetName)) continue;
      if (isDuplicateAssessmentExportSheet(sheetName)) continue;
      if (isRedundantAssessmentExportSheet(sheetName)) continue;
      if (sheetName === REPORT_ASSESSMENT_EVENTS && project.getAssessmentEvents().length) continue;

      const sheet = workbook.Sheets[sheetName];
      let headers = headersFromSheet(sheet);

      if (isNormalizedAssessmentExport(headers)) {
        const exportRows = sheetToRows(sheet);
        const parsed = parseAssessmentEventsFromExportRows(exportRows, sheetName, assessmentDedupeOptions(project));
        if (parsed.events.length && !project.getAssessmentEvents().length) {
          const merged = upsertAssessmentSchedule(
            project,
            filename,
            sheetName,
            parsed.events,
            parsed.rows,
            parsed.headers
          );
          fileLoaded = true;
          warnings.push(`Assessment schedule loaded from "${filename}" (${sheetName}): ${merged.length} items.`);
        }
        continue;
      }

      const fileType = classifySheet(headers, sheetName, filename);
      if (fileType === "unknown") continue;

      let rows = sheetToRows(sheet);
      let events = null;
      if (fileType === "timetable") {
        const result = normalizeTimetableFromSheet(rows, headers, filename, sheetName);
        rows = result.rows;
        warnings.push(...result.warnings);
        project.importValidation = result.validation;
        if (!rows.length) {
          warnings.push(`We could not read timetable rows from "${filename}" (${sheetName}).`);
          continue;
        }
      } else if (fileType === "assessmentSchedule") {
        const parsed = parseAssessmentSheet(XLSX, sheet, sheetName, assessmentDedupeOptions(project));
        if (!parsed.events.length) continue;
        const merged = upsertAssessmentSchedule(
          project,
          filename,
          sheetName,
          parsed.events,
          parsed.rows,
          parsed.headers
        );
        warnings.push(
          `Assessment schedule loaded from "${filename}" (${sheetName}): ${merged.length} items across ${new Set(merged.map((e) => e.moduleCode)).size} modules.`
        );
        fileLoaded = true;
        continue;
      }

      project.addDataset(fileType, {
        filename,
        fileType,
        sheetName,
        rows,
        headers,
        events,
        workbook,
        uploadedAt: new Date().toISOString(),
      });
      fileLoaded = true;
    }

    if (!project.datasets.timetable.some((d) => d.filename === filename)) {
      const best = pickBestSheet(workbook, filename);
      if (best.type === "timetable") {
        const rawRows = sheetToRows(workbook.Sheets[best.sheetName]);
        const result = normalizeTimetableFromSheet(rawRows, best.headers, filename, best.sheetName);
        warnings.push(...result.warnings);
        project.importValidation = result.validation;
        if (result.rows.length) {
          project.addDataset("timetable", {
            filename,
            fileType: "timetable",
            sheetName: best.sheetName,
            rows: result.rows,
            headers: best.headers,
            workbook,
            uploadedAt: new Date().toISOString(),
          });
          fileLoaded = true;
        }
      } else if (!fileLoaded) {
        warnings.push(`We couldn't find a timetable in "${filename}". Please check the file includes module, campus, weekday, and tutor columns.`);
      }
    }
  }

  project.importWarnings = [...new Set(warnings)];
  finalizeProject(project);
  appendInvigilatorWarnings(project);
  return project;
}

function appendInvigilatorWarnings(project) {
  const warnings = [...(project.importWarnings || [])];
  const restored = project._invigilatorsRestored || 0;
  if (restored) {
    warnings.push(
      `Restored ${restored} invigilator name${restored === 1 ? "" : "s"} from your saved workbook.`
    );
  }
  delete project._invigilatorsRestored;

  if (project._semesterStartRestored) {
    warnings.push(`Restored semester start date (${project._semesterStartRestored}) from your saved workbook.`);
    delete project._semesterStartRestored;
  }

  if (project._testWeeksFilled) {
    warnings.push(
      `Filled test week/date for ${project._testWeeksFilled} planned class test${project._testWeeksFilled === 1 ? "" : "s"} from the assessment schedule.`
    );
    delete project._testWeeksFilled;
  }

  const seminars = project.getTimetableRows().filter((r) => r.Type === "Seminar");
  const planned = seminars.filter((s) => normalizePlan(project.getPlan(planKey(s))).planned);
  const missing = planned.filter((s) => !normalizePlan(project.getPlan(planKey(s))).invigilator).length;
  if (planned.length && missing) {
    warnings.push(
      `${missing} planned class test${missing === 1 ? " has" : "s have"} no invigilator in this file. Assign on the Class tests tab, then Save workbook. If you edited a newer saved file, upload that file — not an older backup.`
    );
  }
  project.importWarnings = [...new Set(warnings)];
}

function normalizeTimetableFromSheet(rawRows, headers, filename, sheetName) {
  const { rows, validation } = mapTimetableRows(rawRows, headers);
  const warnings = [...validation.warnings];
  if (!validation.ok) {
    warnings.push(
      `"${filename}" (${sheetName}): some expected columns are missing (${validation.missing.join(", ")}).`
    );
  }
  return { rows, warnings, validation };
}

function deriveProjectName(files) {
  if (files.length === 1) return files[0].filename.replace(/\.xlsx?$/i, "");
  return `Assessment project (${files.length} files)`;
}
