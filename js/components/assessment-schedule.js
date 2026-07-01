import { esc } from "../utils/dom.js";
import { displayAssessmentStatus, WEEKDAYS } from "../config/constants.js";
import {
  buildAssessmentScheduleItems,
  filterAssessmentItemsForWeek,
  buildAssessmentSemesterColumns,
  groupAssessmentByWeek,
  groupAssessmentByModule,
  groupAssessmentByType,
  groupAssessmentByCampus,
  groupAssessmentByCohort,
  groupAssessmentByScheduleSemester,
  dayColumnsForAssessmentWeek,
  listAssessmentFilterOptions,
  itemMatchesAssessmentScheduleFilters,
} from "../analytics/assessment-viz.js";
import { getCurrentTeachingWeek, getAssessmentTypeLabel, resolveSemesterStart } from "../analytics/assessment.js";
import { teachingWeekCommencing } from "../analytics/class-test-viz.js";
import { formatShortDate } from "../utils/dates.js";

const TYPE_CLASS = {
  classTest: "assess-class-test",
  presentation: "assess-presentation",
  submission: "assess-submission",
  exam: "assess-exam",
  other: "assess-other",
};

const VIEWS = [
  { id: "this-week", label: "This week" },
  { id: "semester", label: "Semester map" },
  { id: "timeline", label: "By teaching week" },
  { id: "by-module", label: "By module" },
  { id: "by-type", label: "By type" },
  { id: "by-cohort", label: "By cohort" },
  { id: "by-campus", label: "By campus" },
  { id: "by-schedule-semester", label: "By schedule semester" },
];

function statusClass(status) {
  return String(status || "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function resolveViewingWeek(currentWeek, weekOffset, semesterStart) {
  const baseWeek = currentWeek?.beforeSemester ? 1 : currentWeek?.weekNumber || 1;
  const weekNumber = Math.max(1, baseWeek + weekOffset);
  const wc = semesterStart ? teachingWeekCommencing(semesterStart, weekNumber) : null;
  return {
    weekNumber,
    weekLabel: `Week ${weekNumber}`,
    weekCommencing: wc,
    isViewingCurrent: Boolean(currentWeek && !currentWeek.beforeSemester && weekOffset === 0),
    weekOffset,
  };
}

function renderPositionBar(currentWeek, semesterStart, todayWeekday) {
  if (!currentWeek) {
    return `<div class="cts-position-bar cts-position-missing">
      <strong>Semester position unknown</strong>
      <span class="muted small">Set the semester start date below to browse weeks and see “you are here” markers.</span>
    </div>`;
  }
  if (currentWeek.beforeSemester) {
    return `<div class="cts-position-bar">
      <span class="cts-you-are-here">Before semester</span>
      <span>Starts in <strong>${currentWeek.daysUntilStart} days</strong> (w/c ${esc(semesterStart)})</span>
    </div>`;
  }
  const todayLabel = todayWeekday ? ` · <strong>${esc(todayWeekday)}</strong>` : "";
  return `<div class="cts-position-bar">
    <span class="cts-you-are-here">You are here</span>
    <span><strong>${esc(currentWeek.weekLabel)}</strong>${todayLabel} · w/c ${esc(formatShortDate(new Date(`${currentWeek.weekCommencing}T12:00:00`)))}</span>
    <span class="muted small">Day ${currentWeek.dayInWeek} of 7 in this teaching week</span>
  </div>`;
}

function renderWeekNav(viewingWeek) {
  const wcLabel = viewingWeek.weekCommencing ? formatShortDate(viewingWeek.weekCommencing) : "";
  const atFirstWeek = viewingWeek.weekNumber <= 1;
  return `<div class="cts-week-nav" role="group" aria-label="Browse teaching weeks">
    <button type="button" class="btn btn-small" data-ass-week-delta="-1"${atFirstWeek ? " disabled" : ""}>← Previous</button>
    <div class="cts-week-nav-center">
      <strong>${esc(viewingWeek.weekLabel)}</strong>
      ${wcLabel ? `<span class="muted small">w/c ${esc(wcLabel)}</span>` : ""}
      ${viewingWeek.isViewingCurrent ? `<span class="cts-you-are-here small">This week</span>` : ""}
    </div>
    <button type="button" class="btn btn-small" data-ass-week-delta="1">Next →</button>
    ${!viewingWeek.isViewingCurrent ? `<button type="button" class="btn btn-small btn-muted" data-ass-week-reset>Back to this week</button>` : ""}
  </div>`;
}

function cohortBadge(item) {
  const c = item.primaryCohort;
  if (!c?.parsed) return "";
  return `<span class="cts-cohort-badge" title="${esc(c.raw)}">${esc(c.cohortLabel)} · ${esc(c.studyYear)}${c.studySemesterLabel ? ` · ${esc(c.studySemesterLabel)}` : ""}</span>`;
}

function renderAssessmentChip(item, { compact = false } = {}) {
  const typeCls = TYPE_CLASS[item.assessmentType] || TYPE_CLASS.other;
  const dueLine = item.dueDateParsed
    ? formatShortDate(item.dueDateParsed)
    : item.dueDate || item.weekLabel;
  const typeLabel = getAssessmentTypeLabel(item.assessmentType);

  if (compact) {
    return `<div class="cts-chip cts-chip-compact timeline-chip ${typeCls}" title="${esc(item.rawText)}">
      <strong>${esc(item.moduleCode)}</strong> ${esc(item.assessmentCode || typeLabel)}
      <span class="muted small">${esc(item.weekLabel)}</span>
    </div>`;
  }

  return `<div class="cts-chip assess-schedule-chip ${typeCls}" title="${esc(item.rawText)}">
    <div class="cts-chip-head">
      <strong>${esc(item.moduleCode)}</strong>
      <span class="timeline-chip ${typeCls}">${esc(typeLabel)}</span>
    </div>
    ${cohortBadge(item)}
    <div class="muted small">${esc(item.moduleName)}</div>
    <div class="cts-chip-when">${esc(item.assessmentCode || item.title?.slice(0, 40) || "—")} · ${esc(item.weekLabel)}</div>
    <div class="cts-chip-time">${item.weekday ? `${esc(item.weekday)} · ` : ""}${esc(dueLine)}</div>
    <div class="cts-chip-meta muted small">
      ${item.weight ? `${esc(item.weight)} · ` : ""}${item.dueText ? esc(item.dueText.slice(0, 60)) : ""}
      ${item.campuses.length ? ` · ${esc(item.campuses.join(", "))}` : ""}
    </div>
    <div class="cts-chip-status"><span class="badge status-${statusClass(item.status)}">${esc(displayAssessmentStatus(item.status))}</span></div>
  </div>`;
}

function renderThisWeekDayBoard(weekItems, ctx) {
  const { columns, unscheduled } = dayColumnsForAssessmentWeek(weekItems, ctx.weekCommencing);
  const showToday = ctx.viewingWeek?.isViewingCurrent;

  let html = `<div class="cts-day-grid">`;
  for (const col of columns) {
    const isToday = showToday && col.day === ctx.todayWeekday;
    html += `<div class="cts-day-col${isToday ? " is-today" : ""}">
      <div class="cts-day-head">
        <strong>${esc(col.day.slice(0, 3))}</strong>
        ${col.dateLabel ? `<span class="muted small">${esc(col.dateLabel)}</span>` : ""}
        ${isToday ? `<span class="cts-today-tag">Today</span>` : ""}
      </div>
      <div class="cts-day-body">${
        col.items.length
          ? col.items.map((i) => renderAssessmentChip(i)).join("")
          : `<span class="muted small cts-empty-day-inline">—</span>`
      }</div>
    </div>`;
  }
  html += `</div>`;

  if (unscheduled.length) {
    html += `<div class="assess-week-floating">
      <h5 class="muted small">Scheduled this week (no specific day)</h5>
      <div class="cts-group-items">${unscheduled.map((i) => renderAssessmentChip(i)).join("")}</div>
    </div>`;
  }
  return html;
}

function renderThisWeekView(weekItems, ctx) {
  if (!ctx.semesterStart) {
    return `<p class="muted">Set the semester start date below to browse assessment weeks.</p>`;
  }

  const dayHint =
    ctx.viewingWeek.isViewingCurrent && ctx.todayWeekday
      ? ` · <span class="cts-today-inline">${esc(ctx.todayWeekday)} today</span>`
      : "";

  return `<div class="cts-this-week">
    ${renderWeekNav(ctx.viewingWeek)}
    <h4 class="cts-subheading">${esc(ctx.viewingWeek.weekLabel)} — assessments by day${dayHint}</h4>
    ${weekItems.length ? renderThisWeekDayBoard(weekItems, ctx) : `<p class="muted small">No assessments in ${esc(ctx.viewingWeek.weekLabel)} with the current filters.</p>`}
  </div>`;
}

function renderSemesterMapView(items, ctx) {
  const columns = buildAssessmentSemesterColumns(items, {
    semesterStart: ctx.semesterStart,
    currentWeek: ctx.currentWeek,
  });
  return `<div class="cts-semester-wrap"><div class="cts-semester-map">${columns
    .map((col) => {
      const wc = col.weekCommencing ? formatShortDate(col.weekCommencing) : "";
      const colClass = col.isCurrent ? "cts-semester-col is-current" : col.isPast ? "cts-semester-col is-past" : "cts-semester-col";
      return `<div class="${colClass}">
        <div class="cts-semester-head">
          ${col.isCurrent ? `<span class="cts-you-are-here small">Now</span>` : ""}
          <strong>${esc(col.weekLabel)}</strong>
          ${wc ? `<span class="muted small">${esc(wc)}</span>` : ""}
        </div>
        <div class="cts-semester-body">${col.items.length ? col.items.map((i) => renderAssessmentChip(i, { compact: true })).join("") : `<span class="muted small">—</span>`}</div>
      </div>`;
    })
    .join("")}</div></div>`;
}

function renderTimelineView(items, ctx) {
  const weeks = groupAssessmentByWeek(items);
  return `<div class="cts-timeline-wrap"><div class="cts-timeline">${weeks
    .map((week) => {
      const wc = week.weekCommencing ? formatShortDate(week.weekCommencing) : "";
      const isCurrent = ctx.currentWeek && week.weekNum === ctx.currentWeek.weekNumber;
      return `<div class="cts-week-col${isCurrent ? " is-current" : ""}">
        <div class="cts-week-head">
          ${isCurrent ? `<span class="cts-you-are-here small">Now</span>` : ""}
          <strong>${esc(week.label)}</strong>
          ${wc ? `<span class="muted small">${esc(wc)}</span>` : ""}
          <span class="muted small">${week.items.length} item${week.items.length === 1 ? "" : "s"}</span>
        </div>
        <div class="cts-week-body">${week.items.map((i) => renderAssessmentChip(i)).join("")}</div>
      </div>`;
    })
    .join("")}</div></div>`;
}

function renderGroupedPanels(groups, nameFn = (g) => g.name) {
  return `<div class="cts-group-list">${groups
    .map(
      (group) => `<details class="cts-group-panel" open>
        <summary><strong>${esc(nameFn(group))}</strong> <span class="muted small">${group.items.length} item${group.items.length === 1 ? "" : "s"}</span></summary>
        <div class="cts-group-items">${group.items.map((i) => renderAssessmentChip(i)).join("")}</div>
      </details>`
    )
    .join("")}</div>`;
}

function renderViewContent(items, view, ctx) {
  switch (view) {
    case "this-week":
      return renderThisWeekView(ctx.weekItems, ctx);
    case "semester":
      return renderSemesterMapView(items, ctx);
    case "by-module":
      return renderGroupedPanels(groupAssessmentByModule(items), (g) => `${g.name} — ${g.moduleName}`);
    case "by-type":
      return renderGroupedPanels(groupAssessmentByType(items));
    case "by-cohort":
      return renderGroupedPanels(groupAssessmentByCohort(items));
    case "by-campus":
      return renderGroupedPanels(groupAssessmentByCampus(items));
    case "by-schedule-semester":
      return renderGroupedPanels(groupAssessmentByScheduleSemester(items));
    default:
      return renderTimelineView(items, ctx);
  }
}

function renderFilterBar(options, filters) {
  const sel = (id, label, values, current) => {
    const opts = values.map((v) => `<option value="${esc(v)}"${v === current ? " selected" : ""}>${esc(v)}</option>`).join("");
    return `<label class="cts-filter-label">${esc(label)}<select id="${id}" data-ass-filter="${id}"><option value="">All</option>${opts}</select></label>`;
  };

  const typeLabels = {
    classTest: "Class test / lab",
    presentation: "Presentation",
    submission: "Submission",
    exam: "Exam",
    other: "Other",
  };

  return `<div class="cts-filters">
    ${options.types.length ? `<label class="cts-filter-label">Type<select id="ass-filter-type" data-ass-filter="ass-filter-type"><option value="">All</option>${options.types.map((t) => `<option value="${esc(t)}"${t === filters.type ? " selected" : ""}>${esc(typeLabels[t] || t)}</option>`).join("")}</select></label>` : ""}
    ${options.scheduleSemesters.length ? sel("ass-filter-sched-sem", "Schedule semester", options.scheduleSemesters, filters.scheduleSemester) : ""}
    ${options.campuses.length ? sel("ass-filter-campus", "Campus", options.campuses, filters.campus) : ""}
    ${options.siteCodes.length ? sel("ass-filter-site", "Site", options.siteCodes, filters.siteCode) : ""}
    ${options.cohortCodes.length ? `<label class="cts-filter-label">Cohort intake<select id="ass-filter-cohort" data-ass-filter="ass-filter-cohort"><option value="">All</option>${options.cohortCodes.map((c) => `<option value="${esc(c.code)}"${c.code === filters.cohortCode ? " selected" : ""}>${esc(c.code)} (${esc(c.label)})</option>`).join("")}</select></label>` : ""}
    ${options.studyYears.length ? sel("ass-filter-year", "Year", options.studyYears, filters.studyYear) : ""}
    ${options.semesters.length ? `<label class="cts-filter-label">Semester<select id="ass-filter-semester" data-ass-filter="ass-filter-semester"><option value="">All</option>${options.semesters.map((s) => `<option value="${esc(s)}"${String(s) === String(filters.studySemester) ? " selected" : ""}>Semester ${esc(s)}</option>`).join("")}</select></label>` : ""}
    ${Object.values(filters).some(Boolean) ? `<button type="button" class="btn btn-small btn-muted" id="ass-filter-clear">Clear</button>` : ""}
  </div>`;
}

export function renderAssessmentSchedule(project, { view = "this-week", filters = {}, weekOffset = 0, moduleCode = "" } = {}) {
  const events = project.getAssessmentEvents();
  if (!events.length) return "";

  const semesterStart = resolveSemesterStart(project, events);
  const allItems = buildAssessmentScheduleItems(project, { semesterStart });
  let items = allItems.filter((item) => itemMatchesAssessmentScheduleFilters(item, filters));
  if (moduleCode) {
    items = items.filter((item) => String(item.moduleCode).toLowerCase() === String(moduleCode).toLowerCase());
  }

  const currentWeek = getCurrentTeachingWeek(semesterStart);
  const viewingWeek = resolveViewingWeek(currentWeek, weekOffset, semesterStart);
  const todayWeekday =
    viewingWeek.isViewingCurrent && currentWeek?.dayInWeek ? WEEKDAYS[currentWeek.dayInWeek - 1] : "";
  const weekItems = semesterStart ? filterAssessmentItemsForWeek(items, viewingWeek.weekNumber, semesterStart) : [];

  const ctx = {
    semesterStart,
    currentWeek,
    viewingWeek,
    todayWeekday,
    weekCommencing: viewingWeek.weekCommencing,
    weekItems,
  };

  const filterOptions = listAssessmentFilterOptions(allItems);
  const modules = new Set(items.map((i) => i.moduleCode)).size;

  return `<section class="class-test-schedule-panel assessment-schedule-panel">
    <div class="cts-header">
      <h3 class="section-heading">Assessment schedule</h3>
      <p class="muted small">Browse deadlines and in-class assessments by week, module, type, campus, or cohort. Campus and cohort come from your timetable where the module is taught.</p>
      <div class="cts-stats muted small">${items.length} of ${allItems.length} items · ${modules} module${modules === 1 ? "" : "s"}${moduleCode ? ` · filtered to ${esc(moduleCode)}` : ""}</div>
    </div>
    ${renderPositionBar(currentWeek, semesterStart, todayWeekday)}
    ${renderFilterBar(filterOptions, filters)}
    <div class="cts-toolbar" role="group" aria-label="Assessment schedule view">
      <span class="cts-toolbar-label">View</span>
      ${VIEWS.map(
        (v) =>
          `<button type="button" class="btn btn-small layout-btn cts-view-btn ass-view-btn${v.id === view ? " active" : ""}" data-ass-view="${v.id}" aria-pressed="${v.id === view}">${esc(v.label)}</button>`
      ).join("")}
    </div>
    <div class="cts-legend muted small">
      <span><i class="dot assess-class-test"></i> Class test / lab</span>
      <span><i class="dot assess-presentation"></i> Presentation</span>
      <span><i class="dot assess-submission"></i> Submission</span>
      <span><i class="dot assess-exam"></i> Exam</span>
      <span><i class="dot cts-now"></i> Current week / today</span>
    </div>
    ${items.length ? renderViewContent(items, view, ctx) : `<p class="muted">No assessments match the selected filters.</p>`}
  </section>`;
}

const FILTER_MAP = {
  "ass-filter-type": "type",
  "ass-filter-sched-sem": "scheduleSemester",
  "ass-filter-campus": "campus",
  "ass-filter-site": "siteCode",
  "ass-filter-cohort": "cohortCode",
  "ass-filter-year": "studyYear",
  "ass-filter-semester": "studySemester",
};

export function bindAssessmentScheduleView(container, { onViewChange, onFilterChange, onWeekOffsetChange } = {}) {
  container.querySelectorAll("[data-ass-view]").forEach((btn) => {
    btn.onclick = () => {
      const view = btn.dataset.assView;
      if (view) onViewChange?.(view);
    };
  });

  container.querySelectorAll("[data-ass-week-delta]").forEach((btn) => {
    btn.onclick = () => {
      if (btn.disabled) return;
      const delta = Number(btn.dataset.assWeekDelta);
      if (Number.isFinite(delta)) onWeekOffsetChange?.(delta);
    };
  });

  container.querySelector("[data-ass-week-reset]")?.addEventListener("click", () => onWeekOffsetChange?.("reset"));

  container.querySelectorAll("[data-ass-filter]").forEach((el) => {
    el.addEventListener("change", () => {
      const key = FILTER_MAP[el.id];
      if (key) onFilterChange?.({ [key]: el.value });
    });
  });

  container.querySelector("#ass-filter-clear")?.addEventListener("click", () => {
    onFilterChange?.({
      type: "",
      scheduleSemester: "",
      campus: "",
      siteCode: "",
      cohortCode: "",
      studyYear: "",
      studySemester: "",
    });
  });
}
