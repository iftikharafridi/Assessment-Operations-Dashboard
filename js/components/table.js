import { esc } from "../utils/dom.js";

export function dataTable({ headers, rowsHtml, className = "data-table" }) {
  return `<table class="${className}">
    <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>`;
}

export function statsBar(items) {
  return `<div class="stats-bar">${items.map((i) => `<span>${esc(i)}</span>`).join("")}</div>`;
}

export function intro(text) {
  return `<p class="intro">${text}</p>`;
}
