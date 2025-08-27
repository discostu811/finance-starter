// version: finance-v0.1b3-patch3
// date: 2025-08-27 17:23 Europe/London
// changelog: harden Detail reader; relax year filter; add logging

import xlsx from 'xlsx';

function is2024(v:any): boolean {
  if (v === 2024) return true;
  if (typeof v === 'number') return v === 2024;
  if (typeof v === 'string') return v.trim() === '2024';
  return false;
}

// Heuristics:
// - Find the first row that contains 'Month' (case-insensitive) -> header row.
// - Categories are all non-empty headers except Year/Month/Total expenses.
// - Month column = the column whose header equals 'Month' (fallback to first column with month-like numbers beneath).
// - Data rows: continuous block below header where Month is 1..12. If a 'Year' column exists, prefer rows with 2024; otherwise accept all until months stop being 1..12.
export function readDetail2024(wb: xlsx.WorkBook) {
  const ws = wb.Sheets['Detail'];
  if (!ws) throw new Error('Detail sheet not found');
  const rows = xlsx.utils.sheet_to_json<any>(ws, {defval:null, raw:true, header:1});

  // Header row
  let headerIdx = rows.findIndex((r:any[]) => Array.isArray(r) && r.some(v => (v??'').toString().toLowerCase().includes('month')));
  if (headerIdx < 0) headerIdx = 0;
  const header = rows[headerIdx] as any[];

  // Month column
  let monthCol = header.findIndex(v => (v??'').toString().trim().toLowerCase() === 'month');
  if (monthCol < 0) {
    // fallback: find a column where the next few values look like 1..12
    for (let c=0;c<header.length;c++) {
      let ok=0;
      for (let r=headerIdx+1; r<Math.min(rows.length, headerIdx+8); r++) {
        const mv = Number(rows[r]?.[c]);
        if (Number.isFinite(mv) && mv>=1 && mv<=12) ok++;
      }
      if (ok>=3) { monthCol=c; break; }
    }
    if (monthCol < 0) monthCol = 1;
  }

  // Possible Year column(s): any header that includes 'year' or any leading columns frequently equal 2024
  const yearCols:number[] = [];
  for (let c=0;c<header.length;c++) {
    const name = (header[c]??'').toString().trim().toLowerCase();
    if (name === 'year' || name.includes('year')) yearCols.push(c);
  }
  if (yearCols.length===0) {
    for (let c=0;c<Math.min(3, header.length); c++) {
      let hits=0, scans=0;
      for (let r=headerIdx+1; r<Math.min(rows.length, headerIdx+20); r++) {
        const v = rows[r]?.[c];
        if (v==null) continue;
        scans++;
        if (is2024(v)) hits++;
      }
      if (hits>=3) yearCols.push(c);
    }
  }

  // Categories
  const categories:string[] = [];
  for (let i=0;i<header.length;i++) {
    const v = (header[i]??'').toString().trim();
    if (v && v!=='Year' && v!=='Month' && v!=='Total expenses') categories.push(v);
  }

  // Collect rows until months stop being 1..12
  const data:any[] = [];
  for (let r=headerIdx+1; r<rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const m = Number(row[monthCol]);
    if (!Number.isFinite(m) || m<1 || m>12) {
      // stop if we've already started collecting and month no longer valid
      if (data.length>0) break;
      else continue;
    }
    // If we have year columns, enforce 2024; else accept
    if (yearCols.length>0) {
      let any2024 = false;
      for (const yc of yearCols) if (is2024(row[yc])) { any2024 = true; break; }
      if (!any2024) continue;
    }
    const out:any = {Month: m};
    for (let i=0;i<header.length;i++) {
      const name = (header[i]??'').toString().trim();
      if (!name || name==='Year' || name==='Month' || name==='Total expenses') continue;
      out[name] = Number(row[i]??0) || 0;
    }
    out['Grand Total'] = Object.keys(out).filter(k=>k!=='Month').reduce((a,k)=>a+(Number(out[k])||0),0);
    data.push(out);
  }

  data.sort((a,b)=>a.Month-b.Month);
  return {categories, rows: data};
}
