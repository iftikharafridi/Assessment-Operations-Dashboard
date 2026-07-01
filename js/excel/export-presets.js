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
  flattenRowForExport,
} from "./workbook-builders.js";
import { campusMatches } from "../config/constants.js";
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

/** Named export packs for Reports & Export tab. */
export const EXPORT_BUNDLES = [
  {
    id: "bundleFull",
    label: "Export Full Operations Workbook",
    hint: "All sheets — timetable, class tests, invigilation, assessments, campus summary, and settings.",
    filenamePart: "operations-workbook",
    sheets: [
      "Timetable",
      "Class Test Plans",
      "Class Test Schedule",
      "Invigilation Plan",
      "Weekly Timetable",
      "Missing Invigilators",
      "Campus Summary",
      "Tutor Workload",
      "Assessment Events",
      "Assessment Tracking",
      "Dashboard Settings",
      "_ProjectMeta",
    ],
  },
  {
    id: "bundleClassTestPlan",
    label: "Export Class Test Plan Only",
    hint: "Class test plans, schedule, missing invigilators, and campus summary.",
    filenamePart: "class-test-plan-pack",
    sheets: ["Class Test Plans", "Class Test Schedule", "Missing Invigilators", "Campus Summary"],
  },
  {
    id: "bundleInvigilationPack",
    label: "Export Invigilation Pack",
    hint: "Invigilation plan, missing invigilators, tutor workload, and campus summary.",
    filenamePart: "invigilation-pack",
    sheets: ["Invigilation Plan", "Missing Invigilators", "Tutor Workload", "Campus Summary"],
  },
  {
    id: "bundleAssessmentSummary",
    label: "Export Assessment Schedule Summary",
    hint: "Assessment events and operational tracking.",
    filenamePart: "assessment-summary",
    sheets: ["Assessment Events", "Assessment Tracking"],
    requiresAssessment: true,
  },
  {
    id: "bundleCampusPack",
    label: "Export Campus Pack",
    hint: "Select a campus on the Reports tab — timetable, class tests, invigilation, and summary for that site.",
    filenamePart: "campus-pack",
    isCampusSelect: true,
    sheets: ["Timetable (campus)", "Class Test Schedule", "Invigilation Plan", "Missing Invigilators", "Campus Summary"],
  },
  {
    id: "bundleFilteredView",
    label: "Export Visible / Filtered View",
    hint: "Exports rows matching your current sidebar filters and active tab.",
    filenamePart: "filtered-view",
    sheets: ["Filtered export based on current view"],
  },
];

export function getExportPreset(id) {
  const bundle = EXPORT_BUNDLES.find((b) => b.id === id);
  if (bundle) return { ...bundle, isBundle: true };
  return EXPORT_PRESETS.find((p) => p.id === id) || EXPORT_PRESETS[0];
}

export function listExportPresets(project) {
  return [
    ...EXPORT_BUNDLES.filter((b) => !b.requiresAssessment || project?.hasAssessmentSchedule?.()),
    ...EXPORT_PRESETS.filter((p) => !p.requiresAssessment || project?.hasAssessmentSchedule?.()),
  ];
}

function filterRowsByCampus(rows, campus) {
  if (!campus) return rows;
  return rows.filter((r) => campusMatches(campus, r.Campus));
}

function appendSheetFromPreset(wb, preset, project, options = {}) {
  const built = preset.build(project, options);
  const headers = built.headers || (built.rows[0] ? Object.keys(built.rows[0]) : []);
  appendStyledSheet(wb, built.rows, built.name, headers, preset.sheetKind || built.sheetKind || "default");
  for (const extra of preset.extraSheets?.(project, options) || []) {
    const extraHeaders = extra.headers || (extra.rows[0] ? Object.keys(extra.rows[0]) : []);
    appendStyledSheet(wb, extra.rows, extra.name, extraHeaders, extra.sheetKind || "default");
  }
}

export function buildWorkbookForPreset(project, presetId = "full", options = {}) {
  if (presetId === "full" || presetId === "bundleFull") return buildFullWorkbook(project, options);

  const bundle = EXPORT_BUNDLES.find((b) => b.id === presetId);
  if (bundle) return buildBundleWorkbook(project, bundle, options);

  const preset = EXPORT_PRESETS.find((p) => p.id === presetId) || EXPORT_PRESETS[0];
  const wb = getWriteXlsx().utils.book_new();
  appendSheetFromPreset(wb, preset, project, options);
  appendMetaSheet(wb, project, options);
  return wb;
}

function buildBundleWorkbook(project, bundle, options = {}) {
  const wb = getWriteXlsx().utils.book_new();
  const campus = options.campus || "";

  switch (bundle.id) {
    case "bundleClassTestPlan":
      appendSheetFromPreset(wb, getExportPreset("classTestPlans"), project, options);
      appendSheetFromPreset(wb, getExportPreset("classTestSchedule"), project, options);
      appendSheetFromPreset(wb, getExportPreset("missingInvigilators"), project, options);
      appendSheetFromPreset(wb, getExportPreset("campusSummary"), project, options);
      break;
    case "bundleInvigilationPack":
      appendSheetFromPreset(wb, getExportPreset("invigilationPlan"), project, options);
      appendSheetFromPreset(wb, getExportPreset("missingInvigilators"), project, options);
      appendSheetFromPreset(wb, getExportPreset("tutorWorkload"), project, options);
      appendSheetFromPreset(wb, getExportPreset("campusSummary"), project, options);
      break;
    case "bundleAssessmentSummary":
      appendSheetFromPreset(wb, getExportPreset("assessmentEvents"), project, options);
      appendSheetFromPreset(wb, getExportPreset("assessmentTracking"), project, options);
      break;
    case "bundleCampusPack":
      buildCampusPackWorkbook(wb, project, campus);
      break;
    case "bundleFilteredView":
      buildFilteredViewWorkbook(wb, project, options);
      break;
    default:
      return buildFullWorkbook(project, options);
  }

  appendMetaSheet(wb, project, { ...options, bundleId: bundle.id, campus });
  return wb;
}

function buildCampusPackWorkbook(wb, project, campus) {
  if (!campus) throw new Error("Select a campus for the campus pack export.");

  const weekly = filterRowsByCampus(buildWeeklyTimetableRows(project), campus);
  appendStyledSheet(wb, weekly, `${WEEKLY_TIMETABLE_SHEET} (${campus})`, WEEKLY_TIMETABLE_COLUMNS, "timetable");

  const classTests = filterRowsByCampus(buildClassTestSchedule(project), campus);
  appendStyledSheet(wb, classTests, REPORT_CLASS_TEST_SCHEDULE, CLASS_TEST_SCHEDULE_COLUMNS, "class-test-schedule");

  const invig = filterRowsByCampus(buildInvigilationPlanRows(project), campus);
  appendStyledSheet(wb, invig, INVIGILATION_SHEET, INVIGILATION_PLAN_COLUMNS, "invigilation");

  const missing = filterRowsByCampus(buildMissingInvigilators(project), campus);
  if (missing.length) {
    appendStyledSheet(wb, missing, REPORT_MISSING_INVIGILATORS, MISSING_INVIGILATOR_COLUMNS, "missing-invigilators");
  }

  const summary = buildCampusSummary(project).filter((r) => campusMatches(campus, r.Campus));
  appendStyledSheet(wb, summary.length ? summary : [{ Campus: campus, Note: "No data for this campus." }], REPORT_CAMPUS_SUMMARY, null, "summary");
}

function buildFilteredViewWorkbook(wb, project, options = {}) {
  const { filters = {}, activeTab = "" } = options;
  const allRows = project.getTimetableRows();
  const filtered = allRows.filter((row) => {
    if (filters.campus && !campusMatches(filters.campus, row.Campus)) return false;
    if (filters.weekday && row.Weekday !== filters.weekday) return false;
    if (filters.moduleCode && !String(row["Module code"]).toLowerCase().includes(String(filters.moduleCode).toLowerCase())) return false;
    if (filters.tutor && !String(row.Staff || "").toLowerCase().includes(String(filters.tutor).toLowerCase())) return false;
    if (filters.type && row.Type !== filters.type) return false;
    return true;
  });

  const tab = String(activeTab || "dashboard");
  if (tab === "tests" || tab === "invigilation") {
    const planned = filtered.filter((r) => r.Type === "Seminar");
    appendStyledSheet(wb, buildClassTestSchedule(project).filter((r) => planned.some((p) => p["Module code"] === r["Module code"])), `${REPORT_CLASS_TEST_SCHEDULE} (filtered)`, CLASS_TEST_SCHEDULE_COLUMNS, "class-test-schedule");
  } else if (tab === "assessment" && project.getAssessmentEvents?.().length) {
    appendStyledSheet(wb, project.getAssessmentEvents().map(eventToRow), REPORT_ASSESSMENT_EVENTS, ASSESSMENT_EXPORT_COLUMNS, "assessment-events");
  } else {
    appendStyledSheet(
      wb,
      filtered.map((row) => flattenRowForExport(row)),
      `${WEEKLY_TIMETABLE_SHEET} (filtered)`,
      WEEKLY_TIMETABLE_COLUMNS,
      "timetable"
    );
  }
}

function appendMetaSheet(wb, project, options = {}) {
  const exportedAt = formatExportTimestamp();
  const sourceFiles = Object.values(project.datasets || {})
    .flat()
    .map((d) => d.filename)
    .filter(Boolean);
  appendStyledSheet(
    wb,
    [{
      payload: JSON.stringify({
        ...project.toMeta(),
        exportedAt,
        exportBundle: options.bundleId || options.presetId || null,
        exportCampus: options.campus || null,
        sourceFiles,
      }),
    }],
    META_SHEET,
    ["payload"],
    "meta"
  );
}

function buildFullWorkbook(project, options = {}) {
  const wb = getWriteXlsx().utils.book_new();
  const primary = project.datasets.timetable[0];

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

  appendMetaSheet(wb, project, { ...options, bundleId: "bundleFull" });

  return wb;
}
