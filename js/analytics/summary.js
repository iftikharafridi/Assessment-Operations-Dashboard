import { parseGroups } from "../utils/groups.js";
import { unique } from "../utils/dom.js";

export function buildModuleSummary(rows) {
  const byCampusModule = {};

  for (const r of rows) {
    const key = `${r.Campus}|${r["Module code"]}`;
    if (!byCampusModule[key]) {
      byCampusModule[key] = {
        campus: r.Campus,
        code: r["Module code"],
        name: r["Module name"],
        lectures: 0,
        seminars: 0,
        groups: new Set(),
        totalSize: 0,
        staff: new Set(),
      };
    }
    const entry = byCampusModule[key];
    if (r.Type === "Lecture") entry.lectures++;
    else entry.seminars++;
    parseGroups(r.Activity, r["Student Groups"]).letterGroups.forEach((g) => entry.groups.add(g));
    entry.totalSize = Math.max(entry.totalSize, r.Size);
    entry.staff.add(r.Staff);
  }

  return Object.values(byCampusModule).sort(
    (a, b) => a.campus.localeCompare(b.campus) || a.code.localeCompare(b.code)
  );
}

export function getCampusStaffMap(rows) {
  const map = {};
  for (const campus of unique(rows.map((r) => r.Campus))) {
    map[campus] = unique(rows.filter((r) => r.Campus === campus).map((r) => r.Staff)).sort();
  }
  return map;
}

export function getSessionStats(rows) {
  return {
    sessions: rows.length,
    seminars: rows.filter((r) => r.Type === "Seminar").length,
    modules: unique(rows.map((r) => r["Module code"])).length,
  };
}
