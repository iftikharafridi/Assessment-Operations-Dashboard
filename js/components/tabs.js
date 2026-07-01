import { esc } from "../utils/dom.js";

/** Main navigation */
export const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "assessment", label: "Assessments" },
  { id: "tests", label: "Class Tests" },
  { id: "timetable", label: "Timetable" },
  { id: "invigilation", label: "Invigilation" },
  { id: "reports", label: "Reports & Export" },
  { id: "settings", label: "Settings / Help" },
];

export const TAB_ALIASES = {
  overview: "dashboard",
  tracker: "tests",
  invigilation: "invigilation",
  seminars: "tests",
  validation: "dashboard",
  summary: "dashboard",
  timetable: "timetable",
  issues: "dashboard",
  reports: "reports",
  settings: "settings",
};

export function normalizeTabId(tab) {
  return TAB_ALIASES[tab] || tab;
}

export function renderTabs(activeTab, { issueCount = 0 } = {}) {
  const current = normalizeTabId(activeTab);
  return TABS.map((t) => {
    const badge =
      t.id === "dashboard" && issueCount > 0
        ? `<span class="tab-badge" title="${issueCount} open item${issueCount === 1 ? "" : "s"}">${issueCount > 99 ? "99+" : issueCount}</span>`
        : "";
    return `<button class="tab-btn${t.id === current ? " active" : ""}" data-tab="${t.id}">${esc(t.label)}${badge}</button>`;
  }).join("");
}

export function bindTabs(onChange) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.onclick = () => onChange(btn.dataset.tab);
  });
}

export const ASSESSMENT_SUB_VIEWS = [
  { id: "timeline", label: "Timeline View" },
  { id: "upcoming", label: "Upcoming Deadlines" },
  { id: "all", label: "All Assessments" },
  { id: "tracking", label: "Assessment Tracking" },
];

export function renderSubTabs(activeId, views, dataAttr = "data-sub-tab") {
  return `<div class="sub-tabs" role="tablist">${views
    .map(
      (v) =>
        `<button type="button" class="sub-tab-btn${v.id === activeId ? " active" : ""}" ${dataAttr}="${v.id}" aria-selected="${v.id === activeId}">${esc(v.label)}</button>`
    )
    .join("")}</div>`;
}

export function bindSubTabs(container, attrName, onChange) {
  container.querySelectorAll(`[${attrName}]`).forEach((btn) => {
    btn.onclick = () => onChange(btn.getAttribute(attrName));
  });
}
