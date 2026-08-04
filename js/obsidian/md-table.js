/**
 * Markdown table helpers for Academic Operations OS exports.
 * Contract: replace table data rows only; preserve headings, prose, DataviewJS, notes.
 */

/** Escape a cell for a Markdown pipe table. */
export function escapeMdCell(value) {
  let s = value == null ? "" : String(value);
  s = s.replace(/\r\n|\r|\n/g, "<br>");
  s = s.replace(/\|/g, "\\|");
  return s.trim();
}

export function formatIsoDate(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10))) return s.slice(0, 10);
  return s;
}

export function splitMdLines(text) {
  return String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

export function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

export function isTableRow(line) {
  const t = String(line ?? "").trim();
  return t.startsWith("|") && t.includes("|", 1);
}

export function parseTableRow(line) {
  let s = String(line ?? "").trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  const cells = [];
  let cur = "";
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      cur += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === "|") {
      cells.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

export function formatTableRow(cells) {
  return `| ${cells.map(escapeMdCell).join(" | ")} |`;
}

export function formatSeparator(columnCount) {
  return `| ${Array.from({ length: columnCount }, () => "---").join(" | ")} |`;
}

/**
 * Find Markdown tables in a document.
 * @returns {Array<{ start: number, end: number, header: string[], separatorIndex: number, dataStart: number }>}
 */
export function findMarkdownTables(lines) {
  const tables = [];
  let i = 0;
  while (i < lines.length) {
    if (!isTableRow(lines[i])) {
      i += 1;
      continue;
    }
    const header = parseTableRow(lines[i]);
    if (i + 1 >= lines.length || !isTableSeparator(lines[i + 1])) {
      i += 1;
      continue;
    }
    let end = i + 2;
    while (end < lines.length && isTableRow(lines[end]) && !isTableSeparator(lines[end])) {
      end += 1;
    }
    tables.push({
      start: i,
      end,
      header,
      separatorIndex: i + 1,
      dataStart: i + 2,
    });
    i = end;
  }
  return tables;
}

function normalizeHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function headersMatch(actual, expected) {
  if (!actual?.length || actual.length !== expected.length) return false;
  return expected.every((h, idx) => normalizeHeader(actual[idx]) === normalizeHeader(h));
}

/**
 * Replace data rows of the first table whose header matches expectedHeaders.
 * Validates each data row has the same cell count as the header.
 */
export function replaceMatchingTableRows(markdown, expectedHeaders, dataRows) {
  const lines = splitMdLines(markdown);
  const tables = findMarkdownTables(lines);
  const target = tables.find((t) => headersMatch(t.header, expectedHeaders));
  if (!target) {
    return {
      ok: false,
      markdown,
      error: `No Markdown table found with headers: ${expectedHeaders.join(" | ")}`,
      rowsWritten: 0,
      skippedRows: 0,
      warnings: [],
    };
  }

  const colCount = expectedHeaders.length;
  const warnings = [];
  const validRows = [];
  let skippedRows = 0;

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    if (!Array.isArray(row) || row.length !== colCount) {
      skippedRows += 1;
      warnings.push(`Skipped row ${r + 1}: expected ${colCount} cells, got ${row?.length ?? 0}.`);
      continue;
    }
    validRows.push(formatTableRow(row));
  }

  const next = [
    ...lines.slice(0, target.dataStart),
    ...validRows,
    ...lines.slice(target.end),
  ];

  return {
    ok: true,
    markdown: next.join("\n"),
    rowsWritten: validRows.length,
    skippedRows,
    warnings,
    error: null,
  };
}

export function stampForBackup(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}-${hh}${mm}${ss}`;
}

export const AOS_GENERATED_START = "<!-- AOS:GENERATED:START -->";
export const AOS_GENERATED_END = "<!-- AOS:GENERATED:END -->";

/** Build a Markdown pipe table (header + separator + data rows). */
export function formatMarkdownTable(headers, dataRows) {
  const lines = [formatTableRow(headers), formatSeparator(headers.length)];
  for (const row of dataRows) {
    if (!Array.isArray(row) || row.length !== headers.length) continue;
    lines.push(formatTableRow(row));
  }
  return lines.join("\n");
}

/**
 * Replace content between AOS generated markers.
 * If markers are missing, append a new generated block at the end.
 * Preserves all text outside the markers.
 */
export function replaceGeneratedSection(markdown, generatedBody, { title = "" } = {}) {
  const start = AOS_GENERATED_START;
  const end = AOS_GENERATED_END;
  const body = String(generatedBody ?? "").replace(/^\n+|\n+$/g, "");
  const block = `${start}\n${body}\n${end}`;
  const text = String(markdown ?? "");
  const startIdx = text.indexOf(start);
  const endIdx = text.indexOf(end);

  if (startIdx >= 0 && endIdx > startIdx) {
    const afterEnd = endIdx + end.length;
    return {
      ok: true,
      markdown: text.slice(0, startIdx) + block + text.slice(afterEnd),
      created: false,
      preservedManual: true,
    };
  }

  const base = text.trim()
    ? text.replace(/\s*$/, "\n\n") + block + "\n"
    : (title ? `# ${title}\n\n` : "") + block + "\n";

  return {
    ok: true,
    markdown: base,
    created: !String(markdown ?? "").trim(),
    preservedManual: Boolean(text.trim()),
  };
}

/** Create a new document with title + generated markers. */
export function createMarkedDocument(title, generatedBody) {
  const body = String(generatedBody ?? "").replace(/^\n+|\n+$/g, "");
  return `# ${title}\n\n${AOS_GENERATED_START}\n${body}\n${AOS_GENERATED_END}\n`;
}
