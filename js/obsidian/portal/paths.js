/**
 * Academic Operations OS — Semester Portal path contracts.
 */

export const PORTAL_MODE_COMPLETE = "complete";
export const PORTAL_MODE_DATA_ONLY = "dataOnly";

export const PORTAL_PAGE_PATHS = {
  teachingCentre: "10 - Teaching Centre.md",
  assessmentCentre: "20 - Assessment Centre.md",
};

export const PORTAL_DATA_PATHS = {
  semesterSettings: "_Data/Semester Settings.md",
  cohortCalendar: "_Data/Cohort Calendar.md",
  teachingTimetable: "_Data/Teaching Timetable.md",
  modules: "_Data/Modules.md",
  teachingTeam: "_Data/Teaching Team.md",
  assessmentSchedule: "_Data/Assessment Schedule.md",
  classTestSchedule: "_Data/Class Test Schedule.md",
  invigilationSchedule: "_Data/Invigilation Schedule.md",
  issuesAndActions: "_Data/Issues and Actions.md",
  exportSummary: "_Data/Export Summary.md",
};

export const PORTAL_ASSET_PATHS = {
  css: "_Assets/academic-operations-os.css",
};

export const PORTAL_FOLDERS = ["_Data", "_Assets"];

/** Legacy two-file assessment export (kept for one release). */
export const LEGACY_ACADEMIC_OS_PATHS = {
  assessmentSchedule: "03 - Assessment/20 - Assessment Schedule.md",
  classTestSchedule: "03 - Assessment/22 - Class Test Schedule.md",
};

export const TEACHING_TIMETABLE_HEADERS = [
  "ID",
  "Module code",
  "Module name",
  "Activity",
  "Class type",
  "Weekday",
  "Start time",
  "End time",
  "Campus",
  "Staff",
  "Student groups",
  "Size",
];

export const MODULES_HEADERS = [
  "Module code",
  "Module name",
  "Course/programme",
  "CRN",
  "Semester",
  "Module coordinator",
  "QAHE module leader",
  "Campuses",
  "Teaching staff",
  "Student groups",
  "Session count",
  "Assessment count",
];

export const TEACHING_TEAM_HEADERS = [
  "Staff",
  "Module code",
  "Module name",
  "Campus",
  "Session count",
  "Lecture count",
  "Seminar count",
  "Weekly hours",
];

export const ASSESSMENT_SCHEDULE_HEADERS = [
  "Status",
  "Module code",
  "Module name",
  "Course/programme",
  "CRN",
  "Semester",
  "Operational week",
  "Cohort week",
  "Assessment",
  "Assessment format",
  "Weight",
  "Scheduling basis",
  "W/C",
  "Fixed deadline",
  "Feedback date",
  "Campus",
  "Cohort",
  "Group",
  "Room",
  "Start time",
  "End time",
  "Tutor / assessor",
  "Module coordinator",
  "QAHE module leader",
  "Notes",
];

export const CLASS_TEST_SCHEDULE_HEADERS = [
  "Status",
  "Module code",
  "Module name",
  "Campus",
  "Cohort",
  "Group",
  "Operational week",
  "Cohort week",
  "W/C",
  "Date",
  "Start time",
  "End time",
  "Room",
  "Tutor",
  "Invigilator",
  "Test type",
  "Duration",
  "Blackboard test ready",
  "LOD ready",
  "Notes",
];

export const INVIGILATION_HEADERS = [
  "Module code",
  "Module name",
  "Campus",
  "Date",
  "Weekday",
  "Start time",
  "End time",
  "Room",
  "Lead tutor",
  "Invigilator",
  "Availability",
  "Warning",
  "Status",
];

export const ISSUES_HEADERS = [
  "Issue type",
  "Severity",
  "Priority",
  "Campus",
  "Module",
  "Group",
  "Title",
  "Recommended action",
  "Status",
];

export const COHORT_CALENDAR_HEADERS = [
  "Cohort label",
  "Raw group",
  "Campus / site",
  "Programme",
  "Intake",
  "Group letter",
  "Study year",
  "Sessions",
  "Modules",
  "Current cohort week",
  "Warning",
];

export const SEMESTER_SETTINGS_HEADERS = [
  "Setting",
  "Value",
];

export const EXPORT_SUMMARY_HEADERS = [
  "Item",
  "Count",
  "Notes",
];

export const ACADEMIC_OS_SCHEDULING_LABELS = {
  weekCommencing: "Group-based",
  fixedDeadline: "Fixed deadline",
  mixed: "Mixed",
  notSpecified: "Not specified",
};

export const PORTAL_NAV_LINKS = [
  { id: "teaching", label: "Teaching", path: "10 - Teaching Centre" },
  { id: "assessments", label: "Assessments", path: "20 - Assessment Centre" },
];
