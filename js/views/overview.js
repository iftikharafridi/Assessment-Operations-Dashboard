import { renderSummaryCards } from "../components/summary-cards.js";
import { intro } from "../components/table.js";
import { renderWeeklyCalendar, bindSessionClicks } from "../components/calendar.js";
import { showSessionDialog } from "../components/dialog.js";
import { parseGroups } from "../utils/groups.js";
import { renderValidationSection } from "./validation.js";
import { renderModuleSummarySection } from "./summary.js";

export function renderOverviewView({ project, rows, container }) {
  container.innerHTML =
    intro("At-a-glance summary and weekly timetable. Open <strong>Issues &amp; to-do</strong> for conflicts and action items.") +
    renderSummaryCards(project) +
    `<h3 class="section-heading">Weekly timetable</h3>` +
    renderWeeklyCalendar(rows, project) +
    renderValidationSection(project) +
    renderModuleSummarySection(rows);

  bindSessionClicks(container, rows, (row) => {
    showSessionDialog(row, parseGroups(row.Activity, row["Student Groups"]));
  });
}
