import { esc } from "../utils/dom.js";
import { intro, dataTable, statsBar } from "../components/table.js";
import { renderSubTabs, bindSubTabs, TEACHING_TEAM_SUB_VIEWS } from "../components/tabs.js";
import { setTeachingTeamSubView } from "../state/store.js";
import { buildTeachingTeamRows, buildGroupsReport } from "../analytics/teaching-team.js";
import { campusDisplayName } from "../config/constants.js";

function renderByTutor(project) {
  const { entries } = buildTeachingTeamRows(project);
  const rowsHtml = entries
    .map(
      (t) => `<tr>
        <td>${esc(t.staff)}</td>
        <td><strong>${esc(t.moduleCode)}</strong><br><span class="muted small">${esc(t.moduleName)}</span></td>
        <td>${esc(campusDisplayName(t.campus) || t.campus)}</td>
        <td>${t.sessions}</td>
        <td>${t.lectures}</td>
        <td>${t.seminars}</td>
        <td>${Math.round(t.hours * 100) / 100}</td>
      </tr>`
    )
    .join("");

  return (
    intro("Teaching load by tutor, module, and campus. Split lecture blocks with a short break are merged so weekly hours are not double-counted.") +
    statsBar([
      `${entries.length} tutor–module rows`,
      `${new Set(entries.map((e) => e.staff)).size} tutors`,
      `${Math.round(entries.reduce((s, e) => s + e.hours, 0) * 10) / 10} weekly hours`,
    ]) +
    `<section class="panel-section"><h3 class="section-heading">By tutor</h3>
    <div class="table-scroll table-scroll-sticky">${dataTable({
      headers: ["Staff", "Module", "Campus", "Sessions", "Lectures", "Seminars", "Weekly hours"],
      rowsHtml: rowsHtml || `<tr><td colspan="7" class="muted">No teaching sessions loaded.</td></tr>`,
      className: "data-table table-pro",
    })}</div></section>`
  );
}

function renderGroups(project) {
  const report = buildGroupsReport(project);
  const { letterGroups, mergedSections, admissionCohorts, summary } = report;

  const letterHtml = letterGroups.length
    ? `<div class="group-letter-chips">${letterGroups
        .map((g) => `<span class="badge">GRP ${esc(g)}</span>`)
        .join(" ")}</div>`
    : `<p class="muted">No letter groups (GRP A, GRP B, …) found in Activity text.</p>`;

  const mergedHtml = mergedSections
    .map(
      (s) => `<tr>
        <td><strong>${esc(s.moduleCode)}</strong><br><span class="muted small">${esc(s.moduleName)}</span></td>
        <td>${esc(campusDisplayName(s.campus) || s.campus)}</td>
        <td>${esc(s.weekday)}<br><span class="muted small">${esc(s.start)}–${esc(s.end)}</span></td>
        <td>${esc(s.staff)}</td>
        <td>${esc(s.activity)}</td>
      </tr>`
    )
    .join("");

  const admissionHtml = admissionCohorts
    .map(
      (c) => `<tr>
        <td>${esc(c.label)}</td>
        <td>${c.parsed ? esc(c.cohortLabel) : "—"}</td>
        <td>${c.parsed ? esc(c.siteName) : "—"}</td>
        <td>${c.parsed ? esc(c.studyYear) : "—"}</td>
        <td>${c.parsed ? esc(c.programme) : "—"}</td>
        <td>${c.parsed ? esc(c.dayPattern) : "—"}</td>
      </tr>`
    )
    .join("");

  return (
    intro("Letter groups, merged sections (e.g. GRP A &amp; B), and admission cohorts from the timetable.") +
    statsBar([
      `${summary.letterGroupCount} letter groups`,
      `${summary.mergedSectionCount} merged sections`,
      `${summary.admissionCohortCount} admission groups`,
    ]) +
    `<section class="panel-section"><h3 class="section-heading">Letter groups</h3>${letterHtml}</section>` +
    `<section class="panel-section"><h3 class="section-heading">Merged sections</h3>
      <p class="muted small">Sessions where Activity combines letter groups (GRP A &amp; B) or lists multiple admission groups.</p>
      <div class="table-scroll table-scroll-sticky">${dataTable({
        headers: ["Module", "Campus", "Day / time", "Staff", "Activity"],
        rowsHtml: mergedHtml || `<tr><td colspan="5" class="muted">No merged GRP A &amp; B (or multi-admission) sessions.</td></tr>`,
        className: "data-table table-pro",
      })}</div></section>` +
    `<section class="panel-section"><h3 class="section-heading">Admission cohorts</h3>
      <div class="table-scroll table-scroll-sticky">${dataTable({
        headers: ["Student group", "Cohort", "Site", "Year", "Programme", "Day"],
        rowsHtml: admissionHtml || `<tr><td colspan="6" class="muted">No student groups found.</td></tr>`,
        className: "data-table table-pro",
      })}</div></section>`
  );
}

export function renderTeachingTeamView({ project, container, state }) {
  const sub = state.teachingTeamSubView || "byTutor";

  container.innerHTML =
    `<div class="view-toolbar"><h2 class="view-title">Teaching Team</h2></div>` +
    renderSubTabs(sub, TEACHING_TEAM_SUB_VIEWS, "data-team-sub") +
    `<div class="team-sub-host">${sub === "groups" ? renderGroups(project) : renderByTutor(project)}</div>`;

  bindSubTabs(container, "data-team-sub", (id) => setTeachingTeamSubView(id));
}
