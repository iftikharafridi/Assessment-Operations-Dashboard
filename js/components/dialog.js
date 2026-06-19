import { esc } from "../utils/dom.js";

let dialogEl = null;

export function ensureDialog() {
  if (dialogEl) return dialogEl;
  dialogEl = document.createElement("dialog");
  dialogEl.className = "app-dialog";
  dialogEl.innerHTML = `
    <form method="dialog" class="dialog-inner">
      <h3 class="dialog-title"></h3>
      <div class="dialog-body"></div>
      <div class="dialog-actions">
        <button value="close" class="btn">Close</button>
      </div>
    </form>`;
  document.body.appendChild(dialogEl);
  return dialogEl;
}

export function showDialog({ title, bodyHtml }) {
  const dialog = ensureDialog();
  dialog.querySelector(".dialog-title").textContent = title;
  dialog.querySelector(".dialog-body").innerHTML = bodyHtml;
  dialog.showModal();
}

export function showSessionDialog(row, groups) {
  showDialog({
    title: `${row["Module code"]} – ${row["Module name"]}`,
    bodyHtml: `
      <dl class="dialog-dl">
        <dt>Type</dt><dd>${esc(row.Type)}</dd>
        <dt>When</dt><dd>${esc(row.Weekday)} ${esc(row["Start time"])}–${esc(row["End time"])}</dd>
        <dt>Campus</dt><dd>${esc(row.Campus)}</dd>
        <dt>Tutor</dt><dd>${esc(row.Staff)}</dd>
        <dt>Groups</dt><dd>${esc(groups.letterGroups.join(" & ") || "—")}</dd>
        <dt>Admission groups</dt><dd>${esc(groups.admissionGroups.join(", ") || "—")}</dd>
        <dt>Class size</dt><dd>${esc(row.Size)}</dd>
        <dt>Activity</dt><dd>${esc(row.Activity)}</dd>
      </dl>`,
  });
}

export function confirmAction(message) {
  return window.confirm(message);
}
