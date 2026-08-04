/**
 * Academic Operations OS — Semester Portal export.
 * Creates/updates Teaching + Assessment pages + _Data tables + CSS.
 */

import {
  PORTAL_MODE_COMPLETE,
  PORTAL_MODE_DATA_ONLY,
  PORTAL_PAGE_PATHS,
  PORTAL_DATA_PATHS,
  PORTAL_ASSET_PATHS,
  PORTAL_FOLDERS,
} from "./paths.js";
import { PORTAL_CSS } from "./css.js";
import {
  collectPortalData,
  tableDocument,
  buildExportSummaryRows,
} from "./data-builders.js";
import { buildTeachingCentrePage } from "./pages-home-teaching.js";
import { buildAssessmentCentrePage } from "./pages-assessment-operations.js";
import {
  createMarkedDocument,
  replaceGeneratedSection,
  stampForBackup,
} from "../md-table.js";

async function readFileHandleText(handle) {
  const file = await handle.getFile();
  return file.text();
}

async function writeFileHandleText(handle, text) {
  const writable = await handle.createWritable();
  await writable.write(new Blob([text], { type: "text/plain;charset=utf-8" }));
  await writable.close();
}

async function ensureDir(root, relativeDir) {
  const parts = String(relativeDir).split(/[/\\]/).filter(Boolean);
  let dir = root;
  for (const p of parts) {
    dir = await dir.getDirectoryHandle(p, { create: true });
  }
  return dir;
}

async function getNestedHandle(root, relativePath, { create = false } = {}) {
  const parts = String(relativePath).split(/[/\\]/).filter(Boolean);
  let dir = root;
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i], { create });
  }
  return dir.getFileHandle(parts[parts.length - 1], { create });
}

async function ensureBackup(root, relativePath, originalText) {
  const stamp = stampForBackup();
  const parts = String(relativePath).split(/[/\\]/).filter(Boolean);
  const fileName = parts[parts.length - 1];
  const backupName =
    fileName.replace(/\.(md|css)$/i, "") +
    `.backup-${stamp}` +
    (/\.css$/i.test(fileName) ? ".css" : ".md");
  // Keep backups out of the main note tree so Obsidian stays uncluttered.
  const backupRel = ["_Backups", ...parts.slice(0, -1), backupName].join("/");
  const backupHandle = await getNestedHandle(root, backupRel, { create: true });
  await writeFileHandleText(backupHandle, originalText);
  return backupRel;
}

/**
 * Pure builder: returns virtual file map for the portal (testable without FS API).
 * @param {object} project
 * @param {{ mode?: string, exportedAt?: string }} options
 */
export function buildPortalFiles(project, options = {}) {
  const mode = options.mode || PORTAL_MODE_COMPLETE;
  const exportedAt = options.exportedAt || new Date().toISOString();
  const exportMeta = {
    exportedAt,
    projectName: project.name || "Semester",
    mode,
  };

  const portalData = collectPortalData(project, exportMeta);
  const { tables, warnings, metrics } = portalData;

  const summarySeed = {
    pagesUpdated: mode === PORTAL_MODE_COMPLETE ? 4 : 0,
    dataUpdated: Object.keys(PORTAL_DATA_PATHS).length,
    assetsUpdated: mode === PORTAL_MODE_COMPLETE ? 1 : 0,
    rowCounts: {
      timetable: tables.timetable.rows.length,
      modules: tables.modules.rows.length,
      teachingTeam: tables.team.rows.length,
      assessments: tables.assessments.rows.length,
      classTests: tables.classTests.rows.length,
      invigilation: tables.invigilation.rows.length,
      issues: tables.issues.rows.length,
      cohorts: tables.cohorts.rows.length,
    },
    warnings,
  };
  const exportSummary = buildExportSummaryRows(summarySeed);

  /** @type {Array<{ path: string, kind: string, title: string, generated: string, isBinaryText?: boolean }>} */
  const files = [];

  const dataSpecs = [
    { path: PORTAL_DATA_PATHS.semesterSettings, title: "Semester Settings", table: tables.settings },
    { path: PORTAL_DATA_PATHS.cohortCalendar, title: "Cohort Calendar", table: tables.cohorts },
    { path: PORTAL_DATA_PATHS.teachingTimetable, title: "Teaching Timetable", table: tables.timetable },
    { path: PORTAL_DATA_PATHS.modules, title: "Modules", table: tables.modules },
    { path: PORTAL_DATA_PATHS.teachingTeam, title: "Teaching Team", table: tables.team },
    { path: PORTAL_DATA_PATHS.assessmentSchedule, title: "Assessment Schedule", table: tables.assessments },
    { path: PORTAL_DATA_PATHS.classTestSchedule, title: "Class Test Schedule", table: tables.classTests },
    { path: PORTAL_DATA_PATHS.invigilationSchedule, title: "Invigilation Schedule", table: tables.invigilation },
    { path: PORTAL_DATA_PATHS.issuesAndActions, title: "Issues and Actions", table: tables.issues },
    { path: PORTAL_DATA_PATHS.exportSummary, title: "Export Summary", table: exportSummary },
  ];

  for (const spec of dataSpecs) {
    files.push({
      path: spec.path,
      kind: "data",
      title: spec.title,
      generated: tableDocument(spec.title, spec.table.headers, spec.table.rows),
    });
  }

  if (mode === PORTAL_MODE_COMPLETE) {
    files.push({
      path: PORTAL_ASSET_PATHS.css,
      kind: "asset",
      title: "CSS",
      generated: PORTAL_CSS,
      isBinaryText: true,
    });
    files.push({
      path: PORTAL_PAGE_PATHS.teachingCentre,
      kind: "page",
      title: "Teaching Centre",
      generated: buildTeachingCentrePage(),
    });
    files.push({
      path: PORTAL_PAGE_PATHS.assessmentCentre,
      kind: "page",
      title: "Assessment Centre",
      generated: buildAssessmentCentrePage(),
    });
  }

  return {
    mode,
    files,
    warnings,
    metrics,
    rowCounts: summarySeed.rowCounts,
    exportMeta,
  };
}

/** Apply generated body into an existing document (marker-aware). */
export function applyGeneratedContent(existingText, title, generatedBody, { rawFile = false } = {}) {
  if (rawFile) {
    return {
      ok: true,
      markdown: generatedBody,
      created: !String(existingText ?? "").trim(),
      preservedManual: false,
    };
  }
  if (!String(existingText ?? "").trim()) {
    return {
      ok: true,
      markdown: createMarkedDocument(title, generatedBody),
      created: true,
      preservedManual: false,
    };
  }
  return replaceGeneratedSection(existingText, generatedBody, { title });
}

export function isDirectoryPickerSupported() {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

export async function pickSemesterFolder() {
  return window.showDirectoryPicker({ mode: "readwrite", id: "academic-operations-os" });
}

/**
 * @param {object} project
 * @param {FileSystemDirectoryHandle} semesterRoot
 * @param {{ mode?: string }} options
 */
export async function exportAcademicOperationsPortal(project, semesterRoot, options = {}) {
  const mode = options.mode || PORTAL_MODE_COMPLETE;
  const built = buildPortalFiles(project, {
    mode,
    exportedAt: new Date().toLocaleString(),
  });

  for (const folder of PORTAL_FOLDERS) {
    await ensureDir(semesterRoot, folder);
  }

  const results = [];
  const backups = [];
  const created = [];
  const updated = [];
  const failed = [];

  for (const file of built.files) {
    try {
      let existing = "";
      let existed = false;
      try {
        const handle = await getNestedHandle(semesterRoot, file.path, { create: false });
        existing = await readFileHandleText(handle);
        existed = true;
      } catch {
        existed = false;
      }

      if (existed && existing) {
        try {
          const backupPath = await ensureBackup(semesterRoot, file.path, existing);
          backups.push(backupPath);
        } catch (err) {
          failed.push({ path: file.path, error: `Backup failed: ${err?.message || err}` });
          continue;
        }
      }

      const applied = applyGeneratedContent(existing, file.title, file.generated, {
        rawFile: file.kind === "asset",
      });
      const handle = await getNestedHandle(semesterRoot, file.path, { create: true });
      await writeFileHandleText(handle, applied.markdown);

      const entry = {
        path: file.path,
        kind: file.kind,
        created: !existed,
        rows: file.kind === "data" ? (file.generated.match(/^\|/gm)?.length || 0) - 2 : 0,
      };
      results.push(entry);
      if (!existed) created.push(file.path);
      else updated.push(file.path);
    } catch (err) {
      failed.push({ path: file.path, error: err?.message || String(err) });
    }
  }

  const pagesUpdated = results.filter((r) => r.kind === "page").length;
  const dataUpdated = results.filter((r) => r.kind === "data").length;
  const assetsUpdated = results.filter((r) => r.kind === "asset").length;

  return {
    ok: failed.length === 0,
    mode,
    pagesUpdated,
    dataUpdated,
    assetsUpdated,
    created,
    updated,
    backups,
    failed,
    rowCounts: built.rowCounts,
    warnings: built.warnings,
    metrics: built.metrics,
    unsupported: [
      "Student-level lookup remains in the Student Data application",
      "Timetable has no teaching-room column — rooms only from class-test plans",
      "Cohort week left blank when cohort-specific start dates are unknown",
    ],
  };
}

export function formatPortalSummaryHtml(summary) {
  if (!summary) return "";
  const modeLabel =
    summary.mode === PORTAL_MODE_DATA_ONLY
      ? "Update Data Tables Only"
      : "Create/Update Complete Semester Portal";

  const list = (items) =>
    items?.length
      ? `<ul>${items.map((i) => `<li><code>${escape(typeof i === "string" ? i : i.path || i)}</code>${i.error ? ` — ${escape(i.error)}` : ""}</li>`).join("")}</ul>`
      : "<p class='muted small'>None</p>";

  const counts = summary.rowCounts || {};
  return `<div class="alert ${summary.ok ? "alert-success" : "alert-warning"}" role="status">
    <strong>Academic Operations OS — ${escape(modeLabel)}</strong>
    <p class="small">Pages: ${summary.pagesUpdated || 0} · Data files: ${summary.dataUpdated || 0} · Assets: ${summary.assetsUpdated || 0}</p>
    <p class="small">Rows — timetable ${counts.timetable || 0}, modules ${counts.modules || 0}, team ${counts.teachingTeam || 0}, assessments ${counts.assessments || 0}, class tests ${counts.classTests || 0}, invigilation ${counts.invigilation || 0}, issues ${counts.issues || 0}, cohorts ${counts.cohorts || 0}</p>
    <details><summary>Created</summary>${list(summary.created)}</details>
    <details><summary>Updated</summary>${list(summary.updated)}</details>
    <details><summary>Backups (in <code>_Backups/</code>)</summary>${list(summary.backups)}</details>
    <details open><summary>Warnings (${summary.warnings?.length || 0})</summary>${
      summary.warnings?.length
        ? `<ul>${summary.warnings.slice(0, 40).map((w) => `<li>${escape(w)}</li>`).join("")}</ul>`
        : "<p class='muted small'>None</p>"
    }</details>
    <details><summary>Notes / limitations</summary>${list(summary.unsupported)}</details>
    ${
      summary.failed?.length
        ? `<details open><summary>Failed</summary>${list(summary.failed)}</details>`
        : ""
    }
  </div>`;
}

function escape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export { PORTAL_MODE_COMPLETE, PORTAL_MODE_DATA_ONLY };
