import { buildWorkbookForPreset, getExportPreset } from "./export-presets.js";
import { getWriteXlsx, EXCEL_STYLE_ERROR_MSG } from "./xlsx.js";

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
  const xlsx = getWriteXlsx();
  if (!xlsx?.writeFile) {
    throw new Error(EXCEL_STYLE_ERROR_MSG);
  }
  const presetId = options.preset || "full";
  const { preset, filename, filters, activeTab, campus, ...rest } = options;
  const wb = buildWorkbookForPreset(project, presetId, { filters, activeTab, campus, ...rest });
  const name = filename || buildExportFilename(project, presetId);
  xlsx.writeFile(wb, `${name}.xlsx`, { cellStyles: true });
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
