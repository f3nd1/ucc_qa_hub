type Kind = "csv" | "json" | "sql";

const MIME: Record<Kind, string> = {
  csv: "text/csv",
  json: "application/json",
  sql: "text/plain",
};

/** Trigger a browser download of generated file text (client-only). */
export function download(filename: string, text: string, kind: Kind): void {
  // Prepend a BOM for CSV so Excel reads UTF-8 correctly.
  const body = kind === "csv" ? "﻿" + text : text;
  const blob = new Blob([body], { type: MIME[kind] + ";charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
