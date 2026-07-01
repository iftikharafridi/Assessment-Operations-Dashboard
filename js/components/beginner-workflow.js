import { esc } from "../utils/dom.js";
import { normalizePlan, planKey } from "../planner/plans.js";

const STEPS = [
  { id: "timetable", label: "Upload timetable", hint: "Import your campus timetable Excel file" },
  { id: "assessment", label: "Upload assessment schedule", hint: "Import the programme assessment schedule" },
  { id: "candidates", label: "Review class-test candidates", hint: "Check detected class tests on Assessments tab" },
  { id: "assign", label: "Assign invigilators and rooms", hint: "Use Class Tests and Invigilation tabs" },
  { id: "readiness", label: "Check readiness", hint: "Blackboard test, room, invigilator, technical setup" },
  { id: "export", label: "Export plan", hint: "Download from Reports & Export" },
];

function stepStatus(project, stepId) {
  if (!project) return "pending";
  const hasTimetable = project.getTimetableRows?.().length > 0;
  const hasAssessment = project.getAssessmentEvents?.().length > 0;
  const hasPlanned = project.getTimetableRows?.().some((r) => normalizePlan(project.getPlan(planKey(r))).planned);

  switch (stepId) {
    case "timetable":
      return hasTimetable ? "done" : "pending";
    case "assessment":
      return hasAssessment ? "done" : "pending";
    case "candidates":
      return hasAssessment ? "done" : hasTimetable ? "active" : "pending";
    case "assign":
      return hasPlanned ? "active" : hasTimetable ? "pending" : "pending";
    default:
      return hasPlanned ? "pending" : "pending";
  }
}

export function renderBeginnerWorkflow(project) {
  return `<section class="workflow-panel">
    <h3 class="section-heading">Getting started</h3>
    <ol class="workflow-steps">${STEPS.map((step, i) => {
      const status = stepStatus(project, step.id);
      return `<li class="workflow-step is-${status}">
        <span class="workflow-num">${i + 1}</span>
        <div class="workflow-body">
          <strong>${esc(step.label)}</strong>
          <span class="muted small">${esc(step.hint)}</span>
        </div>
        <span class="workflow-status">${status === "done" ? "✓ Done" : status === "active" ? "→ Next" : ""}</span>
      </li>`;
    }).join("")}</ol>
  </section>`;
}
