/** @typedef {'timetable'|'staff'|'rooms'|'assessmentSchedule'|'unknown'} FileType */

export const APP_VERSION = "1.3.2";

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export const CALENDAR_SLOT_MINUTES = 15;
export const CALENDAR_START_HOUR = 9;
export const CALENDAR_END_HOUR = 18;

/** 15-minute bands for the weekly grid (09:00 – 17:45). */
export const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = CALENDAR_START_HOUR; h < CALENDAR_END_HOUR; h++) {
    for (const m of [0, 15, 30, 45]) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
})();

/** Hour labels for calendar header row (each hour = 4 quarter slots). */
export const CALENDAR_HOURS = (() => {
  const hours = [];
  for (let h = CALENDAR_START_HOUR; h < CALENDAR_END_HOUR; h++) {
    hours.push(String(h).padStart(2, "0"));
  }
  return hours;
})();

export const PLAN_SHEET = "Class Test Plans";
export const INVIGILATION_SHEET = "Invigilation Plan";
export const DASHBOARD_SHEET = "Dashboard Summary";
export const DASHBOARD_SETTINGS_SHEET = "Dashboard Settings";
export const REPORT_CLASS_TEST_SCHEDULE = "Class Test Schedule";
export const REPORT_MISSING_INVIGILATORS = "Missing Invigilators";
export const REPORT_CAMPUS_SUMMARY = "Campus Summary";
export const REPORT_TUTOR_WORKLOAD = "Tutor Workload";
export const REPORT_ASSESSMENT_EVENTS = "Assessment Events";
export const ASSESSMENT_TRACKING_SHEET = "Assessment Tracking";
export const META_SHEET = "_ProjectMeta";

export const ASSESSMENT_STATUSES = [
  "Not started",
  "Planning",
  "In progress",
  "Ready",
  "Submitted",
  "Completed",
  "Issue",
];

export function displayAssessmentStatus(status) {
  return status || "Not started";
}

export const WEEKLY_TIMETABLE_SHEET = "Weekly Timetable";

export const CLASS_TEST_SCHEDULE_COLUMNS = [
  "Module code",
  "Module name",
  "Campus",
  "Test week",
  "Test date",
  "Day",
  "Time",
  "Room",
  "Room confirmed",
  "Lead tutor",
  "Invigilator",
  "Invigilation",
  "Status",
  "Paper ready",
  "LOD ready",
  "Notes",
];

export const MISSING_INVIGILATOR_COLUMNS = [
  "Module code",
  "Campus",
  "Test week",
  "Day",
  "Time",
  "Lead tutor",
  "Status",
];

export const INVIGILATION_PLAN_COLUMNS = [
  "Session ID",
  "Module code",
  "Campus",
  "Test week",
  "Day",
  "Time",
  "Lead tutor",
  "Invigilator",
  "Same campus",
  "Availability",
  "Warning",
  "Status",
];

export const WEEKLY_TIMETABLE_COLUMNS = [
  "Weekday",
  "Start time",
  "End time",
  "Campus",
  "Module code",
  "Module name",
  "Type",
  "Activity",
  "Room",
  "Staff",
  "Student Groups",
  "Size",
];

export const GENERATED_SHEETS = new Set([
  PLAN_SHEET,
  INVIGILATION_SHEET,
  DASHBOARD_SHEET,
  DASHBOARD_SETTINGS_SHEET,
  REPORT_CLASS_TEST_SCHEDULE,
  REPORT_MISSING_INVIGILATORS,
  REPORT_CAMPUS_SUMMARY,
  REPORT_TUTOR_WORKLOAD,
  REPORT_ASSESSMENT_EVENTS,
  ASSESSMENT_TRACKING_SHEET,
  WEEKLY_TIMETABLE_SHEET,
  META_SHEET,
]);

export const TIMETABLE_COLUMNS = [
  "ID",
  "Module code",
  "Module name",
  "Activity",
  "Type",
  "Weekday",
  "Start time",
  "End time",
  "Room",
  "Campus",
  "Staff",
  "Student Groups",
  "Size",
];

export const REQUIRED_TIMETABLE_FIELDS = [
  "Module code",
  "Campus",
  "Weekday",
  "Staff",
];

export const PLAN_STATUSES = [
  "Not Planned",
  "Planning",
  "Invigilator Needed",
  "Ready",
  "Completed",
  "Issue",
];

export const PLAN_COLUMNS = [
  "Stable session ID",
  "Session ID",
  "Module code",
  "Module name",
  "Campus",
  "Seminar slot",
  "Class test",
  "Test week",
  "Test date",
  "Test start time",
  "Test end time",
  "Duration (minutes)",
  "Room",
  "Room confirmed",
  "Lead tutor",
  "Invigilator",
  "Paper ready",
  "LOD/software ready",
  "Status",
  "Notes",
];

export const FILE_TYPE_LABELS = {
  timetable: "Timetable",
  staff: "Staff",
  rooms: "Rooms",
  assessmentSchedule: "Assessment Schedule",
  unknown: "Other",
};

export const FUTURE_MODULES = [
  "campusMaps",
  "roomLayoutDesigner",
  "lodReadiness",
  "blackboardReadiness",
  "attendance",
  "workload",
  "examPlanning",
];

export const CAMPUS_COLORS = {
  "London RAV": "#2563eb",
  "London IH": "#7c3aed",
  "Birmingham LRH": "#059669",
  Manchester: "#d97706",
};

/** Filter value that matches every London site in the timetable. */
export const LONDON_CAMPUS_FILTER = "London (all sites)";

export const LONDON_CAMPUSES = ["London RAV", "London IH"];

export function campusColor(campus) {
  return CAMPUS_COLORS[campus] || "#64748b";
}

export function campusDisplayName(campus) {
  const name = String(campus ?? "").trim();
  if (name === "London RAV") return "London RAV (London campus)";
  if (name === "London IH") return "London IH (London campus)";
  return name;
}

export function campusMatches(filterCampus, rowCampus) {
  const filter = String(filterCampus ?? "").trim();
  const campus = String(rowCampus ?? "").trim();
  if (!filter) return true;
  if (campus === filter) return true;
  if (filter === LONDON_CAMPUS_FILTER && LONDON_CAMPUSES.includes(campus)) return true;
  return false;
}

export const SESSION_STYLES = {
  lecture: "lec",
  seminar: "sem",
  planned: "planned",
  ready: "ready",
  completed: "completed",
  issue: "issue",
  conflict: "conflict",
};

export const DEFAULT_PLAN = {
  planned: false,
  status: "Not Planned",
  testWeek: "",
  testDate: "",
  testStartTime: "",
  testEndTime: "",
  testDuration: "",
  durationMinutes: "",
  room: "",
  roomConfirmed: false,
  leadTutor: "",
  invigilator: "",
  paperReady: false,
  lodReady: false,
  notes: "",
};

/** Colleague-friendly labels shown in the UI */
export const STATUS_LABELS = {
  "Not Planned": "Not planned",
  Planning: "Planning",
  "Invigilator Needed": "Needs invigilator",
  Ready: "Ready",
  Completed: "Completed",
  Issue: "Possible issue",
};

export function displayStatus(status) {
  return STATUS_LABELS[status] || status;
}

export const COLUMN_ALIASES = {
  ID: ["id", "session id", "session_id", "event id"],
  "Module code": ["module code", "module_code", "mod code", "module", "code"],
  "Module name": ["module name", "module_name", "mod name", "title"],
  Activity: ["activity", "event", "session name", "description"],
  Type: ["type", "activity type", "session type", "event type"],
  Weekday: ["weekday", "day", "day of week"],
  "Start time": ["start time", "start", "start_time", "from", "time start"],
  "End time": ["end time", "end", "end_time", "to", "time end"],
  Room: ["room", "venue", "location", "room name"],
  Campus: ["campus", "site", "location campus"],
  Staff: ["staff", "tutor", "lecturer", "teacher", "instructor"],
  "Student Groups": ["student groups", "groups", "cohort", "student group", "admission groups"],
  Size: ["size", "students", "headcount", "capacity", "class size"],
};

export const HELP_COLUMNS = [
  "Module code",
  "Module name",
  "Campus",
  "Weekday",
  "Start time",
  "End time",
  "Type (Lecture or Seminar)",
  "Staff",
  "Student Groups",
  "Size",
];
