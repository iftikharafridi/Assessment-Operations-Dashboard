import {
  DASHBOARD_SHEET,
  GENERATED_SHEETS,
  INVIGILATION_SHEET,
  META_SHEET,
  PLAN_COLUMNS,
  PLAN_SHEET,
  REPORT_CAMPUS_SUMMARY,
  REPORT_CLASS_TEST_SCHEDULE,
  REPORT_MISSING_INVIGILATORS,
  REPORT_TUTOR_WORKLOAD,
  REPORT_ASSESSMENT_EVENTS,
  ASSESSMENT_TRACKING_SHEET,
} from "../config/constants.js";
import { eventToRow } from "./assessment-parser.js";
import { buildAssessmentTrackingExportRows } from "../analytics/assessment.js";
import { formatTimeRange } from "../utils/time.js";
import { normalizePlan, planKey } from "../planner/plans.js";
import {
  buildCampusSummary,
  buildClassTestSchedule,
  buildDashboardSummaryRows,
  buildMissingInvigilators,
  buildTutorWorkload,
} from "../analytics/dashboard.js";
import { buildInvigilationPlanRows } from "../analytics/invigilation.js";
import { appendStyledSheet, formatExportTimestamp } from "./sheet-style.js";
import { XLSX } from "./xlsx.js";

export function exportProjectWorkbook(project) {
  const wb = XLSX.utils.book_new();
  const primary = project.datasets.timetable[0];
  const exportedAt = formatExportTimestamp();

  if (primary?.workbook) {
    for (const sheetName of primary.workbook.SheetNames) {
      if (GENERATED_SHEETS.has(sheetName)) continue;
      XLSX.utils.book_append_sheet(wb, primary.workbook.Sheets[sheetName], sheetName);
    }
  } else if (primary?.rows?.length) {
    const exportRows = primary.rows.map(flattenRowForExport);
    const sheet = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, sheet, primary.sheetName || "Timetable");
  }

  appendAuxiliarySheets(project, wb, primary?.workbook?.SheetNames || []);

  appendStyledSheet(wb, buildPlanExportRows(project), PLAN_SHEET, PLAN_COLUMNS);
  appendStyledSheet(wb, buildInvigilationPlanRows(project), INVIGILATION_SHEET);
  appendStyledSheet(wb, buildDashboardSummaryRows(project, exportedAt), DASHBOARD_SHEET);
  appendStyledSheet(wb, buildClassTestSchedule(project), REPORT_CLASS_TEST_SCHEDULE);
  appendStyledSheet(wb, buildMissingInvigilators(project), REPORT_MISSING_INVIGILATORS);
  appendStyledSheet(wb, buildCampusSummary(project), REPORT_CAMPUS_SUMMARY);
  appendStyledSheet(wb, buildTutorWorkload(project), REPORT_TUTOR_WORKLOAD);
  if (project.getAssessmentEvents?.().length) {
    appendStyledSheet(
      wb,
      project.getAssessmentEvents().map(eventToRow),
      REPORT_ASSESSMENT_EVENTS
    );
    appendStyledSheet(wb, buildAssessmentTrackingExportRows(project), ASSESSMENT_TRACKING_SHEET);
  }
  appendStyledSheet(wb, [{ payload: JSON.stringify({ ...project.toMeta(), exportedAt }) }], META_SHEET);

  return wb;
}

function flattenRowForExport(row) {
  const { _extra, _sourceFile, _sourceId, sessionId, ...canonical } = row;
  return { ...canonical, ...(_extra || {}), "Stable session ID": sessionId };
}

function appendAuxiliarySheets(project, wb, skipSheets) {
  const skip = new Set([...skipSheets, ...GENERATED_SHEETS]);
  for (const type of ["staff", "rooms", "assessmentSchedule"]) {
    for (const ds of project.datasets[type] || []) {
      if (!ds.rows?.length) continue;
      let sheetName = ds.sheetName || type;
      if (skip.has(sheetName) || wb.SheetNames.includes(sheetName)) {
        sheetName = `${sheetName} (${ds.filename.replace(/\.xlsx?$/i, "")})`;
      }
      appendStyledSheet(wb, ds.rows, sheetName.slice(0, 31));
      skip.add(sheetName);
    }
  }
}

function buildPlanExportRows(project) {
  return project
    .getTimetableRows()
    .filter((r) => r.Type === "Seminar")
    .map((s) => {
      const plan = normalizePlan(project.getPlan(planKey(s)));
      return {
        "Stable session ID": s.sessionId,
        "Session ID": s.ID,
        "Module code": s["Module code"],
        "Module name": s["Module name"],
        Campus: s.Campus,
        "Seminar slot": `${s.Weekday} ${formatTimeRange(s["Start time"], s["End time"])}`,
        "Class test": plan.planned ? "Yes" : "No",
        "Test week": plan.testWeek,
        "Test date": plan.testDate,
        "Test start time": plan.testStartTime,
        "Test end time": plan.testEndTime,
        "Duration (minutes)": plan.durationMinutes,
        Room: plan.room || s.Room || "",
        "Room confirmed": plan.roomConfirmed ? "Yes" : "No",
        "Lead tutor": plan.leadTutor || s.Staff || "",
        Invigilator: plan.invigilator || "",
        "Paper ready": plan.paperReady ? "Yes" : "No",
        "LOD/software ready": plan.lodReady ? "Yes" : "No",
        Status: plan.status,
        Notes: plan.notes || "",
      };
    });
}

export function downloadProjectExcel(project, filename) {
  const wb = exportProjectWorkbook(project);
  const name = filename || buildExportFilename(project);
  XLSX.writeFile(wb, `${name}.xlsx`);
}

/** e.g. Timetable 2026-06-19 14-30 */
export function buildExportFilename(project) {
  const base =
    project.primaryFilename?.replace(/\.xlsx?$/i, "") ||
    project.name.replace(/[^\w\- ]+/g, "").trim() ||
    "assessment-workbook";
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const time = [String(now.getHours()).padStart(2, "0"), String(now.getMinutes()).padStart(2, "0")].join("-");
  return `${base} ${date} ${time}`;
}
