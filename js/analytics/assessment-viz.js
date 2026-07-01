import {
  getEventDueDate,
  getAssessmentTypeLabel,
  parseIsoDate,
  addWeeksToIso,
} from "./assessment.js";
import { parseGroups } from "../utils/groups.js";
import { cohortMetaForGroups } from "../utils/cohort.js";
import { parseFlexibleDate, weekdayName, weekCommencingMonday, dateSortKey, formatShortDate } from "../utils/dates.js";
import { teachingWeekCommencing } from "./class-test-viz.js";
import { unique } from "../utils/dom.js";
import { WEEKDAYS } from "../config/constants.js";

function moduleCodeMatches(a, b) {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

/** @param {import("../model/project.js").Project} project */
export function buildAssessmentScheduleItems(project, { semesterStart = "" } = {}) {
  const semStart = semesterStart || project.getSemesterStartDate?.() || "";
  const rows = project.getTimetableRows();

  return project.getAssessmentEvents().map((event) => {
    const due = getEventDueDate(event, semStart);
    const dueParsed = parseFlexibleDate(due) || parseIsoDate(due);
    const moduleRows = rows.filter((r) => moduleCodeMatches(r["Module code"], event.moduleCode));
    const campuses = unique(moduleRows.map((r) => r.Campus).filter(Boolean));
    const admissionGroups = unique(
      moduleRows.flatMap((r) => parseGroups(r.Activity, r["Student Groups"]).admissionGroups)
    );
    const { cohorts, primary } = cohortMetaForGroups(admissionGroups, semStart);
    const record = project.getAssessmentRecord(event.id);
    const wc =
      event.weekCommencing ||
      (semStart && event.weekNumber ? addWeeksToIso(semStart, event.weekNumber - 1) : "");

    return {
      eventId: event.id,
      moduleCode: event.moduleCode,
      moduleName: event.moduleName,
      assessmentCode: event.assessmentCode,
      assessmentType: event.assessmentType,
      weekNumber: event.weekNumber,
      weekLabel: event.weekLabel,
      weekCommencing: wc,
      dueDate: due,
      dueDateParsed: dueParsed,
      weekday: dueParsed ? weekdayName(dueParsed) : "",
      scheduleSemester: event.semester || "",
      suggestsClassTest: event.suggestsClassTest,
      status: record.status,
      tasks: record.tasks,
      notes: record.notes,
      dueText: event.dueText,
      weight: event.weight,
      rawText: event.rawText,
      title: event.title,
      campuses,
      campus: campuses[0] || "",
      cohorts,
      primaryCohort: primary,
      admissionGroups,
    };
  });
}

export function itemInAssessmentTeachingWeek(item, weekNum, semesterStart) {
  if (!weekNum) return false;
  if (item.weekNumber === weekNum) return true;
  if (item.dueDateParsed && semesterStart) {
    const itemWc = weekCommencingMonday(item.dueDateParsed);
    const weekWc = teachingWeekCommencing(semesterStart, weekNum);
    if (!itemWc || !weekWc) return false;
    return dateSortKey(itemWc) === dateSortKey(weekWc);
  }
  return false;
}

export function filterAssessmentItemsForWeek(items, weekNum, semesterStart) {
  return items.filter((item) => itemInAssessmentTeachingWeek(item, weekNum, semesterStart));
}

function compareAssessmentItems(a, b) {
  const week = (a.weekNumber || 999) - (b.weekNumber || 999);
  if (week) return week;
  const dateA = a.dueDateParsed ? dateSortKey(a.dueDateParsed) : 0;
  const dateB = b.dueDateParsed ? dateSortKey(b.dueDateParsed) : 0;
  if (dateA !== dateB) return dateA - dateB;
  return String(a.moduleCode).localeCompare(String(b.moduleCode));
}

export function groupAssessmentByWeek(items) {
  const buckets = new Map();
  for (const item of items) {
    const key = item.weekLabel || `Week ${item.weekNumber}` || "Unknown";
    if (!buckets.has(key)) {
      buckets.set(key, {
        label: key,
        weekNum: item.weekNumber,
        weekCommencing: item.weekCommencing ? parseIsoDate(String(item.weekCommencing).slice(0, 10)) : null,
        items: [],
      });
    }
    buckets.get(key).items.push(item);
  }
  for (const b of buckets.values()) b.items.sort(compareAssessmentItems);
  return [...buckets.values()].sort((a, b) => (a.weekNum || 999) - (b.weekNum || 999));
}

export function groupAssessmentByModule(items) {
  const buckets = new Map();
  for (const item of items) {
    if (!buckets.has(item.moduleCode)) buckets.set(item.moduleCode, { name: item.moduleCode, moduleName: item.moduleName, items: [] });
    buckets.get(item.moduleCode).items.push(item);
  }
  for (const b of buckets.values()) b.items.sort(compareAssessmentItems);
  return [...buckets.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function groupAssessmentByType(items) {
  const buckets = new Map();
  for (const item of items) {
    const key = item.assessmentType;
    if (!buckets.has(key)) buckets.set(key, { name: getAssessmentTypeLabel(key), type: key, items: [] });
    buckets.get(key).items.push(item);
  }
  for (const b of buckets.values()) b.items.sort(compareAssessmentItems);
  return [...buckets.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function groupAssessmentByCampus(items) {
  const buckets = new Map();
  for (const item of items) {
    const labels = item.campuses.length ? item.campuses : ["(Not in timetable)"];
    for (const campus of labels) {
      if (!buckets.has(campus)) buckets.set(campus, { name: campus, items: [] });
      buckets.get(campus).items.push(item);
    }
  }
  for (const b of buckets.values()) b.items.sort(compareAssessmentItems);
  return [...buckets.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function groupAssessmentByCohort(items) {
  const buckets = new Map();
  for (const item of items) {
    const entries =
      item.cohorts?.filter((c) => c.parsed).map((c) => ({
        key: c.cohortCode,
        name: `${c.cohortLabel} (${c.siteCode} · ${c.studyYear})`,
      })) || [];
    const list = entries.length ? entries : [{ key: "unknown", name: "Unknown cohort" }];
    for (const { key, name } of list) {
      if (!buckets.has(key)) buckets.set(key, { name, items: [] });
      buckets.get(key).items.push(item);
    }
  }
  for (const b of buckets.values()) b.items.sort(compareAssessmentItems);
  return [...buckets.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function groupAssessmentByScheduleSemester(items) {
  const buckets = new Map();
  for (const item of items) {
    const key = item.scheduleSemester || "(No semester label)";
    if (!buckets.has(key)) buckets.set(key, { name: key, items: [] });
    buckets.get(key).items.push(item);
  }
  for (const b of buckets.values()) b.items.sort(compareAssessmentItems);
  return [...buckets.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function buildAssessmentSemesterColumns(items, { semesterStart = "", currentWeek = null, maxWeeks = 14 } = {}) {
  const maxItemWeek = items.reduce((m, i) => Math.max(m, i.weekNumber || 0), 0);
  const currentNum = currentWeek?.weekNumber || 1;
  const total = Math.max(maxWeeks, maxItemWeek, currentNum);
  const columns = [];

  for (let w = 1; w <= total; w++) {
    columns.push({
      weekNum: w,
      weekLabel: `Week ${w}`,
      weekCommencing: semesterStart ? teachingWeekCommencing(semesterStart, w) : null,
      isCurrent: currentWeek && !currentWeek.beforeSemester && w === currentNum,
      isPast: currentWeek && !currentWeek.beforeSemester && w < currentNum,
      items: filterAssessmentItemsForWeek(items, w, semesterStart),
    });
  }
  return columns;
}

export function dayColumnsForAssessmentWeek(items, weekCommencing) {
  const byDay = new Map();
  const unscheduled = [];

  for (const item of items) {
    if (item.weekday && WEEKDAYS.includes(item.weekday)) {
      if (!byDay.has(item.weekday)) byDay.set(item.weekday, []);
      byDay.get(item.weekday).push(item);
    } else {
      unscheduled.push(item);
    }
  }

  const columns = WEEKDAYS.map((day, i) => {
    const d = weekCommencing
      ? new Date(weekCommencing.getFullYear(), weekCommencing.getMonth(), weekCommencing.getDate() + i, 12, 0, 0)
      : null;
    return {
      day,
      date: d,
      dateLabel: d ? formatShortDate(d) : "",
      items: [...(byDay.get(day) || [])].sort(compareAssessmentItems),
    };
  });

  return { columns, unscheduled: unscheduled.sort(compareAssessmentItems) };
}

export function listAssessmentFilterOptions(items) {
  const campuses = new Set();
  const siteCodes = new Set();
  const cohortMap = new Map();
  const studyYears = new Set();
  const semesters = new Set();
  const scheduleSemesters = new Set();
  const types = new Set();

  for (const item of items) {
    item.campuses.forEach((c) => campuses.add(c));
    if (item.assessmentType) types.add(item.assessmentType);
    if (item.scheduleSemester) scheduleSemesters.add(item.scheduleSemester);
    for (const c of item.cohorts || []) {
      if (!c.parsed) continue;
      siteCodes.add(c.siteCode);
      if (!cohortMap.has(c.cohortCode)) cohortMap.set(c.cohortCode, c.cohortLabel || c.cohortCode);
      studyYears.add(c.studyYear);
      if (c.studySemester != null) semesters.add(String(c.studySemester));
    }
  }

  return {
    campuses: [...campuses].sort(),
    siteCodes: [...siteCodes].sort(),
    cohortCodes: [...cohortMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, label]) => ({ code, label })),
    studyYears: [...studyYears].sort(),
    semesters: [...semesters].sort((a, b) => Number(a) - Number(b)),
    scheduleSemesters: [...scheduleSemesters].sort(),
    types: [...types].sort(),
  };
}

export function itemMatchesAssessmentScheduleFilters(item, filters = {}) {
  if (filters.type && item.assessmentType !== filters.type) return false;
  if (filters.scheduleSemester && item.scheduleSemester !== filters.scheduleSemester) return false;
  if (filters.campus && !item.campuses.includes(filters.campus)) return false;

  const parsed = (item.cohorts || []).filter((c) => c.parsed);
  if (filters.siteCode || filters.cohortCode || filters.studyYear || filters.studySemester) {
    if (!parsed.length) return false;
    const match = parsed.some((c) => {
      if (filters.siteCode && c.siteCode !== filters.siteCode) return false;
      if (filters.cohortCode && c.cohortCode !== filters.cohortCode) return false;
      if (filters.studyYear && c.studyYear !== filters.studyYear) return false;
      if (filters.studySemester && String(c.studySemester) !== String(filters.studySemester)) return false;
      return true;
    });
    if (!match) return false;
  }
  return true;
}
