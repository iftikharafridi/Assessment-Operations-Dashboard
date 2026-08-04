import { esc } from "../utils/dom.js";
import { SCHEDULING_BASIS_LABELS } from "../excel/assessment-format.js";
import { getCurrentTeachingWeek, resolveSemesterStart } from "../analytics/assessment.js";
import {
  buildSimplifiedAssessmentRows,
  filterSimplifiedRows,
} from "./simplified-assessment-schedule.js";

const BASIS_CLASS = {
  weekCommencing: "sched-wc",
  fixedDeadline: "sched-fixed",
  mixed: "sched-mixed",
  notSpecified: "sched-unknown",
};

function basisBadge(basis) {
  const label = SCHEDULING_BASIS_LABELS[basis] || basis || "Not specified";
  return `<span class="sched-basis-badge ${BASIS_CLASS[basis] || "sched-unknown"}">${esc(label)}</span>`;
}

function basisShort(basis) {
  if (basis === "weekCommencing") return "W/C";
  if (basis === "fixedDeadline") return "Fixed";
  if (basis === "mixed") return "Mixed";
  return "—";
}

function weekSortKey(row) {
  if (row.weekNumber != null && row.weekNumber !== "" && Number.isFinite(Number(row.weekNumber))) {
    return Number(row.weekNumber);
  }
  const m = String(row.weekLabel || "").match(/week\s*(-?\d+)/i);
  return m ? Number(m[1]) : 9999;
}

function weekLabelFor(row) {
  if (row.weekLabel) return row.weekLabel;
  if (row.weekNumber != null && row.weekNumber !== "") return `Week ${row.weekNumber}`;
  return "Week not specified";
}

function dateHint(r) {
  if (r.schedulingBasis === "fixedDeadline") return r.exactDueDate || "";
  if (r.schedulingBasis === "mixed") {
    const parts = [];
    if (r.exactDueDate) parts.push(r.exactDueDate);
    if (r.weekCommencing) parts.push(`W/C ${r.weekCommencing}`);
    return parts.join(" · ");
  }
  return r.weekCommencing || "";
}

/**
 * Group filtered assessment rows into operational-week buckets.
 * Includes weeks outside 1–12 whenever events exist there.
 */
export function groupSimplifiedRowsByWeek(rows) {
  /** @type {Map<string, { label: string, weekNum: number, weekCommencing: string, items: any[] }>} */
  const buckets = new Map();

  for (const row of rows) {
    const weekNum = weekSortKey(row);
    const label = weekLabelFor(row);
    const key = `${weekNum}|${label}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        label,
        weekNum,
        weekCommencing: row.weekCommencing || "",
        items: [],
      });
    }
    const bucket = buckets.get(key);
    if (!bucket.weekCommencing && row.weekCommencing) bucket.weekCommencing = row.weekCommencing;
    bucket.items.push(row);
  }

  for (const b of buckets.values()) {
    b.items.sort(
      (a, b) =>
        String(a.exactDueDate || a.weekCommencing || "").localeCompare(
          String(b.exactDueDate || b.weekCommencing || "")
        ) || String(a.moduleCode).localeCompare(String(b.moduleCode))
    );
  }

  return [...buckets.values()].sort((a, b) => a.weekNum - b.weekNum || a.label.localeCompare(b.label));
}

function renderDensityToggle(density) {
  return `<div class="by-week-density" role="group" aria-label="By week layout">
    <span class="cts-toolbar-label">Layout</span>
    <button type="button" class="btn btn-small layout-btn${density === "compact" ? " active" : ""}" data-by-week-density="compact" aria-pressed="${density === "compact"}">Compact (all weeks)</button>
    <button type="button" class="btn btn-small layout-btn${density === "cards" ? " active" : ""}" data-by-week-density="cards" aria-pressed="${density === "cards"}">Cards</button>
  </div>`;
}

function renderWeekNav(weeks, currentWeekNum, focusWeek) {
  if (!weeks.length) return "";
  const options = weeks
    .map(
      (w) =>
        `<option value="${esc(String(w.weekNum))}" ${Number(focusWeek) === w.weekNum ? "selected" : ""}>${esc(w.label)}${w.weekNum === currentWeekNum ? " (current)" : ""}</option>`
    )
    .join("");
  return `<div class="by-week-nav">
    <button type="button" class="btn btn-small" id="by-week-prev" title="Previous week">←</button>
    <label class="by-week-jump">Jump to
      <select id="by-week-jump">${options}</select>
    </label>
    <button type="button" class="btn btn-small" id="by-week-next" title="Next week">→</button>
    ${
      currentWeekNum != null && Number.isFinite(currentWeekNum)
        ? `<button type="button" class="btn btn-small btn-muted" id="by-week-current">This week</button>`
        : ""
    }
  </div>`;
}

function renderEventCard(r) {
  const wc =
    r.schedulingBasis === "fixedDeadline" ? "—" : r.weekCommencing ? esc(r.weekCommencing) : "—";
  const fixed =
    r.schedulingBasis === "weekCommencing" ? "—" : r.exactDueDate ? esc(r.exactDueDate) : "—";

  return `<article class="by-week-card ${BASIS_CLASS[r.schedulingBasis] || ""}" data-event-id="${esc(r.id)}">
    <header>
      <strong>${esc(r.moduleCode)}</strong>
      <span class="muted small">${esc(r.assessmentCode || "—")}</span>
      ${basisBadge(r.schedulingBasis)}
    </header>
    <div class="by-week-card-title">${esc(r.assessmentFormat || r.title || "Assessment")}</div>
    <div class="muted small">${esc(r.moduleName || "")}${r.weight ? ` · ${esc(r.weight)}` : ""}${r.semester ? ` · Semester ${esc(r.semester)}` : ""}</div>
    <dl class="by-week-dates">
      <div><dt>W/C</dt><dd>${wc}</dd></div>
      <div><dt>Fixed deadline</dt><dd>${fixed}</dd></div>
      <div><dt>Feedback</dt><dd>${esc((r.feedbackDate || r.feedbackText || "—").toString().slice(0, 40))}</dd></div>
    </dl>
  </article>`;
}

function renderCompactChip(r) {
  const hint = dateHint(r);
  const title = [
    r.moduleName,
    r.assessmentFormat,
    SCHEDULING_BASIS_LABELS[r.schedulingBasis] || "",
    hint,
  ]
    .filter(Boolean)
    .join(" · ");

  return `<div class="by-week-chip ${BASIS_CLASS[r.schedulingBasis] || ""}" title="${esc(title)}" data-event-id="${esc(r.id)}">
    <span class="by-week-chip-code">${esc(r.moduleCode)}</span>
    <span class="by-week-chip-assess">${esc(r.assessmentCode || "—")}</span>
    <span class="by-week-chip-format">${esc(r.assessmentFormat || "—")}</span>
    ${r.weight ? `<span class="by-week-chip-weight">${esc(r.weight)}</span>` : ""}
    <span class="by-week-chip-basis">${esc(basisShort(r.schedulingBasis))}</span>
    ${hint ? `<span class="by-week-chip-date">${esc(hint)}</span>` : ""}
  </div>`;
}

function renderCardsLayout(weeks, currentWeekNum, activeWeek) {
  return weeks
    .map((week) => {
      const isCurrent = currentWeekNum != null && week.weekNum === currentWeekNum;
      const isFocused = activeWeek != null && week.weekNum === activeWeek;
      const wc = week.weekCommencing ? ` · w/c ${esc(week.weekCommencing)}` : "";
      return `<details class="by-week-panel${isCurrent ? " is-current" : ""}${isFocused ? " is-focused" : ""}" data-week="${week.weekNum}" ${isFocused || isCurrent ? "open" : ""} id="by-week-${week.weekNum}">
        <summary>
          <span class="by-week-summary-main">
            ${isCurrent ? `<span class="cts-you-are-here small">Now</span>` : ""}
            <strong>${esc(week.label)}</strong>
            <span class="muted small">${wc}</span>
          </span>
          <span class="muted small">${week.items.length} assessment${week.items.length === 1 ? "" : "s"}</span>
        </summary>
        <div class="by-week-cards">${week.items.map(renderEventCard).join("")}</div>
      </details>`;
    })
    .join("");
}

/** All weeks visible at once — dense chips in a horizontal week map. */
function renderCompactLayout(weeks, currentWeekNum) {
  if (!weeks.length) return `<p class="muted">No assessment events match the current filters.</p>`;

  const columns = weeks
    .map((week) => {
      const isCurrent = currentWeekNum != null && week.weekNum === currentWeekNum;
      const wc = week.weekCommencing ? formatShortWc(week.weekCommencing) : "";
      return `<div class="by-week-compact-col${isCurrent ? " is-current" : ""}" data-week="${week.weekNum}" id="by-week-${week.weekNum}">
        <div class="by-week-compact-head">
          ${isCurrent ? `<span class="cts-you-are-here small">Now</span>` : ""}
          <strong>${esc(week.label)}</strong>
          ${wc ? `<span class="muted small">${esc(wc)}</span>` : ""}
          <span class="muted small">${week.items.length}</span>
        </div>
        <div class="by-week-compact-body">
          ${week.items.map(renderCompactChip).join("") || `<span class="muted small">—</span>`}
        </div>
      </div>`;
    })
    .join("");

  const listRows = weeks
    .flatMap((week) =>
      week.items.map((r) => {
        const isCurrent = currentWeekNum != null && week.weekNum === currentWeekNum;
        return `<tr class="${BASIS_CLASS[r.schedulingBasis] || ""}${isCurrent ? " is-current-week" : ""}">
          <td><strong>${esc(week.label)}</strong>${week.weekCommencing ? `<br><span class="muted small">${esc(week.weekCommencing)}</span>` : ""}</td>
          <td><strong>${esc(r.moduleCode)}</strong><br><span class="muted small">${esc(r.moduleName || "")}</span></td>
          <td>${esc(r.assessmentCode || "—")}</td>
          <td>${esc(r.assessmentFormat || "—")}</td>
          <td>${esc(r.weight || "—")}</td>
          <td>${basisBadge(r.schedulingBasis)}</td>
          <td>${esc(r.weekCommencing || "—")}</td>
          <td>${esc(r.exactDueDate || "—")}</td>
        </tr>`;
      })
    )
    .join("");

  return `<div class="by-week-compact-wrap">
      <div class="by-week-compact-scroll" role="region" aria-label="All assessment weeks">${columns}</div>
    </div>
    <details class="by-week-compact-table-panel" open>
      <summary><strong>All assessments (list)</strong> <span class="muted small">Same data in one scrollable table</span></summary>
      <div class="table-scroll table-scroll-sticky">
        <table class="data-table table-pro by-week-compact-table">
          <thead>
            <tr>
              <th>Week</th>
              <th>Module</th>
              <th>Assessment</th>
              <th>Format</th>
              <th>Weight</th>
              <th>Basis</th>
              <th>W/C</th>
              <th>Fixed deadline</th>
            </tr>
          </thead>
          <tbody>${listRows}</tbody>
        </table>
      </div>
    </details>`;
}

function formatShortWc(iso) {
  const s = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * @param {object} project
 * @param {{ filters?: object, focusWeek?: number|null, density?: 'cards'|'compact' }} opts
 */
export function renderAssessmentByWeek(
  project,
  { filters = {}, focusWeek = null, density = "compact" } = {}
) {
  const events = project.getAssessmentEvents();
  const semesterStart = resolveSemesterStart(project, events);
  const currentWeek = getCurrentTeachingWeek(semesterStart);
  const currentWeekNum =
    currentWeek && !currentWeek.beforeSemester ? currentWeek.weekNumber : null;

  const all = buildSimplifiedAssessmentRows(events);
  const rows = filterSimplifiedRows(all, filters);
  const weeks = groupSimplifiedRowsByWeek(rows);
  const layout = density === "cards" ? "cards" : "compact";

  let activeWeek = focusWeek;
  if (activeWeek == null || !weeks.some((w) => w.weekNum === activeWeek)) {
    if (currentWeekNum != null && weeks.some((w) => w.weekNum === currentWeekNum)) {
      activeWeek = currentWeekNum;
    } else {
      activeWeek = weeks[0]?.weekNum ?? null;
    }
  }

  const body =
    layout === "compact"
      ? renderCompactLayout(weeks, currentWeekNum)
      : `<div class="by-week-list">${
          renderCardsLayout(weeks, currentWeekNum, activeWeek) ||
          `<p class="muted">No assessment events match the current filters.</p>`
        }</div>`;

  return `<section class="panel-section assessment-by-week-panel">
    <p class="muted small">${
      layout === "compact"
        ? "Compact weekly map — <strong>all assessments visible at once</strong>, plus a full list below. Weeks outside 1–12 are included when present."
        : "Card layout by operational week. Open a week, or use Jump to / This week."
    }</p>
    <div class="by-week-toolbar">
      ${renderDensityToggle(layout)}
      ${renderWeekNav(weeks, currentWeekNum, activeWeek)}
    </div>
    ${body}
  </section>`;
}

export function bindAssessmentByWeek(
  container,
  { weeks = [], focusWeek = null, onFocusWeekChange, onDensityChange } = {}
) {
  const weekNums = weeks.length
    ? weeks.map((w) => w.weekNum)
    : [...container.querySelectorAll("[data-week]")].map((el) => Number(el.dataset.week));

  const jump = (weekNum) => {
    if (!Number.isFinite(weekNum)) return;
    onFocusWeekChange?.(weekNum);
    const panel = container.querySelector(`#by-week-${weekNum}`);
    panel?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  const currentIndex = () => {
    const idx = weekNums.findIndex((w) => w === focusWeek);
    return idx >= 0 ? idx : 0;
  };

  container.querySelectorAll("[data-by-week-density]").forEach((btn) => {
    btn.onclick = () => onDensityChange?.(btn.dataset.byWeekDensity);
  });

  container.querySelector("#by-week-prev")?.addEventListener("click", () => {
    const i = Math.max(0, currentIndex() - 1);
    jump(weekNums[i]);
  });
  container.querySelector("#by-week-next")?.addEventListener("click", () => {
    const i = Math.min(weekNums.length - 1, currentIndex() + 1);
    jump(weekNums[i]);
  });
  container.querySelector("#by-week-jump")?.addEventListener("change", (e) => {
    jump(Number(e.target.value));
  });
  container.querySelector("#by-week-current")?.addEventListener("click", () => {
    const currentEl =
      container.querySelector(".by-week-panel.is-current") ||
      container.querySelector(".by-week-compact-col.is-current");
    if (currentEl) jump(Number(currentEl.dataset.week));
  });
}
