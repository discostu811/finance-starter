/*
version: finance-v0.1b3
date: 2025-08-27 16:30 Europe/London
changelog: fix boolean literals (False/True -> false/true)
*/

import * as fs from "fs";
import * as path from "path";
import * as xlsx from "xlsx";

export type RawRow = Record<string, any>;

export function pickColumns(rows: RawRow[], cols: string[]): RawRow[] {
  // Keep only rows with a valid numeric Month between 1..12
  return rows.filter(r => {
    const m = Number(r["Month"] ?? r["MONTH"] ?? r["month"]);
    if (!(m!=null && m>=1 && m<=12)) return false as any;
    return true as any;
  }).map(r => {
    const obj: RawRow = {};
    for (const c of cols) obj[c] = r[c];
    return obj;
  });
}
