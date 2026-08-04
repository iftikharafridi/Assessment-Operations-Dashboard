/**
 * Path contracts for the LEGACY two-file Academic Operations OS export (v2.2).
 * Prefer js/obsidian/portal/ for the complete semester portal.
 */

export const ACADEMIC_OS_ASSESSMENT_PATHS = {
  assessmentSchedule: "03 - Assessment/20 - Assessment Schedule.md",
  classTestSchedule: "03 - Assessment/22 - Class Test Schedule.md",
};

/** Fixed header contract for 20 - Assessment Schedule.md */
export const ASSESSMENT_SCHEDULE_MD_HEADERS = [
  "Status",
  "Module code",
  "Module name",
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
  "Notes",
];

/** Fixed header contract for 22 - Class Test Schedule.md */
export const CLASS_TEST_SCHEDULE_MD_HEADERS = [
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
  "Test type",
  "Duration",
  "Notes",
];

/** Labels used in the Academic Operations OS template (not internal keys). */
export const ACADEMIC_OS_SCHEDULING_LABELS = {
  weekCommencing: "Group-based",
  fixedDeadline: "Fixed deadline",
  mixed: "Mixed",
  notSpecified: "Not specified",
};

export const ACADEMIC_OS_REQUIRED_FOLDERS = ["03 - Assessment"];
