import { PLAN_STATUSES, WEEKDAYS } from "../config/constants.js";
import { normalizePlan, planKey } from "../planner/plans.js";
import { ukDateSortKey } from "../utils/dates.js";
import { timeToMinutes } from "../utils/time.js";

export const TRACKER_SORT_DEFAULT = { key: "seminarSlot", dir: "asc" };

function parseUkDate(value) {
  return ukDateSortKey(value);
}

function seminarSlotSortValue(row) {
  const day = WEEKDAYS.indexOf(row.Weekday);
  return (day < 0 ? 99 : day) * 10000 + timeToMinutes(row["Start time"] || "99:99");
}

export function trackerSortValue(row, plan, key) {
  switch (key) {
    case "campus":
      return String(row.Campus ?? "").toLowerCase();
    case "module":
      return String(row["Module code"] ?? "").toLowerCase();
    case "seminarSlot":
      return seminarSlotSortValue(row);
    case "testWeek": {
      const n = parseInt(String(plan.testWeek ?? "").replace(/\D/g, ""), 10);
      return Number.isFinite(n) ? n : String(plan.testWeek ?? "").toLowerCase();
    }
    case "testDate":
      return parseUkDate(plan.testDate);
    case "testStartTime":
      return timeToMinutes(plan.testStartTime || "99:99");
    case "testEndTime":
      return timeToMinutes(plan.testEndTime || "99:99");
    case "duration":
      return Number(plan.durationMinutes) || 0;
    case "status": {
      const idx = PLAN_STATUSES.indexOf(plan.status);
      return idx < 0 ? 99 : idx;
    }
    case "room":
      return String(plan.room ?? "").toLowerCase();
    case "leadTutor":
      return String(plan.leadTutor ?? "").toLowerCase();
    case "invigilator":
      return String(plan.invigilator ?? "").toLowerCase();
    case "notes":
      return String(plan.notes ?? "").toLowerCase();
    default:
      return seminarSlotSortValue(row);
  }
}

export function sortTrackerRows(rows, project, sort = TRACKER_SORT_DEFAULT) {
  const { key, dir } = { ...TRACKER_SORT_DEFAULT, ...sort };
  const mul = dir === "desc" ? -1 : 1;

  return [...rows].sort((a, b) => {
    const pa = normalizePlan(project.getPlan(planKey(a)));
    const pb = normalizePlan(project.getPlan(planKey(b)));
    const va = trackerSortValue(a, pa, key);
    const vb = trackerSortValue(b, pb, key);

    if (va < vb) return -1 * mul;
    if (va > vb) return 1 * mul;

    const tie = seminarSlotSortValue(a) - seminarSlotSortValue(b);
    if (tie) return tie;
    return String(a["Module code"] ?? "").localeCompare(String(b["Module code"] ?? ""));
  });
}
