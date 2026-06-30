import { WEEKDAYS } from "../config/constants.js";
import { normalizePlan, planKey, updatePlan, markAsClassTest } from "../planner/plans.js";
import { markDirty } from "../state/store.js";
import { unique } from "../utils/dom.js";

function moduleCodeMatches(a, b) {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

export function getAssessmentTypeLabel(type) {
  const labels = {
    classTest: "Class test / lab",
    presentation: "Presentation",
    submission: "Submission / deadline",
    exam: "Exam",
    other: "Other",
  };
  return labels[type] || type;
}

export function groupEventsByModule(events) {
  const map = new Map();
  for (const event of events) {
    if (!map.has(event.moduleCode)) map.set(event.moduleCode, []);
    map.get(event.moduleCode).push(event);
  }
  return map;
}

export function getClassTestCandidates(events) {
  return events.filter((e) => e.suggestsClassTest);
}

/** Primary in-class assessment for a module (earliest week). */
export function primaryClassTestEvent(events, moduleCode) {
  return getClassTestCandidates(events)
    .filter((e) => moduleCodeMatches(e.moduleCode, moduleCode))
    .sort((a, b) => a.weekNumber - b.weekNumber)[0];
}

/**
 * Apply assessment schedule suggestions to class test plans.
 * @returns {{ applied: number, modules: string[], warnings: string[] }}
 */
export function applyAssessmentToPlans(project, { moduleCode = null } = {}) {
  const events = project.getAssessmentEvents();
  const candidates = getClassTestCandidates(events).filter(
    (e) => !moduleCode || moduleCodeMatches(e.moduleCode, moduleCode)
  );

  const byModule = groupEventsByModule(candidates);
  const results = { applied: 0, modules: [], warnings: [] };

  for (const [code, moduleEvents] of byModule) {
    const primary = [...moduleEvents].sort((a, b) => a.weekNumber - b.weekNumber)[0];
    const seminars = project
      .getTimetableRows()
      .filter((r) => r.Type === "Seminar" && moduleCodeMatches(r["Module code"], code));

    if (!seminars.length) {
      results.warnings.push(
        `${code}: assessment schedule suggests ${primary.weekLabel} (${primary.title.slice(0, 60)}…) but no seminar slots were found in the timetable.`
      );
      continue;
    }

    const noteLines = [
      `From assessment schedule (${primary.weekLabel}):`,
      primary.rawText.split("\n").slice(0, 4).join(" · "),
    ];

    for (const seminar of seminars) {
      const sid = planKey(seminar);
      markAsClassTest(project, sid, seminar.Staff, seminar);
      updatePlan(project, sid, {
        testWeek: primary.weekLabel,
        testDate: computeClassTestDateForSeminar(primary, seminar),
        status: "Planning",
        notes: noteLines.join("\n"),
      });
      results.applied++;
    }
    results.modules.push(code);
  }

  if (results.applied) markDirty();
  return results;
}

/** Fill test week/date on planned seminars that are missing schedule data. */
export function fillMissingTestWeeksFromSchedule(project, { notify = false } = {}) {
  const events = project.getAssessmentEvents();
  if (!events.length) return 0;

  let filled = 0;
  for (const seminar of project.getTimetableRows().filter((r) => r.Type === "Seminar")) {
    const sid = planKey(seminar);
    const plan = normalizePlan(project.getPlan(sid));
    if (!plan.planned || plan.testWeek) continue;

    const primary = primaryClassTestEvent(events, seminar["Module code"]);
    if (!primary) continue;

    const scheduleNote = `From assessment schedule (${primary.weekLabel}): ${primary.rawText.split("\n").slice(0, 3).join(" · ")}`;
    const notes = plan.notes?.includes(primary.weekLabel) ? plan.notes : [plan.notes, scheduleNote].filter(Boolean).join("\n");

    updatePlan(
      project,
      sid,
      {
        testWeek: primary.weekLabel,
        testDate: computeClassTestDateForSeminar(primary, seminar),
        notes,
      },
      { notify }
    );
    filled++;
  }
  return filled;
}

export function buildAssessmentSummary(events) {
  const modules = unique(events.map((e) => e.moduleCode)).sort();
  const classTests = getClassTestCandidates(events).length;
  return {
    events: events.length,
    modules: modules.length,
    classTestCandidates: classTests,
    moduleCodes: modules,
  };
}

/**
 * Cross-check timetable vs assessment schedule.
 * @returns {Array<{status:'ok'|'warn'|'error', message:string}>}
 */
export function runAssessmentValidation(project) {
  const events = project.getAssessmentEvents();
  const rows = project.getTimetableRows();
  const issues = [];

  if (!events.length) {
    return [{ status: "ok", message: "No assessment schedule loaded — upload one via Add another file." }];
  }

  const scheduleModules = unique(events.map((e) => e.moduleCode.toUpperCase()));
  const timetableModules = unique(rows.map((r) => String(r["Module code"]).trim().toUpperCase())).filter(Boolean);

  for (const code of timetableModules) {
    if (!scheduleModules.includes(code)) {
      issues.push({ status: "warn", message: `${code} is in the timetable but not in the assessment schedule.` });
    }
  }

  for (const code of scheduleModules) {
    if (!timetableModules.includes(code)) {
      issues.push({ status: "warn", message: `${code} is in the assessment schedule but not in the timetable.` });
    }
  }

  for (const code of timetableModules) {
    const primary = primaryClassTestEvent(events, code);
    if (!primary) continue;

    const seminars = rows.filter((r) => r.Type === "Seminar" && moduleCodeMatches(r["Module code"], code));
    if (!seminars.length) {
      issues.push({
        status: "warn",
        message: `${code}: schedule suggests ${primary.weekLabel} in-class assessment but the timetable has no seminar slots for this module.`,
      });
    }

    for (const seminar of seminars) {
      const plan = normalizePlan(project.getPlan(planKey(seminar)));
      if (!plan.planned || !plan.testWeek) continue;
      if (plan.testWeek !== primary.weekLabel) {
        issues.push({
          status: "warn",
          message: `${code} (${seminar.Campus}): class test plan says ${plan.testWeek} but assessment schedule says ${primary.weekLabel}.`,
        });
      }
    }
  }

  if (!issues.length) {
    issues.push({ status: "ok", message: "Assessment schedule matches the timetable modules." });
  }

  return issues;
}

export function filterAssessmentEvents(events, filters = {}) {
  return events.filter((event) => {
    if (filters.moduleCode && !moduleCodeMatches(event.moduleCode, filters.moduleCode)) return false;
    if (filters.type && event.assessmentType !== filters.type) return false;
    if (filters.classTestOnly && !event.suggestsClassTest) return false;
    return true;
  });
}

/** Monday-based week commencing → actual calendar date for a seminar weekday. */
export function dateOnSeminarWeek(weekCommencing, weekday) {
  const start = parseIsoDate(weekCommencing);
  if (!start) return String(weekCommencing ?? "").slice(0, 10);
  const dayIndex = WEEKDAYS.indexOf(weekday);
  if (dayIndex < 0) return formatIsoDate(start);
  const d = new Date(start);
  d.setDate(d.getDate() + dayIndex);
  return formatIsoDate(d);
}

/** Class tests run on the seminar day in the scheduled teaching week. */
export function computeClassTestDateForSeminar(event, seminar) {
  const weekStart = String(event.weekCommencing ?? "").slice(0, 10);
  if (weekStart && seminar?.Weekday) {
    return dateOnSeminarWeek(weekStart, seminar.Weekday);
  }
  if (event.dueDate) return String(event.dueDate).slice(0, 10);
  return weekStart;
}

export function parseIsoDate(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const d = new Date(`${s.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Normalize Excel / typed dates to yyyy-mm-dd for the semester start field. */
export function normalizeSemesterStartDate(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatIsoDate(value);
  const s = String(value).trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const uk = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (uk) {
    const year = uk[3].length === 2 ? 2000 + Number(uk[3]) : Number(uk[3]);
    return `${year}-${String(uk[2]).padStart(2, "0")}-${String(uk[1]).padStart(2, "0")}`;
  }
  const parsed = parseIsoDate(s);
  return parsed ? formatIsoDate(parsed) : s;
}

export function addWeeksToIso(isoStart, weeksAfter) {
  const start = parseIsoDate(isoStart);
  if (!start) return "";
  const d = new Date(start);
  d.setDate(d.getDate() + weeksAfter * 7);
  return formatIsoDate(d);
}

/** Infer semester start from Week 1 w/c dates in the schedule. */
export function inferSemesterStart(events) {
  const weekOnes = events.filter((e) => e.weekNumber === 1 && e.weekCommencing);
  if (weekOnes.length) {
    return weekOnes.map((e) => e.weekCommencing).sort()[0];
  }
  const dated = events.filter((e) => e.weekCommencing).sort((a, b) => a.weekCommencing.localeCompare(b.weekCommencing));
  return dated[0]?.weekCommencing || "";
}

export function resolveSemesterStart(project, events) {
  const stored = normalizeSemesterStartDate(project.getSemesterStartDate?.() || "");
  if (stored) return stored;
  return inferSemesterStart(events);
}

/**
 * @returns {{ weekNumber: number, weekLabel: string, weekCommencing: string, beforeSemester?: boolean } | null}
 */
export function getCurrentTeachingWeek(semesterStart, referenceDate = new Date()) {
  const start = parseIsoDate(semesterStart);
  if (!start) return null;

  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const diffDays = Math.floor((today - startDay) / 86400000);

  if (diffDays < 0) {
    return {
      weekNumber: 0,
      weekLabel: "Before semester",
      weekCommencing: semesterStart,
      beforeSemester: true,
      daysUntilStart: -diffDays,
    };
  }

  const weekNumber = Math.floor(diffDays / 7) + 1;
  return {
    weekNumber,
    weekLabel: `Week ${weekNumber}`,
    weekCommencing: addWeeksToIso(semesterStart, weekNumber - 1),
    beforeSemester: false,
    dayInWeek: (diffDays % 7) + 1,
  };
}

export function getEventDueDate(event, semesterStart = "") {
  if (event.dueDate) return event.dueDate;
  if (/during week \d+ lab/i.test(event.dueText || "") && event.weekCommencing) return event.weekCommencing;
  if (event.weekCommencing) return event.weekCommencing;
  if (semesterStart && event.weekNumber) return addWeeksToIso(semesterStart, event.weekNumber - 1);
  return "";
}

export function getUpcomingAssessments(events, options = {}) {
  const {
    referenceDate = new Date(),
    moduleCode = null,
    limit = 8,
    semesterStart = "",
  } = options;

  const todayStr = formatIsoDate(referenceDate);
  const current = getCurrentTeachingWeek(semesterStart, referenceDate);
  const currentWeekNum = current?.weekNumber || 0;

  return events
    .map((event) => ({
      event,
      dueDate: getEventDueDate(event, semesterStart),
    }))
    .filter(({ event }) => !moduleCode || moduleCodeMatches(event.moduleCode, moduleCode))
    .filter(({ event, dueDate }) => {
      if (dueDate && dueDate >= todayStr) return true;
      if (!dueDate && event.weekNumber >= currentWeekNum) return true;
      return false;
    })
    .sort((a, b) => {
      const da = a.dueDate || `9999-${String(a.event.weekNumber).padStart(2, "0")}`;
      const db = b.dueDate || `9999-${String(b.event.weekNumber).padStart(2, "0")}`;
      return da.localeCompare(db) || a.event.weekNumber - b.event.weekNumber;
    })
    .slice(0, limit)
    .map(({ event, dueDate }) => ({ ...event, effectiveDueDate: dueDate }));
}

export function buildAssessmentTimeline(events, options = {}) {
  const { semesterStart = "", currentWeek = null, moduleCode = null } = options;
  const filtered = moduleCode
    ? events.filter((e) => moduleCodeMatches(e.moduleCode, moduleCode))
    : events;

  const maxWeek = Math.max(
    14,
    currentWeek?.weekNumber || 0,
    ...filtered.map((e) => e.weekNumber || 0)
  );

  const weeks = [];
  for (let w = 1; w <= maxWeek; w++) {
    weeks.push({
      weekNumber: w,
      weekLabel: `Week ${w}`,
      weekCommencing: semesterStart ? addWeeksToIso(semesterStart, w - 1) : "",
      items: filtered.filter((e) => e.weekNumber === w),
      isCurrent: currentWeek?.weekNumber === w,
      isPast: currentWeek?.weekNumber > w,
    });
  }
  return weeks;
}

export function buildAssessmentTrackingExportRows(project) {
  const events = project.getAssessmentEvents();
  const semesterStart = project.getSemesterStartDate() || resolveSemesterStart(project, events);
  return events.map((event) => {
    const record = project.getAssessmentRecord(event.id);
    return {
      "Event ID": event.id,
      "Module code": event.moduleCode,
      "Module name": event.moduleName,
      Week: event.weekLabel,
      "Week commencing": event.weekCommencing,
      Assessment: event.assessmentCode || event.title,
      Type: getAssessmentTypeLabel(event.assessmentType),
      "Class test candidate": event.suggestsClassTest ? "Yes" : "",
      "Due date": getEventDueDate(event, semesterStart),
      Status: record.status,
      Tasks: record.tasks,
      Notes: record.notes,
      "Semester start": semesterStart,
    };
  });
}

export function parseAssessmentTrackingFromSheet(rows) {
  const records = {};
  let semesterStartDate = "";
  for (const row of rows) {
    if (row["Semester start"]) {
      semesterStartDate = normalizeSemesterStartDate(row["Semester start"]);
    }
    const id = String(row["Event ID"] ?? "").trim();
    if (!id || id === "_settings") continue;
    records[id] = {
      status: row.Status || "Not started",
      tasks: row.Tasks ?? "",
      notes: row.Notes ?? "",
    };
  }
  return { semesterStartDate, records };
}

/**
 * Combined issues, to-dos, and updates from assessment tracking + class test plans.
 * @returns {Array<{kind:string, priority:number, title:string, detail:string, linkTab?:string}>}
 */
export function buildActionItems(project) {
  const items = [];
  const events = project.getAssessmentEvents();

  for (const event of events) {
    const record = project.getAssessmentRecord(event.id);
    const label = `${event.moduleCode} · ${event.assessmentCode || event.title.slice(0, 40)} (${event.weekLabel})`;

    if (record.status === "Issue") {
      items.push({
        kind: "issue",
        priority: 1,
        title: label,
        detail: record.notes || record.tasks || "Marked as an issue — add notes on the Assessments tab.",
        linkTab: "assessment",
      });
    }

    if (String(record.tasks ?? "").trim()) {
      items.push({
        kind: "todo",
        priority: 2,
        title: label,
        detail: record.tasks.trim(),
        linkTab: "assessment",
      });
    }

    if (String(record.notes ?? "").trim() && record.status !== "Completed" && record.status !== "Submitted") {
      items.push({
        kind: "update",
        priority: 4,
        title: label,
        detail: record.notes.trim(),
        linkTab: "assessment",
      });
    }
  }

  for (const row of project.getTimetableRows().filter((r) => r.Type === "Seminar")) {
    const plan = normalizePlan(project.getPlan(planKey(row)));
    if (!plan.planned) continue;
    const label = `${row["Module code"]} · ${row.Campus} · ${row.Weekday} ${row["Start time"]}`;

    if (plan.status === "Issue") {
      items.push({
        kind: "issue",
        priority: 1,
        title: `Class test: ${label}`,
        detail: plan.notes || "Class test marked as issue.",
        linkTab: "tests",
      });
    }
    if (plan.status === "Invigilator Needed") {
      items.push({
        kind: "todo",
        priority: 2,
        title: `Invigilator needed: ${label}`,
        detail: plan.notes || "Assign an invigilator on the Class tests tab.",
        linkTab: "tests",
      });
    }
    if (!plan.invigilator && plan.planned && plan.status !== "Completed") {
      items.push({
        kind: "todo",
        priority: 3,
        title: `Missing invigilator: ${label}`,
        detail: "No invigilator assigned yet.",
        linkTab: "tests",
      });
    }
    if (String(plan.notes ?? "").trim()) {
      items.push({
        kind: "update",
        priority: 4,
        title: `Class test note: ${label}`,
        detail: plan.notes.trim(),
        linkTab: "tests",
      });
    }
  }

  const seen = new Set();
  return items
    .filter((item) => {
      const key = `${item.kind}|${item.title}|${item.detail.slice(0, 40)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
}

export function summarizeActionItems(items) {
  return {
    issues: items.filter((i) => i.kind === "issue").length,
    todos: items.filter((i) => i.kind === "todo").length,
    updates: items.filter((i) => i.kind === "update").length,
    total: items.length,
  };
}
