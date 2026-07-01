import { esc } from "../utils/dom.js";
import { campusColor, campusDisplayName } from "../config/constants.js";
import { computeExtendedDashboardMetrics } from "./kpi-cards.js";

export function renderKpiCards(project, { lastExportAt = null, dirty = false } = {}) {
  const m = computeExtendedDashboardMetrics(project);
  const cards = [
    { label: "Timetable sessions", value: m.totalSessions, tone: "neutral" },
    { label: "Assessment events", value: m.assessmentEvents, tone: "neutral" },
    { label: "Planned class tests", value: m.plannedTests, tone: "planned" },
    { label: "Missing invigilators", value: m.missingInvigilators, tone: m.missingInvigilators ? "warn" : "neutral" },
    { label: "Rooms not confirmed", value: m.roomsNotConfirmed, tone: m.roomsNotConfirmed ? "warn" : "neutral" },
    { label: "Blackboard test not ready", value: m.paperNotReady, tone: m.paperNotReady ? "warn" : "neutral" },
    { label: "LOD / software not ready", value: m.lodNotReady, tone: m.lodNotReady ? "warn" : "neutral" },
    {
      label: "Plan status",
      value: dirty ? "Unsaved" : lastExportAt ? "Saved" : "In progress",
      tone: dirty ? "warn" : lastExportAt ? "ready" : "neutral",
      hint: lastExportAt ? `Last export: ${lastExportAt}` : "Export from Reports & Export",
    },
  ];

  return `<div class="kpi-grid">${cards
    .map(
      (c) => `<article class="kpi-card tone-${c.tone}">
        <span class="kpi-value">${esc(String(c.value))}</span>
        <span class="kpi-label">${esc(c.label)}</span>
        ${c.hint ? `<span class="kpi-hint muted small">${esc(c.hint)}</span>` : ""}
      </article>`
    )
    .join("")}</div>`;
}

export function renderCampusCards(campuses, { onNavigateAttr = "data-nav" } = {}) {
  if (!campuses.length) return `<p class="muted">No campus data loaded.</p>`;

  return `<div class="campus-card-grid">${campuses
    .map(
      (c) => `<article class="campus-card" style="border-left: 4px solid ${campusColor(c.campus)}">
        <header class="campus-card-head">
          <h3>${esc(campusDisplayName(c.campus))}</h3>
          ${c.warnings ? `<span class="badge issue">${c.warnings} warning${c.warnings === 1 ? "" : "s"}</span>` : ""}
        </header>
        <dl class="campus-card-stats">
          <div><dt>Sessions</dt><dd>${c.sessions}</dd></div>
          <div><dt>Seminars</dt><dd>${c.seminars}</dd></div>
          <div><dt>Planned tests</dt><dd>${c.plannedTests}</dd></div>
          <div><dt>Ready</dt><dd>${c.readyTests}</dd></div>
          <div><dt>Missing invigilators</dt><dd>${c.missingInvigilators}</dd></div>
        </dl>
        <div class="campus-card-actions">
          <button type="button" class="btn btn-small" ${onNavigateAttr}="timetable" data-campus="${esc(c.campus)}">View timetable</button>
          <button type="button" class="btn btn-small" ${onNavigateAttr}="tests" data-campus="${esc(c.campus)}">View class tests</button>
          <button type="button" class="btn btn-small btn-muted" ${onNavigateAttr}="invigilation" data-campus="${esc(c.campus)}">View issues</button>
        </div>
      </article>`
    )
    .join("")}</div>`;
}
