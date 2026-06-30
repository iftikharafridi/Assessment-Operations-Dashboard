import { esc } from "../utils/dom.js";

/**
 * @typedef {{ label: string, sortKey?: string }} TableHeaderDef
 * @typedef {{ key: string, dir: 'asc'|'desc' }} TableSortState
 */

function normalizeHeader(header) {
  return typeof header === "string" ? { label: header } : header;
}

function renderHeaderCell(header, sort) {
  const { label, sortKey } = normalizeHeader(header);
  if (!sortKey) return `<th>${esc(label)}</th>`;

  const active = sort?.key === sortKey;
  const icon = active ? (sort.dir === "asc" ? "▲" : "▼") : "⇅";
  const ariaSort = active ? (sort.dir === "asc" ? "ascending" : "descending") : "none";

  return `<th class="th-sortable" aria-sort="${ariaSort}">
    <button type="button" class="sort-header-btn" data-sort-key="${esc(sortKey)}">
      <span class="sort-header-label">${esc(label)}</span>
      <span class="sort-icon" aria-hidden="true">${icon}</span>
    </button>
  </th>`;
}

export function dataTable({ headers, rowsHtml, className = "data-table", sort = null }) {
  return `<table class="${className}${sort ? " data-table-sortable" : ""}">
    <thead><tr>${headers.map((h) => renderHeaderCell(h, sort)).join("")}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>`;
}

/** @param {(sortKey: string) => void} onSort */
export function bindTableSort(container, onSort) {
  container.querySelectorAll(".sort-header-btn").forEach((btn) => {
    btn.addEventListener("click", () => onSort(btn.dataset.sortKey));
  });
}

export function toggleSortKey(current, sortKey) {
  if (current?.key === sortKey) {
    return { key: sortKey, dir: current.dir === "asc" ? "desc" : "asc" };
  }
  return { key: sortKey, dir: "asc" };
}

export function statsBar(items) {
  return `<div class="stats-bar">${items.map((i) => `<span>${esc(i)}</span>`).join("")}</div>`;
}

export function intro(text) {
  return `<p class="intro">${text}</p>`;
}
