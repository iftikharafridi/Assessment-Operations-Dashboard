import { XLSX } from "./xlsx.js";

/** Apply readable widths, frozen header row, and auto-filter to exported sheets. */
export function styleWorksheet(sheet) {
  if (!sheet || !sheet["!ref"]) return sheet;

  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const colCount = range.e.c - range.s.c + 1;
  sheet["!cols"] = Array.from({ length: colCount }, (_, c) => {
    let max = 10;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      const len = cell?.v != null ? String(cell.v).length : 0;
      max = Math.max(max, Math.min(len + 2, 48));
    }
    return { wch: max };
  });

  sheet["!autofilter"] = { ref: sheet["!ref"] };
  sheet["!views"] = [{ state: "frozen", ySplit: 1, topLeftCell: "A2", activeCell: "A2" }];
  return sheet;
}

export function appendStyledSheet(wb, rows, sheetName, header) {
  const sheet = XLSX.utils.json_to_sheet(rows, header ? { header } : undefined);
  styleWorksheet(sheet);
  XLSX.utils.book_append_sheet(wb, sheet, sheetName.slice(0, 31));
}

export function formatExportTimestamp() {
  return new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
