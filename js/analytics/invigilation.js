import { normalizePlan, planKey } from "../planner/plans.js";
import { getTestSlot, timesOverlap } from "../utils/time.js";
import { unique } from "../utils/dom.js";

export function buildInvigilationView(rows, campus, day, project) {
  const daySessions = rows.filter((r) => r.Campus === campus && r.Weekday === day);
  const staffBusy = {};
  for (const s of daySessions) {
    if (!staffBusy[s.Staff]) staffBusy[s.Staff] = [];
    staffBusy[s.Staff].push(s);
  }

  const allStaff = unique(rows.filter((r) => r.Campus === campus).map((r) => r.Staff)).sort();

  return allStaff.map((staff) => {
    const sessions = staffBusy[staff] || [];
    const busy = sessions.length > 0;
    const testClashes = findTestClashesForStaff(staff, campus, day, rows, project);
    return {
      staff,
      busy,
      sameCampus: true,
      sessions: sessions.map(
        (s) => `${s["Start time"]}–${s["End time"]} ${s["Module code"]} (${s.Type})`
      ),
      testClashes,
      invigilationNote: busy
        ? testClashes.length
          ? "Teaching overlaps a planned class test — not available"
          : "Teaching this day — only free outside their sessions"
        : "Available — good invigilator candidate",
    };
  });
}

function findTestClashesForStaff(staff, campus, day, rows, project) {
  if (!project) return [];
  const clashes = [];
  const planned = rows.filter(
    (r) => r.Type === "Seminar" && r.Campus === campus && normalizePlan(project.getPlan(planKey(r))).planned
  );
  for (const session of planned) {
    const plan = normalizePlan(project.getPlan(planKey(session)));
    if (plan.invigilator !== staff && session.Staff !== staff) continue;
    const slot = getTestSlot(session, plan);
    if (slot.weekday !== day) continue;
    const teaching = rows.filter(
      (r) =>
        r.Staff === staff &&
        r.Weekday === day &&
        timesOverlap(r["Start time"], r["End time"], slot.start, slot.end)
    );
    if (teaching.length) {
      clashes.push(`${session["Module code"]} test (${slot.start}–${slot.end})`);
    }
  }
  return clashes;
}

export function getInvigilatorAvailability(staff, session, plan, allRows) {
  const slot = getTestSlot(session, plan);
  const teaching = allRows.filter(
    (r) =>
      r.Staff === staff &&
      r.Weekday === slot.weekday &&
      timesOverlap(r["Start time"], r["End time"], slot.start, slot.end)
  );
  const sameCampus = allRows.some((r) => r.Staff === staff && r.Campus === session.Campus);
  return {
    available: teaching.length === 0,
    sameCampus,
    teaching,
    warning: teaching.length
      ? `${staff} is teaching at ${slot.start}–${slot.end} on ${slot.weekday}`
      : sameCampus
        ? ""
        : `${staff} is not on the ${session.Campus} timetable — check campus`,
  };
}

export function buildInvigilationPlanRows(project) {
  const rows = project.getTimetableRows();
  return rows
    .filter((r) => r.Type === "Seminar" && normalizePlan(project.getPlan(planKey(r))).planned)
    .map((s) => {
      const p = normalizePlan(project.getPlan(planKey(s)));
      const slot = getTestSlot(s, p);
      const availability = p.invigilator
        ? getInvigilatorAvailability(p.invigilator, s, p, rows)
        : { available: null, sameCampus: false, warning: "Invigilator not assigned" };
      return {
        "Session ID": s.ID,
        "Module code": s["Module code"],
        Campus: s.Campus,
        "Test week": p.testWeek,
        Day: slot.weekday,
        Time: `${slot.start} – ${slot.end}`,
        "Lead tutor": p.leadTutor || s.Staff,
        Invigilator: p.invigilator || "",
        "Same campus": availability.sameCampus ? "Yes" : "Check",
        Availability: p.invigilator
          ? availability.available
            ? "Available"
            : "Busy / conflict"
          : "Not assigned",
        Warning: availability.warning,
        Status: p.status,
      };
    });
}

export function getCampusStaffMap(rows) {
  const map = {};
  for (const campus of unique(rows.map((r) => r.Campus)).sort()) {
    map[campus] = unique(rows.filter((r) => r.Campus === campus).map((r) => r.Staff)).sort();
  }
  return map;
}
