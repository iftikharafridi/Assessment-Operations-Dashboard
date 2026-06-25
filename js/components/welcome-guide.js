import { esc } from "../utils/dom.js";
import { APP_VERSION } from "../config/constants.js";

export const WELCOME_STEPS = [
  {
    title: "Get your Excel files ready",
    body: "Download the starter templates below if you do not have exports yet. Replace the example rows with your real data.",
  },
  {
    title: "Upload your timetable",
    body: "Drag and drop <strong>Timetable-template.xlsx</strong> (or your real export) onto the upload area, or click <strong>Upload timetable</strong>.",
  },
  {
    title: "Add the assessment schedule",
    body: "Click <strong>Add another file</strong> and upload <strong>Assessment-Schedule-template.xlsx</strong> or your programme assessment schedule. Skip this if you reopen a saved workbook.",
  },
  {
    title: "Review the Overview",
    body: "Summary cards and weekly timetable. Open <strong>Issues &amp; to-do</strong> for conflicts and action items.",
  },
  {
    title: "Assessments tab",
    body: "Timeline, deadlines, <strong>Tasks / to-do</strong>, and <strong>Apply class test weeks</strong> from the schedule.",
  },
  {
    title: "Class tests tab",
    body: "Click <strong>Mark as class test</strong>, set dates and rooms, and assign invigilators. Use <strong>Who is available?</strong> at the bottom of the tab.",
  },
  {
    title: "Save your workbook",
    body: "Click <strong>Save workbook</strong>. The file is downloaded with the date and time in the name, e.g. <em>Timetable 2026-06-19 15-30.xlsx</em>.",
  },
  {
    title: "Continue later",
    body: "Upload your <strong>saved workbook</strong> only — it restores class test plans, assessment tracking, and notes. You do not need separate files again.",
  },
];

export const TEMPLATE_FILES = [
  {
    href: "templates/Timetable-template.xlsx",
    label: "Timetable template",
    hint: "One row per session — replace example rows with your data",
  },
  {
    href: "templates/Assessment-Schedule-template.xlsx",
    label: "Assessment schedule template",
    hint: "One row per coursework item — class tests, submissions, presentations",
  },
];

export function renderWelcomeGuide() {
  return `
    <section class="welcome-guide">
      <h3>How to use this dashboard</h3>
      <ol class="welcome-steps">
        ${WELCOME_STEPS.map(
          (step, i) =>
            `<li><strong>${i + 1}. ${esc(step.title)}</strong><p>${step.body}</p></li>`
        ).join("")}
      </ol>
      <p class="muted welcome-version">Version ${esc(APP_VERSION)} · Your files stay on your computer — nothing is uploaded to the internet.</p>
    </section>
    <section class="template-downloads">
      <h3>Starter templates</h3>
      <p class="muted">No timetable or assessment file yet? Download these, edit in Excel, then upload here.</p>
      <div class="template-cards">
        ${TEMPLATE_FILES.map(
          (t) =>
            `<a class="template-card" href="${esc(t.href)}" download>
              <span class="template-label">${esc(t.label)}</span>
              <span class="template-hint">${esc(t.hint)}</span>
              <span class="template-dl">Download .xlsx</span>
            </a>`
        ).join("")}
      </div>
      <p class="muted small">Or click <strong>Try sample timetable</strong> above to explore the dashboard first.</p>
    </section>`;
}
