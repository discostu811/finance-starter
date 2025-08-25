// version: v0.1b1
// date: 2025-08-25 08:51 Europe/London
// changelog: slice: fix Amex 2024 date parsing
// scripts/try-amex.ts
import { loadWorkbook, extractSheet } from "../lib/xlsx";
import * as XLSX from "xlsx";

const file = process.argv[2];
const wb = loadWorkbook(file);
const sheet = wb.Sheets["2024 amex"];
if (!sheet) {
  console.error("No sheet named '2024 amex'");
  process.exit(1);
}
const { headers, data } = extractSheet(sheet);
console.log("Detected headers:", headers);
console.log("First 3 rows:", data.slice(0, 3));
