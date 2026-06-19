import { markDirty } from "../state/store.js";
import { markAsClassTest, unmarkClassTest, updatePlan, planKey } from "./plans.js";

export function applyBulkAction(project, sessionIds, action, value) {
  for (const id of sessionIds) {
    const row = project.getTimetableRows().find((r) => planKey(r) === id);
    switch (action) {
      case "mark":
        markAsClassTest(project, id, row?.Staff, row);
        break;
      case "unmark":
        unmarkClassTest(project, id);
        break;
      case "testWeek":
        updatePlan(project, id, { testWeek: value, planned: true });
        break;
      case "status":
        updatePlan(project, id, { status: value, planned: true });
        break;
      case "duration":
        updatePlan(project, id, { durationMinutes: value, planned: true });
        break;
      case "invigilator":
        updatePlan(project, id, { invigilator: value, planned: true });
        break;
      default:
        break;
    }
  }
  markDirty();
}

export function getSelectedFromDom(container) {
  return [...container.querySelectorAll(".row-select:checked")].map((el) => el.value);
}

export function renderBulkBar() {
  return `<div class="bulk-bar" id="bulk-bar" hidden>
    <span class="bulk-count"><strong id="bulk-count">0</strong> selected</span>
    <button type="button" class="btn btn-small btn-primary" data-bulk="mark">Mark as class test</button>
    <input type="text" id="bulk-week" placeholder="Test week" class="bulk-input">
    <button type="button" class="btn btn-small" data-bulk="testWeek">Set week</button>
    <select id="bulk-status" class="bulk-input">
      <option value="">Set status…</option>
      <option>Planning</option>
      <option>Invigilator Needed</option>
      <option>Ready</option>
      <option>Completed</option>
      <option>Issue</option>
    </select>
    <button type="button" class="btn btn-small" data-bulk="status">Apply status</button>
    <input type="number" id="bulk-duration" placeholder="Minutes" class="bulk-input bulk-input-narrow" min="15" step="15">
    <button type="button" class="btn btn-small" data-bulk="duration">Set duration</button>
    <input type="text" id="bulk-invigilator" placeholder="Invigilator name" class="bulk-input">
    <button type="button" class="btn btn-small" data-bulk="invigilator">Assign invigilator</button>
    <button type="button" class="btn btn-small btn-muted" data-bulk="unmark">Clear class test</button>
  </div>`;
}

export function bindBulkBar(container, project, onUpdate) {
  const bar = container.querySelector("#bulk-bar");
  if (!bar) return;

  const refreshCount = () => {
    const selected = getSelectedFromDom(container);
    bar.hidden = selected.length === 0;
    const countEl = container.querySelector("#bulk-count");
    if (countEl) countEl.textContent = String(selected.length);
  };

  container.querySelectorAll(".row-select").forEach((cb) => {
    cb.onchange = refreshCount;
  });

  bar.querySelectorAll("[data-bulk]").forEach((btn) => {
    btn.onclick = () => {
      const selected = getSelectedFromDom(container);
      if (!selected.length) return;
      const action = btn.dataset.bulk;
      let value;
      if (action === "testWeek") value = container.querySelector("#bulk-week")?.value || "";
      if (action === "status") value = container.querySelector("#bulk-status")?.value || "";
      if (action === "duration") value = container.querySelector("#bulk-duration")?.value || "";
      if (action === "invigilator") value = container.querySelector("#bulk-invigilator")?.value || "";
      if ((action === "testWeek" || action === "status" || action === "invigilator") && !value) return;
      if (action === "duration" && !value) return;
      applyBulkAction(project, selected, action, value);
      onUpdate();
    };
  });
}
