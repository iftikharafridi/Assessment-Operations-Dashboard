import { renderSummaryCards, renderConflictList } from "../components/summary-cards.js";
import { renderActionItemsPanel } from "../components/action-items.js";
import { buildActionItems } from "../analytics/assessment.js";
import { intro } from "../components/table.js";import { renderWeeklyCalendar, bindSessionClicks } from "../components/calendar.js";
import { showSessionDialog } from "../components/dialog.js";
import { parseGroups } from "../utils/groups.js";

export function renderOverviewView({ project, rows, container }) {
  const actionItems = buildActionItems(project);

  container.innerHTML =
    intro("At-a-glance view of your class test planning. Use the tabs above to plan tests, assign invigilators, and save your workbook.") +
    renderSummaryCards(project) +
    renderActionItemsPanel(actionItems, { title: "Issues & to-do" }) +
    renderConflictList(project) +    `<h3 class="section-heading">Weekly timetable by campus</h3>` +
    renderWeeklyCalendar(rows, project);

  bindSessionClicks(container, rows, (row) => {
    showSessionDialog(row, parseGroups(row.Activity, row["Student Groups"]));
  });
}
