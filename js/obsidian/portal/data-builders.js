import { formatMarkdownTable, formatIsoDate } from "../md-table.js";
import { enrichAssessmentEvent } from "../../excel/assessment-format.js";
import { normalizeSemesterNumber } from "../../excel/assessment-parser.js";
import {
  resolveSemesterStart,
  getCurrentTeachingWeek,
  buildActionItems,
} from "../../analytics/assessment.js";
import {
  computeDashboardMetrics,
  detectConflicts,
  buildMissingInvigilators,
  getPlannedSeminars,
} from "../../analytics/dashboard.js";
import { buildInvigilationPlanRows } from "../../analytics/invigilation.js";
import { parseGroups } from "../../utils/groups.js";
import { parseAdmissionGroup } from "../../utils/cohort.js";
import { normalizePlan, planKey } from "../../planner/plans.js";
import { getTestSlot, timeToMinutes } from "../../utils/time.js";
import { weekCommencingMonday, parseFlexibleDate } from "../../utils/dates.js";
import { unique } from "../../utils/dom.js";
import { APP_VERSION } from "../../config/constants.js";
import {
  TEACHING_TIMETABLE_HEADERS,
  MODULES_HEADERS,
  TEACHING_TEAM_HEADERS,
  ASSESSMENT_SCHEDULE_HEADERS,
  CLASS_TEST_SCHEDULE_HEADERS,
  INVIGILATION_HEADERS,
  ISSUES_HEADERS,
  COHORT_CALENDAR_HEADERS,
  SEMESTER_SETTINGS_HEADERS,
  EXPORT_SUMMARY_HEADERS,
  ACADEMIC_OS_SCHEDULING_LABELS,
} from "./paths.js";

export function parseOperationalWeek(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const s = String(value).trim();
  const m = s.match(/week\s*(-?\d+)/i) || s.match(/^(-?\d+)$/);
  if (m) return m[1];
  return s;
}

function formatSemesterLabel(semester, scheduleTitle = "") {
  const num = normalizeSemesterNumber(semester);
  const year = String(scheduleTitle || "").match(/20\d{2}/)?.[0] || "";
  if (num && year) return `S${num} ${year}`;
  if (num) return `S${num}`;
  return String(semester || "").trim();
}

function cohortAndGroupFromText(studentGroups) {
  const groups = String(studentGroups || "")
    .split(/[,;]/)
    .map((g) => g.trim())
    .filter(Boolean);
  let cohort = "";
  const letters = [];
  for (const g of groups) {
    const parsed = parseAdmissionGroup(g);
    if (parsed?.parsed && parsed.cohortLabel && !cohort) cohort = parsed.cohortLabel;
    const letter =
      g.match(/\b(?:Grp|Group)\s*([A-Z])\b/i)?.[1] ||
      (parsed?.parsed ? g.match(/\b([A-Z])\s*$/)?.[1] : null);
    if (letter && !letters.includes(letter.toUpperCase())) letters.push(letter.toUpperCase());
  }
  return { cohort, group: letters.join(" & ") };
}

function sessionHours(start, end) {
  const mins = timeToMinutes(end) - timeToMinutes(start);
  return mins > 0 ? Math.round((mins / 60) * 100) / 100 : 0;
}

function splitStaffNames(staff) {
  return String(staff || "")
    .split(/[,;/&]| and /i)
    .map((s) => s.trim())
    .filter((s) => s && !/^tbc|tba|n\/a|none$/i.test(s));
}

export function buildTeachingTimetableRows(project) {
  const warnings = [];
  const rows = project.getTimetableRows().map((r) => {
    if (!String(r.Staff || "").trim()) {
      warnings.push(`Missing staff: ${r["Module code"] || "?"} (${r.Campus || "?"}) ${r.Weekday || ""}`);
    }
    return [
      r.ID ?? "",
      r["Module code"] || "",
      r["Module name"] || "",
      r.Activity || "",
      r.Type || "",
      r.Weekday || "",
      r["Start time"] || "",
      r["End time"] || "",
      r.Campus || "",
      r.Staff || "",
      r["Student Groups"] || "",
      r.Size ?? "",
    ];
  });
  return { headers: TEACHING_TIMETABLE_HEADERS, rows, warnings };
}

export function buildModulesRows(project) {
  const timetable = project.getTimetableRows();
  const events = project.getAssessmentEvents().map(enrichAssessmentEvent);
  /** @type {Map<string, object>} */
  const byCode = new Map();

  for (const e of events) {
    const code = String(e.moduleCode || "").toUpperCase();
    if (!code) continue;
    const cur = byCode.get(code) || {
      code,
      name: "",
      course: "",
      crn: "",
      semester: "",
      coordinator: "",
      leader: "",
      campuses: new Set(),
      staff: new Set(),
      groups: new Set(),
      sessions: 0,
      assessments: 0,
    };
    cur.name = cur.name || e.moduleName || "";
    cur.course = cur.course || e.course || "";
    cur.crn = cur.crn || e.crn || "";
    cur.semester = cur.semester || formatSemesterLabel(e.semester, e.scheduleTitle);
    cur.coordinator = cur.coordinator || e.moduleCoordinator || "";
    cur.leader = cur.leader || e.qaheModuleLeader || "";
    cur.assessments += 1;
    byCode.set(code, cur);
  }

  for (const r of timetable) {
    const code = String(r["Module code"] || "").toUpperCase();
    if (!code) continue;
    const cur = byCode.get(code) || {
      code,
      name: "",
      course: "",
      crn: "",
      semester: "",
      coordinator: "",
      leader: "",
      campuses: new Set(),
      staff: new Set(),
      groups: new Set(),
      sessions: 0,
      assessments: 0,
    };
    cur.name = cur.name || r["Module name"] || "";
    if (r.Campus) cur.campuses.add(r.Campus);
    for (const s of splitStaffNames(r.Staff)) cur.staff.add(s);
    for (const g of String(r["Student Groups"] || "")
      .split(/[,;]/)
      .map((x) => x.trim())
      .filter(Boolean)) {
      cur.groups.add(g);
    }
    cur.sessions += 1;
    byCode.set(code, cur);
  }

  const rows = [...byCode.values()]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((m) => [
      m.code,
      m.name,
      m.course,
      m.crn,
      m.semester,
      m.coordinator,
      m.leader,
      [...m.campuses].sort().join(", "),
      [...m.staff].sort().join(", "),
      [...m.groups].sort().join(", "),
      String(m.sessions),
      String(m.assessments),
    ]);

  return { headers: MODULES_HEADERS, rows, warnings: [] };
}

export function buildTeachingTeamRows(project) {
  /** @type {Map<string, object>} */
  const map = new Map();
  for (const r of project.getTimetableRows()) {
    const staffList = splitStaffNames(r.Staff);
    if (!staffList.length) continue;
    for (const staff of staffList) {
      const key = [staff, r["Module code"], r.Campus].join("|");
      const cur = map.get(key) || {
        staff,
        moduleCode: r["Module code"] || "",
        moduleName: r["Module name"] || "",
        campus: r.Campus || "",
        sessions: 0,
        lectures: 0,
        seminars: 0,
        hours: 0,
      };
      cur.sessions += 1;
      if (/lecture/i.test(r.Type || "")) cur.lectures += 1;
      if (/seminar/i.test(r.Type || "")) cur.seminars += 1;
      cur.hours += sessionHours(r["Start time"], r["End time"]);
      map.set(key, cur);
    }
  }

  const rows = [...map.values()]
    .sort(
      (a, b) =>
        a.staff.localeCompare(b.staff) ||
        a.moduleCode.localeCompare(b.moduleCode) ||
        a.campus.localeCompare(b.campus)
    )
    .map((t) => [
      t.staff,
      t.moduleCode,
      t.moduleName,
      t.campus,
      String(t.sessions),
      String(t.lectures),
      String(t.seminars),
      String(Math.round(t.hours * 100) / 100),
    ]);

  return { headers: TEACHING_TEAM_HEADERS, rows, warnings: [] };
}

export function buildAssessmentSchedulePortalRows(project) {
  const events = project.getAssessmentEvents();
  const timetable = project.getTimetableRows();
  const warnings = [];
  const rows = [];

  const sorted = events
    .map((e) => enrichAssessmentEvent(e))
    .sort(
      (a, b) =>
        String(a.exactDueDate || a.weekCommencing || "9999").localeCompare(
          String(b.exactDueDate || b.weekCommencing || "9999")
        ) || String(a.moduleCode).localeCompare(String(b.moduleCode))
    );

  for (const e of sorted) {
    const basis = e.schedulingBasis || "notSpecified";
    const basisLabel = ACADEMIC_OS_SCHEDULING_LABELS[basis] || basis;
    const showWc = basis === "weekCommencing" || basis === "mixed";
    const showFixed = basis === "fixedDeadline" || basis === "mixed";
    const opWeek =
      e.weekNumber != null && e.weekNumber !== ""
        ? String(e.weekNumber)
        : parseOperationalWeek(e.weekLabel);

    const moduleRows = timetable.filter(
      (r) => String(r["Module code"]).toLowerCase() === String(e.moduleCode || "").toLowerCase()
    );
    const campus =
      e.campus ||
      (moduleRows.length === 1 ? moduleRows[0].Campus : moduleRows.length ? "All" : "");
    const firstGroups = moduleRows[0]
      ? parseGroups(moduleRows[0].Activity, moduleRows[0]["Student Groups"])
      : { letterGroups: [], admissionGroups: [] };
    const { cohort, group } = cohortAndGroupFromText(firstGroups.admissionGroups.join(", "));
    const record = project.getAssessmentRecord?.(e.id);
    const status = record?.status && record.status !== "Not started" ? record.status : "Planned";

    if (basis === "notSpecified") {
      warnings.push(`${e.moduleCode || "?"} ${e.assessmentCode || ""}: scheduling basis not specified.`);
    }
    if (!e.exactDueDate && !e.weekCommencing && !opWeek) {
      warnings.push(`${e.moduleCode || "?"} ${e.assessmentCode || ""}: missing assessment date.`);
    }
    if (moduleRows.length === 0) {
      warnings.push(`${e.moduleCode || "?"}: unmatched assessment module (no timetable rows).`);
    }

    rows.push([
      status,
      e.moduleCode || "",
      e.moduleName || "",
      e.course || "",
      e.crn || "",
      formatSemesterLabel(e.semester, e.scheduleTitle),
      opWeek,
      e.cohortWeek != null && e.cohortWeek !== "" ? String(e.cohortWeek) : "",
      e.assessmentCode || e.title || "",
      e.assessmentFormat || "",
      e.weight || "",
      basisLabel,
      showWc ? formatIsoDate(e.weekCommencing) : "",
      showFixed ? formatIsoDate(e.exactDueDate) : "",
      formatIsoDate(e.feedbackDate) || "",
      campus,
      cohort || (moduleRows.length ? "All" : ""),
      group || (moduleRows.length ? "All" : ""),
      "",
      "",
      "",
      "",
      e.moduleCoordinator || "",
      e.qaheModuleLeader || "",
      "",
    ]);
  }

  return { headers: ASSESSMENT_SCHEDULE_HEADERS, rows, warnings };
}

export function buildClassTestSchedulePortalRows(project) {
  const planned = getPlannedSeminars(project);
  const rows = [];
  const warnings = [];

  const sorted = planned.slice().sort((a, b) => {
    const pa = normalizePlan(project.getPlan(planKey(a)));
    const pb = normalizePlan(project.getPlan(planKey(b)));
    return (
      String(pa.testDate || "").localeCompare(String(pb.testDate || "")) ||
      String(a.Campus).localeCompare(String(b.Campus)) ||
      String(a["Module code"]).localeCompare(String(b["Module code"]))
    );
  });

  for (const s of sorted) {
    const p = normalizePlan(project.getPlan(planKey(s)));
    const slot = getTestSlot(s, p);
    const groups = parseGroups(s.Activity, s["Student Groups"]);
    const { cohort, group } = cohortAndGroupFromText(groups.admissionGroups.join(", "));
    const opWeek = parseOperationalWeek(p.testWeek);
    const testDate = formatIsoDate(p.testDate);
    let wc = "";
    const parsedDate = parseFlexibleDate(p.testDate);
    if (parsedDate) {
      const monday = weekCommencingMonday(parsedDate);
      wc = monday ? formatIsoDate(monday) : "";
    }

    if (!p.invigilator) warnings.push(`${s["Module code"]} (${s.Campus}): missing invigilator.`);
    if (!p.room) warnings.push(`${s["Module code"]} (${s.Campus}): missing room.`);

    let duration = "";
    if (p.durationMinutes) duration = `${p.durationMinutes} minutes`;
    else if (slot.start && slot.end) {
      const mins = timeToMinutes(slot.end) - timeToMinutes(slot.start);
      if (mins > 0) duration = `${mins} minutes`;
    }

    rows.push([
      p.status || "Planned",
      s["Module code"] || "",
      s["Module name"] || "",
      s.Campus || "",
      cohort,
      group || groups.letterGroups.join(" & "),
      opWeek,
      "",
      wc,
      testDate,
      slot.start || "",
      slot.end || "",
      p.room || "",
      p.leadTutor || s.Staff || "",
      p.invigilator || "",
      "Practical class test",
      duration,
      p.paperReady ? "Yes" : "No",
      p.lodReady ? "Yes" : "No",
      p.notes || "",
    ]);
  }

  return { headers: CLASS_TEST_SCHEDULE_HEADERS, rows, warnings };
}

export function buildInvigilationRows(project) {
  const warnings = [];
  let raw = [];
  try {
    raw = buildInvigilationPlanRows(project) || [];
  } catch {
    raw = [];
  }

  if (!raw.length) {
    for (const s of getPlannedSeminars(project)) {
      const p = normalizePlan(project.getPlan(planKey(s)));
      const slot = getTestSlot(s, p);
      raw.push({
        "Module code": s["Module code"],
        "Module name": s["Module name"],
        Campus: s.Campus,
        Date: p.testDate || "",
        Weekday: slot.weekday || s.Weekday,
        "Start time": slot.start,
        "End time": slot.end,
        Room: p.room || "",
        "Lead tutor": p.leadTutor || s.Staff || "",
        Invigilator: p.invigilator || "",
        Availability: "",
        Warning: p.invigilator ? "" : "Missing invigilator",
        Status: p.status || "",
      });
    }
  }

  const rows = raw.map((r) => {
    if (!r.Invigilator) warnings.push(`Invigilation gap: ${r["Module code"] || "?"} (${r.Campus || "?"})`);
    const time = r["Start time"] && r["End time"]
      ? null
      : String(r.Time || "").split(/\s*[–-]\s*/);
    return [
      r["Module code"] || "",
      r["Module name"] || "",
      r.Campus || "",
      formatIsoDate(r.Date || r["Test date"]) || r.Date || r["Test date"] || "",
      r.Weekday || r.Day || "",
      r["Start time"] || time?.[0] || "",
      r["End time"] || time?.[1] || "",
      r.Room || "",
      r["Lead tutor"] || "",
      r.Invigilator || "",
      r.Availability || "",
      r.Warning || "",
      r.Status || "",
    ];
  });

  return { headers: INVIGILATION_HEADERS, rows, warnings };
}

export function buildIssuesRows(project) {
  const actions = buildActionItems(project);
  const conflicts = detectConflicts(project);
  const missing = buildMissingInvigilators(project);
  const rows = [];

  for (const a of actions) {
    rows.push([
      a.kind || "issue",
      a.kind === "issue" ? "High" : a.kind === "todo" ? "Medium" : "Low",
      String(a.priority ?? ""),
      "",
      "",
      "",
      a.title || "",
      a.detail || "",
      "Open",
    ]);
  }

  for (const c of conflicts) {
    rows.push([
      c.type || "conflict",
      "High",
      "1",
      "",
      "",
      "",
      c.message || "Conflict",
      "Resolve timetable/room/invigilator clash",
      "Open",
    ]);
  }

  for (const m of missing) {
    rows.push([
      "missing-invigilator",
      "High",
      "2",
      m.Campus || "",
      m["Module code"] || "",
      "",
      `Missing invigilator: ${m["Module code"] || ""}`,
      "Assign an invigilator on the Class tests / Invigilation tab",
      "Open",
    ]);
  }

  return { headers: ISSUES_HEADERS, rows, warnings: [] };
}

export function buildCohortCalendarRows(project) {
  const semesterStart = resolveSemesterStart(project, project.getAssessmentEvents());
  const current = getCurrentTeachingWeek(semesterStart);
  const warnings = [];
  /** @type {Map<string, object>} */
  const map = new Map();

  for (const r of project.getTimetableRows()) {
    const groups = parseGroups(r.Activity, r["Student Groups"]);
    const labels = groups.admissionGroups.length
      ? groups.admissionGroups
      : String(r["Student Groups"] || "")
          .split(/[,;]/)
          .map((g) => g.trim())
          .filter(Boolean);

    for (const label of labels) {
      const parsed = parseAdmissionGroup(label);
      const key = parsed.parsed
        ? `${parsed.cohortLabel}|${parsed.siteName}|${parsed.programme}|${label}`
        : label;
      const cur = map.get(key) || {
        cohortLabel: parsed.parsed ? parsed.cohortLabel : label,
        raw: label,
        campus: parsed.parsed ? parsed.siteName : r.Campus || "",
        programme: parsed.parsed ? parsed.programme : "",
        intake: parsed.parsed ? parsed.cohortLabel : "",
        letter: "",
        studyYear: parsed.parsed ? parsed.studyYear : "",
        sessions: 0,
        modules: new Set(),
        warning: "",
      };
      if (!parsed.parsed) {
        cur.warning = "Malformed or unparsed student group";
        warnings.push(`Malformed student group: ${label}`);
      }
      const letter = label.match(/\b([A-Z])\s*$/)?.[1] || "";
      if (letter) cur.letter = letter;
      cur.sessions += 1;
      if (r["Module code"]) cur.modules.add(r["Module code"]);
      map.set(key, cur);
    }
  }

  const rows = [...map.values()]
    .sort((a, b) => a.cohortLabel.localeCompare(b.cohortLabel) || a.raw.localeCompare(b.raw))
    .map((c) => {
      let cohortWeek = "";
      if (!semesterStart) {
        cohortWeek = "";
        c.warning = c.warning || "Semester start unknown — cohort week left blank";
      } else if (current && !current.beforeSemester) {
        // Without per-cohort start dates, leave blank rather than guessing offset
        cohortWeek = "";
        if (!c.warning) c.warning = "Cohort-specific start not configured — week left blank";
      }
      return [
        c.cohortLabel,
        c.raw,
        c.campus,
        c.programme,
        c.intake,
        c.letter,
        c.studyYear,
        String(c.sessions),
        [...c.modules].sort().join(", "),
        cohortWeek,
        c.warning,
      ];
    });

  return { headers: COHORT_CALENDAR_HEADERS, rows, warnings };
}

export function buildSemesterSettingsRows(project, exportMeta = {}) {
  const events = project.getAssessmentEvents();
  const semesterStart = resolveSemesterStart(project, events);
  const current = getCurrentTeachingWeek(semesterStart);
  const metrics = computeDashboardMetrics(project);
  const rows = [
    ["Project name", project.name || ""],
    ["App version", APP_VERSION],
    ["Semester start (Week 1 W/C)", semesterStart || ""],
    ["Current operational week", current?.weekLabel || ""],
    ["Current week commencing", current?.weekCommencing || ""],
    ["Export time", exportMeta.exportedAt || new Date().toISOString()],
    ["Timetable sessions", String(metrics.totalSessions)],
    ["Assessment events", String(metrics.assessmentEvents)],
    ["Planned class tests", String(metrics.plannedTests)],
    ["Open conflicts", String(metrics.conflicts)],
  ];
  return { headers: SEMESTER_SETTINGS_HEADERS, rows, warnings: [] };
}

export function buildExportSummaryRows(summary) {
  const rows = [
    ["Pages created/updated", String(summary.pagesUpdated ?? 0), ""],
    ["Data files created/updated", String(summary.dataUpdated ?? 0), ""],
    ["Assets created/updated", String(summary.assetsUpdated ?? 0), ""],
    ["Timetable rows", String(summary.rowCounts?.timetable ?? 0), ""],
    ["Module rows", String(summary.rowCounts?.modules ?? 0), ""],
    ["Teaching team rows", String(summary.rowCounts?.teachingTeam ?? 0), ""],
    ["Assessment rows", String(summary.rowCounts?.assessments ?? 0), ""],
    ["Class test rows", String(summary.rowCounts?.classTests ?? 0), ""],
    ["Invigilation rows", String(summary.rowCounts?.invigilation ?? 0), ""],
    ["Issue rows", String(summary.rowCounts?.issues ?? 0), ""],
    ["Cohort rows", String(summary.rowCounts?.cohorts ?? 0), ""],
    ["Warnings", String(summary.warnings?.length ?? 0), ""],
  ];
  return { headers: EXPORT_SUMMARY_HEADERS, rows, warnings: [] };
}

export function tableDocument(title, headers, rows) {
  return `${formatMarkdownTable(headers, rows)}\n`;
}

export function collectPortalData(project, exportMeta = {}) {
  const timetable = buildTeachingTimetableRows(project);
  const modules = buildModulesRows(project);
  const team = buildTeachingTeamRows(project);
  const assessments = buildAssessmentSchedulePortalRows(project);
  const classTests = buildClassTestSchedulePortalRows(project);
  const invigilation = buildInvigilationRows(project);
  const issues = buildIssuesRows(project);
  const cohorts = buildCohortCalendarRows(project);
  const settings = buildSemesterSettingsRows(project, exportMeta);

  const warnings = [
    ...timetable.warnings,
    ...modules.warnings,
    ...team.warnings,
    ...assessments.warnings,
    ...classTests.warnings,
    ...invigilation.warnings,
    ...issues.warnings,
    ...cohorts.warnings,
  ];

  const seminars = project.getTimetableRows().filter((r) => r.Type === "Seminar");
  const planned = getPlannedSeminars(project);
  const unplannedCandidates = seminars.filter((r) => !normalizePlan(project.getPlan(planKey(r))).planned);

  const events = project.getAssessmentEvents().map(enrichAssessmentEvent);
  const fixed = events.filter((e) => e.schedulingBasis === "fixedDeadline").length;
  const wc = events.filter((e) => e.schedulingBasis === "weekCommencing").length;

  return {
    tables: { timetable, modules, team, assessments, classTests, invigilation, issues, cohorts, settings },
    warnings: unique(warnings),
    metrics: {
      ...computeDashboardMetrics(project),
      modules: modules.rows.length,
      staff: unique(team.rows.map((r) => r[0])).length,
      campuses: unique(project.getTimetableRows().map((r) => r.Campus).filter(Boolean)).length,
      fixedDeadlines: fixed,
      groupBased: wc,
      unplannedCandidates: unplannedCandidates.length,
      openIssues: issues.rows.length,
      qualityWarnings: warnings.length + (project.importWarnings?.length || 0),
    },
    semesterStart: resolveSemesterStart(project, project.getAssessmentEvents()),
    currentWeek: getCurrentTeachingWeek(resolveSemesterStart(project, project.getAssessmentEvents())),
    exportMeta,
  };
}
