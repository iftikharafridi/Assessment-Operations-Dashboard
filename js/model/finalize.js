import { assignSessionIds, sessionKey } from "../utils/session-id.js";

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
      newPlans[row.sessionId] = { ...plan, _matchedKey: key };
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
