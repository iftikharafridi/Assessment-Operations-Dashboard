import { parseGroups } from "../utils/groups.js";
import { parseAdmissionGroup } from "../utils/cohort.js";
import { timeToMinutes } from "../utils/time.js";
import { mergeSplitSessions } from "../utils/session-merge.js";
import { TEACHING_TEAM_HEADERS } from "../obsidian/portal/paths.js";

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

function sessionType(row) {
  return String(row.Type || row["Class type"] || "").trim();
}

/**
 * Aggregate teaching load by staff × module × campus.
 * Uses mergeSplitSessions so a lecture with a mid-slot break counts once for hours.
 *
 * @param {import("../model/project.js").Project} project
 * @returns {{ headers: string[], rows: string[][], entries: object[], warnings: string[] }}
 */
export function buildTeachingTeamRows(project) {
  const raw = project.getTimetableRows();
  const merged = mergeSplitSessions(raw);

  /** @type {Map<string, object>} */
  const map = new Map();
  for (const r of merged) {
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
      const type = sessionType(r);
      if (/lecture/i.test(type)) cur.lectures += 1;
      if (/seminar/i.test(type)) cur.seminars += 1;
      cur.hours += sessionHours(r["Start time"], r["End time"]);
      map.set(key, cur);
    }
  }

  const entries = [...map.values()].sort(
    (a, b) =>
      a.staff.localeCompare(b.staff) ||
      a.moduleCode.localeCompare(b.moduleCode) ||
      a.campus.localeCompare(b.campus)
  );

  const rows = entries.map((t) => [
    t.staff,
    t.moduleCode,
    t.moduleName,
    t.campus,
    String(t.sessions),
    String(t.lectures),
    String(t.seminars),
    String(Math.round(t.hours * 100) / 100),
  ]);

  return { headers: TEACHING_TEAM_HEADERS, rows, entries, warnings: [] };
}

/**
 * Groups / merged-sections report from timetable Activity + Student Groups.
 * @param {import("../model/project.js").Project} project
 */
export function buildGroupsReport(project) {
  const rows = project.getTimetableRows();
  /** @type {Set<string>} */
  const letterSet = new Set();
  /** @type {object[]} */
  const mergedSections = [];
  /** @type {Map<string, object>} */
  const admissionMap = new Map();

  for (const r of rows) {
    const groups = parseGroups(r.Activity, r["Student Groups"]);
    for (const letter of groups.letterGroups) {
      letterSet.add(letter.toUpperCase());
    }

    const isMergedLetters = groups.letterGroups.length > 1;
    const isMergedAdmission = groups.admissionGroups.length > 1;
    if (isMergedLetters || isMergedAdmission) {
      mergedSections.push({
        moduleCode: r["Module code"] || "",
        moduleName: r["Module name"] || "",
        campus: r.Campus || "",
        weekday: r.Weekday || "",
        start: r["Start time"] || "",
        end: r["End time"] || "",
        staff: r.Staff || "",
        activity: r.Activity || "",
        letterGroups: groups.letterGroups,
        admissionGroups: groups.admissionGroups,
      });
    }

    for (const label of groups.admissionGroups) {
      if (!admissionMap.has(label)) {
        const parsed = parseAdmissionGroup(label);
        admissionMap.set(label, {
          label,
          cohortLabel: parsed.parsed ? parsed.cohortLabel : "",
          siteName: parsed.parsed ? parsed.siteName : "",
          studyYear: parsed.parsed ? parsed.studyYear : "",
          programme: parsed.parsed ? parsed.programme : "",
          dayPattern: parsed.parsed ? parsed.dayPattern : "",
          parsed: parsed.parsed,
        });
      }
    }
  }

  const letterGroups = [...letterSet].sort();
  const admissionCohorts = [...admissionMap.values()].sort((a, b) => a.label.localeCompare(b.label));

  mergedSections.sort(
    (a, b) =>
      a.moduleCode.localeCompare(b.moduleCode) ||
      a.campus.localeCompare(b.campus) ||
      a.weekday.localeCompare(b.weekday) ||
      a.start.localeCompare(b.start)
  );

  return {
    letterGroups,
    mergedSections,
    admissionCohorts,
    summary: {
      letterGroupCount: letterGroups.length,
      mergedSectionCount: mergedSections.length,
      admissionCohortCount: admissionCohorts.length,
    },
  };
}

/** Distinct letter group labels across the timetable (GRP A, GRP B, …). */
export function listLetterGroups(project) {
  return buildGroupsReport(project).letterGroups;
}
