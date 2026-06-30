import { esc } from "../utils/dom.js";
import { listExportPresets } from "../excel/export-presets.js";

export function renderExportMenu(project) {
  const presets = listExportPresets(project).filter((p) => !p.isSave);
  const options = presets
    .map((p) => `<option value="${esc(p.id)}">${esc(p.label)}</option>`)
    .join("");

  return `<div class="export-actions">
    <label class="export-preset-label">
      <span class="sr-only">Export type</span>
      <select id="export-preset" class="export-preset-select" title="Choose what to export">${options}</select>
    </label>
    <button type="button" class="btn" id="export-excel-btn" title="Download selected report">Export</button>
    <button type="button" class="btn btn-primary" id="save-excel-btn" title="Save full workbook to reopen later">Save workbook</button>
  </div>`;
}

export function bindExportMenu({ project, onExport, onSave }) {
  const select = document.getElementById("export-preset");
  const exportBtn = document.getElementById("export-excel-btn");
  const saveBtn = document.getElementById("save-excel-btn");

  exportBtn?.addEventListener("click", () => {
    const presetId = select?.value || "classTestSchedule";
    onExport?.(presetId);
  });

  saveBtn?.addEventListener("click", () => onSave?.());

  select?.addEventListener("change", () => {
    const preset = listExportPresets(project).find((p) => p.id === select.value);
    if (preset?.hint && exportBtn) exportBtn.title = preset.hint;
  });
  select?.dispatchEvent(new Event("change"));
}
