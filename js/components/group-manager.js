import { esc } from "../utils/dom.js";
import { markDirty } from "../state/store.js";

function countSessionsForGroup(rows, groupName) {
  const needle = groupName.toLowerCase();
  return rows.filter((row) =>
    String(row["Student Groups"] || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .includes(needle)
  ).length;
}

export function listStudentGroups(project) {
  const hidden = new Set(project.getHiddenStudentGroups().map((g) => g.toLowerCase()));
  const rows = project.getAllTimetableRows();
  const groups = new Map();

  for (const row of rows) {
    for (const raw of String(row["Student Groups"] || "").split(",")) {
      const name = raw.trim();
      if (!name) continue;
      if (!groups.has(name.toLowerCase())) {
        groups.set(name.toLowerCase(), { name, sessions: countSessionsForGroup(rows, name), hidden: hidden.has(name.toLowerCase()) });
      }
    }
  }

  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function renderGroupManager(project) {
  const groups = listStudentGroups(project);
  if (!groups.length) return "";

  const visible = groups.filter((g) => !g.hidden);
  const hidden = groups.filter((g) => g.hidden);

  const rowHtml = (g, action) =>
    `<li class="group-row">
      <span class="group-name" title="${esc(g.name)}">${esc(g.name)}</span>
      <span class="muted small">${g.sessions} session${g.sessions === 1 ? "" : "s"}</span>
      <button type="button" class="btn btn-small ${action.class}" data-group-action="${action.id}" data-group="${esc(g.name)}">${action.label}</button>
    </li>`;

  return `
    <details class="group-manager">
      <summary>Manage student groups</summary>
      <p class="muted small">Hide groups dropped by the university — their sessions disappear from the dashboard and exports. Restore anytime.</p>
      ${visible.length ? `<ul class="group-list">${visible.map((g) => rowHtml(g, { id: "hide", label: "Hide", class: "btn-muted" })).join("")}</ul>` : `<p class="muted small">All groups are hidden.</p>`}
      ${hidden.length ? `<p class="group-hidden-label"><strong>Hidden groups</strong></p><ul class="group-list group-list-hidden">${hidden.map((g) => rowHtml(g, { id: "restore", label: "Restore", class: "" })).join("")}</ul>` : ""}
    </details>`;
}

export function bindGroupManager(project, onChange) {
  document.querySelectorAll("[data-group-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.group;
      if (!name) return;
      if (btn.dataset.groupAction === "hide") project.hideStudentGroup(name);
      else project.restoreStudentGroup(name);
      markDirty();
      onChange?.();
    });
  });
}
