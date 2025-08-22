// lib/xlsx.ts
// Patch5: Excel parser with header-row detection

import * as XLSX from "xlsx";

export function loadWorkbook(path: string) {
  return XLSX.readFile(path, { cellDates: true });
}

export function extractSheet(sheet: XLSX.Sheet) {
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

  let headerRowIndex = rows.findIndex(
    (row) => Array.isArray(row) && row.some((cell) => String(cell || "").toLowerCase() === "date")
  );
  if (headerRowIndex === -1) headerRowIndex = 0;

  const headers = rows[headerRowIndex].map((h, i) => h || `col_${i}`);
  const data = rows.slice(headerRowIndex + 1).map((r) => {
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => (obj[h] = r[i] ?? null));
    return obj;
  });

  return { headers, data, headerRowIndex };
}
