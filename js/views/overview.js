import { renderSummaryCards } from "../components/summary-cards.js";
import { intro } from "../components/table.js";
import { renderWeeklyCalendar, bindSessionClicks, bindCalendarLayoutToggle } from "../components/calendar.js";
import { showSessionDialog } from "../components/dialog.js";
import { parseGroups } from "../utils/groups.js";
import { renderValidationSection } from "./validation.js";
import { renderModuleSummarySection } from "./summary.js";

export function renderOverviewView({ project, rows, container, state, onCalendarLayoutChange }) {
  const layout = state?.calendarLayout || "day-side";

  container.innerHTML =
    intro("At-a-glance summary and weekly timetable. Open <strong>Issues &amp; to-do</strong> for conflicts and action items.") +
    renderSummaryCards(project) +
    `<h3 class="section-heading">Weekly timetable</h3>` +
    renderWeeklyCalendar(rows, project, { layout }) +
    renderValidationSection(project) +
    renderModuleSummarySection(rows);

  bindCalendarLayoutToggle(container, onCalendarLayoutChange);
  bindSessionClicks(container, rows, (row) => {
    showSessionDialog(row, parseGroups(row.Activity, row["Student Groups"]));
  });
}
