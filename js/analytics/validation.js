import { REQUIRED_TIMETABLE_FIELDS, WEEKDAYS } from "../config/constants.js";
import { detectConflicts } from "./dashboard.js";
import { runAssessmentValidation } from "./assessment.js";
import { unique } from "../utils/dom.js";
import { isValidTime, timesOverlap, timeToMinutes } from "../utils/time.js";

/**
 * @returns {{ checks: Array, summary: object }}
 */
export function runDataValidation(project) {
  const rows = project.getTimetableRows();
  const seminars = rows.filter((r) => r.Type === "Seminar");
  const rooms = unique(rows.map((r) => r.Room).filter(Boolean));

  const missingCampus = rows.filter((r) => !String(r.Campus || "").trim());
  const missingStaff = rows.filter((r) => !String(r.Staff || "").trim());
  const missingDayTime = rows.filter(
    (r) => !String(r.Weekday || "").trim() || !String(r["Start time"] || "").trim()
  );
  const invalidTimes = rows.filter(
    (r) =>
      (r["Start time"] && !isValidTime(r["Start time"])) ||
      (r["End time"] && !isValidTime(r["End time"])) ||
      (isValidTime(r["Start time"]) && isValidTime(r["End time"]) &&
        timeToMinutes(r["Start time"]) >= timeToMinutes(r["End time"]))
  );

  const duplicateRooms = findDuplicateRoomBookings(rows);
  const tutorDoubleBookings = findTutorDoubleBookings(rows);
  const invigilatorConflicts = detectConflicts(project);
  const unmatchedPlans = project.unmatchedPlans || [];
  const assessmentIssues = runAssessmentValidation(project);
  const assessmentWarnings = assessmentIssues.filter((i) => i.status !== "ok");

  const missingColumns = project.importValidation?.missing || [];

  const summary = {
    sessions: rows.length,
    campuses: unique(rows.map((r) => r.Campus).filter(Boolean)).length,
    modules: unique(rows.map((r) => r["Module code"]).filter(Boolean)).length,
    tutors: unique(rows.map((r) => r.Staff).filter(Boolean)).length,
    rooms: rooms.length,
    seminarSlots: seminars.length,
  };

  const checks = [
    check("import-count", "Sessions imported", summary.sessions > 0 ? "ok" : "error", summary.sessions, summary.sessions ? `${summary.sessions} sessions loaded` : "No sessions found"),
    check("campuses", "Campuses found", summary.campuses > 0 ? "ok" : "warn", summary.campuses, `${summary.campuses} campuses`),
    check("modules", "Modules found", summary.modules > 0 ? "ok" : "warn", summary.modules, `${summary.modules} modules`),
    check("tutors", "Tutors found", summary.tutors > 0 ? "ok" : "warn", summary.tutors, `${summary.tutors} tutors`),
    check("seminars", "Seminar slots", summary.seminarSlots > 0 ? "ok" : "warn", summary.seminarSlots, `${summary.seminarSlots} seminar slots`),
    check("missing-columns", "Required columns", missingColumns.length ? "warn" : "ok", missingColumns.length, missingColumns.length ? `Missing: ${missingColumns.join(", ")}` : "All required columns found"),
    check("missing-campus", "Rows missing campus", missingCampus.length ? "error" : "ok", missingCampus.length, missingCampus.length ? `${missingCampus.length} rows need a campus` : "Every row has a campus"),
    check("missing-staff", "Rows missing tutor", missingStaff.length ? "error" : "ok", missingStaff.length, missingStaff.length ? `${missingStaff.length} rows need a tutor` : "Every row has a tutor"),
    check("missing-time", "Rows missing day/time", missingDayTime.length ? "warn" : "ok", missingDayTime.length, missingDayTime.length ? `${missingDayTime.length} rows missing weekday or start time` : "All rows have day and time"),
    check("invalid-time", "Unclear start/end times", invalidTimes.length ? "warn" : "ok", invalidTimes.length, invalidTimes.length ? `${invalidTimes.length} rows have unclear times` : "All times look valid"),
    check("room-clash", "Duplicate room bookings", duplicateRooms.length ? "error" : "ok", duplicateRooms.length, duplicateRooms.length ? `${duplicateRooms.length} possible room clashes` : "No duplicate room bookings found"),
    check("tutor-clash", "Tutor double-bookings", tutorDoubleBookings.length ? "error" : "ok", tutorDoubleBookings.length, tutorDoubleBookings.length ? `${tutorDoubleBookings.length} tutor overlaps found` : "No tutor double-bookings found"),
    check("invig-clash", "Invigilator conflicts", invigilatorConflicts.length ? "error" : "ok", invigilatorConflicts.length, invigilatorConflicts.length ? `${invigilatorConflicts.length} invigilator issues` : "No invigilator conflicts"),
    check("unmatched-plans", "Saved plans matched", unmatchedPlans.length ? "warn" : "ok", unmatchedPlans.length, unmatchedPlans.length ? `${unmatchedPlans.length} saved plans could not be matched to current timetable` : "All saved plans matched"),
    check(
      "assessment-schedule",
      "Assessment schedule",
      !project.hasAssessmentSchedule?.() ? "warn" : assessmentWarnings.length ? "warn" : "ok",
      assessmentWarnings.length,
      !project.hasAssessmentSchedule?.()
        ? "No assessment schedule loaded — upload via Add another file"
        : assessmentWarnings.length
          ? `${assessmentWarnings.length} assessment timetable note${assessmentWarnings.length === 1 ? "" : "s"}`
          : `${project.getAssessmentEvents().length} assessment items loaded`
    ),
  ];

  return {
    summary,
    checks,
    details: {
      missingCampus,
      missingStaff,
      missingDayTime,
      invalidTimes,
      duplicateRooms,
      tutorDoubleBookings,
      invigilatorConflicts,
      unmatchedPlans,
      missingColumns,
      assessmentIssues,
    },
  };
}

function check(id, label, status, count, message) {
  return { id, label, status, count, message };
}

function findDuplicateRoomBookings(rows) {
  const issues = [];
  const withRoom = rows.filter((r) => String(r.Room || "").trim() && r.Weekday && r["Start time"]);
  for (let i = 0; i < withRoom.length; i++) {
    for (let j = i + 1; j < withRoom.length; j++) {
      const a = withRoom[i];
      const b = withRoom[j];
      if (a.Campus !== b.Campus || a.Room !== b.Room || a.Weekday !== b.Weekday) continue;
      if (timesOverlap(a["Start time"], a["End time"], b["Start time"], b["End time"])) {
        issues.push({
          message: `${a.Room} on ${a.Weekday} ${a["Start time"]}–${a["End time"]}: ${a["Module code"]} and ${b["Module code"]}`,
          rows: [a, b],
        });
      }
    }
  }
  return issues;
}

function findTutorDoubleBookings(rows) {
  const issues = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      if (a.Staff !== b.Staff || a.Weekday !== b.Weekday) continue;
      if (!a["Start time"] || !b["Start time"]) continue;
      if (timesOverlap(a["Start time"], a["End time"] || a["Start time"], b["Start time"], b["End time"] || b["Start time"])) {
        issues.push({
          message: `${a.Staff} on ${a.Weekday}: ${a["Module code"]} (${a["Start time"]}) overlaps ${b["Module code"]} (${b["Start time"]})`,
          rows: [a, b],
        });
      }
    }
  }
  return issues;
}

export { REQUIRED_TIMETABLE_FIELDS, WEEKDAYS };
