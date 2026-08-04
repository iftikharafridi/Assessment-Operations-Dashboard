import { PORTAL_NAV_LINKS } from "./paths.js";

export function renderPortalNavHtml(activeId) {
  const links = PORTAL_NAV_LINKS.map((l) => {
    const cls = l.id === activeId ? "aos-nav-active" : "";
    return `<a class="${cls}" href="${l.path}">${l.label}</a>`;
  }).join("\n");
  return `<div class="aos-nav" id="aos-top">\n${links}\n</div>`;
}

export function renderPortalNavBottomHtml(activeId) {
  const links = PORTAL_NAV_LINKS.map((l) => {
    const cls = l.id === activeId ? "aos-nav-active" : "";
    return `<a class="${cls}" href="${l.path}">${l.label}</a>`;
  }).join("\n");
  return `<div class="aos-nav aos-nav-bottom">\n${links}\n</div>\n<a class="aos-back-top" href="#aos-top">Back to top</a>`;
}

/** Shared DataviewJS helpers embedded in each portal page. */
export function portalSharedDvJs() {
  return `
const AOS = {
  esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  },
  async loadCss() {
    try {
      const css = await dv.io.load("_Assets/academic-operations-os.css");
      if (!css) return;
      const style = document.createElement("style");
      style.textContent = css;
      dv.container.appendChild(style);
    } catch (e) {
      console.warn("AOS CSS missing", e);
    }
  },
  parseMdTable(text) {
    if (!text) return { headers: [], rows: [] };
    const lines = String(text).replace(/\\r\\n/g, "\\n").split("\\n");
    let header = null;
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.startsWith("|")) continue;
      const cells = AOS.splitRow(line);
      if (!header) {
        const next = (lines[i + 1] || "").trim();
        if (/^\\|?\\s*:?-{3,}/.test(next)) {
          header = cells;
          i += 1;
          continue;
        }
        continue;
      }
      if (/^\\|?\\s*:?-{3,}/.test(line)) continue;
      if (cells.length === header.length) rows.push(Object.fromEntries(header.map((h, idx) => [h, cells[idx] ?? ""])));
    }
    return { headers: header || [], rows };
  },
  splitRow(line) {
    let s = line.trim();
    if (s.startsWith("|")) s = s.slice(1);
    if (s.endsWith("|")) s = s.slice(0, -1);
    const cells = [];
    let cur = "";
    let esc = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (esc) { cur += ch; esc = false; continue; }
      if (ch === "\\\\") { esc = true; continue; }
      if (ch === "|") { cells.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  },
  async loadTable(path) {
    try {
      const text = await dv.io.load(path);
      if (!text) return { ok: false, error: "File is empty: " + path, headers: [], rows: [] };
      const parsed = AOS.parseMdTable(text);
      if (!parsed.headers.length) return { ok: false, error: "No Markdown table found in " + path, headers: [], rows: [] };
      return { ok: true, ...parsed };
    } catch (e) {
      return { ok: false, error: "Missing source file: " + path, headers: [], rows: [] };
    }
  },
  missing(msg) {
    return \`<div class="aos-empty">\${AOS.esc(msg)}</div>\`;
  },
  /** Prefer elements already in the note; otherwise create them inside the Dataview block. */
  el(id) {
    let node = document.getElementById(id);
    if (node) return node;
    node = document.createElement("div");
    node.id = id;
    dv.container.appendChild(node);
    return node;
  },
  mountShell(html) {
    const wrap = document.createElement("div");
    wrap.className = "aos-shell";
    wrap.innerHTML = html;
    dv.container.appendChild(wrap);
    return wrap;
  },
  toolbar(views, active) {
    return \`<div class="aos-toolbar">\${views.map(v =>
      \`<button type="button" data-view="\${AOS.esc(v.id)}" class="\${v.id === active ? "aos-active" : ""}">\${AOS.esc(v.label)}</button>\`
    ).join("")}</div>\`;
  },
  unique(arr) {
    return [...new Set(arr.filter(Boolean))].sort();
  },
  todayName() {
    return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];
  },
  isoToday() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  },
  mondayOf(date = new Date()) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  },
  addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  },
  fmtDate(d) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }
};
`;
}
