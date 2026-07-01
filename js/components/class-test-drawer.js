import { esc } from "../utils/dom.js";
import { PLAN_STATUSES, displayStatus, LABEL_BLACKBOARD_TEST_READY, LABEL_BLACKBOARD_TEST_NOT_READY, HINT_BLACKBOARD_TEST_READY } from "../config/constants.js";
import { parseGroups } from "../utils/groups.js";
import { normalizePlan, planKey, updatePlan } from "../planner/plans.js";
import { displayPlanValue } from "../ui/inline-edit.js";
import { markDirty } from "../state/store.js";
import { sessionHasConflict } from "../analytics/dashboard.js";

let drawerEl = null;

function ensureDrawer() {
  if (drawerEl) return drawerEl;
  drawerEl = document.createElement("aside");
  drawerEl.className = "app-drawer";
  drawerEl.innerHTML = `<div class="drawer-backdrop" data-drawer-close></div>
    <div class="drawer-panel" role="dialog" aria-modal="true">
      <header class="drawer-header">
        <h3 class="drawer-title"></h3>
        <button type="button" class="btn btn-small btn-muted" data-drawer-close aria-label="Close">✕</button>
      </header>
      <div class="drawer-body"></div>
      <footer class="drawer-footer">
        <button type="button" class="btn btn-primary" data-drawer-save>Save changes</button>
        <button type="button" class="btn btn-muted" data-drawer-close>Cancel</button>
      </footer>
    </div>`;
  document.body.appendChild(drawerEl);
  return drawerEl;
}

function statusOptions(selected) {
  return PLAN_STATUSES.map(
    (st) => `<option value="${st}" ${selected === st ? "selected" : ""}>${displayStatus(st)}</option>`
  ).join("");
}

export function readinessBadges(plan, conflict) {
  const badges = [];
  if (conflict) badges.push(`<span class="row-badge badge issue">Conflict</span>`);
  if (!plan.invigilator) badges.push(`<span class="row-badge badge issue">Missing invigilator</span>`);
  if (!plan.room) badges.push(`<span class="row-badge badge issue">Room missing</span>`);
  if (!plan.paperReady) badges.push(`<span class="row-badge badge warn">${esc(LABEL_BLACKBOARD_TEST_NOT_READY)}</span>`);
  if (!plan.lodReady) badges.push(`<span class="row-badge badge warn">LOD not ready</span>`);
  if (plan.status === "Ready") badges.push(`<span class="row-badge badge status-ready">Ready</span>`);
  return badges.join(" ");
}

export function openClassTestDrawer(project, session, { onSaved } = {}) {
  const drawer = ensureDrawer();
  const sid = planKey(session);
  const plan = normalizePlan(project.getPlan(sid));
  const groups = parseGroups(session.Activity, session["Student Groups"]);
  const conflict = sessionHasConflict(project, sid);

  drawer.querySelector(".drawer-title").textContent = `${session["Module code"]} — Class test details`;
  drawer.querySelector(".drawer-body").innerHTML = `
    <p class="muted small">${esc(session["Module name"])} · ${esc(session.Campus)} · ${esc(session.Weekday)} ${esc(session["Start time"])}–${esc(session["End time"])}</p>
    <div class="drawer-badges">${readinessBadges(plan, conflict)}</div>
    <div class="drawer-form">
      <label>Test week <input class="plan-field" data-id="${esc(sid)}" data-field="testWeek" value="${esc(displayPlanValue(sid, "testWeek", plan, session))}"></label>
      <label>Test date <input class="plan-field" data-id="${esc(sid)}" data-field="testDate" value="${esc(displayPlanValue(sid, "testDate", plan, session))}"></label>
      <label>Start time <input class="plan-field" data-id="${esc(sid)}" data-field="testStartTime" value="${esc(displayPlanValue(sid, "testStartTime", plan, session))}"></label>
      <label>End time <input class="plan-field" data-id="${esc(sid)}" data-field="testEndTime" value="${esc(displayPlanValue(sid, "testEndTime", plan, session))}"></label>
      <label>Duration (mins) <input class="plan-field" data-id="${esc(sid)}" data-field="durationMinutes" value="${esc(displayPlanValue(sid, "durationMinutes", plan, session))}"></label>
      <label>Room <input class="plan-field" data-id="${esc(sid)}" data-field="room" value="${esc(displayPlanValue(sid, "room", plan, session))}"></label>
      <label>Lead tutor <input class="plan-field" data-id="${esc(sid)}" data-field="leadTutor" value="${esc(displayPlanValue(sid, "leadTutor", plan, session))}"></label>
      <label>Invigilator <input class="plan-field" data-id="${esc(sid)}" data-field="invigilator" value="${esc(displayPlanValue(sid, "invigilator", plan, session))}"></label>
      <label>Status <select class="plan-field" data-id="${esc(sid)}" data-field="status">${statusOptions(plan.status)}</select></label>
      <label class="filter-check"><input type="checkbox" class="plan-check" data-id="${esc(sid)}" data-field="roomConfirmed" ${plan.roomConfirmed ? "checked" : ""}> Room confirmed</label>
      <label class="filter-check" title="${esc(HINT_BLACKBOARD_TEST_READY)}"><input type="checkbox" class="plan-check" data-id="${esc(sid)}" data-field="paperReady" ${plan.paperReady ? "checked" : ""}> ${esc(LABEL_BLACKBOARD_TEST_READY)}</label>
      <label class="filter-check"><input type="checkbox" class="plan-check" data-id="${esc(sid)}" data-field="lodReady" ${plan.lodReady ? "checked" : ""}> LOD / software ready</label>
      <label>Notes <textarea class="plan-field plan-notes" data-id="${esc(sid)}" data-field="notes" rows="4">${esc(displayPlanValue(sid, "notes", plan, session))}</textarea></label>
    </div>
    <details class="drawer-meta"><summary class="muted small">Technical details</summary>
      <dl class="dialog-dl">
        <dt>Session ID</dt><dd>${esc(session.ID ?? "—")}</dd>
        <dt>Stable session key</dt><dd class="mono small">${esc(sid)}</dd>
        <dt>Student groups</dt><dd>${esc(groups.admissionGroups.join(", ") || "—")}</dd>
      </dl>
    </details>`;

  drawer.classList.add("is-open");

  const close = () => drawer.classList.remove("is-open");
  drawer.querySelectorAll("[data-drawer-close]").forEach((el) => {
    el.onclick = close;
  });

  drawer.querySelector("[data-drawer-save]")?.addEventListener("click", () => {
    const partial = {};
    drawer.querySelectorAll(".plan-field, .plan-check").forEach((el) => {
      const field = el.dataset.field;
      if (!field) return;
      partial[field] = el.type === "checkbox" ? el.checked : el.value;
    });
    updatePlan(project, sid, { ...partial, planned: true });
    markDirty();
    close();
    onSaved?.();
  });
}
