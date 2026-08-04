import { esc, unique } from "../utils/dom.js";
import { intro } from "../components/table.js";
import { listExportPresets, EXPORT_BUNDLES } from "../excel/export-presets.js";
import { campusDisplayName } from "../config/constants.js";

function renderBundleCard(bundle) {
  return `<article class="export-bundle-card">
    <h4>${esc(bundle.label)}</h4>
    <p class="muted small">${esc(bundle.hint)}</p>
    <ul class="export-sheet-list">${bundle.sheets.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
    <button type="button" class="btn btn-primary btn-small" data-export-bundle="${esc(bundle.id)}">Download</button>
  </article>`;
}

export function renderReportsView({ project, container, state, onExport, onSave, onAcademicOsExport }) {
  const presets = listExportPresets(project);
  const campuses = unique(project.getTimetableRows().map((r) => r.Campus)).sort();
  const dirty = state.dirty;

  container.innerHTML =
    intro("Download operational Excel packs for colleagues. All exports stay on your computer — nothing is uploaded.") +
    (dirty
      ? `<div class="alert alert-warning"><strong>Unsaved changes</strong> — export or Save workbook to include your latest edits.</div>`
      : "") +
    `<section class="panel-section">
      <h3 class="section-heading">Recommended export packs</h3>
      <div class="export-bundle-grid">${EXPORT_BUNDLES.map(renderBundleCard).join("")}</div>
    </section>` +
    `<section class="panel-section">
      <h3 class="section-heading">Academic Operations OS — Semester Portal</h3>
      <p class="muted small">Create a compact Obsidian portal from everything this dashboard already holds: timetable, modules, teaching team, assessments, class tests, invigilation, and issues. Student-level lookup stays in the Student Data app.</p>
      <ul class="export-sheet-list">
        <li><code>10 - Teaching Centre.md</code> · <code>20 - Assessment Centre.md</code></li>
        <li><code>_Data/</code> source tables · <code>_Assets/academic-operations-os.css</code></li>
      </ul>
      <p class="muted small">Creates missing folders/files, backs up existing files under <code>_Backups/</code> only when overwriting, and replaces only content between <code>&lt;!-- AOS:GENERATED --&gt;</code> markers.</p>
      <div class="export-campus-row" style="flex-wrap:wrap;gap:0.5rem">
        <button type="button" class="btn btn-primary" id="export-aos-portal-complete">Create/Update Complete Semester Portal</button>
        <button type="button" class="btn" id="export-aos-portal-data">Update Data Tables Only</button>
      </div>
      <p class="muted small">Pick this semester folder. After export, open the Teaching and Assessment portal pages. Use <strong>Reading view</strong> with the Dataview plugin enabled.</p>
      <p class="muted small"><strong>Class Tests in Obsidian:</strong> the Class Test Schedule only includes seminars you have marked as planned class tests. If that view is empty, mark tests on the Class Tests tab first, then re-export.</p>
      <div id="academic-os-export-result" class="export-result-host"></div>
      <details class="panel-section" style="margin-top:0.75rem">
        <summary class="muted small">Legacy two-file assessment export (v2.2)</summary>
        <p class="muted small">Updates only <code>03 - Assessment/20 - Assessment Schedule.md</code> and <code>22 - Class Test Schedule.md</code>. Kept for one release while you migrate.</p>
        <button type="button" class="btn btn-small" id="export-academic-os-legacy">Run legacy export</button>
      </details>
    </section>` +
    `<section class="panel-section">
      <h3 class="section-heading">Obsidian (download ZIP)</h3>
      <p class="muted small">Download a ZIP containing <strong>Assessment Schedule Simplified.csv</strong> and an Obsidian note with a DataviewJS dashboard. Place both files in the same vault folder.</p>
      <button type="button" class="btn btn-primary" data-export-bundle="obsidianAssessment">Export Obsidian Assessment Schedule</button>
    </section>` +
    `<section class="panel-section">
      <h3 class="section-heading">Export campus pack</h3>
      <p class="muted small">Timetable, class tests, invigilation, and summary for one campus only.</p>
      <div class="export-campus-row">
        <select id="export-campus-select">${campuses.map((c) => `<option value="${esc(c)}">${esc(campusDisplayName(c))}</option>`).join("")}</select>
        <button type="button" class="btn btn-primary" id="export-campus-pack">Export campus pack</button>
      </div>
    </section>` +
    `<section class="panel-section">
      <h3 class="section-heading">Individual sheets</h3>
      <div class="export-preset-list">${presets
        .filter((p) => !p.isSave && !p.isBundle && !p.sheets && !p.isObsidian)
        .map(
          (p) => `<div class="export-preset-row">
            <div><strong>${esc(p.label)}</strong><br><span class="muted small">${esc(p.hint)}</span></div>
            <button type="button" class="btn btn-small" data-export-preset="${esc(p.id)}">Export</button>
          </div>`
        )
        .join("")}</div>
    </section>` +
    `<section class="panel-section">
      <h3 class="section-heading">Save &amp; reopen</h3>
      <p class="muted small">Save the full workbook to continue editing later in this dashboard.</p>
      <button type="button" class="btn btn-primary" id="reports-save-workbook">Save full operations workbook</button>
    </section>`;

  container.querySelectorAll("[data-export-bundle]").forEach((btn) => {
    btn.onclick = () => onExport?.(btn.dataset.exportBundle);
  });
  container.querySelectorAll("[data-export-preset]").forEach((btn) => {
    btn.onclick = () => onExport?.(btn.dataset.exportPreset);
  });
  container.querySelector("#export-campus-pack")?.addEventListener("click", () => {
    const campus = container.querySelector("#export-campus-select")?.value;
    if (campus) onExport?.("bundleCampusPack", { campus });
  });
  container.querySelector("#reports-save-workbook")?.addEventListener("click", () => onSave?.());
  const resultHost = () => container.querySelector("#academic-os-export-result");
  container.querySelector("#export-aos-portal-complete")?.addEventListener("click", () => {
    onAcademicOsExport?.(resultHost(), { mode: "complete" });
  });
  container.querySelector("#export-aos-portal-data")?.addEventListener("click", () => {
    onAcademicOsExport?.(resultHost(), { mode: "dataOnly" });
  });
  container.querySelector("#export-academic-os-legacy")?.addEventListener("click", () => {
    onAcademicOsExport?.(resultHost(), { mode: "legacy" });
  });
}
