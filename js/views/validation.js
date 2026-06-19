import { esc } from "../utils/dom.js";
import { runDataValidation } from "../analytics/validation.js";
import { intro } from "../components/table.js";

export function renderValidationView({ project, container }) {
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
      </ul><p class="muted">These plans were kept but could not be linked to a current seminar row. Check if the timetable changed.</p></div>`
    : "";

  const assessmentHtml = (report.details.assessmentIssues || [])
    .filter((i) => i.status !== "ok")
    .length
    ? `<div class="alert alert-warning"><strong>Assessment schedule notes</strong><ul>
        ${report.details.assessmentIssues.filter((i) => i.status !== "ok").map((i) => `<li>${esc(i.message)}</li>`).join("")}
      </ul></div>`
    : "";

  container.innerHTML =
    intro("Review imported data before planning class tests. Green means OK, amber means review recommended, red means attention needed.") +
    `<div class="validation-summary">
      <div class="summary-card tone-neutral"><span class="summary-value">${report.summary.sessions}</span><span class="summary-label">Sessions</span></div>
      <div class="summary-card tone-neutral"><span class="summary-value">${report.summary.campuses}</span><span class="summary-label">Campuses</span></div>
      <div class="summary-card tone-neutral"><span class="summary-value">${report.summary.modules}</span><span class="summary-label">Modules</span></div>
      <div class="summary-card tone-neutral"><span class="summary-value">${report.summary.tutors}</span><span class="summary-label">Tutors</span></div>
      <div class="summary-card tone-neutral"><span class="summary-value">${report.summary.rooms}</span><span class="summary-label">Rooms listed</span></div>
      <div class="summary-card tone-neutral"><span class="summary-value">${report.summary.seminarSlots}</span><span class="summary-label">Seminar slots</span></div>
    </div>
    ${unmatchedHtml}
    ${assessmentHtml}
    <h3 class="section-heading">Data checks</h3>
    <div class="check-list">${checksHtml}</div>`;
}
