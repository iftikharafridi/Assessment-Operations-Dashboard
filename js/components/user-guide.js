import { esc } from "../utils/dom.js";
import { APP_VERSION } from "../config/constants.js";
import { showDialog } from "./dialog.js";

const GUIDE_STEPS = [
  {
    title: "Download templates (if needed)",
    body: "On the welcome page, download <strong>Timetable template</strong> and <strong>Assessment schedule template</strong>, fill in your data in Excel, then upload.",
  },
  {
    title: "Upload timetable",
    body: "Click <strong>Upload timetable</strong> or drag your Excel file onto the upload area. Reopen a saved workbook to continue where you left off.",
  },
  {
    title: "Check the Overview tab",
    body: "Summary cards, data checks, and the weekly timetable. Fix any red or amber items before planning.",
  },
  {
    title: "Assessments tab",
    body: "Timeline, upcoming deadlines, <strong>Tasks &amp; notes</strong>, and <strong>Apply class test weeks</strong> from the schedule.",
  },
  {
    title: "Class tests tab",
    body: "Mark seminars as class tests, set dates and rooms, assign invigilators (type any name or pick from suggestions). Use <strong>Who is available?</strong> at the bottom to check cover.",
  },
  {
    title: "Save workbook",
    body: "Click <strong>Save workbook</strong>. Edit only the <strong>Class Test Plans</strong> sheet in Excel — other sheets are optional copies of your data.",
  },
];

export function renderUserGuideButton() {
  return `<button type="button" class="btn btn-help" id="help-btn">How to use</button>`;
}

export function bindUserGuide() {
  document.getElementById("help-btn")?.addEventListener("click", showUserGuide);
}

export function showUserGuide() {
  showDialog({
    title: "How to use this dashboard",
    bodyHtml: `
      <p class="guide-intro">Four tabs: <strong>Overview</strong>, <strong>Class tests</strong>, <strong>Assessments</strong>, and <strong>Issues &amp; to-do</strong>.</p>
      <ol class="guide-steps">
        ${GUIDE_STEPS.map(
          (step, i) => `<li><strong>${i + 1}. ${esc(step.title)}</strong><p>${step.body}</p></li>`
        ).join("")}
      </ol>
      <p class="muted guide-footer">Version ${esc(APP_VERSION)} · Your files stay on your computer and are not uploaded to the internet.</p>`,
  });
}

export function showAboutDialog() {
  showDialog({
    title: "About",
    bodyHtml: `
      <p><strong>Assessment Operations Dashboard</strong></p>
      <p>Version ${esc(APP_VERSION)}</p>
      <p class="muted">Plan class tests, invigilation, and rooms across campuses. All processing happens in your browser.</p>`,
  });
}
