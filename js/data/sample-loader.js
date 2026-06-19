import { assignSessionIds } from "../utils/session-id.js";
import { createEmptyProject } from "../model/project.js";
import { finalizeProject } from "../model/finalize.js";
import { BUILTIN_SAMPLE_ROWS, SAMPLE_FILE_PATHS } from "../data/sample-timetable.js";
import { readWorkbook, ingestWorkbooks } from "../excel/reader.js";
import { isExcelReaderReady } from "../excel/xlsx.js";

/**
 * Load sample timetable for colleague demos.
 * Tries bundled sample/Timetable.xlsx first, then built-in rows (works without Excel reader).
 */
export async function loadSampleTimetable() {
  if (isExcelReaderReady()) {
    for (const path of SAMPLE_FILE_PATHS) {
      try {
        const res = await fetch(path);
        if (!res.ok) continue;
        const buffer = await res.arrayBuffer();
        const filename = path.split("/").pop();
        const parsed = ingestWorkbooks([readWorkbook(buffer, filename)]);
        parsed.name = "Sample timetable";
        parsed.importWarnings = [
          ...(parsed.importWarnings || []),
          "You are viewing the sample timetable. Upload your own file when ready.",
        ];
        return parsed;
      } catch {
        /* try next path */
      }
    }
  }

  return createProjectFromBuiltinSample();
}

function createProjectFromBuiltinSample() {
  const rows = assignSessionIds(BUILTIN_SAMPLE_ROWS.map((r) => ({ ...r, _extra: {} })));
  const project = createEmptyProject("Sample timetable");
  project.addDataset("timetable", {
    filename: "Sample timetable (built-in).xlsx",
    fileType: "timetable",
    sheetName: "Timetable",
    rows,
    headers: Object.keys(rows[0] || {}),
    uploadedAt: new Date().toISOString(),
  });
  project.importWarnings = [
    "You are viewing a small built-in sample timetable for demonstration.",
    "Upload your own timetable file when you are ready to plan for real.",
  ];
  finalizeProject(project);
  return project;
}
