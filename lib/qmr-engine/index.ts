/* Public surface of the ported QMR engine. Framework-agnostic: no React,
   no DOM, no direct persistence. Callers pass a Db value and receive a new
   Db plus an outcome. */

export * from "./types";
export * from "./util";
export {
  DB_KEY,
  emptyDb,
  normalizeDb,
  getS,
  activeCycle,
  records,
  recordOrder,
  activityKey,
} from "./db";
export * from "./criteria";
export * from "./pattern";
export * from "./checks";
export * from "./prompts";
export * from "./ai";
export * from "./review";
export * from "./edit";
export * from "./cycles";
export * from "./csv";
export * from "./io";
export * from "./demo";
export * from "./migration";
export { EXTRACT_SUPPORTED, extractText } from "./extract";
export {
  erpConfig,
  erpConfigured,
  apiList as erpApiList,
  apiGet as erpApiGet,
  addErpDocs,
  fetchErpRecords,
  writeBackRecords,
} from "./erpnext";
export type { ErpConfig, WriteBackResult } from "./erpnext";
