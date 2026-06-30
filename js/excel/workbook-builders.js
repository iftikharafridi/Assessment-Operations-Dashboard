import {
  PLAN_COLUMNS,
  TIMETABLE_COLUMNS,
  WEEKLY_TIMETABLE_COLUMNS,
  WEEKDAYS,
} from "../config/constants.js";
import { formatTimeRange } from "../utils/time.js";
import { timeToMinutes } from "../utils/time.js";
import { normalizePlan, planKey } from "../planner/plans.js";
import { appendStyledSheet } from "./sheet-style.js";

export function flattenRowForExport(row) {
  const { _extra, _sourceFile, _sourceId, sessionId, ...canonical } = row;
  return { ...canonical, ...(_extra || {}), "Stable session ID": sessionId };
}

export function uniqueHeaders(rows, preferred = []) {
  const seen = new Set();
  const headers = [];
  for (const key of preferred) {
    if (rows.some((r) => Object.prototype.hasOwnProperty.call(r, key))) {
      headers.push(key);
      seen.add(key);
    }
  }
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  return headers.length ? headers : preferred;
}

export function buildPlanExportRows(project) {
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

export function buildWeeklyTimetableRows(project) {
  return project
    .getTimetableRows()
    .slice()
    .sort((a, b) => {
      const day = WEEKDAYS.indexOf(a.Weekday) - WEEKDAYS.indexOf(b.Weekday);
      if (day) return day;
      const campus = String(a.Campus).localeCompare(String(b.Campus));
      if (campus) return campus;
      return timeToMinutes(a["Start time"]) - timeToMinutes(b["Start time"]);
    })
    .map((row) => {
      const flat = flattenRowForExport(row);
      return {
        Weekday: flat.Weekday,
        "Start time": flat["Start time"],
        "End time": flat["End time"],
        Campus: flat.Campus,
        "Module code": flat["Module code"],
        "Module name": flat["Module name"],
        Type: flat.Type,
        Activity: flat.Activity,
        Room: flat.Room,
        Staff: flat.Staff,
        "Student Groups": flat["Student Groups"],
        Size: flat.Size,
      };
    });
}

export function appendTimetableSheet(wb, primaryDataset) {
  const timetableRows = primaryDataset.rows.map(flattenRowForExport);
  const timetableHeaders = uniqueHeaders(timetableRows, TIMETABLE_COLUMNS);
  appendStyledSheet(
    wb,
    timetableRows,
    primaryDataset.sheetName || "Timetable",
    timetableHeaders,
    "timetable"
  );
}

/** Staff / rooms only — assessment data lives on Assessment Events. */
export function appendAuxiliarySheets(project, wb) {
  for (const type of ["staff", "rooms"]) {
    for (const ds of project.datasets[type] || []) {
      if (!ds.rows?.length) continue;
      appendStyledSheet(wb, ds.rows, ds.sheetName || type, null, "auxiliary");
    }
  }
}

export { TIMETABLE_COLUMNS, WEEKLY_TIMETABLE_COLUMNS };
