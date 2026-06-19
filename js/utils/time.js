import { TIME_SLOTS } from "../config/constants.js";

export function timeToMinutes(time) {
  if (!time) return 0;
  const parts = String(time).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!parts) return 0;
  return Number(parts[1]) * 60 + Number(parts[2]);
}

export function slotIndex(time) {
  const mins = timeToMinutes(time);
  let best = 0;
  for (let i = 0; i < TIME_SLOTS.length; i++) {
    if (timeToMinutes(TIME_SLOTS[i]) <= mins) best = i;
  }
  return best;
}

export function timesOverlap(start1, end1, start2, end2) {
  if (!start1 || !end1 || !start2 || !end2) return false;
  return timeToMinutes(start1) < timeToMinutes(end2) && timeToMinutes(start2) < timeToMinutes(end1);
}

export function parseDuration(value) {
  const str = String(value || "");
  const match = str.match(/(\d{1,2}:\d{2})\s*[–\-]\s*(\d{1,2}:\d{2})/);
  if (match) return { start: padTime(match[1]), end: padTime(match[2]) };
  return null;
}

function padTime(t) {
  const [h, m] = t.split(":");
  return `${String(h).padStart(2, "0")}:${m}`;
}

export function isValidTime(time) {
  return /^\d{1,2}:\d{2}$/.test(String(time || "").trim());
}

export function addMinutes(time, minutes) {
  const total = timeToMinutes(time) + Number(minutes || 0);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function getTestSlot(session, plan) {
  return {
    weekday: session.Weekday,
    start: plan.testStartTime || session["Start time"],
    end: plan.testEndTime || session["End time"],
    testWeek: plan.testWeek || "",
    testDate: plan.testDate || "",
  };
}

export function formatTimeRange(start, end) {
  return `${start} – ${end}`;
}

export function formatExcelTime(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const match = value.match(/(\d{1,2}:\d{2})/);
    return match ? match[1].padStart(5, "0").replace(/^(\d):/, "0$1:") : value.trim();
  }
  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  if (typeof value === "number") {
    if (value >= 0 && value < 1) {
      const totalMinutes = Math.round(value * 24 * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    if (value > 40000) {
      const utcDays = Math.floor(value - 25569);
      return formatExcelTime(new Date(utcDays * 86400 * 1000));
    }
  }
  return String(value);
}
