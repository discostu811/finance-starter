// version: v0.1b1
// date: 2025-08-25 08:50 Europe/London
// changelog: slice: fix Amex 2024 date parsing
// scripts/debug-reheader.ts
import { loadWorkbook, extractSheet } from "../lib/xlsx";
import * as XLSX from "xlsx";

const file = process.argv[2];
const wb = loadWorkbook(file);
const sheet = wb.Sheets["2024 amex"];
if (!sheet) {
  console.error("No sheet named '2024 amex' found");
  process.exit(1);
}

const { headers, data, headerRowIndex } = extractSheet(sheet);

console.log("HeaderRowIndex=", headerRowIndex);
console.log("HeaderRowValues=", headers);
console.log("NextRowValues=", data[0]);
