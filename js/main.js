import { initXlsx, isExcelReaderReady } from "./excel/xlsx.js";
import { initApp } from "./app.js";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initXlsx();
  } catch {
    /* initApp shows friendly message */
  }
  initApp({ excelReaderReady: isExcelReaderReady() });
});
