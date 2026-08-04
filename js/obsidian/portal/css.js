/** Shared CSS for the Academic Operations OS semester portal. */

export const PORTAL_CSS = `/* Academic Operations OS — Semester Portal
 * Theme tokens follow Obsidian (body.theme-dark / theme-light).
 * Do not resolve --background-* on :root — Obsidian sets those on body.
 */
body,
.theme-dark,
.theme-light {
  color-scheme: light dark;
  --aos-accent: var(--interactive-accent);
  --aos-bg: var(--background-primary);
  --aos-bg2: var(--background-secondary);
  --aos-bg-mod: var(--background-modifier-hover, var(--background-secondary));
  --aos-text: var(--text-normal);
  --aos-muted: var(--text-muted);
  --aos-border: var(--background-modifier-border);
  --aos-warn: var(--text-warning);
  --aos-danger: var(--text-error);
  --aos-ok: var(--text-success);
  --aos-on-accent: var(--text-on-accent, #fff);
  --aos-radius: 10px;
  --aos-shadow: 0 1px 2px color-mix(in srgb, var(--aos-text) 8%, transparent);
}

.aos-shell,
.aos-nav,
.aos-week-row,
.aos-cal-day-grid,
.aos-table,
.aos-card,
.aos-kpi,
.aos-sched-chip {
  color: var(--aos-text);
}

.aos-nav {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0.55rem 0.35rem;
  margin: 0 0 1rem;
  background: var(--aos-bg2);
  border-bottom: 1px solid var(--aos-border);
}

.aos-nav a {
  display: inline-block;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--aos-border);
  text-decoration: none !important;
  color: var(--aos-text) !important;
  font-size: 0.85rem;
  font-weight: 600;
  background: var(--aos-bg);
}

.aos-nav a.aos-nav-active,
.aos-nav a:hover {
  border-color: var(--aos-accent);
  background: color-mix(in srgb, var(--aos-accent) 16%, var(--aos-bg));
  color: var(--aos-accent) !important;
}

.aos-nav-bottom {
  position: static;
  margin-top: 1.5rem;
  border-top: 1px solid var(--aos-border);
  border-bottom: none;
}

.aos-back-top {
  display: inline-block;
  margin: 0.75rem 0;
  font-size: 0.85rem;
}

.aos-header {
  display: grid;
  gap: 0.35rem;
  margin-bottom: 1rem;
}

.aos-header h1 {
  margin: 0;
  font-size: 1.55rem;
}

.aos-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  color: var(--aos-muted);
  font-size: 0.88rem;
}

.aos-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
  gap: 0.55rem;
  margin: 0.85rem 0 1.1rem;
}

.aos-kpi {
  background: var(--aos-bg2);
  border: 1px solid var(--aos-border);
  border-radius: var(--aos-radius);
  padding: 0.65rem 0.7rem;
  box-shadow: var(--aos-shadow);
}

.aos-kpi strong {
  display: block;
  font-size: 1.2rem;
  line-height: 1.1;
}

.aos-kpi span {
  color: var(--aos-muted);
  font-size: 0.75rem;
}

.aos-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0.75rem 0;
}

.aos-toolbar button,
.aos-filters select,
.aos-filters input {
  font: inherit;
  font-size: 0.82rem;
  padding: 0.35rem 0.65rem;
  border-radius: 8px;
  border: 1px solid var(--aos-border);
  background: var(--aos-bg);
  color: var(--aos-text);
  cursor: pointer;
}

.aos-toolbar button.aos-active {
  background: color-mix(in srgb, var(--aos-accent) 18%, var(--aos-bg));
  border-color: var(--aos-accent);
  color: var(--aos-accent);
  font-weight: 700;
}

.aos-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
}

.aos-grid {
  display: grid;
  gap: 0.75rem;
}

.aos-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.65rem;
}

.aos-card {
  border: 1px solid var(--aos-border);
  border-radius: var(--aos-radius);
  background: var(--aos-bg2);
  padding: 0.75rem;
  box-shadow: var(--aos-shadow);
}

.aos-card h3,
.aos-card h4 {
  margin: 0 0 0.35rem;
  font-size: 0.98rem;
}

.aos-card button {
  margin-top: 0.45rem;
}

.aos-muted { color: var(--aos-muted); }
.aos-warn { color: var(--aos-warn); }
.aos-danger { color: var(--aos-danger); }
.aos-ok { color: var(--aos-ok); }

.aos-chip {
  display: inline-block;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  border: 1px solid var(--aos-border);
  font-size: 0.72rem;
  margin: 0.1rem 0.15rem 0.1rem 0;
  background: var(--aos-bg);
}

.aos-chip-wc { border-color: #3b82f6; color: #1d4ed8; }
.aos-chip-fixed { border-color: #16a34a; color: #15803d; }
.aos-chip-mixed { border-color: #d97706; color: #b45309; }
.aos-chip-today { border-color: var(--aos-accent); background: color-mix(in srgb, var(--aos-accent) 16%, var(--aos-bg)); }

.aos-day-col { margin-bottom: 0.85rem; }
.aos-day-col.aos-today { outline: 2px solid color-mix(in srgb, var(--aos-accent) 55%, transparent); border-radius: 8px; padding: 0.35rem; }

.aos-session {
  border-left: 3px solid var(--aos-accent);
  padding: 0.35rem 0.55rem;
  margin: 0.3rem 0;
  background: var(--aos-bg);
  border-radius: 0 8px 8px 0;
}

.aos-table-wrap { overflow-x: auto; }
.aos-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}
.aos-table th, .aos-table td {
  border: 1px solid var(--aos-border);
  padding: 0.35rem 0.45rem;
  text-align: left;
  vertical-align: top;
}
.aos-table th { background: var(--aos-bg2); }

.aos-grid-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.72rem;
  table-layout: fixed;
}
.aos-grid-table th, .aos-grid-table td {
  border: 1px solid var(--aos-border);
  padding: 0.15rem;
  min-height: 2rem;
  vertical-align: top;
}
.aos-grid-block {
  background: color-mix(in srgb, var(--aos-accent) 18%, var(--aos-bg));
  border-radius: 4px;
  padding: 0.15rem 0.25rem;
  margin: 0.1rem 0;
  font-size: 0.68rem;
  line-height: 1.2;
}

.aos-actions a {
  display: block;
  padding: 0.85rem 1rem;
  margin: 0.4rem 0;
  border-radius: var(--aos-radius);
  border: 1px solid var(--aos-border);
  text-decoration: none !important;
  color: var(--aos-text) !important;
  background: var(--aos-bg2);
  font-weight: 700;
}
.aos-actions a:hover {
  border-color: var(--aos-accent);
  background: color-mix(in srgb, var(--aos-accent) 12%, var(--aos-bg));
}

.aos-section { margin: 1.1rem 0; }
.aos-section h2 { margin: 0 0 0.5rem; font-size: 1.15rem; }
.aos-empty { color: var(--aos-muted); font-style: italic; padding: 0.5rem 0; }

.aos-subtoolbar { margin-top: 0.25rem; }
.aos-hide-empty {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: var(--aos-muted);
}
.aos-hide-empty.is-hidden { display: none !important; }

.aos-week-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin: 0.5rem 0 0.75rem;
}
.aos-week-pill {
  padding: 0.28rem 0.55rem;
  border-radius: 999px;
  border: 1px solid var(--aos-border);
  background: var(--aos-bg);
  color: var(--aos-text);
  font-size: 0.8rem;
  font-weight: 650;
  cursor: pointer;
}
.aos-week-pill.has-items {
  border-color: color-mix(in srgb, var(--aos-accent) 55%, var(--aos-border));
  background: color-mix(in srgb, var(--aos-accent) 10%, var(--aos-bg));
  font-weight: 700;
}
.aos-week-pill.is-current {
  background: var(--aos-accent);
  color: var(--aos-on-accent);
  border-color: var(--aos-accent);
  font-weight: 750;
}

.aos-week-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  margin: 0.5rem 0 0.75rem;
  padding: 0.5rem;
  border: 1px solid var(--aos-border);
  border-radius: 8px;
  background: var(--aos-bg2);
}
.aos-week-nav select { min-width: 160px; font: inherit; font-size: 0.8rem; }

.aos-week-row {
  display: grid;
  grid-template-columns: minmax(100px, 120px) minmax(0, 1fr);
  margin-bottom: 0.4rem;
  overflow: hidden;
  border: 1px solid var(--aos-border);
  border-radius: 8px;
  background: var(--aos-bg);
}
.aos-week-row.is-current { border: 2px solid var(--aos-accent); }
.aos-week-side {
  padding: 0.55rem;
  background: var(--aos-bg2);
}
.aos-week-row.is-current .aos-week-side {
  background: var(--aos-accent);
  color: #fff;
}
.aos-week-title { font-size: 0.95rem; font-weight: 800; color: inherit; }
.aos-week-count { margin-top: 0.15rem; font-size: 0.75rem; color: inherit; }
.aos-week-main { min-width: 0; padding: 0.35rem 0.45rem; }

.aos-mod-line {
  display: grid;
  grid-template-columns: minmax(72px, 92px) minmax(0, 1fr);
  gap: 0.35rem;
  align-items: start;
  padding: 0.28rem 0;
  border-bottom: 1px dashed color-mix(in srgb, var(--aos-border) 85%, transparent);
}
.aos-mod-line:last-child { border-bottom: none; }
.aos-mod-line-label {
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.01em;
  color: var(--aos-chip, var(--aos-accent));
  padding-top: 0.42rem;
  line-height: 1.2;
}
.aos-mod-line-label strong {
  display: block;
  color: var(--aos-chip, var(--aos-accent));
}
.aos-mod-line-name {
  display: block;
  margin-top: 0.12rem;
  color: var(--aos-muted);
  font-size: 0.68rem;
  font-weight: 550;
  line-height: 1.25;
}
.aos-sched-name {
  font-size: 0.72rem;
  color: var(--aos-muted);
  max-width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.aos-nowrap { white-space: nowrap; }
.aos-cal-timed-day.is-today {
  background: color-mix(in srgb, var(--aos-accent) 6%, var(--aos-bg));
}
.aos-teach-table td { vertical-align: top; }
.aos-teach-block .aos-cal-event-meta {
  color: var(--aos-text);
}
.aos-mod-badge,
.aos-campus-badge {
  display: inline-block;
  padding: 0.12rem 0.4rem;
  border-radius: 4px;
  border-left: 3px solid var(--aos-chip, var(--aos-accent));
  background: color-mix(in srgb, var(--aos-chip, var(--aos-accent)) 14%, var(--aos-bg));
  font-weight: 800;
  font-size: 0.8rem;
  color: var(--aos-text);
}
.aos-sched-group {
  padding: 0.05rem 0.35rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--aos-chip, var(--aos-accent)) 20%, var(--aos-bg));
  color: var(--aos-text);
  font-size: 0.68rem;
  font-weight: 750;
  white-space: nowrap;
}

.aos-sched-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  min-width: 0;
}
.aos-sched-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  max-width: 100%;
  margin: 0.05rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid color-mix(in srgb, var(--aos-chip, var(--aos-accent)) 40%, var(--aos-border));
  border-left: 3px solid var(--aos-chip, var(--aos-accent));
  border-radius: 6px;
  background: var(--aos-bg);
  color: var(--aos-text);
  font-size: 0.82rem;
  line-height: 1.25;
  -webkit-font-smoothing: antialiased;
}
.aos-sched-mod { font-weight: 800; white-space: nowrap; color: var(--aos-text); }
.aos-sched-code {
  padding: 0.05rem 0.3rem;
  border-radius: 999px;
  background: var(--aos-chip, var(--aos-accent));
  color: var(--aos-on-accent);
  font-size: 0.68rem;
  font-weight: 750;
  white-space: nowrap;
}
.aos-sched-fmt,
.aos-sched-time,
.aos-sched-tutor {
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
  color: var(--aos-text);
}
.aos-sched-tutor { color: var(--aos-muted); }

.aos-cal-header { margin: 0.35rem 0 0.55rem; }
.aos-cal-all-day {
  margin-bottom: 0.55rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--aos-border);
  border-radius: 8px;
  background: var(--aos-bg2);
  font-size: 0.78rem;
}
.aos-cal-day-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--aos-border);
  border-radius: 8px;
  background: var(--aos-bg);
  overflow: hidden;
  padding: 0;
}
.aos-cal-board .aos-cal-day-row,
.aos-cal-day-track-row {
  display: grid;
  grid-template-columns: minmax(95px, 120px) minmax(0, 1fr);
  gap: 0;
  align-items: stretch;
  border-bottom: 1px solid var(--aos-border);
  min-height: 4.2rem;
  padding: 0;
}
.aos-cal-day-row:last-child { border-bottom: none; }
.aos-cal-day-label {
  color: var(--aos-muted);
  font-size: 0.78rem;
  padding: 0.55rem 0.65rem;
  background: var(--aos-bg2);
  border-right: 1px solid var(--aos-border);
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.aos-cal-day-track {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.45rem 0.55rem;
  min-width: 0;
}
.aos-cal-event {
  border: 1px solid color-mix(in srgb, var(--aos-chip, var(--aos-accent)) 45%, var(--aos-border));
  border-left: 4px solid var(--aos-chip, var(--aos-accent));
  border-radius: 6px;
  background: color-mix(in srgb, var(--aos-chip, var(--aos-accent)) 12%, var(--aos-bg));
  padding: 0.35rem 0.5rem;
  color: var(--aos-text);
}
.aos-cal-event-top {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
}
.aos-cal-event-top strong { font-weight: 800; }
.aos-cal-event-top span {
  padding: 0.05rem 0.3rem;
  border-radius: 999px;
  background: var(--aos-chip, var(--aos-accent));
  color: var(--aos-on-accent, #fff);
  font-size: 0.65rem;
  font-weight: 750;
}
.aos-cal-event-meta {
  margin-top: 0.12rem;
  font-size: 0.72rem;
  color: var(--aos-text);
}
.aos-cal-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.7rem;
  margin: 0.35rem 0 0.55rem;
}
.aos-cal-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  font-weight: 650;
  color: var(--aos-text);
}
.aos-cal-legend-item i {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 2px;
  background: var(--aos-chip, var(--aos-accent));
  display: inline-block;
}
.aos-hint { font-size: 0.78rem; margin-top: 0.55rem; }
.aos-cal-timed-scroll {
  overflow-x: auto;
  border: 1px solid var(--aos-border);
  border-radius: 8px;
  background: var(--aos-bg);
}
.aos-cal-timed-inner {
  display: flex;
  flex-direction: column;
}
.aos-cal-timed-top {
  display: grid;
  grid-template-columns: var(--aos-label-w, 105px) var(--aos-cal-w, 800px);
  position: sticky;
  top: 0;
  z-index: 5;
  border-bottom: 1px solid var(--aos-border);
  background: var(--aos-bg2);
}
.aos-cal-corner {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  border-right: 1px solid var(--aos-border);
  color: var(--aos-muted);
  font-size: 0.7rem;
  font-weight: 700;
}
.aos-cal-times { position: relative; height: 40px; }
.aos-cal-gridline {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1px solid color-mix(in srgb, var(--aos-border) 50%, transparent);
  pointer-events: none;
}
.aos-cal-gridline.is-hour { border-left-color: var(--aos-border); }
.aos-cal-timelabel {
  position: absolute;
  top: 7px;
  transform: translateX(5px);
  color: var(--aos-muted);
  font-size: 0.65rem;
  font-weight: 700;
  white-space: nowrap;
}
.aos-cal-timed-day {
  display: grid;
  grid-template-columns: var(--aos-label-w, 105px) var(--aos-cal-w, 800px);
  min-height: var(--aos-row-h, 72px);
  border-bottom: 1px solid var(--aos-border);
}
.aos-cal-timed-day:last-child { border-bottom: none; }
.aos-cal-timed-track {
  position: relative;
  min-height: var(--aos-row-h, 72px);
}
.aos-cal-day-allday {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0.25rem 0.35rem;
  position: relative;
  z-index: 2;
}
.aos-cal-event-timed {
  position: absolute;
  box-sizing: border-box;
  overflow: hidden;
  z-index: 2;
  min-width: 72px;
}
.aos-cal-timed-day .aos-cal-day-label em {
  margin-top: 0.1rem;
  color: var(--aos-muted);
  font-size: 0.65rem;
  font-style: normal;
  font-weight: 500;
}
.aos-callout {
  margin: 0.5rem 0 0.85rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--aos-border);
  border-left: 4px solid var(--aos-accent);
  border-radius: 8px;
  background: var(--aos-bg2);
  color: var(--aos-text);
  font-size: 0.86rem;
}
.aos-callout strong { color: var(--aos-text); }
.aos-callout.aos-callout-warn { border-left-color: var(--aos-warn); }
`;
