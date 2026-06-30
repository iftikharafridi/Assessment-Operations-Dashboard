import { buildWorkbookForPreset, getExportPreset } from "./export-presets.js";
import { XLSX } from "./xlsx.js";

export { buildWorkbookForPreset, getExportPreset } from "./export-presets.js";
export {
  buildPlanExportRows,
  buildWeeklyTimetableRows,
  flattenRowForExport,
} from "./workbook-builders.js";

/** @deprecated Use buildWorkbookForPreset(project, 'full') */
export function exportProjectWorkbook(project) {
  return buildWorkbookForPreset(project, "full");
}

/**
 * @param {import('../model/project.js').Project} project
 * @param {{ preset?: string, filename?: string }} [options]
 */
export function downloadProjectExcel(project, options = {}) {
  if (!XLSX?.writeFile) {
    throw new Error("Excel export is not ready yet. Refresh the page and try again.");
  }
  const presetId = options.preset || "full";
  const wb = buildWorkbookForPreset(project, presetId);
  const name = options.filename || buildExportFilename(project, presetId);
  const writeOpts = XLSX.style_version ? { cellStyles: true } : undefined;
  XLSX.writeFile(wb, `${name}.xlsx`, writeOpts);
}

/** e.g. Timetable class-test-schedule 2026-06-19 14-30 */
export function buildExportFilename(project, presetId = "full") {
  const preset = getExportPreset(presetId);
  const base =
    project.primaryFilename?.replace(/\.xlsx?$/i, "") ||
    project.name.replace(/[^\w\- ]+/g, "").trim() ||
    "assessment-workbook";
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const time = [String(now.getHours()).padStart(2, "0"), String(now.getMinutes()).padStart(2, "0")].join("-");
  const part = preset.filenamePart && preset.id !== "full" ? ` ${preset.filenamePart}` : "";
  return `${base}${part} ${date} ${time}`;
}
