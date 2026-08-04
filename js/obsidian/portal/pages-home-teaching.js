import { renderPortalNavHtml, renderPortalNavBottomHtml, portalSharedDvJs } from "./shared-dv.js";

function wrapPage(activeId, title, bodyHtml, dvScript) {
  return [
    renderPortalNavHtml(activeId),
    `<div class="aos-header"><h1>${title}</h1></div>`,
    bodyHtml,
    "```dataviewjs",
    portalSharedDvJs(),
    dvScript,
    "```",
    renderPortalNavBottomHtml(activeId),
  ].join("\n\n");
}

export function buildTeachingCentrePage() {
  const views = [
    { id: "dayTimeGrid", label: "Day/Time Grid" },
    { id: "allSessions", label: "All Sessions" },
  ];

  const body = `
<p class="aos-muted">Teaching timetable — Day/Time Grid shows each session across its full start–end slot. Use filters for campus, module, staff, or cohort.</p>
<p class="aos-muted"><strong>Reading view + Dataview required.</strong></p>
`.trim();

  const script = `
await AOS.loadCss();
AOS.mountShell(\`<div id="aos-toolbar"></div><div class="aos-filters" id="aos-filters"></div><div id="aos-view"></div>\`);
const views = ${JSON.stringify(views)};
let active = "dayTimeGrid";
let filterCampus = "";
let filterCohort = "";
let filterModule = "";
let filterStaff = "";
let search = "";
const WEEKDAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const CAMPUS_COLORS = {"London RAV":"#2563eb","London IH":"#7c3aed","Birmingham LRH":"#059669"};

function campusColor(campus) {
  return CAMPUS_COLORS[campus] || "#64748b";
}

function timeToMinutes(time) {
  if (!time) return 0;
  const parts = String(time).trim().match(/^(\\d{1,2}):(\\d{2})/);
  if (!parts) return 0;
  return Number(parts[1]) * 60 + Number(parts[2]);
}

function minutesToTime(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

function floorToSlot(mins) { return Math.floor(mins / 30) * 30; }
function ceilToSlot(mins) { return Math.ceil(mins / 30) * 30; }

const tt = await AOS.loadTable("_Data/Teaching Timetable.md");

function rows() {
  if (!tt.ok) return [];
  return tt.rows.filter(r => {
    if (filterCampus && r.Campus !== filterCampus) return false;
    if (filterModule && r["Module code"] !== filterModule) return false;
    if (filterStaff && !String(r.Staff||"").includes(filterStaff)) return false;
    if (filterCohort && !String(r["Student groups"]||"").toLowerCase().includes(filterCohort.toLowerCase())) return false;
    if (search) {
      const hay = [r["Module code"], r["Module name"], r.Activity, r.Staff, r["Student groups"]].join(" ").toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });
}

function renderFilters() {
  const all = tt.ok ? tt.rows : [];
  const campuses = AOS.unique(all.map(r => r.Campus));
  const mods = AOS.unique(all.map(r => r["Module code"]));
  const staff = AOS.unique(all.flatMap(r => String(r.Staff||"").split(/[,;/]/).map(s=>s.trim()).filter(Boolean)));
  const filtersEl = AOS.el("aos-filters");
  filtersEl.innerHTML = \`
    <select id="f-campus"><option value="">All campuses</option>\${campuses.map(c=>\`<option \${c===filterCampus?"selected":""}>\${AOS.esc(c)}</option>\`).join("")}</select>
    <select id="f-module"><option value="">All modules</option>\${mods.map(c=>\`<option \${c===filterModule?"selected":""}>\${AOS.esc(c)}</option>\`).join("")}</select>
    <select id="f-staff"><option value="">All staff</option>\${staff.map(c=>\`<option \${c===filterStaff?"selected":""}>\${AOS.esc(c)}</option>\`).join("")}</select>
    <input id="f-cohort" placeholder="Cohort / group contains…" value="\${AOS.esc(filterCohort)}" />
    <input id="f-search" placeholder="Search…" value="\${AOS.esc(search)}" />
  \`;
  filtersEl.querySelector("#f-campus").onchange = e => { filterCampus = e.target.value; render(); };
  filtersEl.querySelector("#f-module").onchange = e => { filterModule = e.target.value; render(); };
  filtersEl.querySelector("#f-staff").onchange = e => { filterStaff = e.target.value; render(); };
  filtersEl.querySelector("#f-cohort").oninput = e => { filterCohort = e.target.value; render(); };
  filtersEl.querySelector("#f-search").oninput = e => { search = e.target.value; render(); };
}

function assignLanes(dayItems) {
  const sorted = dayItems.map(r => ({
    r,
    startMinutes: timeToMinutes(r["Start time"]),
    endMinutes: timeToMinutes(r["End time"]) || timeToMinutes(r["Start time"]) + 60,
  })).sort((a, b) =>
    a.startMinutes - b.startMinutes ||
    a.endMinutes - b.endMinutes ||
    String(a.r["Module code"]||"").localeCompare(String(b.r["Module code"]||""))
  );
  const laneEnds = [];
  for (const event of sorted) {
    let lane = laneEnds.findIndex(end => event.startMinutes >= end);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(event.endMinutes);
    } else {
      laneEnds[lane] = event.endMinutes;
    }
    event.lane = lane;
  }
  return { events: sorted, laneCount: Math.max(laneEnds.length, 1) };
}

/** Timed grid: hours across the top; each session spans its full start–end width. */
function renderGrid(list) {
  const timed = list.filter(r => r["Start time"]);
  if (!timed.length) return '<div class="aos-empty">No sessions match the current filters</div>';

  const SLOT = 30;
  let calStart = 9 * 60;
  let calEnd = 18 * 60;
  const earliest = Math.min(...timed.map(r => timeToMinutes(r["Start time"])));
  const latest = Math.max(...timed.map(r => timeToMinutes(r["End time"]) || timeToMinutes(r["Start time"]) + 60));
  calStart = Math.min(calStart, floorToSlot(earliest));
  calEnd = Math.max(calEnd, ceilToSlot(latest));
  const totalMins = Math.max(calEnd - calStart, SLOT);
  const slotWidth = 56;
  const calendarWidth = (totalMins / SLOT) * slotWidth;
  const labelWidth = 100;

  let timeHeader = "";
  for (let t = calStart; t <= calEnd; t += SLOT) {
    const pct = ((t - calStart) / totalMins) * 100;
    const hour = t % 60 === 0;
    timeHeader += \`<div class="aos-cal-gridline\${hour ? " is-hour" : ""}" style="left:\${pct}%"></div>\`;
    if (t < calEnd && hour) {
      timeHeader += \`<div class="aos-cal-timelabel" style="left:\${pct}%">\${minutesToTime(t)}</div>\`;
    }
  }

  const legendKeys = AOS.unique(timed.map(r => r.Campus).filter(Boolean));
  const legend = legendKeys.length
    ? \`<div class="aos-cal-legend">\${legendKeys.map(c =>
        \`<span class="aos-cal-legend-item" style="--aos-chip:\${campusColor(c)}"><i></i>\${AOS.esc(c)}</span>\`
      ).join("")}</div>\`
    : "";

  const activeDays = WEEKDAYS.filter(d => timed.some(r => r.Weekday === d));
  const days = activeDays.length ? activeDays : WEEKDAYS.slice(0, 5);

  const dayRows = days.map(day => {
    const dayItems = timed.filter(r => r.Weekday === day);
    const { events, laneCount } = assignLanes(dayItems);
    const laneHeight = 54;
    const rowHeight = Math.max(64, laneCount * laneHeight + 12);

    let grid = "";
    for (let t = calStart; t <= calEnd; t += SLOT) {
      const pct = ((t - calStart) / totalMins) * 100;
      grid += \`<div class="aos-cal-gridline\${t % 60 === 0 ? " is-hour" : ""}" style="left:\${pct}%"></div>\`;
    }

    let blocks = "";
    if (!events.length) {
      blocks = \`<div class="aos-empty">No sessions</div>\`;
    }
    for (const event of events) {
      const r = event.r;
      const start = Math.max(event.startMinutes, calStart);
      const end = Math.min(event.endMinutes, calEnd);
      const left = ((start - calStart) / totalMins) * 100;
      const width = Math.max(((end - start) / totalMins) * 100, 4);
      const top = 6 + event.lane * laneHeight;
      const colour = campusColor(r.Campus);
      const tip = [r["Module code"], r["Module name"], r["Class type"], (r["Start time"]||"") + "–" + (r["End time"]||""), r.Campus, r.Staff, r["Student groups"]].filter(Boolean).join(" · ");
      blocks += \`<div class="aos-cal-event aos-cal-event-timed aos-teach-block" title="\${AOS.esc(tip)}" style="--aos-chip:\${colour};top:\${top}px;left:calc(\${left}% + 2px);width:calc(\${width}% - 4px);height:46px">
        <div class="aos-cal-event-top"><strong>\${AOS.esc(r["Module code"] || "")}</strong>
          <span>\${AOS.esc(r["Class type"] || "")}</span></div>
        <div class="aos-cal-event-meta">\${AOS.esc(r["Module name"] || "")}</div>
        <div class="aos-cal-event-meta">\${AOS.esc(r["Start time"])}–\${AOS.esc(r["End time"])} · \${AOS.esc(r.Campus || "")}</div>
      </div>\`;
    }

    const isToday = day === AOS.todayName();
    return \`<div class="aos-cal-timed-day\${isToday?" is-today":""}" style="--aos-row-h:\${rowHeight}px;--aos-cal-w:\${calendarWidth}px;--aos-label-w:\${labelWidth}px">
      <div class="aos-cal-day-label"><strong>\${day}</strong>
        \${isToday ? '<span class="aos-chip aos-chip-today">Today</span>' : ""}
        <em>\${dayItems.length ? dayItems.length + " session" + (dayItems.length === 1 ? "" : "s") : ""}</em>
      </div>
      <div class="aos-cal-timed-track">\${grid}\${blocks}</div>
    </div>\`;
  }).join("");

  return legend
    + \`<div class="aos-cal-timed-scroll">
      <div class="aos-cal-timed-inner" style="--aos-cal-w:\${calendarWidth}px;--aos-label-w:\${labelWidth}px;min-width:\${labelWidth + calendarWidth}px">
        <div class="aos-cal-timed-top">
          <div class="aos-cal-corner">Day</div>
          <div class="aos-cal-times">\${timeHeader}</div>
        </div>
        \${dayRows}
      </div>
    </div>\`
    + \`<p class="aos-muted aos-hint">Blocks span the full session duration (e.g. 09:30–11:30). Colours are by campus. Scroll horizontally if needed.</p>\`;
}

function renderAll(list) {
  const sorted = list.slice().sort((a, b) =>
    WEEKDAYS.indexOf(a.Weekday) - WEEKDAYS.indexOf(b.Weekday) ||
    String(a["Start time"]||"").localeCompare(String(b["Start time"]||"")) ||
    String(a["Module code"]||"").localeCompare(String(b["Module code"]||""))
  );
  return \`<div class="aos-table-wrap"><table class="aos-table aos-teach-table"><thead><tr>
  <th>Day</th><th>Time</th><th>Module</th><th>Type</th><th>Campus</th><th>Staff</th><th>Groups</th>
  </tr></thead><tbody>
  \${sorted.map(r => {
    const colour = campusColor(r.Campus);
    return \`<tr>
    <td>\${AOS.esc(r.Weekday)}</td>
    <td class="aos-nowrap">\${AOS.esc(r["Start time"])}–\${AOS.esc(r["End time"])}</td>
    <td><span class="aos-mod-badge" style="--aos-chip:\${colour}">\${AOS.esc(r["Module code"])}</span>
      <br><span class="aos-muted">\${AOS.esc(r["Module name"])}</span></td>
    <td>\${AOS.esc(r["Class type"])}</td>
    <td><span class="aos-campus-badge" style="--aos-chip:\${colour}">\${AOS.esc(r.Campus)}</span></td>
    <td>\${AOS.esc(r.Staff)}</td>
    <td>\${AOS.esc(r["Student groups"])}</td>
  </tr>\`;
  }).join("") || '<tr><td colspan="7">No sessions</td></tr>'}
  </tbody></table></div>\`;
}

function render() {
  const toolbarEl = AOS.el("aos-toolbar");
  toolbarEl.innerHTML = AOS.toolbar(views, active);
  toolbarEl.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => { active = btn.dataset.view; render(); };
  });
  renderFilters();
  const host = AOS.el("aos-view");
  if (!tt.ok) { host.innerHTML = AOS.missing(tt.error); return; }
  const list = rows();
  host.innerHTML = active === "allSessions" ? renderAll(list) : renderGrid(list);
}
render();
`;

  return wrapPage("teaching", "Teaching Centre", body, script);
}
