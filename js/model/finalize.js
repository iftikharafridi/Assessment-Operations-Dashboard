import { assignSessionIds, sessionKey } from "../utils/session-id.js";

/** Combine duplicate plan records that map to the same seminar (stable ID + legacy Session ID). */
function mergeMatchedPlans(existing, incoming) {
  if (!existing) return { ...incoming };
  if (!incoming) return { ...existing };
  return {
    ...existing,
    ...incoming,
    invigilator: existing.invigilator || incoming.invigilator,
    leadTutor: existing.leadTutor || incoming.leadTutor,
    testWeek: existing.testWeek || incoming.testWeek,
    testDate: existing.testDate || incoming.testDate,
    testStartTime: existing.testStartTime || incoming.testStartTime,
    testEndTime: existing.testEndTime || incoming.testEndTime,
    testDuration: existing.testDuration || incoming.testDuration,
    durationMinutes: existing.durationMinutes || incoming.durationMinutes,
    room: existing.room || incoming.room,
    notes: [existing.notes, incoming.notes].filter(Boolean).join("\n"),
    status: incoming.status && incoming.status !== "Not Planned" ? incoming.status : existing.status,
    planned: existing.planned || incoming.planned,
    roomConfirmed: existing.roomConfirmed || incoming.roomConfirmed,
    paperReady: existing.paperReady || incoming.paperReady,
    lodReady: existing.lodReady || incoming.lodReady,
  };
}

/** Assign stable session IDs and rematch saved class test plans after import. */
export function finalizeProject(project) {
  for (const ds of project.datasets.timetable) {
    ds.rows = assignSessionIds(ds.rows);
  }

  const rows = project.getTimetableRows();
  const bySessionId = new Map(rows.map((r) => [r.sessionId, r]));
  const byLegacyId = new Map(rows.map((r) => [String(r.ID), r]));

  const oldPlans = { ...project.plans };
  const newPlans = {};
  const unmatched = [];

  for (const [key, plan] of Object.entries(oldPlans)) {
    const row = bySessionId.get(key) || byLegacyId.get(key);
    if (row) {
      newPlans[row.sessionId] = mergeMatchedPlans(newPlans[row.sessionId], { ...plan, _matchedKey: key });
    } else {
      unmatched.push({
        sessionId: key,
        plan,
        label: plan._moduleCode || plan.testWeek || key,
      });
    }
  }

  project.plans = newPlans;
  project.unmatchedPlans = unmatched;
  project.touch();
  return project;
}

export function getRowSessionId(row) {
  return sessionKey(row);
}
