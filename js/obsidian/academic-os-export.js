/**
 * LEGACY (v2.2): Export assessment tables into 03 - Assessment/*.md only.
 * Prefer exportAcademicOperationsPortal() for the full semester portal.
 * Kept for one release while users migrate.
 */

import {
  ACADEMIC_OS_ASSESSMENT_PATHS,
  ACADEMIC_OS_REQUIRED_FOLDERS,
  ASSESSMENT_SCHEDULE_MD_HEADERS,
  CLASS_TEST_SCHEDULE_MD_HEADERS,
} from "./academic-os-contract.js";
import { buildAssessmentScheduleMdRows, buildClassTestScheduleMdRows } from "./academic-os-rows.js";
import { replaceMatchingTableRows, stampForBackup } from "./md-table.js";

async function readFileHandleText(handle) {
  const file = await handle.getFile();
  return file.text();
}

async function writeFileHandleText(handle, text) {
  const writable = await handle.createWritable();
  await writable.write(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  await writable.close();
}

async function getNestedHandle(root, relativePath, { create = false } = {}) {
  const parts = String(relativePath).split(/[/\\]/).filter(Boolean);
  let dir = root;
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i], { create });
  }
  const fileName = parts[parts.length - 1];
  return dir.getFileHandle(fileName, { create });
}

async function ensureBackup(root, relativePath, originalText) {
  const stamp = stampForBackup();
  const parts = String(relativePath).split(/[/\\]/).filter(Boolean);
  const fileName = parts[parts.length - 1];
  const backupName = fileName.replace(/\.md$/i, "") + `.backup-${stamp}.md`;
  const dirParts = parts.slice(0, -1);
  let dir = root;
  for (const p of dirParts) {
    dir = await dir.getDirectoryHandle(p, { create: false });
  }
  const backupHandle = await dir.getFileHandle(backupName, { create: true });
  await writeFileHandleText(backupHandle, originalText);
  return [...dirParts, backupName].join("/");
}

async function validateSemesterFolder(root) {
  const missing = [];
  for (const folder of ACADEMIC_OS_REQUIRED_FOLDERS) {
    try {
      await root.getDirectoryHandle(folder, { create: false });
    } catch {
      missing.push(folder);
    }
  }
  return missing;
}

async function updateOneFile(root, relativePath, expectedHeaders, dataRows) {
  let handle;
  try {
    handle = await getNestedHandle(root, relativePath, { create: false });
  } catch {
    return {
      path: relativePath,
      ok: false,
      error: `File not found: ${relativePath}`,
      rowsWritten: 0,
      skippedRows: 0,
      warnings: [],
      backupPath: null,
    };
  }

  const original = await readFileHandleText(handle);
  const result = replaceMatchingTableRows(original, expectedHeaders, dataRows);
  if (!result.ok) {
    return {
      path: relativePath,
      ok: false,
      error: result.error,
      rowsWritten: 0,
      skippedRows: result.skippedRows || 0,
      warnings: result.warnings || [],
      backupPath: null,
    };
  }

  let backupPath = null;
  try {
    backupPath = await ensureBackup(root, relativePath, original);
  } catch (err) {
    return {
      path: relativePath,
      ok: false,
      error: `Could not create backup before update: ${err?.message || err}`,
      rowsWritten: 0,
      skippedRows: 0,
      warnings: [],
      backupPath: null,
    };
  }

  try {
    await writeFileHandleText(handle, result.markdown);
  } catch (err) {
    return {
      path: relativePath,
      ok: false,
      error: `Write failed after backup ${backupPath}: ${err?.message || err}`,
      rowsWritten: 0,
      skippedRows: result.skippedRows,
      warnings: result.warnings,
      backupPath,
    };
  }

  return {
    path: relativePath,
    ok: true,
    error: null,
    rowsWritten: result.rowsWritten,
    skippedRows: result.skippedRows,
    warnings: result.warnings,
    backupPath,
  };
}

/**
 * @param {import('../model/project.js').Project} project
 * @param {FileSystemDirectoryHandle} semesterRoot
 */
export async function exportAcademicOperationsOs(project, semesterRoot) {
  const summary = {
    ok: false,
    filesUpdated: [],
    filesFailed: [],
    rowsWritten: 0,
    skippedRows: 0,
    warnings: [],
    folderMissing: [],
  };

  if (!semesterRoot) {
    summary.warnings.push("No semester folder selected.");
    return summary;
  }

  summary.folderMissing = await validateSemesterFolder(semesterRoot);
  if (summary.folderMissing.length) {
    summary.warnings.push(
      `This does not look like an Academic Operations OS semester folder. Missing: ${summary.folderMissing.join(", ")}`
    );
    // Continue — user may still have the assessment files; report invalid folder.
  }

  const assessment = buildAssessmentScheduleMdRows(project);
  const classTests = buildClassTestScheduleMdRows(project);
  summary.warnings.push(...assessment.warnings, ...classTests.warnings);

  const jobs = [
    {
      path: ACADEMIC_OS_ASSESSMENT_PATHS.assessmentSchedule,
      headers: ASSESSMENT_SCHEDULE_MD_HEADERS,
      rows: assessment.rows,
      requireData: false,
    },
    {
      path: ACADEMIC_OS_ASSESSMENT_PATHS.classTestSchedule,
      headers: CLASS_TEST_SCHEDULE_MD_HEADERS,
      rows: classTests.rows,
      requireData: false,
    },
  ];

  for (const job of jobs) {
    if (!job.rows.length && job.path.includes("22 - Class Test")) {
      summary.warnings.push(`${job.path}: no planned class tests to export (table will be cleared to header only).`);
    }
    if (!job.rows.length && job.path.includes("20 - Assessment")) {
      summary.warnings.push(`${job.path}: no assessment events loaded.`);
    }

    try {
      const result = await updateOneFile(semesterRoot, job.path, job.headers, job.rows);
      summary.rowsWritten += result.rowsWritten;
      summary.skippedRows += result.skippedRows;
      summary.warnings.push(...(result.warnings || []).map((w) => `${job.path}: ${w}`));
      if (result.ok) {
        summary.filesUpdated.push({
          path: result.path,
          rowsWritten: result.rowsWritten,
          skippedRows: result.skippedRows,
          backupPath: result.backupPath,
        });
      } else {
        summary.filesFailed.push({ path: result.path, error: result.error });
      }
    } catch (err) {
      summary.filesFailed.push({ path: job.path, error: err?.message || String(err) });
    }
  }

  summary.ok = summary.filesUpdated.length > 0 && summary.filesFailed.length === 0;
  if (summary.filesUpdated.length && summary.filesFailed.length) {
    summary.warnings.push("Partial success: some files updated, others failed.");
  }
  return summary;
}

export function isDirectoryPickerSupported() {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

export async function pickSemesterFolder() {
  if (!isDirectoryPickerSupported()) {
    throw new Error(
      "Your browser cannot select a folder (File System Access API unavailable). Use Chrome or Edge on desktop."
    );
  }
  return window.showDirectoryPicker({
    id: "academic-operations-os-semester",
    mode: "readwrite",
  });
}

export function formatAcademicOsSummaryHtml(summary) {
  const lines = [];
  if (summary.ok) {
    lines.push(`<div class="alert alert-info" role="status"><strong>Academic Operations OS export complete</strong>`);
  } else if (summary.filesUpdated.length) {
    lines.push(`<div class="alert alert-warning" role="status"><strong>Partial Academic Operations OS export</strong>`);
  } else {
    lines.push(`<div class="alert alert-error" role="alert"><strong>Academic Operations OS export failed</strong>`);
  }

  lines.push(`<p>Files updated: <strong>${summary.filesUpdated.length}</strong> · Rows written: <strong>${summary.rowsWritten}</strong> · Skipped rows: <strong>${summary.skippedRows}</strong></p>`);

  if (summary.filesUpdated.length) {
    lines.push("<ul>");
    for (const f of summary.filesUpdated) {
      lines.push(
        `<li><code>${escapeHtml(f.path)}</code> — ${f.rowsWritten} row${f.rowsWritten === 1 ? "" : "s"}` +
          (f.backupPath ? ` (backup: <code>${escapeHtml(f.backupPath)}</code>)` : "") +
          `</li>`
      );
    }
    lines.push("</ul>");
  }

  if (summary.filesFailed.length) {
    lines.push("<p><strong>Failed:</strong></p><ul>");
    for (const f of summary.filesFailed) {
      lines.push(`<li><code>${escapeHtml(f.path)}</code> — ${escapeHtml(f.error || "Unknown error")}</li>`);
    }
    lines.push("</ul>");
  }

  if (summary.warnings?.length) {
    lines.push("<p><strong>Warnings:</strong></p><ul>");
    for (const w of summary.warnings.slice(0, 20)) {
      lines.push(`<li>${escapeHtml(w)}</li>`);
    }
    if (summary.warnings.length > 20) {
      lines.push(`<li>…and ${summary.warnings.length - 20} more</li>`);
    }
    lines.push("</ul>");
  }

  lines.push("</div>");
  return lines.join("");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
