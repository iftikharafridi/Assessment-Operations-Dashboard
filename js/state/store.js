/** Lightweight pub/sub store for UI and project state. */

import { defaultFilters } from "../analytics/filters.js";
import { normalizeTabId } from "../components/tabs.js";

const state = {
  project: null,
  activeTab: "welcome",
  assessmentSubView: "timeline",
  timetableCampus: "",
  trackerDetailId: null,
  lastExportAt: null,
  filters: defaultFilters(),
  trackerShowAll: false,
  trackerSort: { key: "seminarSlot", dir: "asc" },
  invigCampus: "",
  invigDay: "Monday",
  calendarLayout: "day-side",
  classTestScheduleView: "this-week",
  classTestScheduleFilters: {
    campus: "",
    siteCode: "",
    cohortCode: "",
    studyYear: "",
    studySemester: "",
  },
  /** 0 = current teaching week; +1 = next week, −1 = previous week */
  classTestScheduleWeekOffset: 0,
  assessmentScheduleView: "this-week",
  assessmentScheduleWeekOffset: 0,
  assessmentScheduleFilters: {
    type: "",
    scheduleSemester: "",
    campus: "",
    siteCode: "",
    cohortCode: "",
    studyYear: "",
    studySemester: "",
  },
  dirty: false,
  excelReaderReady: true,
};

const listeners = new Set();

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit(change = {}) {
  Object.assign(state, change);
  listeners.forEach((fn) => fn(state, change));
}

export function setProject(project) {
  emit({ project, dirty: false, activeTab: project ? "dashboard" : "welcome", filters: defaultFilters() });
}

export function setTab(tab) {
  emit({ activeTab: normalizeTabId(tab) });
}

export function setFilters(partial) {
  emit({ filters: { ...state.filters, ...partial } });
}

export function resetFilters() {
  emit({ filters: defaultFilters() });
}

export function markDirty() {
  if (!state.dirty) emit({ dirty: true });
}

/** Mark project dirty without notifying subscribers (used while editing table fields). */
export function setDirtySilent() {
  state.dirty = true;
}

export function setTrackerShowAll(value) {
  emit({ trackerShowAll: value });
}

/** @param {{ key: string, dir: 'asc'|'desc' }} sort */
export function setTrackerSort(sort) {
  emit({ trackerSort: sort });
}

export function setInvigilation(campus, day) {
  emit({ invigCampus: campus, invigDay: day });
}

/** @param {'this-week'|'semester'|'timeline'|'by-group'|'by-cohort'|'by-campus'|'calendar'} view */
export function setClassTestScheduleView(view) {
  emit({ classTestScheduleView: view });
}

export function setClassTestScheduleFilters(partial) {
  emit({ classTestScheduleFilters: { ...state.classTestScheduleFilters, ...partial } });
}

export function setClassTestScheduleWeekOffset(offset) {
  emit({ classTestScheduleWeekOffset: offset });
}

export function adjustClassTestScheduleWeekOffset(delta) {
  emit({ classTestScheduleWeekOffset: (state.classTestScheduleWeekOffset || 0) + delta });
}

export function setAssessmentScheduleView(view) {
  emit({ assessmentScheduleView: view });
}

export function setAssessmentScheduleFilters(partial) {
  emit({ assessmentScheduleFilters: { ...state.assessmentScheduleFilters, ...partial } });
}

export function setAssessmentScheduleWeekOffset(offset) {
  emit({ assessmentScheduleWeekOffset: offset });
}

export function adjustAssessmentScheduleWeekOffset(delta) {
  emit({ assessmentScheduleWeekOffset: (state.assessmentScheduleWeekOffset || 0) + delta });
}

export function setAssessmentSubView(view) {
  emit({ assessmentSubView: view });
}

export function setTimetableCampus(campus) {
  emit({ timetableCampus: campus || "" });
}

export function setTrackerDetailId(id) {
  emit({ trackerDetailId: id });
}

export function setLastExportAt(iso) {
  emit({ lastExportAt: iso });
}

/** Navigate to a tab and optionally merge filters (e.g. campus). */
export function navigateTo(tab, partialFilters = {}) {
  emit({
    activeTab: normalizeTabId(tab),
    filters: partialFilters && Object.keys(partialFilters).length ? { ...state.filters, ...partialFilters } : state.filters,
  });
}

/** @param {'time-side'|'day-side'} layout */
export function setCalendarLayout(layout) {
  emit({ calendarLayout: layout });
}
