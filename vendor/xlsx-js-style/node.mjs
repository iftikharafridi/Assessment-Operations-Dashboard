/** Node ESM bridge for the xlsx-js-style UMD bundle (styled Excel read/write). */
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const require = createRequire(import.meta.url);
const XLSX = require(path.join(path.dirname(fileURLToPath(import.meta.url)), "xlsx.min.js"));

export { XLSX };
export default XLSX;
