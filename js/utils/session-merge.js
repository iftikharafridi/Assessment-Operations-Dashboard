import { timeToMinutes } from "./time.js";

function sessionType(row) {
  return String(row.Type || row["Class type"] || "").trim();
}

function mergeKey(row) {
  return [
    String(row["Module code"] || "").trim().toLowerCase(),
    String(row.Campus || "").trim().toLowerCase(),
    String(row.Staff || "").trim().toLowerCase(),
    String(row.Weekday || "").trim().toLowerCase(),
    sessionType(row).toLowerCase(),
  ].join("|");
}

function gapMinutes(a, b) {
  return timeToMinutes(b["Start time"]) - timeToMinutes(a["End time"]);
}

function finalizeMerged(row) {
  if ((row.mergedFrom || 1) <= 1) {
    const { mergedFrom, ...rest } = row;
    return rest;
  }
  return row;
}

/**
 * Merge consecutive same-tutor sessions separated by a short break (≤ maxGapMinutes).
 * Match key: Module code, Campus, Staff, Weekday, Class type.
 * Result keeps Activity/groups from the first row; sets mergedFrom when two or more blocks join.
 *
 * @param {object[]} rows
 * @param {{ maxGapMinutes?: number }} [opts]
 * @returns {object[]}
 */
export function mergeSplitSessions(rows, { maxGapMinutes = 30 } = {}) {
  if (!Array.isArray(rows) || !rows.length) return [];
  if (rows.length === 1) return [{ ...rows[0] }];

  /** @type {Map<string, object[]>} */
  const groups = new Map();
  for (const row of rows) {
    const key = mergeKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const out = [];
  for (const list of groups.values()) {
    const sorted = list.slice().sort((a, b) => {
      const sa = timeToMinutes(a["Start time"]);
      const sb = timeToMinutes(b["Start time"]);
      if (sa !== sb) return sa - sb;
      return timeToMinutes(a["End time"]) - timeToMinutes(b["End time"]);
    });

    let current = null;
    for (const row of sorted) {
      if (!current) {
        current = { ...row, mergedFrom: 1 };
        continue;
      }
      const gap = gapMinutes(current, row);
      if (gap >= 0 && gap <= maxGapMinutes) {
        current = {
          ...current,
          "End time": row["End time"],
          mergedFrom: (current.mergedFrom || 1) + 1,
        };
      } else {
        out.push(finalizeMerged(current));
        current = { ...row, mergedFrom: 1 };
      }
    }
    if (current) out.push(finalizeMerged(current));
  }

  return out;
}
