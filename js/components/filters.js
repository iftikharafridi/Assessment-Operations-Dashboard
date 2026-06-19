import { esc } from "../utils/dom.js";
import { PLAN_STATUSES, displayStatus } from "../config/constants.js";
import { filterOptionsFor, describeFilterContext, moduleSeminarNotice } from "../analytics/filters.js";

export function renderFiltersPanel(allRows, project, activeFilters = {}) {
  const opts = {
    campuses: filterOptionsFor(allRows, activeFilters, "campus", project).campuses,
    weekdays: filterOptionsFor(allRows, activeFilters, "weekday", project).weekdays,
    moduleCodes: filterOptionsFor(allRows, activeFilters, "moduleCode", project).moduleCodes,
    moduleNames: filterOptionsFor(allRows, activeFilters, "moduleName", project).moduleNames,
    tutors: filterOptionsFor(allRows, activeFilters, "tutor", project).tutors,
    studentGroups: filterOptionsFor(allRows, activeFilters, "studentGroup", project).studentGroups,
    activityTypes: filterOptionsFor(allRows, activeFilters, "activityType", project).activityTypes,
  };

  const context = describeFilterContext(allRows, activeFilters, project);
  const seminarNotice = moduleSeminarNotice(allRows, activeFilters, project);
  const narrowedRows = context.count
    ? allRows.filter((r) => {
        if (!activeFilters.moduleCode) return true;
        return String(r["Module code"]).trim().toLowerCase() === String(activeFilters.moduleCode).trim().toLowerCase();
      })
    : allRows;

  const moduleOptions = opts.moduleCodes
    .map((m) => {
      const name = narrowedRows.find((r) => String(r["Module code"]).trim() === m)?.["Module name"] || "";
      return `<option value="${esc(m)}">${esc(m)}${name ? ` – ${esc(name)}` : ""}</option>`;
    })
    .join("");

  const moduleNameOptions = opts.moduleNames.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
  const groupOptions = opts.studentGroups.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join("");

  const statusOptions = PLAN_STATUSES.map((s) => `<option value="${esc(s)}">${esc(displayStatus(s))}</option>`).join("");

  return `
    <h3>Filters</h3>
    <label>Campus
      <select id="filter-campus"><option value="">All campuses</option>
        ${opts.campuses.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}
      </select>
    </label>
    <label>Weekday
      <select id="filter-weekday"><option value="">All days</option>
        ${opts.weekdays.map((d) => `<option value="${d}">${d}</option>`).join("")}
      </select>
    </label>
    <label>Module code
      <select id="filter-moduleCode"><option value="">All modules</option>${moduleOptions}</select>
    </label>
    <label>Module name
      <select id="filter-moduleName"><option value="">All names</option>${moduleNameOptions}</select>
    </label>
    <label>Tutor
      <select id="filter-tutor"><option value="">All tutors</option>
        ${opts.tutors.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("")}
      </select>
    </label>
    <label>Student group
      <select id="filter-studentGroup"><option value="">All groups</option>${groupOptions}</select>
    </label>
    <label>Activity type
      <select id="filter-activityType">
        <option value="">All types</option>
        ${opts.activityTypes.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}
      </select>
    </label>
    <label>Class test status
      <select id="filter-status"><option value="">All statuses</option>${statusOptions}</select>
    </label>
    <label class="filter-check"><input type="checkbox" id="filter-invigilatorMissing"> Needs invigilator only</label>
    <label class="filter-check"><input type="checkbox" id="filter-conflictOnly"> Possible issues only</label>
    <label>Search
      <input type="search" id="filter-search" placeholder="Search…">
    </label>
    <button type="button" class="btn btn-small btn-muted" id="filter-reset">Clear filters</button>
    <p class="filter-context muted">${esc(context.hint)}</p>
    ${seminarNotice ? `<p class="filter-context filter-note">${esc(seminarNotice)}</p>` : ""}
    <div class="legend">
      <span><i class="dot lec"></i> Lecture</span>
      <span><i class="dot sem"></i> Seminar</span>
      <span><i class="dot planned"></i> Class test planned</span>
    </div>`;
}

export function readFiltersFromDom() {
  return {
    campus: document.getElementById("filter-campus")?.value || "",
    weekday: document.getElementById("filter-weekday")?.value || "",
    moduleCode: document.getElementById("filter-moduleCode")?.value || "",
    moduleName: document.getElementById("filter-moduleName")?.value || "",
    tutor: document.getElementById("filter-tutor")?.value || "",
    studentGroup: document.getElementById("filter-studentGroup")?.value || "",
    activityType: document.getElementById("filter-activityType")?.value || "",
    status: document.getElementById("filter-status")?.value || "",
    invigilatorMissing: document.getElementById("filter-invigilatorMissing")?.checked || false,
    conflictOnly: document.getElementById("filter-conflictOnly")?.checked || false,
    search: document.getElementById("filter-search")?.value.toLowerCase() || "",
  };
}

export function applyFiltersToDom(filters) {
  const map = [
    ["filter-campus", "campus"],
    ["filter-weekday", "weekday"],
    ["filter-moduleCode", "moduleCode"],
    ["filter-moduleName", "moduleName"],
    ["filter-tutor", "tutor"],
    ["filter-studentGroup", "studentGroup"],
    ["filter-activityType", "activityType"],
    ["filter-status", "status"],
  ];
  for (const [id, key] of map) {
    const el = document.getElementById(id);
    if (el && filters[key] != null) el.value = filters[key];
  }
  const inv = document.getElementById("filter-invigilatorMissing");
  if (inv) inv.checked = Boolean(filters.invigilatorMissing);
  const conf = document.getElementById("filter-conflictOnly");
  if (conf) conf.checked = Boolean(filters.conflictOnly);
  const search = document.getElementById("filter-search");
  if (search && filters.search != null) search.value = filters.search;
}

export function bindFilterEvents(onChange, onReset) {
  [
    "filter-campus", "filter-weekday", "filter-moduleCode", "filter-moduleName",
    "filter-tutor", "filter-studentGroup", "filter-activityType", "filter-status", "filter-search",
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", onChange);
    document.getElementById(id)?.addEventListener("change", onChange);
  });
  ["filter-invigilatorMissing", "filter-conflictOnly"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", onChange);
  });
  document.getElementById("filter-reset")?.addEventListener("click", onReset);
}
