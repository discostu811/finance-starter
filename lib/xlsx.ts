// version: v0.1b1
// date: 2025-08-25 08:51 Europe/London
// changelog: slice: fix Amex 2024 date parsing
import * as XLSX from "xlsx";
import { readFileSync } from "fs";

export function loadWorkbook(path: string) {
  // Use fs + XLSX.read so it works in ESM and CJS
  const buf = readFileSync(path);
  return XLSX.read(buf, { type: "buffer", raw: true });
}

// Excel date serial -> "YYYY-MM-DD"
export function excelSerialToIso(serial: any): string {
  if (serial == null) return "";
  if (typeof serial === "string") {
    const d = new Date(serial);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return "";
  }
  if (typeof serial !== "number") return "";
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const d = new Date(epoch.getTime() + serial * 86400000);
  return d.toISOString().slice(0, 10);
}

export { XLSX };
