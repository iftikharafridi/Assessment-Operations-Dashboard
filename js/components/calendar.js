import { WEEKDAYS, TIME_SLOTS, CALENDAR_HOURS, campusColor, campusDisplayName } from "../config/constants.js";
import { parseGroups, typeBadge } from "../utils/groups.js";
import { esc, unique } from "../utils/dom.js";
import { sessionSlotSpan, slotIndex } from "../utils/time.js";
import { getSessionStyle, planKey } from "../planner/plans.js";
import { sessionHasConflict } from "../analytics/dashboard.js";

/** @typedef {'time-side'|'day-side'} CalendarLayout */

function renderSessionBlocks(cellSessions, project) {
  let html = "";
  for (const s of cellSessions) {
    const groups = parseGroups(s.Activity, s["Student Groups"]);
    const sid = planKey(s);
    const conflict = project && sessionHasConflict(project, sid);
    const planStyle = project ? getSessionStyle(project, sid, conflict) : null;
    const baseType = typeBadge(s.Type);
    const styleClass = planStyle || baseType;
    const span = sessionSlotSpan(s["Start time"], s["End time"]).span;
    html += `<div class="session ${styleClass}${planStyle && baseType === "sem" ? " is-seminar" : ""}" data-id="${sid}" data-span="${span}" title="${esc(s.Activity)}">
      <div class="session-code">${esc(s["Module code"])} <span class="session-type">${esc(s.Type.slice(0, 3))}</span></div>
      <div class="session-meta">${esc(s["Start time"])}–${esc(s["End time"])}</div>
      <div class="session-staff">${esc(s.Staff)}</div>
      ${groups.letterGroups.length ? `<div class="session-grp">Grp ${esc(groups.letterGroups.join(" & "))}</div>` : ""}
      ${s.Room ? `<div class="session-room">Room: ${esc(s.Room)}</div>` : ""}
      <div class="session-size">${esc(s.Size)} students</div>
    </div>`;
  }
  return html;
}

function sessionsStartingAt(campusRows, day, slotIdx) {
  return campusRows.filter((r) => r.Weekday === day && slotIndex(r["Start time"]) === slotIdx);
}

function maxSessionSpan(sessions) {
  if (!sessions.length) return 1;
  return Math.max(...sessions.map((s) => sessionSlotSpan(s["Start time"], s["End time"]).span));
}

function createDayOccupancy() {
  return Object.fromEntries(WEEKDAYS.map((d) => [d, new Array(TIME_SLOTS.length).fill(false)]));
}

function markOccupied(occupied, day, startIdx, span) {
  for (let k = 1; k < span; k++) {
    if (startIdx + k < TIME_SLOTS.length) occupied[day][startIdx + k] = true;
  }
}

function renderDaySideHeader() {
  let html = `<thead>
    <tr>
      <th rowspan="2" class="day-col">Day</th>
      ${CALENDAR_HOURS.map((h) => `<th colspan="4" class="hour-header">${h}</th>`).join("")}
    </tr>
    <tr>
      ${CALENDAR_HOURS.map(() => `<th class="slot-col">00</th><th class="slot-col">15</th><th class="slot-col">30</th><th class="slot-col">45</th>`).join("")}
    </tr>
  </thead>`;
  return html;
}

function renderDaySideGrid(campusRows, project) {
  const occupied = createDayOccupancy();
  let html = `<table class="timetable-grid layout-day-side">${renderDaySideHeader()}<tbody>`;

  for (const day of WEEKDAYS) {
    html += `<tr><td class="day-col">${esc(day.slice(0, 3))}</td>`;
    let si = 0;
    while (si < TIME_SLOTS.length) {
      if (occupied[day][si]) {
        si++;
        continue;
      }
      const starters = sessionsStartingAt(campusRows, day, si);
      if (starters.length) {
        const span = maxSessionSpan(starters);
        markOccupied(occupied, day, si, span);
        html += `<td class="has-session session-span-cell" colspan="${span}">${renderSessionBlocks(starters, project)}</td>`;
        si += span;
      } else {
        html += `<td class="empty slot-col"></td>`;
        si++;
      }
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  return html;
}

function renderTimeSideGrid(campusRows, project) {
  const occupied = createDayOccupancy();
  let html = `<table class="timetable-grid layout-time-side">
    <thead><tr><th class="time-col">Time</th>${WEEKDAYS.map((d) => `<th>${d.slice(0, 3)}</th>`).join("")}</tr></thead><tbody>`;

  for (let si = 0; si < TIME_SLOTS.length; si++) {
    const showLabel = TIME_SLOTS[si].endsWith(":00") || TIME_SLOTS[si].endsWith(":30");
    html += `<tr><td class="time-col">${showLabel ? TIME_SLOTS[si] : ""}</td>`;
    for (const day of WEEKDAYS) {
      if (occupied[day][si]) continue;
      const starters = sessionsStartingAt(campusRows, day, si);
      if (starters.length) {
        const span = maxSessionSpan(starters);
        markOccupied(occupied, day, si, span);
        html += `<td class="has-session session-span-cell" rowspan="${span}">${renderSessionBlocks(starters, project)}</td>`;
      } else {
        html += `<td class="empty"></td>`;
      }
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  return html;
}

function renderCampusGrid(campusRows, project, layout) {
  return layout === "day-side"
    ? renderDaySideGrid(campusRows, project)
    : renderTimeSideGrid(campusRows, project);
}

export function renderCalendarLayoutToolbar(layout = "day-side") {
  const dayActive = layout === "day-side";
  const timeActive = !dayActive;
  return `<div class="calendar-toolbar">
    <span class="calendar-toolbar-label">Timetable view</span>
    <div class="calendar-layout-toggle" role="group" aria-label="Timetable layout">
      <button type="button" class="btn btn-small layout-btn${dayActive ? " active" : ""}" data-calendar-layout="day-side" aria-pressed="${dayActive}">Days on left (grid)</button>
      <button type="button" class="btn btn-small layout-btn${timeActive ? " active" : ""}" data-calendar-layout="time-side" aria-pressed="${timeActive}">Time on left</button>
    </div>
  </div>`;
}

export function renderWeeklyCalendar(rows, project, { layout = "day-side" } = {}) {
  const campuses = unique(rows.map((r) => r.Campus)).sort();
  let html = renderCalendarLayoutToolbar(layout);
  html += `<div class="calendar-legend">
    <span><i class="dot lec"></i> Lecture</span>
    <span><i class="dot sem"></i> Seminar</span>
    <span><i class="dot planned"></i> Class test planned</span>
    <span><i class="dot ready"></i> Ready</span>
    <span><i class="dot completed"></i> Completed</span>
    <span><i class="dot issue"></i> Issue / conflict</span>
  </div>`;

  for (const campus of campuses) {
    const campusRows = rows.filter((r) => r.Campus === campus);
    if (!campusRows.length) continue;

    html += `<section class="campus-section">
      <h2 style="border-left: 4px solid ${campusColor(campus)}">${esc(campusDisplayName(campus))}</h2>
      <div class="grid-wrap">${renderCampusGrid(campusRows, project, layout)}</div></section>`;
  }

  return html;
}

export function bindCalendarLayoutToggle(container, onLayoutChange) {
  container.querySelectorAll("[data-calendar-layout]").forEach((btn) => {
    btn.onclick = () => {
      const layout = btn.dataset.calendarLayout;
      if (layout) onLayoutChange?.(layout);
    };
  });
}

export function bindSessionClicks(container, rows, onClick) {
  container.querySelectorAll(".session").forEach((el) => {
    el.onclick = () => {
      const row = rows.find((r) => planKey(r) === el.dataset.id);
      if (row) onClick(row);
    };
  });
}
