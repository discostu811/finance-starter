// CANARY: finance-starter v0.1b2 (amazon-suppress)
// lib/amazon.ts — Amazon detection/matching + suppression toggle

import * as XLSX from "xlsx";
import dayjs from "dayjs";

export type AmazonDetail = {
  sheet: string; rowIndex: number;
  detailDate?: string; amount?: number; raw: Record<string, any>;
};
export type AmazonParent = {
  source: "amex" | "mc";
  postedDate: string;   // YYYY-MM-DD
  amount: number;       // positive expense for matching
  merchant: string;
  raw: Record<string, any>;
};

export const AMAZON_PATTERNS: RegExp[] = [
  /\bamazon\b/i,
  /\bamzn\b/i,
  /amznmktplace/i,
  /amazon eu/i,
  /amzn digital/i,
  /amazon prime/i,
  /amzn prime/i,
];

export function looksAmazon(merchant?: string): boolean {
  if (!merchant) return false;
  return AMAZON_PATTERNS.some(rx => rx.test(merchant.trim()));
}

// ---------- A1 helpers ----------
function a1(ws: XLSX.WorkSheet): any[][] {
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true, header: 1 }) as any[][];
}
function findHeaderIdx(grid: any[][]): number {
  const needles = ["date","order date","transaction date","posted","description","amount","total","grand total"];
  for (let i = 0; i < Math.min(500, grid.length); i++) {
    const row = grid[i] ?? [];
    const txt = row.map((c:any)=>String(c ?? "").toLowerCase());
    if (txt.filter(t => t !== "").length < 3) continue;
    if (needles.some(n => txt.some(t => t.includes(n)))) return i;
  }
  return -1;
}
function mapRowsByHeader(ws: XLSX.WorkSheet): Record<string, any>[] {
  const grid = a1(ws);
  if (!grid.length) return [];
  const idx = findHeaderIdx(grid);
  if (idx < 0) return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  const hdr = (grid[idx] ?? []).map((h:any,i:number) => {
    const s = h == null ? "" : String(h).trim();
    return s === "" ? `col_${i}` : s;
  });
  const body = grid.slice(idx + 1);
  return body.map((r:any[]) => Object.fromEntries(hdr.map((k,i)=>[k, r[i] ?? null])));
}

// ---------- normalizers ----------
function pickKey(row: Record<string,any>, wants: string[]): string | undefined {
  const keys = Object.keys(row || {});
  const lower = keys.map(k => k.toLowerCase().trim());
  for (const w of wants) { const i = lower.indexOf(w.toLowerCase()); if (i >= 0) return keys[i]; }
  for (const w of wants) { const i = lower.findIndex(k => k.includes(w.toLowerCase())); if (i >= 0) return keys[i]; }
  return undefined;
}
function normalizeDateAny(v:any): string | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") {
    const ms = Math.round(v * 86400000);
    const base = Date.UTC(1899, 11, 30);
    return dayjs(base + ms).format("YYYY-MM-DD");
  }
  const t = String(v).trim();
  const fmts = ["YYYY-MM-DD","DD/MM/YYYY","MM/DD/YYYY","D/M/YYYY","M/D/YYYY","YYYY/M/D","DD.MM.YYYY","D.M.YYYY","YYYY.MM.DD"];
  for (const f of fmts) { const d = dayjs(t, f, true); if (d.isValid()) return d.format("YYYY-MM-DD"); }
  const d = dayjs(t); return d.isValid() ? d.format("YYYY-MM-DD") : undefined;
}
function toAmount(v:any): number | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") return Math.abs(v);
  const n = Number(String(v).replace(/[£$, ]/g, ""));
  return Number.isFinite(n) ? Math.abs(n) : undefined;
}

// ---------- extract Amazon detail from workbook (given year) ----------
export function extractAmazonDetailFromWorkbook(wb: XLSX.WorkBook, year: number): AmazonDetail[] {
  const out: AmazonDetail[] = [];
  for (const name of wb.SheetNames) {
    const n = name.toLowerCase();
    if (!(n.includes("amazon") || n.includes("amzn"))) continue;
    if (!n.includes(String(year))) continue; // limit to that year
    const ws = wb.Sheets[name];
    const rows = mapRowsByHeader(ws);
    if (!rows.length) continue;

    const kd = pickKey(rows[0], ["Order Date","Date","Transaction Date","Payment Date"]);
    const ka = pickKey(rows[0], ["Grand Total","Order Total","Total","Amount","GBP","Item Total","Total Charged"]);

    rows.forEach((r, i) => {
      const detailDate = normalizeDateAny(kd ? r[kd] : undefined);
      const amount = toAmount(ka ? r[ka] : undefined);
      if (!amount) return;
      out.push({ sheet: name, rowIndex: i + 1, detailDate, amount, raw: r });
    });
  }
  return out;
}

// ---------- matching ----------
export function matchAmazonParentsToDetail(
  parents: AmazonParent[],
  details: AmazonDetail[]
) {
  const byAmt = new Map<string, AmazonDetail[]>();
  const key = (x:number)=> (Math.round(x*100)/100).toFixed(2);

  for (const d of details) {
    if (d.amount == null) continue;
    const k = key(d.amount);
    const arr = byAmt.get(k) || [];
    arr.push(d);
    byAmt.set(k, arr);
  }

  const matched: Array<{parent: AmazonParent, detail: AmazonDetail}> = [];
  const unmatchedParents: AmazonParent[] = [];
  const used = new Set<AmazonDetail>();

  for (const p of parents) {
    const k = key(p.amount);
    const cands = byAmt.get(k) || [];
    const pd = dayjs(p.postedDate);
    let best: AmazonDetail | undefined;

    for (const d of cands) {
      if (used.has(d)) continue;
      if (!d.detailDate) { best = d; break; }
      const dd = dayjs(d.detailDate);
      const diff = Math.abs(dd.diff(pd, "day"));
      if (diff <= 5) { best = d; break; }
    }

    if (best) { matched.push({ parent: p, detail: best }); used.add(best); }
    else unmatchedParents.push(p);
  }

  const unmatchedDetails = details.filter(d => !used.has(d));
  return { matched, unmatchedParents, unmatchedDetails };
}

// ---------- suppression ----------
export function suppressMatchedAmazonParents(
  parents: AmazonParent[],
  details: AmazonDetail[]
): { kept: AmazonParent[], suppressed: AmazonParent[] } {
  const { matched } = matchAmazonParentsToDetail(parents, details);
  const suppressed = matched.map(m => m.parent);
  const set = new Set(suppressed);
  const kept = parents.filter(p => !set.has(p));
  return { kept, suppressed };
}
