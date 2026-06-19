import { WEEKDAYS, campusMatches, LONDON_CAMPUS_FILTER, LONDON_CAMPUSES } from "../config/constants.js";
import { normalizePlan } from "../planner/plans.js";
import { sessionHasConflict } from "./dashboard.js";
import { unique } from "../utils/dom.js";

export function defaultFilters() {
  return {
    campus: "",
    weekday: "",
    moduleCode: "",
    moduleName: "",
    tutor: "",
    studentGroup: "",
    activityType: "",
    status: "",
    invigilatorMissing: false,
    conflictOnly: false,
    search: "",
  };
}

function moduleCodeMatches(rowCode, filterCode) {
  return String(rowCode ?? "").trim().toLowerCase() === String(filterCode ?? "").trim().toLowerCase();
}

export function filterTimetableRows(rows, filters, project = null) {
  return rows.filter((row) => {
    if (filters.campus && !campusMatches(filters.campus, row.Campus)) return false;
    if (filters.weekday && row.Weekday !== filters.weekday) return false;
    if (filters.moduleCode && !moduleCodeMatches(row["Module code"], filters.moduleCode)) return false;
    if (filters.moduleName && String(row["Module name"]).trim().toLowerCase() !== String(filters.moduleName).trim().toLowerCase()) return false;
    if (filters.tutor && String(row.Staff).trim() !== String(filters.tutor).trim()) return false;
    if (filters.studentGroup) {
      const groups = String(row["Student Groups"] || "").toLowerCase();
      if (!groups.includes(filters.studentGroup.toLowerCase())) return false;
    }
    if (filters.activityType && row.Type !== filters.activityType) return false;

    if (project) {
      const plan = normalizePlan(project.getPlan(row.sessionId));
      // Class test status filters apply to seminar slots only — do not hide lectures.
      if (row.Type === "Seminar") {
        if (filters.status && plan.status !== filters.status) return false;
        if (filters.invigilatorMissing) {
          if (!plan.planned || plan.invigilator) return false;
        }
      }
      if (filters.conflictOnly && !sessionHasConflict(project, row.sessionId)) return false;
    }

    if (filters.search) {
      const blob = `${row["Module code"]} ${row["Module name"]} ${row.Activity} ${row.Staff} ${row["Student Groups"]}`.toLowerCase();
      if (!blob.includes(filters.search.toLowerCase())) return false;
    }
    return true;
  });
}

export function filterOptions(rows) {
  const campuses = unique(rows.map((r) => String(r.Campus).trim())).filter(Boolean).sort();
  const hasLondon = campuses.some((c) => LONDON_CAMPUSES.includes(c));
  return {
    campuses: hasLondon ? [LONDON_CAMPUS_FILTER, ...campuses] : campuses,
    weekdays: WEEKDAYS,
    moduleCodes: unique(rows.map((r) => String(r["Module code"]).trim())).filter(Boolean).sort(),
    moduleNames: unique(rows.map((r) => String(r["Module name"]).trim())).filter(Boolean).sort(),
    tutors: unique(rows.map((r) => String(r.Staff).trim())).filter(Boolean).sort(),
    studentGroups: unique(
      rows.flatMap((r) => String(r["Student Groups"] || "").split(",").map((s) => s.trim()).filter(Boolean))
    ).sort(),
    activityTypes: unique(rows.map((r) => r.Type)).filter(Boolean).sort(),
  };
}

/** Build dropdown options from rows that match all filters except one field. */
export function filterOptionsFor(allRows, filters, excludeKey, project = null) {
  const partial = { ...defaultFilters(), ...filters };
  if (excludeKey && Object.prototype.hasOwnProperty.call(partial, excludeKey)) {
    partial[excludeKey] = defaultFilters()[excludeKey];
  }
  return filterOptions(filterTimetableRows(allRows, partial, project));
}

/** Drop filter combinations that cannot match any session. */
export function sanitizeFilters(allRows, filters, project = null) {
  const next = { ...defaultFilters(), ...filters };

  if (next.moduleCode && next.moduleName) {
    const nameForCode = allRows.find((r) => moduleCodeMatches(r["Module code"], next.moduleCode))?.[
      "Module name"
    ];
    if (nameForCode && String(nameForCode).trim() !== String(next.moduleName).trim()) {
      next.moduleName = "";
    }
  }

  const matching = filterTimetableRows(allRows, next, project);
  if (!matching.length) {
    if (next.campus) next.campus = "";
    if (next.weekday) next.weekday = "";
    if (next.tutor) next.tutor = "";
    if (next.studentGroup) next.studentGroup = "";
    if (next.activityType) next.activityType = "";
    if (next.status) next.status = "";
    if (next.invigilatorMissing) next.invigilatorMissing = false;
    if (next.conflictOnly) next.conflictOnly = false;
  }

  return next;
}

export function describeFilterContext(allRows, filters, project = null) {
  const matching = filterTimetableRows(allRows, filters, project);
  if (!matching.length) {
    return { count: 0, campuses: [], hint: "No sessions match your current filters." };
  }

  const campuses = unique(matching.map((r) => String(r.Campus).trim())).sort();
  let hint = `${matching.length} session${matching.length === 1 ? "" : "s"}`;
  if (filters.moduleCode) {
    hint += ` for ${filters.moduleCode}`;
    if (campuses.length) hint += ` at ${campuses.join(", ")}`;
  }

  return { count: matching.length, campuses, hint };
}

/** Explain when a module has lectures at a campus but no seminar slots (class test candidates). */
export function moduleSeminarNotice(allRows, filters, project = null) {
  if (!filters.moduleCode) return "";

  const moduleRows = filterTimetableRows(
    allRows,
    { ...defaultFilters(), moduleCode: filters.moduleCode },
    project
  );
  const lectureCampuses = unique(moduleRows.filter((r) => r.Type === "Lecture").map((r) => String(r.Campus).trim()));
  const seminarCampuses = unique(moduleRows.filter((r) => r.Type === "Seminar").map((r) => String(r.Campus).trim()));
  const lectureOnly = lectureCampuses.filter((c) => !seminarCampuses.includes(c));

  if (!lectureOnly.length) return "";
  return `${filters.moduleCode} has lectures at ${lectureOnly.join(", ")} but no seminar slots there. Open Weekly timetable to view those sessions.`;
}
