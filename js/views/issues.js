import { renderActionItemsPanel } from "../components/action-items.js";
import { renderConflictList } from "../components/summary-cards.js";
import { buildActionItems } from "../analytics/assessment.js";
import { intro } from "../components/table.js";
import { detectConflicts } from "../analytics/dashboard.js";
import { runDataValidation } from "../analytics/validation.js";
import { renderValidationSection } from "./validation.js";

export function countOpenIssues(project) {
  const actions = buildActionItems(project).length;
  const conflicts = detectConflicts(project).length;
  const validation = runDataValidation(project);
  const dataIssues = validation.checks.filter((c) => c.status === "error" || c.status === "warn").length;
  return actions + conflicts + dataIssues;
}

export function renderIssuesView({ project, container }) {
  const actionItems = buildActionItems(project);
  const conflicts = detectConflicts(project);

  const conflictHtml = conflicts.length
    ? renderConflictList(project)
    : `<div class="alert alert-info" role="status"><p>No invigilator or room conflicts detected.</p></div>`;

  container.innerHTML =
    intro("Issues, to-do items, and conflicts in one place. Timelines and tables stay on <strong>Overview</strong>, <strong>Class tests</strong>, and <strong>Assessments</strong>.") +
    renderActionItemsPanel(actionItems, {
      title: "To-do & updates",
      emptyMessage: "Nothing flagged yet. Set Status to Issue on the Assessments tab, or assign invigilators on Class tests.",
    }) +
    `<h3 class="section-heading">Planning conflicts</h3>` +
    conflictHtml +
    renderValidationSection(project);
}
