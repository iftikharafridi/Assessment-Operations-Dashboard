import { DEFAULT_PLAN } from "../config/constants.js";
import { normalizePlan, planKey } from "../planner/plans.js";
import { getTestSlot, timesOverlap } from "../utils/time.js";
import { unique } from "../utils/dom.js";

export function getPlannedSeminars(project) {
  return project
    .getTimetableRows()
    .filter((r) => r.Type === "Seminar" && normalizePlan(project.getPlan(planKey(r))).planned);
}

export function computeDashboardMetrics(project) {
  const rows = project.getTimetableRows();
  const seminars = rows.filter((r) => r.Type === "Seminar");
  const planned = seminars.filter((r) => normalizePlan(project.getPlan(planKey(r))).planned);
  const ready = planned.filter((r) => normalizePlan(project.getPlan(planKey(r))).status === "Ready");
  const completed = planned.filter((r) => normalizePlan(project.getPlan(planKey(r))).status === "Completed");
  const missingInvigilators = planned.filter((r) => {
    const p = normalizePlan(project.getPlan(planKey(r)));
    return !p.invigilator && p.status !== "Completed";
  });
  const conflicts = detectConflicts(project);

  return {
    totalSessions: rows.length,
    seminarSlots: seminars.length,
    plannedTests: planned.length,
    readyTests: ready.length,
    completedTests: completed.length,
    missingInvigilators: missingInvigilators.length,
    conflicts: conflicts.length,
    conflictDetails: conflicts,
  };
}

export function detectConflicts(project) {
  const rows = project.getTimetableRows();
  const planned = rows.filter(
    (r) => r.Type === "Seminar" && normalizePlan(project.getPlan(planKey(r))).planned
  );
  const conflicts = [];

  for (let i = 0; i < planned.length; i++) {
    for (let j = i + 1; j < planned.length; j++) {
      const a = planned[i];
      const b = planned[j];
    const pa = normalizePlan(project.getPlan(planKey(a)));
    const pb = normalizePlan(project.getPlan(planKey(b)));
      const slotA = getTestSlot(a, pa);
      const slotB = getTestSlot(b, pb);

      if (slotA.weekday === slotB.weekday && timesOverlap(slotA.start, slotA.end, slotB.start, slotB.end)) {
        if (pa.room && pb.room && pa.room === pb.room) {
          conflicts.push({
            type: "room",
            message: `Room ${pa.room} double-booked: ${a["Module code"]} and ${b["Module code"]} on ${slotA.weekday}`,
            sessionIds: [planKey(a), planKey(b)],
          });
        }
        if (pa.invigilator && pb.invigilator && pa.invigilator === pb.invigilator) {
          conflicts.push({
            type: "invigilator",
            message: `${pa.invigilator} assigned to two tests at the same time`,
            sessionIds: [planKey(a), planKey(b)],
          });
        }
      }
    }
  }

  for (const session of planned) {
    const plan = normalizePlan(project.getPlan(planKey(session)));
    if (!plan.invigilator) continue;
    const slot = getTestSlot(session, plan);
    const teaching = rows.filter(
      (r) =>
        r.Staff === plan.invigilator &&
        r.Weekday === slot.weekday &&
        timesOverlap(r["Start time"], r["End time"], slot.start, slot.end)
    );
    if (teaching.length) {
      conflicts.push({
        type: "invigilator-busy",
        message: `${plan.invigilator} is teaching during ${session["Module code"]} class test`,
        sessionIds: [planKey(session)],
      });
    }
  }

  return conflicts;
}

export function sessionHasConflict(project, sessionId) {
  const sid = sessionId;
  return detectConflicts(project).some((c) => c.sessionIds.includes(sid));
}

export function buildCampusSummary(project) {
  const rows = project.getTimetableRows();
  const campuses = unique(rows.map((r) => r.Campus)).sort();
  return campuses.map((campus) => {
    const campusRows = rows.filter((r) => r.Campus === campus);
    const seminars = campusRows.filter((r) => r.Type === "Seminar");
    const planned = seminars.filter((r) => normalizePlan(project.getPlan(planKey(r))).planned);
    return {
      Campus: campus,
      Sessions: campusRows.length,
      Seminars: seminars.length,
      "Planned tests": planned.length,
      Ready: planned.filter((r) => normalizePlan(project.getPlan(planKey(r))).status === "Ready").length,
      Completed: planned.filter((r) => normalizePlan(project.getPlan(planKey(r))).status === "Completed").length,
    };
  });
}

export function buildTutorWorkload(project) {
  const rows = project.getTimetableRows();
  const tutors = unique(rows.map((r) => r.Staff)).sort();
  return tutors.map((tutor) => {
    const tutorRows = rows.filter((r) => r.Staff === tutor);
    const invigilating = getPlannedSeminars(project).filter(
      (r) => normalizePlan(project.getPlan(planKey(r))).invigilator === tutor
    );
    return {
      Tutor: tutor,
      "Teaching sessions": tutorRows.length,
      "Modules taught": unique(tutorRows.map((r) => r["Module code"])).length,
      Campuses: unique(tutorRows.map((r) => r.Campus)).join(", "),
      "Invigilation duties": invigilating.length,
    };
  });
}

export function buildClassTestSchedule(project) {
  return getPlannedSeminars(project).map((s) => {
    const p = normalizePlan(project.getPlan(planKey(s)));
    const slot = getTestSlot(s, p);
    return {
      "Module code": s["Module code"],
      "Module name": s["Module name"],
      Campus: s.Campus,
      "Test week": p.testWeek,
      "Test date": p.testDate,
      Day: slot.weekday,
      Time: `${slot.start} – ${slot.end}`,
      Room: p.room,
      "Room confirmed": p.roomConfirmed ? "Yes" : "No",
      "Lead tutor": p.leadTutor || s.Staff,
      Invigilator: p.invigilator,
      Status: p.status,
      "Paper ready": p.paperReady ? "Yes" : "No",
      "LOD ready": p.lodReady ? "Yes" : "No",
      Notes: p.notes,
    };
  });
}

export function buildMissingInvigilators(project) {
  return getPlannedSeminars(project)
    .filter((s) => {
      const p = normalizePlan(project.getPlan(planKey(s)));
      return !p.invigilator && p.status !== "Completed";
    })
    .map((s) => {
      const p = normalizePlan(project.getPlan(planKey(s)));
      const slot = getTestSlot(s, p);
      return {
        "Module code": s["Module code"],
        Campus: s.Campus,
        "Test week": p.testWeek,
        Day: slot.weekday,
        Time: `${slot.start} – ${slot.end}`,
        "Lead tutor": p.leadTutor || s.Staff,
        Status: p.status,
      };
    });
}

export function buildDashboardSummaryRows(project, exportedAt = "") {
  const m = computeDashboardMetrics(project);
  const rows = Object.entries(m)
    .filter(([k]) => !k.startsWith("conflict"))
    .map(([Metric, Value]) => ({ Metric, Value }));
  if (exportedAt) rows.unshift({ Metric: "Exported at", Value: exportedAt });
  return rows;
}
