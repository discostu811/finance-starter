// version: v0.1b1
// date: 2025-08-25 08:50 Europe/London
// changelog: slice: fix Amex 2024 date parsing
// CANARY: finance-starter v0.1c13 (cards parser w/ correct category mapping)
import * as XLSX from "xlsx";

export type CardTxn = {
  source: "amex" | "mc";
  postedDate: string;   // YYYY-MM-DD
  amount: number;       // positive for spend, negative for refunds/payments if you ever need that
  currency?: string;
  merchantRaw?: string;
  descriptionRaw?: string;
  categoryRaw?: string;
  raw?: any;
};

// --- helpers ---------------------------------------------------------------
function toAoa(sh: XLSX.Sheet): any[][] {
  if (!sh) return [];
  const aoa = XLSX.utils.sheet_to_json(sh, { header: 1, raw: true }) as any[][];
  return (aoa || []).filter(
    r => (r ?? []).some(c => c !== null && c !== undefined && String(c).trim() !== "")
  );
}

function pickFirstNonEmpty(
  wb: XLSX.WorkBook,
  names: string[]
): { name: string; aoa: any[][]; header: string[] } | null {
  for (const n of names) {
    const sh = wb.Sheets[n];
    const aoa = toAoa(sh);
    const header = (aoa[0] || []).map(x => String(x ?? "").trim());
    if (header.length >= 2 && aoa.length > 1) {
      return { name: n, aoa, header };
    }
  }
  return null;
}

function candidateNames(wb: XLSX.WorkBook, needle: string, year: number): string[] {
  const all = Object.keys(wb.Sheets);
  const y = String(year);
  const hasNeedle = all.filter(n => n.toLowerCase().includes(needle.toLowerCase()));
  return [
    ...hasNeedle.filter(n => n.includes(y)),
    ...hasNeedle.filter(n => !n.includes(y)),
  ];
}

function excelSerialToIsoMaybe(v: any): string {
  if (typeof v === "number" && Number.isFinite(v)) {
    const t = Date.UTC(1899, 11, 30) + v * 24 * 60 * 60 * 1000;
    return new Date(t).toISOString().slice(0, 10);
  }
  const s = String(v ?? "");
  // try already-ISO-ish
  return s.slice(0, 10);
}

// --- MC --------------------------------------------------------------------
export function parseMC(wb: XLSX.WorkBook, year: number): CardTxn[] {
  const cands = candidateNames(wb, "mc", year);
  const picked = pickFirstNonEmpty(wb, cands);
  if (!picked) {
    console.error(`[cards] MC: no non-empty sheet found among: ${cands.join(", ")}`);
    return [];
  }
  console.error(`[cards] MC: using sheet "${picked.name}" with ${picked.aoa.length - 1} data rows`);
  const { aoa, header } = picked;

  const findEq = (name: string) => header.findIndex(h => h.toLowerCase() === name.toLowerCase());
  const findIncl = (frag: string) => header.findIndex(h => h.toLowerCase().includes(frag.toLowerCase()));

  const col = {
    date: findEq("Date") >= 0 ? findEq("Date") : findIncl("date"),
    desc: findIncl("description"),
    cat:  findIncl("category"),                             // "CATEGORY"
    amount: Math.max(findEq("CONVERTED £"), findIncl("converted £"), findEq("Amount")),
  };

  const rows = aoa.slice(1);
  const out: CardTxn[] = [];
  for (const r of rows) {
    const iso = excelSerialToIsoMaybe(r[col.date]);
    if (!iso.startsWith(String(year))) continue;

    const amtNum = Number(r[col.amount] ?? 0);
    const spend = Math.abs(amtNum); // normalize to positive spend to match Detail

    out.push({
      source: "mc",
      postedDate: iso,
      amount: spend,
      descriptionRaw: r[col.desc]?.toString(),
      categoryRaw: r[col.cat]?.toString(),
      raw: r,
    });
  }
  return out;
}

// --- AMEX ------------------------------------------------------------------
export function parseAmex(wb: XLSX.WorkBook, year: number): CardTxn[] {
  const cands = candidateNames(wb, "amex", year);
  const picked = pickFirstNonEmpty(wb, cands);
  if (!picked) {
    console.error(`[cards] AMEX: no non-empty sheet found among: ${cands.join(", ")}`);
    return [];
  }
  console.error(`[cards] AMEX: using sheet "${picked.name}" with ${picked.aoa.length - 1} data rows`);
  const { aoa, header } = picked;

  const findEq = (name: string) => header.findIndex(h => h.toLowerCase() === name.toLowerCase());
  const findIncl = (frag: string) => header.findIndex(h => h.toLowerCase().includes(frag.toLowerCase()));

  const col = {
    date: findEq("Date") >= 0 ? findEq("Date") : findIncl("date"),
    desc: findIncl("description"),
    cat:  findIncl("categorie") >= 0 ? findIncl("categorie") : findIncl("category"), // handle "CATEGORIE"
    amount: [findIncl("converted"), findIncl("amount")].find(i => i >= 0) ?? -1,
  };

  const rows = aoa.slice(1);
  const out: CardTxn[] = [];
  for (const r of rows) {
    const iso = excelSerialToIsoMaybe(r[col.date]);
    if (!iso.startsWith(String(year))) continue;

    const amtNum = Number(r[col.amount] ?? 0);
    const spend = Math.abs(amtNum);

    out.push({
      source: "amex",
      postedDate: iso,
      amount: spend,
      descriptionRaw: r[col.desc]?.toString(),
      categoryRaw: r[col.cat]?.toString(),
      raw: r,
    });
  }
  return out;
}
