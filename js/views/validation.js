import { esc } from "../utils/dom.js";
import { runDataValidation } from "../analytics/validation.js";

/** Compact data-check block for the Overview tab. */
export function renderValidationSection(project) {
  const report = runDataValidation(project);

  const checksHtml = report.checks
    .map(
      (c) => `<div class="check-row check-${c.status}">
        <span class="check-indicator" aria-hidden="true"></span>
        <div class="check-body">
          <strong>${esc(c.label)}</strong>
          <span class="check-message">${esc(c.message)}</span>
        </div>
        <span class="check-count">${c.count || ""}</span>
      </div>`
    )
    .join("");

  const unmatchedHtml = report.details.unmatchedPlans.length
    ? `<div class="alert alert-warning"><strong>Saved class test plans not matched</strong><ul>
        ${report.details.unmatchedPlans.map((u) => `<li>${esc(u.sessionId)}${u.label ? ` — ${esc(u.label)}` : ""}</li>`).join("")}
      </ul></div>`
    : "";

  const assessmentHtml = (report.details.assessmentIssues || [])
    .filter((i) => i.status !== "ok")
    .length
    ? `<div class="alert alert-warning"><strong>Assessment schedule notes</strong><ul>
        ${report.details.assessmentIssues.filter((i) => i.status !== "ok").map((i) => `<li>${esc(i.message)}</li>`).join("")}
      </ul></div>`
    : "";

  return `<details class="collapsible-section" open>
    <summary>Data checks</summary>
    <div class="collapsible-body">
      <div class="validation-summary">
        <div class="summary-card tone-neutral"><span class="summary-value">${report.summary.sessions}</span><span class="summary-label">Sessions</span></div>
        <div class="summary-card tone-neutral"><span class="summary-value">${report.summary.campuses}</span><span class="summary-label">Campuses</span></div>
        <div class="summary-card tone-neutral"><span class="summary-value">${report.summary.modules}</span><span class="summary-label">Modules</span></div>
        <div class="summary-card tone-neutral"><span class="summary-value">${report.summary.seminarSlots}</span><span class="summary-label">Seminars</span></div>
      </div>
      ${unmatchedHtml}
      ${assessmentHtml}
      <div class="check-list">${checksHtml}</div>
    </div>
  </details>`;
}

/** @deprecated Use renderValidationSection — kept for tests. */
export function renderValidationView({ project, container }) {
  container.innerHTML = renderValidationSection(project);
}
