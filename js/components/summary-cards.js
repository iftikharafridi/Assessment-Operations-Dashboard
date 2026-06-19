import { esc } from "../utils/dom.js";
import { computeDashboardMetrics } from "../analytics/dashboard.js";

export function renderSummaryCards(project) {
  const m = computeDashboardMetrics(project);
  const cards = [
    { label: "Total sessions", value: m.totalSessions, tone: "neutral" },
    { label: "Seminar slots", value: m.seminarSlots, tone: "neutral" },
    { label: "Planned tests", value: m.plannedTests, tone: "planned" },
    { label: "Ready tests", value: m.readyTests, tone: "ready" },
    { label: "Completed tests", value: m.completedTests, tone: "completed" },
    { label: "Missing invigilators", value: m.missingInvigilators, tone: m.missingInvigilators ? "warn" : "neutral" },
    { label: "Conflicts", value: m.conflicts, tone: m.conflicts ? "issue" : "neutral" },
  ];

  return `<div class="summary-cards">${cards
    .map(
      (c) => `<article class="summary-card tone-${c.tone}">
        <span class="summary-value">${esc(c.value)}</span>
        <span class="summary-label">${esc(c.label)}</span>
      </article>`
    )
    .join("")}</div>`;
}

export function renderConflictList(project) {
  const m = computeDashboardMetrics(project);
  if (!m.conflictDetails.length) return "";
  return `<div class="alert alert-issue">
    <strong>Items needing attention</strong>
    <ul>${m.conflictDetails.map((c) => `<li>${esc(c.message)}</li>`).join("")}</ul>
  </div>`;
}
