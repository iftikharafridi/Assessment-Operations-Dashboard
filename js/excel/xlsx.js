/** Excel loader — xlsx-js-style for styled exports; SheetJS ESM as read fallback. */

const STYLED_URL = new URL("../../vendor/xlsx-js-style/xlsx.min.js", import.meta.url).href;
const CDN_URL = "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
const LOCAL_URL = new URL("../../vendor/xlsx/xlsx.mjs", import.meta.url).href;

/** @type {typeof import('xlsx') | null} */
export let XLSX = null;

/** Styled library used for coloured exports — never the plain SheetJS fallback. */
let writeXlsx = null;

let ready = false;
let usedSource = null;

export const EXCEL_READER_ERROR_MSG =
  "Excel reader could not load. Please check internet connection or use the offline version.";

export const EXCEL_STYLE_ERROR_MSG =
  "Styled Excel export could not load. Hard-refresh the page (Ctrl+F5) and try again.";

export function isExcelReaderReady() {
  return ready && XLSX != null;
}

export function isStyledExcelReady() {
  return Boolean(writeXlsx?.style_version);
}

export function getExcelReaderSource() {
  return usedSource;
}

/** Returns the styled XLSX build required for coloured exports. */
export function getWriteXlsx() {
  return writeXlsx;
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

async function loadPlainLib() {
  const sources = [
    { label: "cdn", url: CDN_URL },
    { label: "local", url: LOCAL_URL },
  ];

  let lastError = null;
  for (const source of sources) {
    try {
      const mod = await import(/* @vite-ignore */ source.url);
      return { lib: mod.default ?? mod, label: source.label };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error(EXCEL_READER_ERROR_MSG);
}

function bindStyledLib(lib) {
  XLSX = lib;
  writeXlsx = lib;
  ready = true;
  usedSource = "styled";
  return lib;
}

export async function initXlsx() {
  if (ready && XLSX) return XLSX;

  if (typeof document !== "undefined") {
    try {
      const styled = pickStyledLib() || (await loadStyledScript());
      return bindStyledLib(styled);
    } catch {
      /* fall through — read-only fallback below */
    }
  }

  const { lib, label } = await loadPlainLib();
  XLSX = lib;
  writeXlsx = pickStyledLib();
  ready = true;
  usedSource = writeXlsx ? "styled" : label;
  return XLSX;
}
