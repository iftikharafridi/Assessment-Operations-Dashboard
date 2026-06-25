import { esc } from "../utils/dom.js";

/** Main navigation — keep this list short for colleagues. */
export const TABS = [
  { id: "overview", label: "Overview" },
  { id: "tests", label: "Class tests" },
  { id: "assessment", label: "Assessments" },
];

/** Map removed tab ids (bookmarks, old links) to the new layout. */
export const TAB_ALIASES = {
  tracker: "tests",
  invigilation: "tests",
  seminars: "tests",
  validation: "overview",
  summary: "overview",
  timetable: "overview",
};

export function normalizeTabId(tab) {
  return TAB_ALIASES[tab] || tab;
}

export function renderTabs(activeTab) {
  const current = normalizeTabId(activeTab);
  return TABS.map(
    (t) =>
      `<button class="tab-btn${t.id === current ? " active" : ""}" data-tab="${t.id}">${esc(t.label)}</button>`
  ).join("");
}

export function bindTabs(onChange) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.onclick = () => onChange(btn.dataset.tab);
  });
}
