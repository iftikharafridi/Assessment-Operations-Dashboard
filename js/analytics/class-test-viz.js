import { getPlannedSeminars, sessionHasConflict } from "./dashboard.js";
import { normalizePlan, planKey } from "../planner/plans.js";
import { getTestSlot, timeToMinutes } from "../utils/time.js";
import { parseGroups } from "../utils/groups.js";
import { cohortMetaForGroups } from "../utils/cohort.js";
import { addWeeksToIso, parseIsoDate } from "./assessment.js";
import {
  parseFlexibleDate,
  dateSortKey,
  weekdayName,
  weekCommencingMonday,
  formatShortDate,
  formatUkDate,
  parseTestWeekNumber,
} from "../utils/dates.js";
import { WEEKDAYS } from "../config/constants.js";

/**
 * @typedef {Object} ClassTestItem
 * @property {string} sessionId
 * @property {string} moduleCode
 * @property {string} moduleName
 * @property {string} campus
 * @property {string[]} letterGroups
 * @property {string[]} admissionGroups
 * @property {string} testWeek
 * @property {number|null} testWeekNum
 * @property {string} testDate
 * @property {Date|null} testDateParsed
 * @property {string} weekday
 * @property {string} start
 * @property {string} end
 * @property {string} room
 * @property {string} invigilator
 * @property {string} status
 * @property {string} size
 * @property {boolean} hasConflict
 * @property {string} seminarSlot
 */

/** @returns {ClassTestItem[]} */
export function buildClassTestItems(project, { semesterStart = "" } = {}) {
  const semStart = semesterStart || project.getSemesterStartDate?.() || "";

  return getPlannedSeminars(project)
    .map((session) => {
      const sid = planKey(session);
      const plan = normalizePlan(project.getPlan(sid));
      const slot = getTestSlot(session, plan);
      const groups = parseGroups(session.Activity, session["Student Groups"]);
      const { cohorts, primary } = cohortMetaForGroups(groups.admissionGroups, semStart);
      const parsed = parseFlexibleDate(slot.testDate);
      const weekday = parsed ? weekdayName(parsed) : slot.weekday;
      const weekNum = parseTestWeekNumber(slot.testWeek);

      return {
        sessionId: sid,
        moduleCode: session["Module code"] || "",
        moduleName: session["Module name"] || "",
        campus: session.Campus || "",
        letterGroups: groups.letterGroups,
        admissionGroups: groups.admissionGroups,
        cohorts,
        primaryCohort: primary,
        testWeek: slot.testWeek || "",
        testWeekNum: weekNum,
        testDate: slot.testDate || "",
        testDateParsed: parsed,
        weekday,
        start: slot.start,
        end: slot.end,
        room: plan.room || session.Room || "",
        invigilator: plan.invigilator || "",
        status: plan.status,
        size: session.Size || "",
        hasConflict: sessionHasConflict(project, sid),
        seminarSlot: `${session.Weekday} ${session["Start time"]}–${session["End time"]}`,
      };
    })
    .sort(compareClassTestItems);
}

function compareClassTestItems(a, b) {
  const weekA = a.testWeekNum ?? 999;
  const weekB = b.testWeekNum ?? 999;
  if (weekA !== weekB) return weekA - weekB;

  const dateA = a.testDateParsed ? dateSortKey(a.testDateParsed) : 0;
  const dateB = b.testDateParsed ? dateSortKey(b.testDateParsed) : 0;
  if (dateA !== dateB) return dateA - dateB;

  const dayA = WEEKDAYS.indexOf(a.weekday);
  const dayB = WEEKDAYS.indexOf(b.weekday);
  if (dayA !== dayB) return (dayA < 0 ? 99 : dayA) - (dayB < 0 ? 99 : dayB);

  const timeCmp = timeToMinutes(a.start) - timeToMinutes(b.start);
  if (timeCmp) return timeCmp;

  const campus = String(a.campus).localeCompare(String(b.campus));
  if (campus) return campus;

  return String(a.moduleCode).localeCompare(String(b.moduleCode));
}

/** @param {ClassTestItem[]} items */
export function groupClassTestsByWeek(items) {
  const buckets = new Map();

  for (const item of items) {
    const key = item.testWeek || "__unscheduled__";
    if (!buckets.has(key)) {
      buckets.set(key, {
        label: item.testWeek || "Not scheduled",
        weekNum: item.testWeekNum,
        weekCommencing: item.testDateParsed ? weekCommencingMonday(item.testDateParsed) : null,
        items: [],
      });
    }
    const bucket = buckets.get(key);
    bucket.items.push(item);
    if (!bucket.weekCommencing && item.testDateParsed) {
      bucket.weekCommencing = weekCommencingMonday(item.testDateParsed);
    }
  }

  return [...buckets.values()].sort((a, b) => {
    if (a.weekNum == null && b.weekNum == null) return a.label.localeCompare(b.label);
    if (a.weekNum == null) return 1;
    if (b.weekNum == null) return -1;
    return a.weekNum - b.weekNum;
  });
}

/** @param {ClassTestItem[]} items */
export function groupClassTestsByStudentGroup(items) {
  const buckets = new Map();

  for (const item of items) {
    const labels =
      item.admissionGroups.length > 0
        ? item.admissionGroups
        : item.letterGroups.length > 0
          ? item.letterGroups.map((g) => `Grp ${g}`)
          : ["(No group listed)"];

    for (const label of labels) {
      const key = label.toLowerCase();
      if (!buckets.has(key)) buckets.set(key, { name: label, items: [] });
      buckets.get(key).items.push(item);
    }
  }

  for (const bucket of buckets.values()) {
    bucket.items.sort(compareClassTestItems);
  }

  return [...buckets.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** @param {ClassTestItem[]} items */
export function groupClassTestsByCalendarWeek(items) {
  const buckets = new Map();

  for (const item of items) {
    const wc = item.testDateParsed ? weekCommencingMonday(item.testDateParsed) : null;
    const key = wc ? formatUkDate(wc) : item.testWeek || "__unscheduled__";
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: wc
          ? `w/c ${formatShortDate(wc)}`
          : item.testWeek
            ? item.testWeek
            : "Dates not set",
        weekCommencing: wc,
        weekNum: item.testWeekNum,
        items: [],
      });
    }
    buckets.get(key).items.push(item);
  }

  return [...buckets.values()].sort((a, b) => {
    if (a.weekCommencing && b.weekCommencing) {
      return dateSortKey(a.weekCommencing) - dateSortKey(b.weekCommencing);
    }
    if (a.weekNum != null && b.weekNum != null) return a.weekNum - b.weekNum;
    if (a.weekCommencing) return -1;
    if (b.weekCommencing) return 1;
    return a.label.localeCompare(b.label);
  });
}

/** Day columns for a calendar week board. */
export function dayColumnsForWeek(items) {
  const byDay = new Map();
  const dayOrder = [...WEEKDAYS, "Saturday", "Sunday"];

  for (const item of items) {
    const day = item.weekday || "Unknown";
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(item);
  }

  const orderedDays = [...dayOrder.filter((d) => byDay.has(d)), ...[...byDay.keys()].filter((d) => !dayOrder.includes(d))];

  return orderedDays.map((day) => {
    const dayItems = [...byDay.get(day)].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    const dated = dayItems.find((i) => i.testDateParsed);
    return {
      day,
      items: dayItems,
      dateLabel: dated?.testDateParsed ? formatShortDate(dated.testDateParsed) : "",
    };
  });
}

export function teachingWeekCommencing(semesterStart, weekNum) {
  const iso = addWeeksToIso(semesterStart, weekNum - 1);
  return parseIsoDate(iso);
}

/** @param {ClassTestItem} item */
export function itemInTeachingWeek(item, weekNum, semesterStart) {
  if (!weekNum) return false;
  if (item.testWeekNum === weekNum) return true;
  if (!item.testDateParsed || !semesterStart) return false;
  const itemWc = weekCommencingMonday(item.testDateParsed);
  const weekWc = teachingWeekCommencing(semesterStart, weekNum);
  if (!itemWc || !weekWc) return false;
  return dateSortKey(itemWc) === dateSortKey(weekWc);
}

/** @param {ClassTestItem[]} items */
export function filterItemsForTeachingWeek(items, weekNum, semesterStart) {
  return items.filter((item) => itemInTeachingWeek(item, weekNum, semesterStart));
}

/** @param {ClassTestItem[]} items */
export function buildSemesterWeekColumns(items, { semesterStart = "", currentWeek = null, maxWeeks = 14 } = {}) {
  const maxTestWeek = items.reduce((m, i) => Math.max(m, i.testWeekNum || 0), 0);
  const currentNum = currentWeek?.weekNumber || 1;
  const total = Math.max(maxWeeks, maxTestWeek, currentNum);

  const columns = [];
  for (let w = 1; w <= total; w++) {
    const wc = semesterStart ? teachingWeekCommencing(semesterStart, w) : null;
    columns.push({
      weekNum: w,
      weekLabel: `Week ${w}`,
      weekCommencing: wc,
      isCurrent: currentWeek && !currentWeek.beforeSemester && w === currentNum,
      isPast: currentWeek && !currentWeek.beforeSemester && w < currentNum,
      items: filterItemsForTeachingWeek(items, w, semesterStart),
    });
  }
  return columns;
}

/** @param {ClassTestItem[]} items */
export function groupClassTestsByCohort(items) {
  const buckets = new Map();

  for (const item of items) {
    const labels =
      item.cohorts?.filter((c) => c.parsed).map((c) => ({ key: c.cohortCode, name: `${c.cohortLabel} (${c.siteCode} · ${c.studyYear})` })) ||
      [];
    const entries = labels.length ? labels : [{ key: "unknown", name: "Unknown cohort" }];

    for (const { key, name } of entries) {
      if (!buckets.has(key)) buckets.set(key, { name, items: [] });
      buckets.get(key).items.push(item);
    }
  }

  for (const bucket of buckets.values()) bucket.items.sort(compareClassTestItems);
  return [...buckets.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** @param {ClassTestItem[]} items */
export function groupClassTestsByCampus(items) {
  const buckets = new Map();
  for (const item of items) {
    const key = item.campus || "Unknown campus";
    if (!buckets.has(key)) buckets.set(key, { name: key, items: [] });
    buckets.get(key).items.push(item);
  }
  for (const bucket of buckets.values()) bucket.items.sort(compareClassTestItems);
  return [...buckets.values()].sort((a, b) => a.name.localeCompare(b.name));
}
