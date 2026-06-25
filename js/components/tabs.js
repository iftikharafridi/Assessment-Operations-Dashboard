import { esc } from "../utils/dom.js";

/** Main navigation */
export const TABS = [
  { id: "overview", label: "Overview" },
  { id: "tests", label: "Class tests" },
  { id: "assessment", label: "Assessments" },
  { id: "issues", label: "Issues & to-do" },
];

export const TAB_ALIASES = {
  tracker: "tests",
  invigilation: "tests",
  seminars: "tests",
  validation: "issues",
  summary: "overview",
  timetable: "overview",
};

export function normalizeTabId(tab) {
  return TAB_ALIASES[tab] || tab;
}

export function renderTabs(activeTab, { issueCount = 0 } = {}) {
  const current = normalizeTabId(activeTab);
  return TABS.map((t) => {
    const badge =
      t.id === "issues" && issueCount > 0
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
