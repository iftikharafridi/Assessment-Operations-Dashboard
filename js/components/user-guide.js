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
    body: "Click <strong>Upload timetable</strong> or drag your Excel file onto the upload area.",
  },
  {
    title: "Add assessment schedule",
    body: "Use <strong>Add another file</strong> for the assessment schedule (unless you reopened a saved workbook).",
  },
  {
    title: "Check data",
    body: "Open the <strong>Check data</strong> tab to confirm sessions, campuses, and tutors imported correctly.",
  },
  {
    title: "Assessment hub",
    body: "Use the timeline, add <strong>Tasks &amp; notes</strong>, and apply class test weeks from the schedule.",
  },
  {
    title: "Mark seminar as class test",
    body: "Go to <strong>Seminar slots</strong> or <strong>Class test plan</strong> and click <strong>Mark as class test</strong>.",
  },
  {
    title: "Assign invigilator",
    body: "In <strong>Class test plan</strong>, choose an invigilator. Use <strong>Invigilation</strong> to see availability.",
  },
  {
    title: "Save workbook",
    body: "Click <strong>Save workbook</strong>. The filename includes the date and time. Reopen that file later to continue.",
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
      <p class="guide-intro">Follow these steps to plan class tests across your campuses.</p>
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
