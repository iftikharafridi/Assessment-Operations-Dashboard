import { esc } from "../utils/dom.js";
import { intro, dataTable } from "../components/table.js";
import { buildMissingInvigilators, buildTutorWorkload, detectConflicts } from "../analytics/dashboard.js";
import { buildInvigilationPlanRows } from "../analytics/invigilation.js";
import { getTestSlot } from "../utils/time.js";
import { normalizePlan, planKey } from "../planner/plans.js";
import { displayStatus } from "../config/constants.js";
import { renderInvigilationSection, bindInvigilationSection } from "./invigilation.js";
import { openClassTestDrawer } from "../components/class-test-drawer.js";

export function renderInvigilationTabView({ project, container, state, onInvigChange, onUpdate }) {
  const timetableRows = project.getTimetableRows();
  const rows = buildInvigilationPlanRows(project);
  const missing = buildMissingInvigilators(project);
  const conflicts = detectConflicts(project).filter((c) => c.type.includes("invigilator"));
  const workload = buildTutorWorkload(project).filter((t) => t["Invigilation duties"] > 0);

  const tableRows = rows
    .map((r) => {
      const session = timetableRows.find((row) => planKey(row) === r._planKey);
      const plan = session ? normalizePlan(project.getPlan(planKey(session))) : {};
      const slot = session ? getTestSlot(session, plan) : { start: r["Test time"]?.split("–")[0], end: "" };
      const warn = r.Availability === "Busy / conflict" || r.Availability === "Not assigned";
      return `<tr class="${warn ? "row-issue" : ""}">
        <td><strong>${esc(r["Module code"])}</strong></td>
        <td>${esc(r.Campus)}</td>
        <td>${esc(r["Test week"] || "—")} ${esc(r["Test date"] || "")}<br><span class="muted small">${esc(slot.start || "")}${slot.end ? `–${esc(slot.end)}` : ""}</span></td>
        <td>${esc(r["Lead tutor"] || "—")}</td>
        <td>${esc(r.Invigilator || "—")}</td>
        <td>${esc(r.Availability || "—")}</td>
        <td>${warn ? `<span class="badge issue">${esc(r.Availability)}</span>` : "—"}</td>
        <td><span class="badge status-${String(r.Status || "").replace(/\s+/g, "-").toLowerCase()}">${esc(displayStatus(r.Status || "Planning"))}</span></td>
        <td><button type="button" class="btn btn-small edit-invig-row" data-plan-key="${esc(r._planKey)}" ${session ? "" : "disabled"}>Edit</button></td>
      </tr>`;
    })
    .join("");

  container.innerHTML =
    intro("Operational invigilation view — missing staff, assignments, conflicts, and tutor workload. Use <strong>Edit</strong> to assign or change an invigilator without leaving this tab.") +
    (missing.length
      ? `<div class="alert alert-warning"><strong>${missing.length} planned test${missing.length === 1 ? "" : "s"} without an invigilator</strong></div>`
      : "") +
    (conflicts.length
      ? `<div class="alert alert-issue"><strong>${conflicts.length} invigilator conflict${conflicts.length === 1 ? "" : "s"}</strong><ul>${conflicts.map((c) => `<li>${esc(c.message)}</li>`).join("")}</ul></div>`
      : "") +
    `<section class="panel-section"><h3 class="section-heading">Invigilation assignments</h3>
    <div class="table-scroll table-scroll-sticky">${dataTable({
      headers: ["Module", "Campus", "Test week/date/time", "Lead tutor", "Invigilator", "Availability", "Warning", "Status", "Action"],
      rowsHtml: tableRows || `<tr><td colspan="9" class="muted">No planned class tests.</td></tr>`,
      className: "data-table table-pro",
    })}</div></section>` +
    `<section class="panel-section"><h3 class="section-heading">Tutor workload (invigilation)</h3>
    <div class="table-scroll table-scroll-sticky">${dataTable({
      headers: ["Tutor", "Teaching sessions", "Modules", "Campuses", "Invigilation duties"],
      rowsHtml: workload.map((t) => `<tr><td>${esc(t.Tutor)}</td><td>${t["Teaching sessions"]}</td><td>${t["Modules taught"]}</td><td>${esc(t.Campuses)}</td><td>${t["Invigilation duties"]}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">No invigilation duties assigned.</td></tr>`,
      className: "data-table table-pro",
    })}</div></section>` +
    renderInvigilationSection({ project, state });

  bindInvigilationSection(container, { onInvigChange });

  container.querySelectorAll(".edit-invig-row").forEach((btn) => {
    btn.onclick = () => {
      const session = timetableRows.find((row) => planKey(row) === btn.dataset.planKey);
      if (!session) return;
      openClassTestDrawer(project, session, {
        onSaved: () => onUpdate?.(),
      });
      requestAnimationFrame(() => {
        document.querySelector(".app-drawer.is-open [data-field='invigilator']")?.focus();
      });
    };
  });
}
