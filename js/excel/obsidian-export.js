import {
  buildSimplifiedAssessmentCsv,
  buildObsidianAssessmentMarkdown,
} from "./assessment-simple-export.js";
import { createZipBlob, downloadBlob } from "../utils/zip.js";

export function downloadObsidianAssessmentPack(project) {
  const csvName = "Assessment Schedule Simplified.csv";
  const mdName = "Obsidian Assessment Schedule.md";
  const csv = buildSimplifiedAssessmentCsv(project);
  const md = buildObsidianAssessmentMarkdown({ csvFilename: csvName });

  const stamp = new Date().toISOString().slice(0, 10);
  const zip = createZipBlob([
    { name: csvName, content: csv },
    { name: mdName, content: md },
  ]);
  downloadBlob(zip, `Obsidian Assessment Schedule ${stamp}.zip`);
}
