import {
  PLAN_SHEET,
  PLAN_COLUMNS,
  INVIGILATION_SHEET,
  REPORT_CLASS_TEST_SCHEDULE,
  REPORT_CAMPUS_SUMMARY,
  REPORT_TUTOR_WORKLOAD,
  REPORT_MISSING_INVIGILATORS,
  REPORT_ASSESSMENT_EVENTS,
  ASSESSMENT_TRACKING_SHEET,
  DASHBOARD_SETTINGS_SHEET,
  META_SHEET,
  WEEKLY_TIMETABLE_SHEET,
  CLASS_TEST_SCHEDULE_COLUMNS,
  INVIGILATION_PLAN_COLUMNS,
  WEEKLY_TIMETABLE_COLUMNS,
  MISSING_INVIGILATOR_COLUMNS,
} from "../config/constants.js";
import {
  buildClassTestSchedule,
  buildCampusSummary,
  buildTutorWorkload,
  buildMissingInvigilators,
} from "../analytics/dashboard.js";
import { buildInvigilationPlanRows } from "../analytics/invigilation.js";
import { buildAssessmentTrackingExportRows } from "../analytics/assessment.js";
import { eventToRow, ASSESSMENT_EXPORT_COLUMNS } from "./assessment-parser.js";
import { buildDashboardSettingsRows } from "./dashboard-settings.js";
import { appendStyledSheet, formatExportTimestamp } from "./sheet-style.js";
import {
  appendTimetableSheet,
  appendAuxiliarySheets,
  buildPlanExportRows,
  buildWeeklyTimetableRows,
} from "./workbook-builders.js";
import { getWriteXlsx } from "./xlsx.js";

/** @typedef {'full'|'classTestPlans'|'classTestSchedule'|'invigilationPlan'|'weeklyTimetable'|'campusSummary'|'tutorWorkload'|'missingInvigilators'|'assessmentEvents'|'assessmentTracking'} ExportPresetId */

export const EXPORT_PRESETS = [
  {
    id: "full",
    label: "Full workbook",
    hint: "Save everything — reopen in the dashboard to continue editing",
    filenamePart: "workbook",
    isSave: true,
  },
  {
    id: "classTestSchedule",
    label: "Class test schedule",
    hint: "All planned tests with invigilation status — includes Missing Invigilators sheet when needed",
    filenamePart: "class-test-schedule",
    sheetKind: "class-test-schedule",
    build: (project) => ({
      name: REPORT_CLASS_TEST_SCHEDULE,
      rows: buildClassTestSchedule(project),
      headers: CLASS_TEST_SCHEDULE_COLUMNS,
    }),
    extraSheets: (project) => {
      const rows = buildMissingInvigilators(project);
      if (!rows.length) return [];
      return [
        {
          name: REPORT_MISSING_INVIGILATORS,
          rows,
          headers: MISSING_INVIGILATOR_COLUMNS,
          sheetKind: "missing-invigilators",
        },
      ];
    },
  },
  {
    id: "invigilationPlan",
    label: "Invigilation plan",
    hint: "Who invigilates each planned test",
    filenamePart: "invigilation-plan",
    sheetKind: "invigilation",
    build: (project) => ({
      name: INVIGILATION_SHEET,
      rows: buildInvigilationPlanRows(project),
      headers: INVIGILATION_PLAN_COLUMNS,
    }),
  },
  {
    id: "weeklyTimetable",
    label: "Weekly timetable",
    hint: "All teaching sessions sorted by day and time",
    filenamePart: "weekly-timetable",
    sheetKind: "timetable",
    build: (project) => ({
      name: WEEKLY_TIMETABLE_SHEET,
      rows: buildWeeklyTimetableRows(project),
      headers: WEEKLY_TIMETABLE_COLUMNS,
    }),
  },
  {
    id: "classTestPlans",
    label: "Class test plans",
    hint: "Editable planning sheet (all seminars)",
    filenamePart: "class-test-plans",
    sheetKind: "plans",
    build: (project) => ({
      name: PLAN_SHEET,
      rows: buildPlanExportRows(project),
      headers: PLAN_COLUMNS,
    }),
  },
  {
    id: "campusSummary",
    label: "Campus summary",
    hint: "Sessions and planned tests by campus",
    filenamePart: "campus-summary",
    sheetKind: "summary",
    build: (project) => ({
      name: REPORT_CAMPUS_SUMMARY,
      rows: buildCampusSummary(project),
      headers: null,
    }),
  },
  {
    id: "tutorWorkload",
    label: "Tutor workload",
    hint: "Teaching load and invigilation duties",
    filenamePart: "tutor-workload",
    sheetKind: "summary",
    build: (project) => ({
      name: REPORT_TUTOR_WORKLOAD,
      rows: buildTutorWorkload(project),
      headers: null,
    }),
  },
  {
    id: "missingInvigilators",
    label: "Missing invigilators",
    hint: "Planned tests without an invigilator assigned",
    filenamePart: "missing-invigilators",
    sheetKind: "missing-invigilators",
    build: (project) => ({
      name: REPORT_MISSING_INVIGILATORS,
      rows: buildMissingInvigilators(project),
      headers: null,
    }),
  },
  {
    id: "assessmentEvents",
    label: "Assessment events",
    hint: "Assessment schedule from the dashboard",
    filenamePart: "assessment-events",
    sheetKind: "assessment-events",
    requiresAssessment: true,
    build: (project) => ({
      name: REPORT_ASSESSMENT_EVENTS,
      rows: project.getAssessmentEvents().map(eventToRow),
      headers: ASSESSMENT_EXPORT_COLUMNS,
    }),
  },
  {
    id: "assessmentTracking",
    label: "Assessment tracking",
    hint: "Tasks, notes, and status per assessment",
    filenamePart: "assessment-tracking",
    sheetKind: "assessment-tracking",
    requiresAssessment: true,
    build: (project) => ({
      name: ASSESSMENT_TRACKING_SHEET,
      rows: buildAssessmentTrackingExportRows(project),
      headers: null,
    }),
  },
];

export function getExportPreset(id) {
  return EXPORT_PRESETS.find((p) => p.id === id) || EXPORT_PRESETS[0];
}

export function listExportPresets(project) {
  return EXPORT_PRESETS.filter((p) => !p.requiresAssessment || project?.hasAssessmentSchedule?.());
}

export function buildWorkbookForPreset(project, presetId = "full") {
  const preset = getExportPreset(presetId);
  if (preset.id === "full") return buildFullWorkbook(project);

  const wb = getWriteXlsx().utils.book_new();
  const built = preset.build(project);
  const headers = built.headers || (built.rows[0] ? Object.keys(built.rows[0]) : []);
  appendStyledSheet(wb, built.rows, built.name, headers, preset.sheetKind || "default");

  for (const extra of preset.extraSheets?.(project) || []) {
    const extraHeaders = extra.headers || (extra.rows[0] ? Object.keys(extra.rows[0]) : []);
    appendStyledSheet(wb, extra.rows, extra.name, extraHeaders, extra.sheetKind || "default");
  }

  return wb;
}

function buildFullWorkbook(project) {
  const wb = getWriteXlsx().utils.book_new();
  const primary = project.datasets.timetable[0];
  const exportedAt = formatExportTimestamp();

  if (primary?.rows?.length) {
    appendTimetableSheet(wb, primary);
  }

  appendAuxiliarySheets(project, wb);

  appendStyledSheet(wb, buildPlanExportRows(project), PLAN_SHEET, PLAN_COLUMNS, "plans");

  const classTests = buildClassTestSchedule(project);
  if (classTests.length) {
    appendStyledSheet(wb, classTests, REPORT_CLASS_TEST_SCHEDULE, CLASS_TEST_SCHEDULE_COLUMNS, "class-test-schedule");
  }

  const invigilation = buildInvigilationPlanRows(project);
  if (invigilation.length) {
    appendStyledSheet(wb, invigilation, INVIGILATION_SHEET, INVIGILATION_PLAN_COLUMNS, "invigilation");
  }

  appendStyledSheet(
    wb,
    buildWeeklyTimetableRows(project),
    WEEKLY_TIMETABLE_SHEET,
    WEEKLY_TIMETABLE_COLUMNS,
    "timetable"
  );

  const missing = buildMissingInvigilators(project);
  if (missing.length) {
    appendStyledSheet(
      wb,
      missing,
      REPORT_MISSING_INVIGILATORS,
      MISSING_INVIGILATOR_COLUMNS,
      "missing-invigilators"
    );
  }

  appendStyledSheet(wb, buildCampusSummary(project), REPORT_CAMPUS_SUMMARY, null, "summary");
  appendStyledSheet(wb, buildTutorWorkload(project), REPORT_TUTOR_WORKLOAD, null, "summary");

  if (project.getAssessmentEvents?.().length) {
    appendStyledSheet(
      wb,
      project.getAssessmentEvents().map(eventToRow),
      REPORT_ASSESSMENT_EVENTS,
      ASSESSMENT_EXPORT_COLUMNS,
      "assessment-events"
    );
    appendStyledSheet(
      wb,
      buildAssessmentTrackingExportRows(project),
      ASSESSMENT_TRACKING_SHEET,
      null,
      "assessment-tracking"
    );
  }

  appendStyledSheet(wb, buildDashboardSettingsRows(project), DASHBOARD_SETTINGS_SHEET, ["Setting", "Value"], "settings");

  appendStyledSheet(wb, [{ payload: JSON.stringify({ ...project.toMeta(), exportedAt }) }], META_SHEET, ["payload"], "meta");

  return wb;
}
