import { getSessionStats } from "../analytics/summary.js";
import { renderWeeklyCalendar, bindSessionClicks } from "../components/calendar.js";
import { showSessionDialog } from "../components/dialog.js";
import { parseGroups } from "../utils/groups.js";
import { statsBar } from "../components/table.js";

export function renderTimetableView({ project, rows, container }) {
  const stats = getSessionStats(rows);
  container.innerHTML =
    statsBar([
      `${stats.sessions} sessions`,
      `${stats.seminars} seminars`,
      `${stats.modules} modules`,
    ]) + renderWeeklyCalendar(rows, project);

  bindSessionClicks(container, rows, (row) => {
    showSessionDialog(row, parseGroups(row.Activity, row["Student Groups"]));
  });
}
