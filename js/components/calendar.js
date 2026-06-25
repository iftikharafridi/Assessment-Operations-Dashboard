import { WEEKDAYS, TIME_SLOTS, campusColor, campusDisplayName } from "../config/constants.js";
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
    html += `<div class="session ${styleClass}${planStyle && baseType === "sem" ? " is-seminar" : ""}" data-id="${sid}" title="${esc(s.Activity)}">
      <div class="session-code">${esc(s["Module code"])} <span class="session-type">${esc(s.Type.slice(0, 3))}</span></div>
      <div class="session-meta">${esc(s["Start time"])}–${esc(s["End time"])}</div>
      <div class="session-staff">${esc(s.Staff)}</div>
      ${groups.letterGroups.length ? `<div class="session-grp">Grp ${esc(groups.letterGroups.join(" & "))}</div>` : ""}
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
  return Math.max(
    ...sessions.map((s) => sessionSlotSpan(s["Start time"], s["End time"]).span)
  );
}

function createDayOccupancy() {
  return Object.fromEntries(WEEKDAYS.map((d) => [d, new Array(TIME_SLOTS.length).fill(false)]));
}

function markOccupied(occupied, day, startIdx, span) {
  for (let k = 1; k < span; k++) {
    if (startIdx + k < TIME_SLOTS.length) occupied[day][startIdx + k] = true;
  }
}

function renderCampusGrid(campusRows, project, layout) {
  const layoutClass = layout === "day-side" ? "layout-day-side" : "layout-time-side";

  if (layout === "day-side") {
    const occupied = createDayOccupancy();
    let html = `<table class="timetable-grid ${layoutClass}">
      <thead><tr><th class="day-col">Day</th>${TIME_SLOTS.map((t) => `<th class="time-header">${t}</th>`).join("")}</tr></thead><tbody>`;

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
          html += `<td class="empty"></td>`;
          si++;
        }
      }
      html += `</tr>`;
    }
    html += `</tbody></table>`;
    return html;
  }

  const occupied = createDayOccupancy();
  let html = `<table class="timetable-grid ${layoutClass}">
    <thead><tr><th class="time-col">Time</th>${WEEKDAYS.map((d) => `<th>${d.slice(0, 3)}</th>`).join("")}</tr></thead><tbody>`;

  for (let si = 0; si < TIME_SLOTS.length; si++) {
    html += `<tr><td class="time-col">${TIME_SLOTS[si]}</td>`;
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

export function renderCalendarLayoutToolbar(layout = "time-side") {
  const timeActive = layout !== "day-side";
  const dayActive = layout === "day-side";
  return `<div class="calendar-toolbar">
    <span class="calendar-toolbar-label">Timetable view</span>
    <div class="calendar-layout-toggle" role="group" aria-label="Timetable layout">
      <button type="button" class="btn btn-small layout-btn${timeActive ? " active" : ""}" data-calendar-layout="time-side" aria-pressed="${timeActive}">Time on left</button>
      <button type="button" class="btn btn-small layout-btn${dayActive ? " active" : ""}" data-calendar-layout="day-side" aria-pressed="${dayActive}">Days on left</button>
    </div>
  </div>`;
}

export function renderWeeklyCalendar(rows, project, { layout = "time-side" } = {}) {
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
