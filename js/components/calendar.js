import { WEEKDAYS, TIME_SLOTS, campusColor, campusDisplayName } from "../config/constants.js";
import { parseGroups, typeBadge } from "../utils/groups.js";
import { esc, unique } from "../utils/dom.js";
import { slotIndex } from "../utils/time.js";
import { getSessionStyle, planKey } from "../planner/plans.js";
import { sessionHasConflict } from "../analytics/dashboard.js";

export function renderWeeklyCalendar(rows, project, onSessionClick) {
  const campuses = unique(rows.map((r) => r.Campus)).sort();
  let html = `<div class="calendar-legend">
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
      <div class="grid-wrap"><table class="timetable-grid">
        <thead><tr><th class="time-col">Time</th>${WEEKDAYS.map((d) => `<th>${d.slice(0, 3)}</th>`).join("")}</tr></thead>
        <tbody>`;

    for (let si = 0; si < TIME_SLOTS.length; si++) {
      const time = TIME_SLOTS[si];
      html += `<tr><td class="time-col">${time}</td>`;
      for (const day of WEEKDAYS) {
        const cellSessions = campusRows.filter(
          (r) => r.Weekday === day && slotIndex(r["Start time"]) === si
        );
        if (cellSessions.length) {
          html += `<td class="has-session">`;
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
          html += `</td>`;
        } else {
          html += `<td class="empty"></td>`;
        }
      }
      html += `</tr>`;
    }
    html += `</tbody></table></div></section>`;
  }

  return html;
}

export function bindSessionClicks(container, rows, onClick) {
  container.querySelectorAll(".session").forEach((el) => {
    el.onclick = () => {
      const row = rows.find((r) => planKey(r) === el.dataset.id);
      if (row) onClick(row);
    };
  });
}
