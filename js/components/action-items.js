import { esc } from "../utils/dom.js";
import { summarizeActionItems } from "../analytics/assessment.js";

const KIND_LABEL = {
  issue: "Issue",
  todo: "To-do",
  update: "Update",
  status: "In progress",
};

const KIND_CLASS = {
  issue: "alert-error",
  todo: "alert-warning",
  update: "alert-info",
  status: "alert-info",
};

export function renderActionItemsPanel(items, { title = "Issues & to-do", emptyMessage } = {}) {
  const summary = summarizeActionItems(items);

  if (!items.length) {
    return `<section class="action-items-panel">
      <h3 class="section-heading">${esc(title)}</h3>
      <div class="alert alert-info" role="status">
        <p>${esc(
          emptyMessage ||
            "Nothing flagged yet. On the Assessments tab, set Status to Issue, or add Tasks / notes. Class test to-dos appear when invigilators are missing."
        )}</p>
      </div>
    </section>`;
  }

  const groups = [
    { key: "issue", label: "Issues", filter: (i) => i.kind === "issue" },
    { key: "todo", label: "To-do", filter: (i) => i.kind === "todo" },
    { key: "other", label: "Updates & status", filter: (i) => i.kind === "update" || i.kind === "status" },
  ];

  let html = `<section class="action-items-panel">
    <h3 class="section-heading">${esc(title)}</h3>
    <div class="action-items-summary">
      <span class="action-pill issue">${summary.issues} issue${summary.issues === 1 ? "" : "s"}</span>
      <span class="action-pill todo">${summary.todos} to-do</span>
      <span class="action-pill update">${summary.updates} update${summary.updates === 1 ? "" : "s"}</span>
    </div>`;

  for (const group of groups) {
    const groupItems = items.filter(group.filter);
    if (!groupItems.length) continue;
    html += `<h4 class="action-group-title">${esc(group.label)}</h4><ul class="action-items-list">`;
    for (const item of groupItems) {
      html += `<li class="action-item ${esc(item.kind)}">
        <span class="action-kind">${esc(KIND_LABEL[item.kind] || item.kind)}</span>
        <div class="action-body">
          <strong>${esc(item.title)}</strong>
          <p>${esc(item.detail)}</p>
        </div>
      </li>`;
    }
    html += `</ul>`;
  }

  html += `<p class="muted small">Edit tasks and notes on the <strong>Assessments</strong> tab. Save workbook to keep them — filename includes date and time.</p></section>`;
  return html;
}
