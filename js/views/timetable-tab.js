import { esc } from "../utils/dom.js";
import { campusColor, campusDisplayName } from "../config/constants.js";
import { renderWeeklyCalendar, bindSessionClicks, bindCalendarLayoutToggle } from "../components/calendar.js";
import { showSessionDialog } from "../components/dialog.js";
import { parseGroups } from "../utils/groups.js";
import { intro } from "../components/table.js";
import { unique } from "../utils/dom.js";

export function renderTimetableView({ project, rows, container, state, onCalendarLayoutChange, onSelectCampus }) {
  const campuses = unique(project.getTimetableRows().map((r) => r.Campus)).sort();
  const selected = state.timetableCampus || "";

  if (!selected) {
    container.innerHTML =
      intro("Choose a campus to open the detailed weekly timetable. All campuses are shown here first so nothing is hidden below the fold.") +
      `<div class="campus-picker-grid">${campuses
        .map((campus) => {
          const count = project.getTimetableRows().filter((r) => r.Campus === campus).length;
          return `<button type="button" class="campus-picker-card" data-campus="${esc(campus)}" style="border-left: 4px solid ${campusColor(campus)}">
            <strong>${esc(campusDisplayName(campus))}</strong>
            <span class="muted small">${count} session${count === 1 ? "" : "s"}</span>
          </button>`;
        })
        .join("")}</div>`;

    container.querySelectorAll("[data-campus]").forEach((btn) => {
      btn.onclick = () => onSelectCampus?.(btn.dataset.campus);
    });
    return;
  }

  const campusRows = rows.filter((r) => r.Campus === selected);
  const layout = state?.calendarLayout || "day-side";

  container.innerHTML =
    `<div class="view-toolbar">
      <button type="button" class="btn btn-small btn-muted" id="timetable-back">← All campuses</button>
      <h2 class="view-title" style="border-left: 4px solid ${campusColor(selected)}">${esc(campusDisplayName(selected))}</h2>
    </div>` +
    intro("Weekly teaching grid for this campus. Use filters in the sidebar for weekday, module, tutor, or session type.") +
    `<div class="table-scroll table-scroll-sticky">` +
    renderWeeklyCalendar(campusRows, project, { layout }) +
    `</div>`;

  document.getElementById("timetable-back")?.addEventListener("click", () => onSelectCampus?.(""));

  bindCalendarLayoutToggle(container, onCalendarLayoutChange);
  bindSessionClicks(container, campusRows, (row) => {
    showSessionDialog(row, parseGroups(row.Activity, row["Student Groups"]));
  });
}
