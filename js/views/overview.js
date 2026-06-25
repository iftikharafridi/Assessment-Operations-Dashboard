import { renderSummaryCards, renderConflictList } from "../components/summary-cards.js";
import { renderActionItemsPanel } from "../components/action-items.js";
import { buildActionItems } from "../analytics/assessment.js";
import { intro } from "../components/table.js";
import { renderWeeklyCalendar, bindSessionClicks } from "../components/calendar.js";
import { showSessionDialog } from "../components/dialog.js";
import { parseGroups } from "../utils/groups.js";
import { renderValidationSection } from "./validation.js";
import { renderModuleSummarySection } from "./summary.js";

export function renderOverviewView({ project, rows, container }) {
  const actionItems = buildActionItems(project);

  container.innerHTML =
    intro("Summary of your timetable, class test planning, and assessment deadlines. Plan details on the <strong>Class tests</strong> tab; coursework on <strong>Assessments</strong>.") +
    renderSummaryCards(project) +
    renderActionItemsPanel(actionItems, { title: "Issues & to-do" }) +
    renderConflictList(project) +
    renderValidationSection(project) +
    renderModuleSummarySection(rows) +
    `<h3 class="section-heading">Weekly timetable</h3>` +
    renderWeeklyCalendar(rows, project);

  bindSessionClicks(container, rows, (row) => {
    showSessionDialog(row, parseGroups(row.Activity, row["Student Groups"]));
  });
}
