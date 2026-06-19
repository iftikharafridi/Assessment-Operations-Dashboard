import { XLSX } from "./xlsx.js";
import { createEmptyProject } from "../model/project.js";
import { finalizeProject } from "../model/finalize.js";
import { GENERATED_SHEETS, META_SHEET, PLAN_SHEET, ASSESSMENT_TRACKING_SHEET, REPORT_ASSESSMENT_EVENTS } from "../config/constants.js";
import { classifySheet, headersFromSheet, pickBestSheet, sheetToRows } from "./normalize.js";
import { mapTimetableRows } from "./column-map.js";
import {
  parseAssessmentSheet,
  parseAssessmentEventsFromExportRows,
  isNormalizedAssessmentExport,
  isDuplicateAssessmentExportSheet,
  ASSESSMENT_EXPORT_COLUMNS,
} from "./assessment-parser.js";
import { parseAssessmentTrackingFromSheet } from "../analytics/assessment.js";
import { normalizePlan } from "../planner/plans.js";

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

export function ingestWorkbooks(files) {
  const project = createEmptyProject(deriveProjectName(files));
  const warnings = [];

  for (const { workbook, filename } of files) {
    const plansSheet = workbook.Sheets[PLAN_SHEET];
    const metaSheet = workbook.Sheets[META_SHEET];

    if (plansSheet) Object.assign(project.plans, parsePlansFromSheet(plansSheet));

    const assessmentEventsSheet = workbook.Sheets[REPORT_ASSESSMENT_EVENTS];
    if (assessmentEventsSheet) {
      const exportRows = sheetToRows(assessmentEventsSheet);
      const parsed = parseAssessmentEventsFromExportRows(exportRows, REPORT_ASSESSMENT_EVENTS);
      if (parsed.events.length) {
        project.addDataset("assessmentSchedule", {
          filename,
          fileType: "assessmentSchedule",
          sheetName: REPORT_ASSESSMENT_EVENTS,
          rows: parsed.rows,
          headers: parsed.headers,
          events: parsed.events,
          uploadedAt: new Date().toISOString(),
        });
        warnings.push(
          `Restored ${parsed.events.length} assessment items from saved "${REPORT_ASSESSMENT_EVENTS}" sheet.`
        );
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
              meta.assessmentTracking.semesterStartDate || project.assessmentTracking.semesterStartDate,
            records: { ...meta.assessmentTracking.records, ...project.assessmentTracking.records },
          };
        }
      }
    }

    let fileLoaded = false;

    for (const sheetName of workbook.SheetNames) {
      if (GENERATED_SHEETS.has(sheetName)) continue;
      if (isDuplicateAssessmentExportSheet(sheetName)) continue;
      if (sheetName === REPORT_ASSESSMENT_EVENTS && project.getAssessmentEvents().length) continue;

      const sheet = workbook.Sheets[sheetName];
      let headers = headersFromSheet(sheet);

      if (isNormalizedAssessmentExport(headers)) {
        const exportRows = sheetToRows(sheet);
        const parsed = parseAssessmentEventsFromExportRows(exportRows, sheetName);
        if (parsed.events.length && !project.getAssessmentEvents().length) {
          project.addDataset("assessmentSchedule", {
            filename,
            fileType: "assessmentSchedule",
            sheetName,
            rows: parsed.rows,
            headers: parsed.headers,
            events: parsed.events,
            uploadedAt: new Date().toISOString(),
          });
          fileLoaded = true;
          warnings.push(
            `Assessment schedule loaded from "${filename}" (${sheetName}): ${parsed.events.length} items.`
          );
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
        const parsed = parseAssessmentSheet(XLSX, sheet, sheetName);
        events = parsed.events;
        rows = parsed.rows;
        headers = ASSESSMENT_EXPORT_COLUMNS;
        if (!events.length) continue;
        if (project.getAssessmentEvents().length) continue;
        warnings.push(
          `Assessment schedule loaded from "${filename}" (${sheetName}): ${events.length} items across ${new Set(events.map((e) => e.moduleCode)).size} modules.`
        );
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
  return project;
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
