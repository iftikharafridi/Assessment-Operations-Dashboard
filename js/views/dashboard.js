import { esc } from "../utils/dom.js";
import { intro } from "../components/table.js";
import { renderKpiCards, renderCampusCards } from "../components/campus-cards.js";
import { renderBeginnerWorkflow } from "../components/beginner-workflow.js";
import { renderConflictList } from "../components/summary-cards.js";
import { computeCampusMetrics } from "../analytics/dashboard.js";
import { buildActionItems, summarizeActionItems } from "../analytics/assessment.js";
import { renderActionItemsPanel } from "../components/action-items.js";
import { renderValidationSection } from "./validation.js";

export function renderDashboardView({ project, container, state, onNavigate }) {
  const campuses = computeCampusMetrics(project);
  const actions = buildActionItems(project);
  const actionSummary = summarizeActionItems(actions);

  container.innerHTML =
    intro("Operational overview across all campuses. Use the cards below to jump straight to a campus timetable, class tests, or invigilation issues.") +
    renderKpiCards(project, { lastExportAt: state.lastExportAt, dirty: state.dirty }) +
    renderBeginnerWorkflow(project) +
    (actionSummary.total
      ? `<section class="panel-section">${renderActionItemsPanel(actions.slice(0, 8), { title: "Issues & to-do", emptyMessage: "" })}</section>`
      : "") +
    renderConflictList(project) +
    `<section class="panel-section">
      <h3 class="section-heading">Campus overview</h3>
      <p class="muted small">All campuses at a glance — no need to scroll through timetables to find London or Manchester.</p>
      ${renderCampusCards(campuses)}
    </section>` +
    renderValidationSection(project);

  container.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.nav;
      const campus = btn.dataset.campus || "";
      onNavigate?.(tab, campus ? { campus } : {});
    });
  });
}
