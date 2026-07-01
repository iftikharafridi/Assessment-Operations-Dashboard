import { APP_VERSION, FUTURE_MODULES } from "../config/constants.js";
import { normalizePlan } from "../planner/plans.js";
import { normalizeSemesterStartDate } from "../analytics/assessment.js";
import {
  createEmptyAssessmentTracking,
  normalizeAssessmentRecord,
} from "./assessment-tracking.js";
let nextId = 1;

function uid() {
  return `ds-${Date.now()}-${nextId++}`;
}

/**
 * @typedef {Object} Dataset
 * @property {string} id
 * @property {string} filename
 * @property {string} fileType
 * @property {string} sheetName
 * @property {Array<Record<string, unknown>>} rows
 * @property {object} [workbook] - SheetJS workbook reference for export
 * @property {string} [uploadedAt]
 */

/**
 * Central project model — extensible for future assessment modules.
 */
export class Project {
  constructor(name = "Untitled project") {
    this.name = name;
    this.version = APP_VERSION;
    this.createdAt = new Date().toISOString();
    this.modifiedAt = this.createdAt;
    /** @type {Record<string, Dataset[]>} */
    this.datasets = {
      timetable: [],
      staff: [],
      rooms: [],
      assessmentSchedule: [],
    };
    /** @type {Record<string, object>} Session ID -> plan fields */
    this.plans = {};
    /** Future module payloads keyed by module id */
    this.modules = Object.fromEntries(FUTURE_MODULES.map((m) => [m, null]));
    /** Primary export source filename */
    this.primaryFilename = null;
    /** Friendly import messages shown in the UI */
    this.importWarnings = [];
    /** Rows from validation */
    this.importValidation = { missing: [] };
    /** Admission cohorts hidden from views/exports (dropped groups). */
    this.hiddenStudentGroups = [];
    /** Plans that could not be matched after reopen */
    this.unmatchedPlans = [];
    /** Assessment hub: semester start + per-event tasks/notes */
    this.assessmentTracking = createEmptyAssessmentTracking();
  }

  touch() {
    this.modifiedAt = new Date().toISOString();
  }

  /**
   * @param {string} fileType
   * @param {Omit<Dataset, 'id'>} dataset
   */
  addDataset(fileType, dataset) {
    const type = this.datasets[fileType] ? fileType : "unknown";
    if (!this.datasets[type]) this.datasets[type] = [];
    const entry = { id: uid(), ...dataset };
    this.datasets[type].push(entry);
    if (fileType === "timetable" && !this.primaryFilename) {
      this.primaryFilename = dataset.filename;
    }
    this.touch();
    return entry;
  }

  removeDataset(fileType, datasetId) {
    const list = this.datasets[fileType];
    if (!list) return;
    this.datasets[fileType] = list.filter((d) => d.id !== datasetId);
    this.touch();
  }

  /** @returns {Array<Record<string, unknown>>} */
  getTimetableRows() {
    const rows = this.datasets.timetable.flatMap((d) =>
      d.rows.map((r) => ({ ...r, _sourceFile: d.filename, _sourceId: d.id }))
    );
    const hidden = this.getHiddenStudentGroups();
    if (!hidden.length) return rows;
    const blocked = new Set(hidden.map((g) => g.toLowerCase()));
    return rows.filter((row) => {
      const groups = String(row["Student Groups"] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return !groups.some((g) => blocked.has(g.toLowerCase()));
    });
  }

  getHiddenStudentGroups() {
    return [...(this.hiddenStudentGroups || [])];
  }

  hideStudentGroup(name) {
    const label = String(name ?? "").trim();
    if (!label) return;
    const exists = (this.hiddenStudentGroups || []).some((g) => g.toLowerCase() === label.toLowerCase());
    if (!exists) {
      this.hiddenStudentGroups = [...(this.hiddenStudentGroups || []), label];
      this.touch();
    }
  }

  restoreStudentGroup(name) {
    const label = String(name ?? "").trim().toLowerCase();
    if (!label) return;
    this.hiddenStudentGroups = (this.hiddenStudentGroups || []).filter((g) => g.toLowerCase() !== label);
    this.touch();
  }

  /** Raw timetable rows including hidden groups (for group manager counts). */
  getAllTimetableRows() {
    return this.datasets.timetable.flatMap((d) =>
      d.rows.map((r) => ({ ...r, _sourceFile: d.filename, _sourceId: d.id }))
    );
  }

  getStaffRows() {
    return this.datasets.staff.flatMap((d) => d.rows);
  }

  getRoomRows() {
    return this.datasets.rooms.flatMap((d) => d.rows);
  }

  getAssessmentRows() {
    return this.datasets.assessmentSchedule.flatMap((d) => d.rows);
  }

  getAssessmentEvents() {
    return this.datasets.assessmentSchedule.flatMap((d) => d.events || []);
  }

  hasAssessmentSchedule() {
    return this.getAssessmentEvents().length > 0;
  }

  getAssessmentRecord(eventId) {
    return normalizeAssessmentRecord(this.assessmentTracking.records[String(eventId)] || {});
  }

  setAssessmentRecord(eventId, partial) {
    const key = String(eventId);
    this.assessmentTracking.records[key] = normalizeAssessmentRecord({
      ...this.getAssessmentRecord(key),
      ...partial,
    });
    this.touch();
  }

  setSemesterStartDate(date) {
    this.assessmentTracking.semesterStartDate = normalizeSemesterStartDate(date);
    this.touch();
  }

  getSemesterStartDate() {
    return this.assessmentTracking.semesterStartDate || "";
  }

  getPlan(sessionId) {
    return normalizePlan(this.plans[String(sessionId)] || {});
  }

  setPlan(sessionId, partial) {
    const key = String(sessionId);
    this.plans[key] = { ...this.getPlan(sessionId), ...partial };
    this.touch();
  }

  clearPlans() {
    this.plans = {};
    this.unmatchedPlans = [];
    this.touch();
  }

  get loadedFileSummary() {
    return Object.entries(this.datasets)
      .filter(([, list]) => list.length)
      .map(([type, list]) => ({ type, count: list.length, files: list.map((d) => d.filename) }));
  }

  toMeta() {
    return {
      version: this.version,
      name: this.name,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
      primaryFilename: this.primaryFilename,
      modules: this.modules,
      assessmentTracking: this.assessmentTracking,
      hiddenStudentGroups: this.hiddenStudentGroups || [],
      datasetIndex: Object.fromEntries(
        Object.entries(this.datasets).map(([type, list]) => [
          type,
          list.map(({ id, filename, sheetName, uploadedAt }) => ({ id, filename, sheetName, uploadedAt })),
        ])
      ),
    };
  }

  static fromMeta(meta, plans, datasets) {
    const project = new Project(meta.name || "Restored project");
    project.version = meta.version || APP_VERSION;
    project.createdAt = meta.createdAt || project.createdAt;
    project.modifiedAt = meta.modifiedAt || project.modifiedAt;
    project.primaryFilename = meta.primaryFilename || null;
    project.modules = { ...project.modules, ...(meta.modules || {}) };
    project.assessmentTracking = meta.assessmentTracking || createEmptyAssessmentTracking();
    project.hiddenStudentGroups = Array.isArray(meta.hiddenStudentGroups) ? [...meta.hiddenStudentGroups] : [];
    project.plans = plans || {};
    if (datasets) project.datasets = datasets;
    return project;
  }
}

export function createEmptyProject(name) {
  return new Project(name);
}
