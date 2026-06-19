import { esc } from "../utils/dom.js";
import { FILE_TYPE_LABELS, HELP_COLUMNS } from "../config/constants.js";

export function renderDropzone() {
  return `
    <section class="welcome-hero">
      <h2 class="welcome-title">Upload your timetable Excel file to begin.</h2>
      <p class="welcome-lead">Plan class tests, assign invigilators, and save your work back into Excel — all in your browser.</p>
    </section>
    <section class="dropzone dropzone-large" id="dropzone">
      <input type="file" id="file-input" accept=".xlsx,.xls" multiple hidden>
      <div class="dropzone-inner">
        <div class="dropzone-icon" aria-hidden="true">↑</div>
        <p class="dropzone-label"><strong>Drag and drop</strong> your Excel file here</p>
        <p class="dropzone-or muted">or</p>
        <button type="button" class="btn btn-primary" id="browse-btn">Upload timetable</button>
        <button type="button" class="btn" id="sample-btn">Try sample timetable</button>
        <p class="dropzone-hint">No file yet? Download the starter templates below. Reopen a saved workbook to restore class test plans and assessment tracking.</p>
      </div>
    </section>
    ${renderHelpSection()}`;
}

export function renderHelpSection() {
  return `
    <section class="help-section">
      <h3>Which file should I upload?</h3>
      <p>Upload the <strong>timetable export</strong> from your scheduling system (usually named something like <em>Timetable.xlsx</em>).</p>
      <h4>Helpful columns</h4>
      <ul class="help-columns">${HELP_COLUMNS.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
      <p class="muted help-note">Extra columns are fine — they will be kept when you save. If a column has a slightly different name (e.g. “Tutor” instead of “Staff”), the app will try to match it automatically.</p>
      <h4>After planning</h4>
      <p>Use <strong>Save workbook</strong> to download an Excel file with your class test plans and summary reports. Open that same file here later to continue where you left off.</p>
    </section>`;
}

export function renderImportWarnings(warnings) {
  if (!warnings?.length) return "";
  return `<div class="alert alert-warning" role="alert">
    <strong>Please check your file</strong>
    <ul>${warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
  </div>`;
}

export function renderProjectFiles(project) {
  if (!project?.loadedFileSummary?.length) return "";
  const items = project.loadedFileSummary
    .flatMap(({ type, files }) =>
      files.map((f) => `<li><span class="file-type">${esc(FILE_TYPE_LABELS[type] || type)}</span> ${esc(f)}</li>`)
    )
    .join("");
  return `<div class="project-files"><h3>Loaded files</h3><ul>${items}</ul></div>`;
}

export function bindDropzone({ onFiles, onSample, zoneId = "dropzone", inputId = "file-input", browseId = "browse-btn", sampleId = "sample-btn" }) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const browse = document.getElementById(browseId);
  const sample = document.getElementById(sampleId);
  if (!zone || !input) return;

  const handleFiles = (fileList) => {
    const files = [...fileList].filter((f) => /\.xlsx?$/i.test(f.name));
    if (files.length) onFiles(files);
  };

  browse?.addEventListener("click", () => input.click());
  sample?.addEventListener("click", () => onSample?.());
  input.addEventListener("change", () => handleFiles(input.files));

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dragover");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });
}
