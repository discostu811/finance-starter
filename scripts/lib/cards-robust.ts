// version: v0.1b1
// date: 2025-08-25 08:50 Europe/London
// changelog: slice: fix Amex 2024 date parsing
import { utils } from "xlsx";

export function toAoa(sh: any): any[][] {
  if (!sh) return [];
  const aoa = utils.sheet_to_json(sh, { header: 1, raw: true }) as any[][];
  return (aoa || []).filter(r => (r ?? []).some(c => c !== null && c !== undefined && String(c).trim() !== ""));
}

function normHeader(s: any): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[^\p{L}\p{N} £$%]/gu, "");
}

function findColIdx(headerRow: any[], candidates: RegExp[]): number {
  const map = headerRow.map(h => normHeader(h));
  for (let i = 0; i < map.length; i++) for (const rx of candidates) if (rx.test(map[i])) return i;
  return -1;
}

const CATEGORY_COL_CANDIDATES = [/^category$/, /^cat$/];
const AMOUNT_COL_CANDIDATES = [/^(converted ?[£$]|converted ?gbp|gbp ?converted)$/, /^amount( ?[£$])?$/, /^value( ?[£$])?$/];
const DATE_COL_CANDIDATES = [/^date$/, /^posted ?date$/, /^transaction ?date$/];

function toIsoDate(v: any): string {
  if (v == null || v === "") return "";
  if (typeof v === "number") {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const ms = v * 86400000;
    return new Date(epoch.getTime() + ms).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(+d) ? "" : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export type CardRow = { source: "AMEX" | "MC"; category: string; amount: number; date: string; raw: any[] };

export function parseCardAoA(source: "AMEX" | "MC", aoa: any[][]): CardRow[] {
  if (!aoa || aoa.length < 2) return [];
  const header = aoa[0];
  const catIdx  = findColIdx(header, CATEGORY_COL_CANDIDATES);
  const amtIdx  = findColIdx(header, AMOUNT_COL_CANDIDATES);
  const dateIdx = findColIdx(header, DATE_COL_CANDIDATES);
  if (catIdx < 0 || amtIdx < 0) {
    console.warn(`[cards] ${source}: header not found (category=${catIdx}, amount=${amtIdx})`);
    return [];
  }

  const out: CardRow[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!r || r.length === 0) continue;
    const category = String(r[catIdx] ?? "").trim();
    if (!category) continue;

    let amt = Number(r[amtIdx]);
    if (typeof r[amtIdx] === "string") {
      const m = String(r[amtIdx]).replace(/[£$,]/g, "");
      const n = Number(m);
      if (!Number.isNaN(n)) amt = n;
    }
    if (!Number.isFinite(amt)) continue;

    const isPayment = /(payment|repayment|credit|refund)/i.test(category);
    if (isPayment) continue;

    amt = Math.abs(amt);
    const date = dateIdx >= 0 ? toIsoDate(r[dateIdx]) : "";
    out.push({ source, category, amount: amt, date, raw: r });
  }
  return out;
}

export function pickFirstNonEmpty(wb: any, names: string[]): {name:string, aoa:any[][], header:string[]} | null {
  for (const n of names) {
    const sh = wb.Sheets?.[n];
    const aoa = toAoa(sh);
    const header = (aoa[0] || []).map((x: any) => String(x ?? "").trim());
    if (header.length >= 2 && aoa.length > 1) return { name: n, aoa, header };
  }
  return null;
}
