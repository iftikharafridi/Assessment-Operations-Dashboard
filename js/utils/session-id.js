/** Stable session identity for plan matching across save/reopen cycles. */

export function buildSessionKey(row) {
  return [
    row.Campus,
    row["Module code"],
    row.Activity || "",
    row.Type || "",
    row.Weekday,
    row["Start time"],
    row["End time"],
    row.Room || "",
    row.Staff,
    row["Student Groups"] || "",
  ]
    .map((v) => String(v ?? "").trim().toLowerCase())
    .join("|");
}

export function stableSessionId(row) {
  const key = buildSessionKey(row);
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 33) ^ key.charCodeAt(i);
  }
  return `sess-${(hash >>> 0).toString(36)}`;
}

export function assignSessionIds(rows) {
  return rows.map((row) => ({
    ...row,
    sessionId: row.sessionId || stableSessionId(row),
  }));
}

export function sessionKey(row) {
  return row.sessionId || stableSessionId(row);
}
