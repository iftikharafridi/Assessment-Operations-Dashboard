import { DEFAULT_PLAN, LABEL_BLACKBOARD_TEST_READY } from "../config/constants.js";
import { normalizePlan, planKey } from "../planner/plans.js";
import { getInvigilatorAvailability } from "./invigilation.js";
import { getTestSlot, timesOverlap } from "../utils/time.js";
import { parseGroups } from "../utils/groups.js";
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
  const roomsNotConfirmed = planned.filter((r) => {
    const p = normalizePlan(project.getPlan(planKey(r)));
    return !p.roomConfirmed && p.status !== "Completed";
  });
  const paperNotReady = planned.filter((r) => {
    const p = normalizePlan(project.getPlan(planKey(r)));
    return !p.paperReady && p.status !== "Completed";
  });
  const lodNotReady = planned.filter((r) => {
    const p = normalizePlan(project.getPlan(planKey(r)));
    return !p.lodReady && p.status !== "Completed";
  });
  const conflicts = detectConflicts(project);

  return {
    totalSessions: rows.length,
    seminarSlots: seminars.length,
    plannedTests: planned.length,
    readyTests: ready.length,
    completedTests: completed.length,
    missingInvigilators: missingInvigilators.length,
    roomsNotConfirmed: roomsNotConfirmed.length,
    paperNotReady: paperNotReady.length,
    lodNotReady: lodNotReady.length,
    assessmentEvents: project.getAssessmentEvents?.().length || 0,
    conflicts: conflicts.length,
    conflictDetails: conflicts,
  };
}

/** Per-campus metrics for dashboard cards. */
export function computeCampusMetrics(project) {
  const rows = project.getTimetableRows();
  const campuses = unique(rows.map((r) => r.Campus)).sort();
  const conflicts = detectConflicts(project);

  return campuses.map((campus) => {
    const campusRows = rows.filter((r) => r.Campus === campus);
    const seminars = campusRows.filter((r) => r.Type === "Seminar");
    const planned = seminars.filter((r) => normalizePlan(project.getPlan(planKey(r))).planned);
    const missingInvig = planned.filter((r) => !normalizePlan(project.getPlan(planKey(r))).invigilator).length;
    const campusSessionIds = new Set(planned.map((r) => planKey(r)));
    const issueCount = conflicts.filter((c) => c.sessionIds.some((id) => campusSessionIds.has(id))).length + missingInvig;

    return {
      campus,
      sessions: campusRows.length,
      seminars: seminars.length,
      plannedTests: planned.length,
      readyTests: planned.filter((r) => normalizePlan(project.getPlan(planKey(r))).status === "Ready").length,
      missingInvigilators: missingInvig,
      warnings: issueCount,
    };
  });
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
  const rows = project.getTimetableRows();
  return getPlannedSeminars(project)
    .slice()
    .sort((a, b) => {
      const pa = normalizePlan(project.getPlan(planKey(a)));
      const pb = normalizePlan(project.getPlan(planKey(b)));
      const week = String(pa.testWeek ?? "").localeCompare(String(pb.testWeek ?? ""), undefined, { numeric: true });
      if (week) return week;
      const date = String(pa.testDate ?? "").localeCompare(String(pb.testDate ?? ""));
      if (date) return date;
      const campus = String(a.Campus).localeCompare(String(b.Campus));
      if (campus) return campus;
      return String(getTestSlot(a, pa).start).localeCompare(String(getTestSlot(b, pb).start));
    })
    .map((s) => {
      const p = normalizePlan(project.getPlan(planKey(s)));
      const slot = getTestSlot(s, p);
      const groups = parseGroups(s.Activity, s["Student Groups"]);
      const invigilation = p.invigilator
        ? getInvigilatorAvailability(p.invigilator, s, p, rows).available
          ? "Assigned"
          : "Busy / conflict"
        : "Not assigned";
      return {
        "Module code": s["Module code"],
        "Module name": s["Module name"],
        Campus: s.Campus,
        Groups: groups.letterGroups.length ? groups.letterGroups.join(" & ") : "",
        "Student Groups": groups.admissionGroups.join(", "),
        Size: s.Size ?? "",
        "Test week": p.testWeek,
        "Test date": p.testDate,
        Day: slot.weekday,
        Time: `${slot.start} – ${slot.end}`,
        Room: p.room,
        "Room confirmed": p.roomConfirmed ? "Yes" : "No",
        "Lead tutor": p.leadTutor || s.Staff,
        Invigilator: p.invigilator || "",
        Invigilation: invigilation,
        Status: p.status,
        [LABEL_BLACKBOARD_TEST_READY]: p.paperReady ? "Yes" : "No",
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
