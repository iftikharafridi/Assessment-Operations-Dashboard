/** Keep in-progress table field values while the UI is frozen during typing. */

import { pauseShellRender, resumeShellRender } from "./render-guard.js";
import { setDirtySilent } from "../state/store.js";
import { normalizePlan, updatePlan } from "../planner/plans.js";

const drafts = new Map();
let blurTimer = null;

function planKey(id, field) {
  return `plan::${id}::${field}`;
}

function assessKey(id, field) {
  return `assess::${id}::${field}`;
}

export function getPlanDraft(id, field) {
  return drafts.get(planKey(id, field));
}

export function getAssessDraft(id, field) {
  return drafts.get(assessKey(id, field));
}

function isTextField(el) {
  return (
    el?.matches?.(".plan-field:not(select)") ||
    el?.matches?.(".assess-tasks") ||
    el?.matches?.(".assess-notes")
  );
}

function isTableFieldFocus() {
  const el = document.activeElement;
  return el?.matches?.(".plan-field") || el?.matches?.(".assess-tasks") || el?.matches?.(".assess-notes");
}

function commitPlanField(el, project) {
  const { id, field } = el.dataset;
  if (!id || !field) return;
  drafts.delete(planKey(id, field));

  const prior = normalizePlan(project.getPlan(id))[field];
  const next = el.value;
  if (String(prior ?? "") === String(next ?? "")) return;

  updatePlan(project, id, { [field]: next, planned: true }, { notify: false });
  setDirtySilent();
}

function commitAssessField(el, project) {
  const id = el.dataset.id;
  if (!id) return;
  const field = el.classList.contains("assess-tasks") ? "tasks" : "notes";
  drafts.delete(assessKey(id, field));

  const record = project.getAssessmentRecord(id);
  const prior = record[field] ?? "";
  const next = el.value;
  if (String(prior) === String(next)) return;

  project.setAssessmentRecord(id, { [field]: next });
  setDirtySilent();
}

function commitField(el, project) {
  if (el.matches(".plan-field:not(select)")) commitPlanField(el, project);
  else if (el.matches(".assess-tasks, .assess-notes")) commitAssessField(el, project);
}

let bound = false;

export function bindInlineFieldEditing({ getProject, onDirty }) {
  if (bound) return;
  const root = document.getElementById("main");
  if (!root) return;
  bound = true;

  root.addEventListener(
    "focusin",
    (e) => {
      if (!isTextField(e.target)) return;
      clearTimeout(blurTimer);
      pauseShellRender();
    },
    true
  );

  root.addEventListener(
    "input",
    (e) => {
      const el = e.target;
      if (el.matches(".plan-field:not(select)")) {
        drafts.set(planKey(el.dataset.id, el.dataset.field), el.value);
        return;
      }
      if (el.matches(".assess-tasks")) {
        drafts.set(assessKey(el.dataset.id, "tasks"), el.value);
        return;
      }
      if (el.matches(".assess-notes")) {
        drafts.set(assessKey(el.dataset.id, "notes"), el.value);
      }
    },
    true
  );

  root.addEventListener(
    "focusout",
    (e) => {
      if (!isTextField(e.target)) return;
      const el = e.target;
      clearTimeout(blurTimer);
      blurTimer = window.setTimeout(() => {
        if (isTableFieldFocus()) return;
        const project = getProject();
        if (!project) return;
        commitField(el, project);
        onDirty?.();
        resumeShellRender(true);
      }, 150);
    },
    true
  );
}

export function displayPlanValue(id, field, plan, session) {
  const draft = getPlanDraft(id, field);
  if (draft !== undefined) return draft;
  if (field === "leadTutor") return plan.leadTutor || session.Staff || "";
  if (field === "room") return plan.room || session.Room || "";
  return plan[field] ?? "";
}

export function displayAssessValue(id, field, record) {
  const draft = getAssessDraft(id, field);
  if (draft !== undefined) return draft;
  return record[field] ?? "";
}
