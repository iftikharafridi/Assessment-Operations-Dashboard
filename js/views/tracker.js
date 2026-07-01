import { displayStatus } from "../config/constants.js";
import { parseGroups } from "../utils/groups.js";
import { esc } from "../utils/dom.js";
import { dataTable, intro, bindTableSort, toggleSortKey } from "../components/table.js";
import { sortTrackerRows, TRACKER_SORT_DEFAULT } from "../analytics/tracker-sort.js";
import { setTrackerSort } from "../state/store.js";
import {
  clearAllPlans,
  normalizePlan,
  markAsClassTest,
  unmarkClassTest,
  planKey,
} from "../planner/plans.js";
import { confirmAction } from "../components/dialog.js";
import { renderBulkBar, bindBulkBar } from "../planner/bulk.js";
import { sessionHasConflict } from "../analytics/dashboard.js";
import { moduleSeminarNotice } from "../analytics/filters.js";
import { renderClassTestSchedule, bindClassTestScheduleView } from "../components/class-test-schedule.js";
import { openClassTestDrawer, readinessBadges } from "../components/class-test-drawer.js";

function statusBadge(status) {
  const cls = String(status || "Planning")
    .replace(/\s+/g, "-")
    .toLowerCase();
  return `<span class="badge status-${cls}">${esc(displayStatus(status || "Planning"))}</span>`;
}

function readinessSummary(plan, conflict) {
  if (plan.status === "Ready" && plan.invigilator && plan.room && plan.paperReady && plan.lodReady) {
    return `<span class="badge status-ready">Ready</span>`;
  }
  if (conflict) return `<span class="badge issue">Conflict</span>`;
  const issues = [];
  if (!plan.invigilator) issues.push("Invigilator");
  if (!plan.room) issues.push("Room");
  if (!plan.paperReady) issues.push("Blackboard");
  if (!plan.lodReady) issues.push("LOD");
  return issues.length
    ? `<span class="badge warn">${issues.length} item${issues.length === 1 ? "" : "s"} pending</span>`
    : `<span class="badge status-planning">In progress</span>`;
}

export function renderTrackerView({ project, rows, container, state, onUpdate, onExport, onClear }) {
  const seminars = rows.filter((r) => r.Type === "Seminar");
  const showAll = state.trackerShowAll;

  const sort = state.trackerSort || TRACKER_SORT_DEFAULT;
  const visibleSeminars = seminars.filter(
    (s) => showAll || normalizePlan(project.getPlan(planKey(s))).planned
  );
  const sortedSeminars = sortTrackerRows(visibleSeminars, project, sort);

  const rowsHtml = sortedSeminars
    .map((s) => {
      const sid = planKey(s);
      const plan = normalizePlan(project.getPlan(sid));
      const groups = parseGroups(s.Activity, s["Student Groups"]);
      const conflict = sessionHasConflict(project, sid);
      const groupLabel = groups.letterGroups.length ? groups.letterGroups.join(" & ") : groups.admissionGroups.slice(0, 2).join(", ");

      return `<tr class="tracker-row${plan.planned ? " row-planned" : " row-muted"}${conflict ? " row-issue" : ""}" data-session-id="${esc(sid)}" title="Double-click to view all details">
        <td><input type="checkbox" class="row-select" value="${esc(sid)}" aria-label="Select row"></td>
        <td><strong>${esc(s["Module code"])}</strong></td>
        <td><span class="muted small">${esc(s["Module name"])}</span></td>
        <td><span class="campus-chip">${esc(s.Campus)}</span></td>
        <td>${esc(groupLabel || "—")}</td>
        <td>${esc(plan.testWeek || "—")}</td>
        <td>${esc(plan.testDate || "—")}</td>
        <td>${esc(plan.testStartTime || s["Start time"] || "—")}</td>
        <td>${esc(plan.room || s.Room || "—")}</td>
        <td>${esc(plan.leadTutor || s.Staff || "—")}</td>
        <td>${esc(plan.invigilator || "—")}</td>
        <td>${statusBadge(plan.status)}</td>
        <td>${readinessSummary(plan, conflict)}</td>
        <td class="tracker-badges">${readinessBadges(plan, conflict)}</td>
        <td class="action-cell">${
          plan.planned
            ? `<button type="button" class="btn btn-small view-test-detail" data-id="${esc(sid)}">View / Edit</button>
               <button type="button" class="btn btn-small btn-muted unmark-test" data-id="${esc(sid)}">Remove</button>`
            : `<button type="button" class="btn btn-small btn-primary mark-test" data-id="${esc(sid)}">Mark test</button>`
        }</td>
      </tr>`;
    })
    .join("");

  const seminarNotice = state?.filters?.moduleCode
    ? moduleSeminarNotice(project.getTimetableRows(), state.filters, project)
    : "";

  const plannedSeminars = project.getTimetableRows().filter(
    (r) => r.Type === "Seminar" && normalizePlan(project.getPlan(planKey(r))).planned
  );
  const missingInvig = plannedSeminars.filter((s) => !normalizePlan(project.getPlan(planKey(s))).invigilator).length;

  const headers = [
    { label: "" },
    { label: "Module code", sortKey: "module" },
    { label: "Module name" },
    { label: "Campus", sortKey: "campus" },
    { label: "Groups" },
    { label: "Test week", sortKey: "testWeek" },
    { label: "Test date", sortKey: "testDate" },
    { label: "Time", sortKey: "testStartTime" },
    { label: "Room", sortKey: "room" },
    { label: "Lead tutor", sortKey: "leadTutor" },
    { label: "Invigilator", sortKey: "invigilator" },
    { label: "Status", sortKey: "status" },
    { label: "Readiness" },
    { label: "Flags" },
    { label: "Actions" },
  ];

  container.innerHTML = `
    ${renderClassTestSchedule(project, {
      view: state.classTestScheduleView || "this-week",
      filters: state.classTestScheduleFilters || {},
      weekOffset: state.classTestScheduleWeekOffset || 0,
    })}
    ${intro("Planned class tests in a compact view. Double-click a row or use <strong>View / Edit</strong> for full details. Assign invigilators on the Invigilation tab.")}
    ${missingInvig ? `<div class="alert alert-warning" role="status"><strong>${missingInvig} planned test${missingInvig === 1 ? "" : "s"} without an invigilator</strong><p>Open the <strong>Invigilation</strong> tab to assign staff, or edit rows here.</p></div>` : ""}
    ${seminarNotice ? `<div class="alert alert-info" role="status"><strong>Filter note</strong><p>${esc(seminarNotice)}</p></div>` : ""}
    ${renderBulkBar()}
    <div class="table-scroll table-scroll-sticky">
    ${dataTable({
      headers,
      rowsHtml,
      className: "data-table table-pro tracker-table-compact",
      sort,
    })}
    </div>
    <div class="tracker-footer-actions">
      <label class="show-all"><input type="checkbox" id="tracker-show-all" ${showAll ? "checked" : ""}> Show all seminars (not just planned tests)</label>
      <div class="tracker-actions-inline">
        <button id="export-plans" class="btn btn-primary">Save workbook</button>
        <button id="clear-plans" class="btn btn-danger btn-small">Clear all plans</button>
      </div>
    </div>`;

  bindClassTestScheduleView(container, {
    onViewChange: (view) => onUpdate(view, "classTestView"),
    onFilterChange: (filters) => onUpdate(filters, "classTestFilters"),
    onWeekOffsetChange: (delta) => onUpdate(delta, "classTestWeek"),
  });
  bindRowActions(container, project, seminars, onUpdate);
  bindBulkBar(container, project, onUpdate);
  bindTableSort(container, (sortKey) => {
    setTrackerSort(toggleSortKey(sort, sortKey));
  });

  container.querySelectorAll(".tracker-row").forEach((tr) => {
    tr.addEventListener("dblclick", () => {
      const sid = tr.dataset.sessionId;
      const session = seminars.find((s) => planKey(s) === sid);
      if (session) openClassTestDrawer(project, session, { onSaved: () => onUpdate() });
    });
  });

  document.getElementById("export-plans")?.addEventListener("click", onExport);
  document.getElementById("clear-plans")?.addEventListener("click", async () => {
    if (await confirmAction("Clear all class test plans? This cannot be undone until you save a new workbook.")) {
      clearAllPlans(project);
      onClear();
    }
  });
  document.getElementById("tracker-show-all")?.addEventListener("change", (e) => {
    onUpdate(e.target.checked, "showAll");
  });
}

function bindRowActions(container, project, seminars, onUpdate) {
  container.querySelectorAll(".mark-test").forEach((btn) => {
    btn.onclick = () => {
      const row = seminars.find((s) => planKey(s) === btn.dataset.id);
      markAsClassTest(project, btn.dataset.id, row?.Staff, row);
      onUpdate();
    };
  });
  container.querySelectorAll(".unmark-test").forEach((btn) => {
    btn.onclick = () => {
      unmarkClassTest(project, btn.dataset.id);
      onUpdate();
    };
  });
  container.querySelectorAll(".view-test-detail").forEach((btn) => {
    btn.onclick = () => {
      const session = seminars.find((s) => planKey(s) === btn.dataset.id);
      if (session) openClassTestDrawer(project, session, { onSaved: () => onUpdate() });
    };
  });
}
