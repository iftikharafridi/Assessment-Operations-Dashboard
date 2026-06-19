import { esc } from "../utils/dom.js";

export const TABS = [
  { id: "overview", label: "Overview" },
  { id: "validation", label: "Check data" },
  { id: "timetable", label: "Weekly timetable" },
  { id: "seminars", label: "Seminar slots" },
  { id: "tracker", label: "Class test plan" },
  { id: "assessment", label: "Assessment hub" },
  { id: "invigilation", label: "Invigilation" },
  { id: "summary", label: "Module summary" },
];

export function renderTabs(activeTab) {
  return TABS.map(
    (t) =>
      `<button class="tab-btn${t.id === activeTab ? " active" : ""}" data-tab="${t.id}">${esc(t.label)}</button>`
  ).join("");
}

export function bindTabs(onChange) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.onclick = () => onChange(btn.dataset.tab);
  });
}
