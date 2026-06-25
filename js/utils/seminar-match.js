/** Match seminar rows to saved plan / schedule rows. */
export function seminarLookupKey(module, campus, weekday, startTime) {
  const start = String(startTime ?? "").match(/(\d{1,2}:\d{2})/)?.[1] || String(startTime ?? "").trim();
  return [module, campus, weekday, start]
    .map((s) => String(s ?? "").trim().toLowerCase())
    .join("|");
}
