/** Excel loader — xlsx-js-style for styled exports; SheetJS ESM as read fallback. */

const STYLED_URL = new URL("../../vendor/xlsx-js-style/xlsx.min.js", import.meta.url).href;
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

function pickStyledLib() {
  const lib = globalThis.XLSX;
  if (lib?.utils && lib?.style_version) return lib;
  return null;
}

function loadStyledScript() {
  const existing = pickStyledLib();
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = STYLED_URL;
    script.onload = () => {
      const lib = pickStyledLib();
      if (lib) resolve(lib);
      else reject(new Error("Styled Excel library loaded without XLSX global"));
    };
    script.onerror = () => reject(new Error("Styled Excel library failed to load"));
    document.head.appendChild(script);
  });
}

export async function initXlsx() {
  if (ready && XLSX) return XLSX;

  if (typeof document !== "undefined") {
    try {
      const styled = pickStyledLib() || (await loadStyledScript());
      XLSX = styled;
      ready = true;
      usedSource = "styled";
      return XLSX;
    } catch {
      /* fall through to SheetJS */
    }
  }

  const sources = [
    { label: "cdn", url: CDN_URL },
    { label: "local", url: LOCAL_URL },
  ];

  let lastError = null;
  for (const source of sources) {
    try {
      const mod = await import(/* @vite-ignore */ source.url);
      XLSX = mod.default ?? mod;
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
