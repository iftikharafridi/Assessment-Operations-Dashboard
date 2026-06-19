import { DEFAULT_PLAN, PLAN_STATUSES } from "../config/constants.js";
import { markDirty } from "../state/store.js";
import { addMinutes, formatTimeRange, isValidTime } from "../utils/time.js";
import { sessionKey } from "../utils/session-id.js";

const LEGACY_STATUS_MAP = {
  Draft: "Planning",
  Proposed: "Planning",
  Approved: "Ready",
  Scheduled: "Ready",
};

export function planKey(row) {
  return sessionKey(row);
}

export function normalizePlan(raw = {}) {
  const plan = { ...DEFAULT_PLAN, ...raw };
  if (raw.testDate && !plan.testDate) plan.testDate = raw.testDate;
  if (raw["Test date"]) plan.testDate = raw["Test date"];
  if (raw.testTime && !plan.testDuration) plan.testDuration = raw.testTime;
  if (raw.invigilator2 && !plan.invigilator) plan.invigilator = raw.invigilator2;
  if (raw["Duration (minutes)"] && !plan.durationMinutes) plan.durationMinutes = raw["Duration (minutes)"];
  if (raw["Test start time"] && !plan.testStartTime) plan.testStartTime = raw["Test start time"];
  if (raw["Test end time"] && !plan.testEndTime) plan.testEndTime = raw["Test end time"];
  if (LEGACY_STATUS_MAP[plan.status]) plan.status = LEGACY_STATUS_MAP[plan.status];
  if (!PLAN_STATUSES.includes(plan.status)) plan.status = plan.planned ? "Planning" : "Not Planned";
  plan.roomConfirmed = truthy(plan.roomConfirmed);
  plan.paperReady = truthy(plan.paperReady);
  plan.lodReady = truthy(plan.lodReady);
  plan.planned = truthy(plan.planned) || (plan.status !== "Not Planned" && plan.status !== "");
  syncPlanTimes(plan);
  return plan;
}

function truthy(value) {
  if (typeof value === "boolean") return value;
  const s = String(value ?? "").trim().toLowerCase();
  return s === "yes" || s === "true" || s === "1" || s === "y";
}

/** Keep start/end/duration fields aligned. Duration in minutes auto-calculates end time. */
export function syncPlanTimes(plan) {
  if (plan.durationMinutes && plan.testStartTime && isValidTime(plan.testStartTime)) {
    plan.testEndTime = addMinutes(plan.testStartTime, Number(plan.durationMinutes));
  }
  if (plan.testStartTime && plan.testEndTime && isValidTime(plan.testStartTime) && isValidTime(plan.testEndTime)) {
    plan.testDuration = formatTimeRange(plan.testStartTime, plan.testEndTime);
  } else if (plan.testDuration && !plan.testStartTime) {
    const match = String(plan.testDuration).match(/(\d{1,2}:\d{2})\s*[–\-]\s*(\d{1,2}:\d{2})/);
    if (match) {
      plan.testStartTime = match[1];
      plan.testEndTime = match[2];
    }
  }
}

export function updatePlan(project, sessionId, partial) {
  const current = normalizePlan(project.getPlan(sessionId));
  const merged = { ...current, ...partial };
  if (partial.roomConfirmed != null) merged.roomConfirmed = truthy(partial.roomConfirmed);
  if (partial.paperReady != null) merged.paperReady = truthy(partial.paperReady);
  if (partial.lodReady != null) merged.lodReady = truthy(partial.lodReady);
  syncPlanTimes(merged);
  project.setPlan(sessionId, normalizePlan(merged));
  markDirty();
}

export function markAsClassTest(project, sessionId, sessionStaff = "", session = null) {
  const current = normalizePlan(project.getPlan(sessionId));
  const partial = {
    planned: true,
    status: current.status === "Not Planned" ? "Planning" : current.status,
    leadTutor: current.leadTutor || sessionStaff,
  };
  if (session) {
    if (!current.testStartTime) partial.testStartTime = session["Start time"];
    if (!current.testEndTime) partial.testEndTime = session["End time"];
    if (!current.testDuration) partial.testDuration = formatTimeRange(session["Start time"], session["End time"]);
  }
  updatePlan(project, sessionId, partial);
}

export function unmarkClassTest(project, sessionId) {
  updatePlan(project, sessionId, { planned: false, status: "Not Planned" });
}

export function togglePlanned(project, sessionId, planned, sessionStaff = "", session = null) {
  if (planned) markAsClassTest(project, sessionId, sessionStaff, session);
  else unmarkClassTest(project, sessionId);
}

export function clearAllPlans(project) {
  project.clearPlans();
  project.unmatchedPlans = [];
  markDirty();
}

export function isPlanned(project, sessionId) {
  return Boolean(normalizePlan(project.getPlan(sessionId)).planned);
}

export function getSessionStyle(project, sessionId, hasConflict = false) {
  if (hasConflict) return "conflict";
  const plan = normalizePlan(project.getPlan(sessionId));
  if (plan.status === "Issue") return "issue";
  if (plan.status === "Completed") return "completed";
  if (plan.status === "Ready") return "ready";
  if (plan.planned) return "planned";
  return null;
}

export { PLAN_STATUSES };
