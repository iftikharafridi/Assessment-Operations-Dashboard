/** SheetJS loader — tries CDN first, then local vendor copy for offline use. */

const CDN_URL = "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
const LOCAL_URL = new URL("../../vendor/xlsx/xlsx.mjs", import.meta.url).href;

export let XLSX = null;

let ready = false;
let usedSource = null;

export const EXCEL_READER_ERROR_MSG =
  "Excel reader could not load. Please check internet connection or use the offline version.";

export function isExcelReaderReady() {
  return ready && XLSX != null;
}

export function getExcelReaderSource() {
  return usedSource;
}

export async function initXlsx() {
  if (ready && XLSX) return XLSX;

  const sources = [
    { label: "cdn", url: CDN_URL },
    { label: "local", url: LOCAL_URL },
  ];

  let lastError = null;
  for (const source of sources) {
    try {
      const mod = await import(/* @vite-ignore */ source.url);
      XLSX = mod;
      ready = true;
      usedSource = source.label;
      return XLSX;
    } catch (err) {
      lastError = err;
    }
  }

  ready = false;
  XLSX = null;
  usedSource = null;
  throw lastError || new Error(EXCEL_READER_ERROR_MSG);
}
