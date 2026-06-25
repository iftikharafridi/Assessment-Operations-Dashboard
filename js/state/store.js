/** Lightweight pub/sub store for UI and project state. */

import { defaultFilters } from "../analytics/filters.js";
import { normalizeTabId } from "../components/tabs.js";

const state = {
  project: null,
  activeTab: "welcome",
  filters: defaultFilters(),
  trackerShowAll: false,
  invigCampus: "",
  invigDay: "Monday",
  calendarLayout: "time-side",
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
  emit({ project, dirty: false, activeTab: project ? "overview" : "welcome", filters: defaultFilters() });
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

export function setTrackerShowAll(value) {
  emit({ trackerShowAll: value });
}

export function setInvigilation(campus, day) {
  emit({ invigCampus: campus, invigDay: day });
}

/** @param {'time-side'|'day-side'} layout */
export function setCalendarLayout(layout) {
  emit({ calendarLayout: layout });
}
