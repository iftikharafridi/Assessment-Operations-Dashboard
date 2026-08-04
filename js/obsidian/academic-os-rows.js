import { enrichAssessmentEvent } from "../excel/assessment-format.js";
import { normalizeSemesterNumber } from "../excel/assessment-parser.js";
import { parseGroups } from "../utils/groups.js";
import { normalizePlan, planKey } from "../planner/plans.js";
import { getTestSlot } from "../utils/time.js";
import { weekCommencingMonday, parseFlexibleDate } from "../utils/dates.js";
import { formatIsoDate } from "./md-table.js";
import {
  ASSESSMENT_SCHEDULE_MD_HEADERS,
  CLASS_TEST_SCHEDULE_MD_HEADERS,
  ACADEMIC_OS_SCHEDULING_LABELS,
} from "./academic-os-contract.js";
import { parseAdmissionGroup } from "../utils/cohort.js";

/** Parse "Week 7", "Week -1", "Week 14", or bare numbers into an operational week value. */
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

function statusFromAssessment(event) {
  if (event.status && event.status !== "Not started") return event.status;
  return "Planned";
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
    const letter = g.match(/\b(?:Grp|Group)\s*([A-Z])\b/i)?.[1] || g.match(/\b([A-Z])\b/)?.[1];
    if (letter && !letters.includes(letter.toUpperCase())) letters.push(letter.toUpperCase());
  }
  return { cohort, group: letters.join(" & ") };
}

function feedbackDateOnly(event) {
  return formatIsoDate(event.feedbackDate) || formatIsoDate(parseFlexibleDate(event.feedbackText)) || "";
}

/**
 * Build Assessment Schedule Markdown table rows matching the semester template.
 */
export function buildAssessmentScheduleMdRows(project) {
  const events = project.getAssessmentEvents?.() || [];
  const rows = [];
  const warnings = [];
  const timetable = project.getTimetableRows?.() || [];

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
      (moduleRows.length === 1
        ? moduleRows[0].Campus
        : moduleRows.length
          ? "All"
          : "");
    const firstGroups = moduleRows[0]
      ? parseGroups(moduleRows[0].Activity, moduleRows[0]["Student Groups"])
      : { letterGroups: [], admissionGroups: [] };
    const { cohort, group } = cohortAndGroupFromText(firstGroups.admissionGroups.join(", "));

    rows.push([
      statusFromAssessment(e),
      e.moduleCode || "",
      e.moduleName || "",
      formatSemesterLabel(e.semester, e.scheduleTitle),
      opWeek,
      e.cohortWeek != null && e.cohortWeek !== "" ? String(e.cohortWeek) : "",
      e.assessmentCode || e.title || "",
      e.assessmentFormat || "",
      e.weight || "",
      basisLabel,
      showWc ? formatIsoDate(e.weekCommencing) : "",
      showFixed ? formatIsoDate(e.exactDueDate) : "",
      feedbackDateOnly(e),
      campus,
      cohort || (moduleRows.length ? "All" : ""),
      group || (moduleRows.length ? "All" : ""),
      "",
      "",
      "",
      "",
      "",
    ]);

    if (basis === "notSpecified") {
      warnings.push(`${e.moduleCode || "?"} ${e.assessmentCode || ""}: scheduling basis not specified.`);
    }
  }

  return { headers: ASSESSMENT_SCHEDULE_MD_HEADERS, rows, warnings };
}

function durationLabel(plan, session) {
  if (plan.durationMinutes) return `${plan.durationMinutes} minutes`;
  const slot = getTestSlot(session, plan);
  if (!slot.start || !slot.end) return "";
  const [sh, sm] = String(slot.start).split(":").map(Number);
  const [eh, em] = String(slot.end).split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return "";
  const mins = eh * 60 + em - (sh * 60 + sm);
  return mins > 0 ? `${mins} minutes` : "";
}

function testTypeLabel(plan, session) {
  return "Practical class test";
}

export function buildClassTestScheduleMdRows(project) {
  const planned = project
    .getTimetableRows()
    .filter((r) => r.Type === "Seminar" && normalizePlan(project.getPlan(planKey(r))).planned);
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

    if (!p.invigilator) {
      warnings.push(`${s["Module code"]} (${s.Campus}): missing invigilator.`);
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
      p.room || s.Room || "",
      p.leadTutor || s.Staff || "",
      testTypeLabel(p, s),
      durationLabel(p, s),
      p.notes || "",
    ]);
  }

  return { headers: CLASS_TEST_SCHEDULE_MD_HEADERS, rows, warnings };
}
