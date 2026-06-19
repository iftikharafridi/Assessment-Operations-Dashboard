import { esc } from "../utils/dom.js";

export function card({ title, subtitle = "", body = "", className = "", borderColor = "" }) {
  const style = borderColor ? ` style="border-top: 3px solid ${borderColor}"` : "";
  return `<article class="card ${className}"${style}>
    ${title ? `<h3 class="card-title">${esc(title)}</h3>` : ""}
    ${subtitle ? `<p class="card-subtitle">${subtitle}</p>` : ""}
    <div class="card-body">${body}</div>
  </article>`;
}

export function rosterGrid(entries, campusColorFn) {
  return `<div class="roster-grid">${entries
    .map(
      ([campus, staff]) =>
        card({
          title: campus,
          borderColor: campusColorFn(campus),
          body: `<ul>${staff.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`,
        })
    )
    .join("")}</div>`;
}
