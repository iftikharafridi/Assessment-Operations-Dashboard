import { esc } from "../utils/dom.js";
import { displayStatus, WEEKDAYS, TIME_SLOTS, CALENDAR_HOURS } from "../config/constants.js";
import {
  buildClassTestItems,
  groupClassTestsByWeek,
  groupClassTestsByStudentGroup,
  groupClassTestsByCalendarWeek,
  groupClassTestsByCohort,
  groupClassTestsByCampus,
  dayColumnsForWeek,
  buildSemesterWeekColumns,
  filterItemsForTeachingWeek,
  teachingWeekCommencing,
} from "../analytics/class-test-viz.js";
import { getCurrentTeachingWeek, resolveSemesterStart } from "../analytics/assessment.js";
import { formatShortDate } from "../utils/dates.js";
import { listCohortFilterOptions, itemMatchesCohortFilters } from "../utils/cohort.js";
import { slotIndex, sessionSlotSpan, timeToMinutes } from "../utils/time.js";

const VIEWS = [
  { id: "this-week", label: "This week" },
  { id: "semester", label: "Semester map" },
  { id: "timeline", label: "By test week" },
  { id: "by-group", label: "By student group" },
  { id: "by-cohort", label: "By cohort" },
  { id: "by-campus", label: "By campus" },
  { id: "calendar", label: "Week grid" },
];

function statusClass(status) {
  return String(status || "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function groupLabel(item) {
  const parts = [];
  if (item.letterGroups.length) parts.push(`Grp ${item.letterGroups.join(" & ")}`);
  if (item.admissionGroups.length) parts.push(item.admissionGroups.join(", "));
  return parts.join(" · ") || "All groups";
}

function cohortBadge(item) {
  const c = item.primaryCohort;
  if (!c?.parsed) return "";
  return `<span class="cts-cohort-badge" title="${esc(c.raw)}">${esc(c.cohortLabel)} · ${esc(c.studyYear)}${c.studySemesterLabel ? ` · ${esc(c.studySemesterLabel)}` : ""}</span>`;
}

function renderTestChip(item, { compact = false } = {}) {
  const dateLine = item.testDateParsed
    ? formatShortDate(item.testDateParsed)
    : item.testDate || item.seminarSlot;
  const conflict = item.hasConflict ? `<span class="cts-conflict" title="Possible clash">⚠</span>` : "";

  if (compact) {
    return `<div class="cts-chip cts-chip-compact status-${statusClass(item.status)}${item.hasConflict ? " has-conflict" : ""}" title="${esc(item.moduleName)} — ${esc(groupLabel(item))}">
      <strong>${esc(item.moduleCode)}</strong>${conflict}
      <span class="cts-chip-time">${esc(item.start)}–${esc(item.end)}</span>
      ${item.letterGroups.length ? `<span class="muted small">Grp ${esc(item.letterGroups.join(" & "))}</span>` : ""}
    </div>`;
  }

  return `<div class="cts-chip status-${statusClass(item.status)}${item.hasConflict ? " has-conflict" : ""}" title="${esc(item.moduleName)}">
    <div class="cts-chip-head">
      <strong>${esc(item.moduleCode)}</strong>${conflict}
      ${item.letterGroups.length ? `<span class="cts-grp">Grp ${esc(item.letterGroups.join(" & "))}</span>` : ""}
    </div>
    ${cohortBadge(item)}
    <div class="cts-chip-groups muted small">${esc(groupLabel(item))}</div>
    <div class="cts-chip-when">${esc(item.weekday)} · ${esc(dateLine)}</div>
    <div class="cts-chip-time">${esc(item.start)}–${esc(item.end)} · ${esc(item.campus)}</div>
    <div class="cts-chip-meta muted small">
      ${item.room ? `Room ${esc(item.room)}` : "Room not set"}
      ${item.invigilator ? ` · ${esc(item.invigilator)}` : " · No invigilator"}
      ${item.size ? ` · ${esc(item.size)} students` : ""}
    </div>
    <div class="cts-chip-status"><span class="badge status-${statusClass(item.status)}">${esc(displayStatus(item.status))}</span></div>
  </div>`;
}

function renderPositionBar(currentWeek, semesterStart, todayWeekday) {
  if (!currentWeek) {
    return `<div class="cts-position-bar cts-position-missing">
      <strong>Semester position unknown</strong>
      <span class="muted small">Set the semester start date on the <strong>Assessments</strong> tab to see the current teaching week and “you are here” markers.</span>
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

function sessionsStartingAt(items, day, slotIdx) {
  return items.filter((item) => item.weekday === day && slotIndex(item.start) === slotIdx);
}

function renderThisWeekTimeGrid(weekItems, { todayWeekday, weekCommencing, viewingWeek } = {}) {
  const showToday = viewingWeek?.isViewingCurrent;
  const occupied = Object.fromEntries(WEEKDAYS.map((d) => [d, new Array(TIME_SLOTS.length).fill(false)]));
  const dayDates = WEEKDAYS.map((day, i) => {
    const d = weekCommencing ? new Date(weekCommencing.getFullYear(), weekCommencing.getMonth(), weekCommencing.getDate() + i, 12, 0, 0) : null;
    return { day, date: d, isToday: showToday && day === todayWeekday };
  });

  let html = `<div class="cts-week-grid-wrap"><table class="timetable-grid layout-day-side cts-week-grid"><thead><tr><th class="day-col">Day</th>`;
  html += CALENDAR_HOURS.map((h) => `<th colspan="4" class="hour-header">${h}</th>`).join("");
  html += `</tr><tr><th></th>${CALENDAR_HOURS.map(() => `<th class="slot-col">00</th><th class="slot-col">15</th><th class="slot-col">30</th><th class="slot-col">45</th>`).join("")}</tr></thead><tbody>`;

  const totalSlots = TIME_SLOTS.length;

  for (const { day, date, isToday } of dayDates) {
    const dayItems = weekItems.filter((i) => i.weekday === day);

    html += `<tr class="${isToday ? "cts-today-row" : ""}"><td class="day-col cts-day-label${isToday ? " is-today" : ""}">
      <strong>${esc(day.slice(0, 3))}</strong>
      ${date ? `<span class="muted small">${esc(formatShortDate(date))}</span>` : ""}
      ${isToday ? `<span class="cts-today-tag">Today</span>` : ""}
    </td>`;

    if (!dayItems.length) {
      html += `<td colspan="${totalSlots}" class="cts-empty-day muted small">No class tests</td></tr>`;
      continue;
    }

    let si = 0;
    while (si < TIME_SLOTS.length) {
      if (occupied[day][si]) {
        si++;
        continue;
      }
      const starters = sessionsStartingAt(dayItems, day, si);
      if (starters.length) {
        const span = Math.max(...starters.map((s) => sessionSlotSpan(s.start, s.end).span));
        for (let k = 1; k < span; k++) {
          if (si + k < TIME_SLOTS.length) occupied[day][si + k] = true;
        }
        html += `<td class="has-session session-span-cell" colspan="${span}">${starters.map((s) => renderTestChip(s, { compact: true })).join("")}</td>`;
        si += span;
      } else {
        html += `<td class="empty slot-col"></td>`;
        si++;
      }
    }
    html += `</tr>`;
  }

  html += `</tbody></table></div>`;
  return html;
}

function resolveViewingWeek(currentWeek, weekOffset, semesterStart) {
  const baseWeek = currentWeek?.beforeSemester ? 1 : currentWeek?.weekNumber || 1;
  const weekNumber = Math.max(1, baseWeek + weekOffset);
  const wc = semesterStart ? teachingWeekCommencing(semesterStart, weekNumber) : null;
  const isViewingCurrent = Boolean(currentWeek && !currentWeek.beforeSemester && weekOffset === 0);

  return {
    weekNumber,
    weekLabel: `Week ${weekNumber}`,
    weekCommencing: wc,
    isViewingCurrent,
    weekOffset,
  };
}

function renderWeekNav(viewingWeek) {
  const wcLabel = viewingWeek.weekCommencing ? formatShortDate(viewingWeek.weekCommencing) : "";
  const atFirstWeek = viewingWeek.weekNumber <= 1;

  return `<div class="cts-week-nav" role="group" aria-label="Browse teaching weeks">
    <button type="button" class="btn btn-small" data-cts-week-delta="-1"${atFirstWeek ? " disabled" : ""} aria-label="Previous week">← Previous</button>
    <div class="cts-week-nav-center">
      <strong>${esc(viewingWeek.weekLabel)}</strong>
      ${wcLabel ? `<span class="muted small">w/c ${esc(wcLabel)}</span>` : ""}
      ${viewingWeek.isViewingCurrent ? `<span class="cts-you-are-here small">This week</span>` : ""}
    </div>
    <button type="button" class="btn btn-small" data-cts-week-delta="1" aria-label="Next week">Next →</button>
    ${!viewingWeek.isViewingCurrent ? `<button type="button" class="btn btn-small btn-muted" data-cts-week-reset>Back to this week</button>` : ""}
  </div>`;
}

function renderThisWeekView(weekItems, ctx) {
  if (!ctx.semesterStart) {
    return `<p class="muted">Set the semester start date on the <strong>Assessments</strong> tab to browse weeks.</p>`;
  }

  if (ctx.currentWeek?.beforeSemester && ctx.viewingWeek.weekOffset === 0) {
    return `${renderWeekNav(ctx.viewingWeek)}
      <p class="muted">Semester has not started yet — use <strong>Next →</strong> to preview upcoming teaching weeks.</p>
      ${weekItems.length ? renderThisWeekTimeGrid(weekItems, ctx) : ""}`;
  }

  const listHtml = weekItems.length
    ? `<ul class="cts-week-list">${weekItems
        .sort((a, b) => {
          const day = WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday);
          if (day) return day;
          return timeToMinutes(a.start) - timeToMinutes(b.start);
        })
        .map((item) => `<li>${renderTestChip(item)}</li>`)
        .join("")}</ul>`
    : "";

  const dayHint =
    ctx.viewingWeek.isViewingCurrent && ctx.todayWeekday
      ? ` · <span class="cts-today-inline">${esc(ctx.todayWeekday)} today</span>`
      : "";

  return `<div class="cts-this-week">
    ${renderWeekNav(ctx.viewingWeek)}
    <h4 class="cts-subheading">${esc(ctx.viewingWeek.weekLabel)} — class tests by day &amp; time${dayHint}</h4>
    ${renderThisWeekTimeGrid(weekItems, ctx)}
    ${weekItems.length ? `<details class="cts-week-details"><summary class="muted small">List view (${weekItems.length} test${weekItems.length === 1 ? "" : "s"})</summary>${listHtml}</details>` : `<p class="muted small">No class tests in ${esc(ctx.viewingWeek.weekLabel)} with the current filters.</p>`}
  </div>`;
}

function renderSemesterMapView(items, ctx) {
  const columns = buildSemesterWeekColumns(items, {
    semesterStart: ctx.semesterStart,
    currentWeek: ctx.currentWeek,
  });
  if (!columns.length) return "";

  return `<div class="cts-semester-wrap">
    <div class="cts-semester-map">
      ${columns
        .map((col) => {
          const wc = col.weekCommencing ? formatShortDate(col.weekCommencing) : "";
          const colClass = col.isCurrent ? "cts-semester-col is-current" : col.isPast ? "cts-semester-col is-past" : "cts-semester-col";
          return `<div class="${colClass}">
            <div class="cts-semester-head">
              ${col.isCurrent ? `<span class="cts-you-are-here small">Now</span>` : ""}
              <strong>${esc(col.weekLabel)}</strong>
              ${wc ? `<span class="muted small">${esc(wc)}</span>` : ""}
            </div>
            <div class="cts-semester-body">
              ${col.items.length ? col.items.map((i) => renderTestChip(i, { compact: true })).join("") : `<span class="muted small">—</span>`}
            </div>
          </div>`;
        })
        .join("")}
    </div>
  </div>`;
}

function renderTimelineView(items, ctx) {
  const weeks = groupClassTestsByWeek(items);
  if (!weeks.length) return "";

  return `<div class="cts-timeline-wrap">
    <div class="cts-timeline">
      ${weeks
        .map((week) => {
          const wc = week.weekCommencing ? formatShortDate(week.weekCommencing) : "";
          const isCurrent = ctx.currentWeek && week.weekNum === ctx.currentWeek.weekNumber;
          return `<div class="cts-week-col${isCurrent ? " is-current" : ""}">
            <div class="cts-week-head">
              ${isCurrent ? `<span class="cts-you-are-here small">Now</span>` : ""}
              <strong>${esc(week.label)}</strong>
              ${wc ? `<span class="muted small">${esc(wc)}</span>` : ""}
              <span class="muted small">${week.items.length} test${week.items.length === 1 ? "" : "s"}</span>
            </div>
            <div class="cts-week-body">${week.items.map((i) => renderTestChip(i)).join("")}</div>
          </div>`;
        })
        .join("")}
    </div>
  </div>`;
}

function renderGroupedPanels(groups) {
  return `<div class="cts-group-list">
    ${groups
      .map(
        (group) => `<details class="cts-group-panel" open>
          <summary><strong>${esc(group.name)}</strong> <span class="muted small">${group.items.length} test${group.items.length === 1 ? "" : "s"}</span></summary>
          <div class="cts-group-items">${group.items.map((i) => renderTestChip(i)).join("")}</div>
        </details>`
      )
      .join("")}
  </div>`;
}

function renderCalendarView(items) {
  const weeks = groupClassTestsByCalendarWeek(items);
  if (!weeks.length) return "";

  return `<div class="cts-calendar-boards">
    ${weeks
      .map((week) => {
        const columns = dayColumnsForWeek(week.items);
        const title = week.weekNum != null ? `Week ${week.weekNum}` : week.label;
        return `<section class="cts-calendar-week">
          <h4 class="cts-calendar-title">${esc(title)} <span class="muted">${esc(week.label)}</span></h4>
          <div class="cts-day-grid">
            ${columns
              .map(
                (col) => `<div class="cts-day-col">
                  <div class="cts-day-head">
                    <strong>${esc(col.day.slice(0, 3))}</strong>
                    ${col.dateLabel ? `<span class="muted small">${esc(col.dateLabel)}</span>` : ""}
                  </div>
                  <div class="cts-day-body">${col.items.map((i) => renderTestChip(i)).join("")}</div>
                </div>`
              )
              .join("")}
          </div>
        </section>`;
      })
      .join("")}
  </div>`;
}

function renderViewContent(items, view, ctx) {
  switch (view) {
    case "this-week":
      return renderThisWeekView(ctx.thisWeekItems, ctx);
    case "semester":
      return renderSemesterMapView(items, ctx);
    case "by-group":
      return renderGroupedPanels(groupClassTestsByStudentGroup(items));
    case "by-cohort":
      return renderGroupedPanels(groupClassTestsByCohort(items));
    case "by-campus":
      return renderGroupedPanels(groupClassTestsByCampus(items));
    case "calendar":
      return renderCalendarView(items);
    default:
      return renderTimelineView(items, ctx);
  }
}

function renderFilterBar(options, filters) {
  const sel = (id, label, values, current) => {
    const opts = values
      .map((v) => `<option value="${esc(v)}"${v === current ? " selected" : ""}>${esc(v)}</option>`)
      .join("");
    return `<label class="cts-filter-label">${esc(label)}
      <select id="${id}" data-cts-filter="${id}">
        <option value="">All</option>${opts}
      </select>
    </label>`;
  };

  const semOpts = options.semesters.map((s) => ({ v: s, l: `Semester ${s}` }));

  return `<div class="cts-filters">
    ${options.campuses.length ? sel("cts-filter-campus", "Campus", options.campuses, filters.campus) : ""}
    ${options.siteCodes.length ? sel("cts-filter-site", "Site", options.siteCodes, filters.siteCode) : ""}
    ${options.cohortCodes.length
      ? `<label class="cts-filter-label">Cohort intake
      <select id="cts-filter-cohort" data-cts-filter="cts-filter-cohort">
        <option value="">All</option>
        ${options.cohortCodes.map((c) => `<option value="${esc(c.code)}"${c.code === filters.cohortCode ? " selected" : ""}>${esc(c.code)} (${esc(c.label)})</option>`).join("")}
      </select>
    </label>`
      : ""}
    ${options.studyYears.length ? sel("cts-filter-year", "Year", options.studyYears, filters.studyYear) : ""}
    ${options.semesters.length ? `<label class="cts-filter-label">Semester
      <select id="cts-filter-semester" data-cts-filter="cts-filter-semester">
        <option value="">All</option>
        ${semOpts.map((o) => `<option value="${esc(o.v)}"${String(o.v) === String(filters.studySemester) ? " selected" : ""}>${esc(o.l)}</option>`).join("")}
      </select>
    </label>` : ""}
    ${Object.values(filters).some(Boolean) ? `<button type="button" class="btn btn-small btn-muted" id="cts-filter-clear">Clear</button>` : ""}
  </div>`;
}

export function renderClassTestSchedule(project, { view = "this-week", filters = {}, weekOffset = 0 } = {}) {
  const events = project.getAssessmentEvents?.() || [];
  const semesterStart = resolveSemesterStart(project, events);
  const allItems = buildClassTestItems(project, { semesterStart });
  const items = allItems.filter((item) => itemMatchesCohortFilters(item, filters));
  const currentWeek = getCurrentTeachingWeek(semesterStart);
  const viewingWeek = resolveViewingWeek(currentWeek, weekOffset, semesterStart);
  const todayWeekday =
    viewingWeek.isViewingCurrent && currentWeek?.dayInWeek ? WEEKDAYS[currentWeek.dayInWeek - 1] : "";
  const weekCommencing = viewingWeek.weekCommencing;
  const thisWeekItems = semesterStart
    ? filterItemsForTeachingWeek(items, viewingWeek.weekNumber, semesterStart)
    : [];

  const ctx = {
    semesterStart,
    currentWeek,
    viewingWeek,
    todayWeekday,
    weekCommencing,
    thisWeekItems,
  };
  const filterOptions = listCohortFilterOptions(allItems);

  if (!allItems.length) {
    return `<section class="class-test-schedule-panel cts-empty">
      <h3 class="section-heading">Class test schedule</h3>
      <p class="muted">Mark seminar slots as class tests below to see a visual schedule by week, student group, cohort, and campus.</p>
    </section>`;
  }

  const modules = new Set(items.map((i) => i.moduleCode)).size;

  return `<section class="class-test-schedule-panel">
    <div class="cts-header">
      <h3 class="section-heading">Class test schedule</h3>
      <p class="muted small">See where you are in the semester, this week’s tests by day and time, and filter by campus or cohort (e.g. <em>0126</em> = Jan 26 intake).</p>
      <div class="cts-stats muted small">${items.length} of ${allItems.length} planned · ${modules} module${modules === 1 ? "" : "s"}</div>
    </div>
    ${renderPositionBar(currentWeek, semesterStart, todayWeekday)}
    ${renderFilterBar(filterOptions, filters)}
    <div class="cts-toolbar" role="group" aria-label="Schedule view">
      <span class="cts-toolbar-label">View</span>
      ${VIEWS.map(
        (v) =>
          `<button type="button" class="btn btn-small layout-btn cts-view-btn${v.id === view ? " active" : ""}" data-cts-view="${v.id}" aria-pressed="${v.id === view}">${esc(v.label)}</button>`
      ).join("")}
    </div>
    <div class="cts-legend muted small">
      <span><i class="dot planned"></i> Planned</span>
      <span><i class="dot ready"></i> Ready</span>
      <span><i class="dot completed"></i> Completed</span>
      <span><i class="dot issue"></i> Issue / clash</span>
      <span><i class="dot cts-now"></i> Current week / today</span>
    </div>
    ${items.length ? renderViewContent(items, view, ctx) : `<p class="muted">No tests match the selected filters.</p>`}
  </section>`;
}

const FILTER_MAP = {
  "cts-filter-campus": "campus",
  "cts-filter-site": "siteCode",
  "cts-filter-cohort": "cohortCode",
  "cts-filter-year": "studyYear",
  "cts-filter-semester": "studySemester",
};

export function bindClassTestScheduleView(container, { onViewChange, onFilterChange, onWeekOffsetChange } = {}) {
  container.querySelectorAll("[data-cts-view]").forEach((btn) => {
    btn.onclick = () => {
      const view = btn.dataset.ctsView;
      if (view) onViewChange?.(view);
    };
  });

  container.querySelectorAll("[data-cts-week-delta]").forEach((btn) => {
    btn.onclick = () => {
      if (btn.disabled) return;
      const delta = Number(btn.dataset.ctsWeekDelta);
      if (Number.isFinite(delta)) onWeekOffsetChange?.(delta);
    };
  });

  container.querySelector("[data-cts-week-reset]")?.addEventListener("click", () => {
    onWeekOffsetChange?.("reset");
  });

  container.querySelectorAll("[data-cts-filter]").forEach((el) => {
    el.addEventListener("change", () => {
      const key = FILTER_MAP[el.id];
      if (key) onFilterChange?.({ [key]: el.value });
    });
  });

  container.querySelector("#cts-filter-clear")?.addEventListener("click", () => {
    onFilterChange?.({
      campus: "",
      siteCode: "",
      cohortCode: "",
      studyYear: "",
      studySemester: "",
    });
  });
}
