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

export function renderReportsView({ project, container, state, onExport, onSave }) {
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
        .filter((p) => !p.isSave && !p.isBundle && !p.sheets)
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
}
