import { EXCEL_READER_ERROR_MSG } from "../excel/xlsx.js";

export function renderExcelReaderError() {
  return `<div class="alert alert-error" role="alert">
    <strong>Excel reader could not load</strong>
    <p>${EXCEL_READER_ERROR_MSG}</p>
    <p class="muted">You can still try the <strong>sample timetable</strong> to explore the dashboard. To upload your own files, use the offline version (see README) or check your internet connection.</p>
  </div>`;
}
