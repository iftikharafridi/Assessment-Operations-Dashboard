import { esc, unique } from "../utils/dom.js";
import { dataTable } from "./table.js";
import { normalizeSemesterNumber } from "../excel/assessment-parser.js";
import { SCHEDULING_BASIS_LABELS } from "../excel/assessment-format.js";

const BASIS_CLASS = {
  weekCommencing: "sched-wc",
  fixedDeadline: "sched-fixed",
  mixed: "sched-mixed",
  notSpecified: "sched-unknown",
};

export function buildSimplifiedAssessmentRows(events) {
  return (events || [])
    .map((e) => ({
      ...e,
      semester: normalizeSemesterNumber(e.semester),
      sortKey: e.exactDueDate || e.weekCommencing || "9999-99-99",
    }))
    .sort(
      (a, b) =>
        a.sortKey.localeCompare(b.sortKey) ||
        String(a.moduleCode).localeCompare(String(b.moduleCode)) ||
        (a.weekNumber || 0) - (b.weekNumber || 0)
    );
}

export function computeSimplifiedKpis(rows) {
  return {
    total: rows.length,
    weekCommencing: rows.filter((r) => r.schedulingBasis === "weekCommencing").length,
    fixedDeadline: rows.filter((r) => r.schedulingBasis === "fixedDeadline").length,
    mixed: rows.filter((r) => r.schedulingBasis === "mixed").length,
  };
}

export function filterSimplifiedRows(rows, filters = {}) {
  return rows.filter((r) => {
    if (filters.module && !String(r.moduleCode).toLowerCase().includes(String(filters.module).toLowerCase())) {
      return false;
    }
    if (filters.semester && String(r.semester) !== String(filters.semester)) return false;
    if (filters.format && r.assessmentFormat !== filters.format) return false;
    if (filters.basis && r.schedulingBasis !== filters.basis) return false;
    return true;
  });
}

function renderKpis(kpis) {
  return `<div class="kpi-grid simplified-kpis">
    <article class="kpi-card"><span class="kpi-value">${kpis.total}</span><span class="kpi-label">Total events</span></article>
    <article class="kpi-card tone-planned"><span class="kpi-value">${kpis.weekCommencing}</span><span class="kpi-label">W/C events</span></article>
    <article class="kpi-card tone-ready"><span class="kpi-value">${kpis.fixedDeadline}</span><span class="kpi-label">Fixed deadlines</span></article>
    <article class="kpi-card tone-warn"><span class="kpi-value">${kpis.mixed}</span><span class="kpi-label">Mixed events</span></article>
  </div>`;
}

export function renderSimplifiedFilterChrome(events, filters = {}) {
  const all = buildSimplifiedAssessmentRows(events);
  const rows = filterSimplifiedRows(all, filters);
  const kpis = computeSimplifiedKpis(rows);

  const modules = unique(all.map((r) => r.moduleCode).filter(Boolean)).sort();
  const semesters = unique(all.map((r) => r.semester).filter(Boolean)).sort((a, b) => Number(a) - Number(b));
  const formats = unique(all.map((r) => r.assessmentFormat).filter(Boolean)).sort();
  const bases = ["weekCommencing", "fixedDeadline", "mixed", "notSpecified"].filter((b) =>
    all.some((r) => r.schedulingBasis === b)
  );

  return `${renderKpis(kpis)}
    <div class="view-filters simplified-filters">
      <label>Module
        <select id="simp-filter-module">
          <option value="">All modules</option>
          ${modules.map((m) => `<option value="${esc(m)}" ${filters.module === m ? "selected" : ""}>${esc(m)}</option>`).join("")}
        </select>
      </label>
      <label>Semester
        <select id="simp-filter-semester">
          <option value="">All</option>
          ${semesters.map((s) => `<option value="${esc(s)}" ${String(filters.semester) === String(s) ? "selected" : ""}>${esc(s)}</option>`).join("")}
        </select>
      </label>
      <label>Assessment format
        <select id="simp-filter-format">
          <option value="">All formats</option>
          ${formats.map((f) => `<option value="${esc(f)}" ${filters.format === f ? "selected" : ""}>${esc(f)}</option>`).join("")}
        </select>
      </label>
      <label>Scheduling basis
        <select id="simp-filter-basis">
          <option value="">All</option>
          ${bases.map((b) => `<option value="${esc(b)}" ${filters.basis === b ? "selected" : ""}>${esc(SCHEDULING_BASIS_LABELS[b] || b)}</option>`).join("")}
        </select>
      </label>
      ${Object.values(filters).some(Boolean) ? `<button type="button" class="btn btn-small btn-muted" id="simp-filter-clear">Clear</button>` : ""}
    </div>`;
}

function basisBadge(basis) {
  const label = SCHEDULING_BASIS_LABELS[basis] || basis || "Not specified";
  return `<span class="sched-basis-badge ${BASIS_CLASS[basis] || "sched-unknown"}">${esc(label)}</span>`;
}

/**
 * @param {{ events: any[], filters?: object, onFilterChange?: Function }} opts
 */
export function renderSimplifiedAssessmentSchedule(events, { filters = {}, onFilterChange } = {}) {
  const all = buildSimplifiedAssessmentRows(events);
  const rows = filterSimplifiedRows(all, filters);

  const rowsHtml = rows
    .map((r) => {
      const wc =
        r.schedulingBasis === "fixedDeadline"
          ? "—"
          : r.weekCommencing
            ? esc(r.weekCommencing)
            : "—";
      const fixed =
        r.schedulingBasis === "weekCommencing"
          ? "—"
          : r.exactDueDate
            ? esc(r.exactDueDate)
            : "—";
      return `<tr class="${BASIS_CLASS[r.schedulingBasis] || ""}" data-event-id="${esc(r.id)}">
        <td><strong>${esc(r.moduleCode)}</strong><br><span class="muted small">${esc(r.moduleName)}</span></td>
        <td>${esc(r.semester || "—")}</td>
        <td>${esc(r.weekLabel || "—")}</td>
        <td>${esc(r.assessmentCode || "—")}</td>
        <td>${esc(r.assessmentFormat || "—")}</td>
        <td>${esc(r.weight || "—")}</td>
        <td>${basisBadge(r.schedulingBasis)}</td>
        <td title="Week commencing">${wc}</td>
        <td>${fixed}</td>
        <td class="muted small">${esc((r.feedbackText || r.feedbackDate || "—").slice(0, 80))}</td>
        <td><button type="button" class="btn btn-small view-simplified-detail" data-event-id="${esc(r.id)}">Details</button></td>
      </tr>`;
    })
    .join("");

  return `<section class="panel-section simplified-schedule-panel">
    <p class="muted small">Operational view of all modules. <strong>W/C</strong> = week commencing (group/timetable-dependent). Fixed deadlines apply to all groups.</p>
    ${renderSimplifiedFilterChrome(events, filters)}
    <div class="table-scroll table-scroll-sticky">${dataTable({
      headers: [
        "Module",
        "Semester",
        "Teaching week",
        "Assessment",
        "Assessment format",
        "Weight",
        "Scheduling basis",
        { label: "W/C", title: "Week commencing — Monday of the teaching week for group-based events" },
        "Fixed deadline",
        "Feedback",
        "Details",
      ],
      rowsHtml: rowsHtml || `<tr><td colspan="11" class="muted">No assessment events match these filters.</td></tr>`,
      className: "data-table table-pro simplified-assess-table",
    })}</div>
    <dialog class="assess-detail-dialog" id="simplified-detail-dialog">
      <article>
        <header><h3>Assessment details</h3>
          <button type="button" class="btn btn-small btn-muted" data-close-simp-dialog>✕</button>
        </header>
        <dl class="dialog-dl" id="simplified-detail-body"></dl>
      </article>
    </dialog>
  </section>`;
}

export function bindSimplifiedAssessmentSchedule(container, events, { filters = {}, onFilterChange } = {}) {
  const emit = (partial) => onFilterChange?.({ ...filters, ...partial });

  container.querySelector("#simp-filter-module")?.addEventListener("change", (e) => emit({ module: e.target.value }));
  container.querySelector("#simp-filter-semester")?.addEventListener("change", (e) => emit({ semester: e.target.value }));
  container.querySelector("#simp-filter-format")?.addEventListener("change", (e) => emit({ format: e.target.value }));
  container.querySelector("#simp-filter-basis")?.addEventListener("change", (e) => emit({ basis: e.target.value }));
  container.querySelector("#simp-filter-clear")?.addEventListener("click", () =>
    onFilterChange?.({ module: "", semester: "", format: "", basis: "" })
  );

  const dlg = container.querySelector("#simplified-detail-dialog");
  const body = container.querySelector("#simplified-detail-body");
  container.querySelectorAll(".view-simplified-detail").forEach((btn) => {
    btn.onclick = () => {
      const event = events.find((e) => e.id === btn.dataset.eventId);
      if (!event || !dlg || !body) return;
      dlg.querySelector("h3").textContent = `${event.moduleCode} — ${event.assessmentCode || "Assessment"}`;
      body.innerHTML = `
        <dt>Module</dt><dd>${esc(event.moduleName)}</dd>
        <dt>Format</dt><dd>${esc(event.assessmentFormat)}</dd>
        <dt>Scheduling</dt><dd>${esc(SCHEDULING_BASIS_LABELS[event.schedulingBasis] || event.schedulingBasis)}</dd>
        <dt>W/C</dt><dd>${esc(event.weekCommencing || "—")}</dd>
        <dt>Fixed deadline</dt><dd>${esc(event.exactDueDate || "—")}</dd>
        <dt>Weight</dt><dd>${esc(event.weight || "—")}</dd>
        <dt>Feedback</dt><dd>${esc(event.feedbackText || event.feedbackDate || "—")}</dd>
        <dt>Source wording</dt><dd class="assessment-details">${esc(event.rawText || "").replace(/\n/g, "<br>")}</dd>`;
      dlg.showModal();
    };
  });
  dlg?.querySelector("[data-close-simp-dialog]")?.addEventListener("click", () => dlg.close());
}
