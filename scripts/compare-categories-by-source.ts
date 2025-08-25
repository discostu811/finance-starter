// version: v0.1b1
// date: 2025-08-25 08:50 Europe/London
// changelog: slice: fix Amex 2024 date parsing
// compare-categories-by-source.ts — rebuilt clean
// Goal: reconcile per-month, per-category totals between (a) card sheets and (b) bank rows.
// Robust to header variants; bank categories inferred from descriptions if no explicit field.

import * as XLSX from "xlsx/xlsx.mjs";
import { parseBankFile } from "../reports/lib/bank";
import * as fs from "fs";
XLSX.set_fs?.(fs);

/** Robust workbook reader: works whether XLSX.readFile exists or not */
const readWb = (filePath: string) => {
  const rf: any = (XLSX as any).readFile;
  if (typeof rf === 'function') return rf(filePath);
  const data = fs.readFileSync(filePath);
  return XLSX.read(data, { type: 'buffer' });
};


type CardTxn = {
  source: "amex" | "mc";
  postedDate: string;   // YYYY-MM-DD
  amount: number;       // positive spend
  merchantRaw?: string;
  descriptionRaw?: string;
  category?: string;
  raw?: any;
};

// ---------- helpers ----------
function pickField<T = any>(obj: any, aliases: string[]): T | undefined {
  if (!obj) return undefined;
  const norm = (x: string) =>
    (x ?? "")
      .toLowerCase()
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\s|_/g, "");
  const want = new Set(aliases.map(norm));
  for (const k of Object.keys(obj)) {
    if (want.has(norm(k))) return obj[k] as T;
  }
  return undefined;
}

function toAoa(sh: XLSX.Sheet): any[][] {
  return XLSX.utils.sheet_to_json<any[]>(sh, { header: 1, raw: false, defval: "" }) as any[][];
}

function parseISO(dateLike: any): string | undefined {
  if (!dateLike) return;
  const s = String(dateLike).trim();
  if (!s) return;
  // ISO already?
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // D/M/Y or M/D/Y with separators
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    let d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    // assume D/M/Y if day > 12
    if (d > 12 && mo <= 12) [d, mo] = [mo, d];
    const dd = String(d).padStart(2, "0");
    const mm = String(mo).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  // Excel serial
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const ms = Math.round(n * 86400 * 1000);
    const dt = new Date(epoch.getTime() + ms);
    const y = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  // Fallback: try Date
  const d = new Date(s);
  if (!isNaN(+d)) {
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  return;
}

function money(n: number): string {
  const s = (Math.round(n * 100) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return s.replace(/-/, "−");
}

// ---------- card parsing ----------

function findSheetName(wb: XLSX.WorkBook, year: number, needle: "amex" | "mc"): string | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const y = String(year);
  const want = needle === "amex" ? /amex|american\s*express/ : /(mc|master\s*card|mastercard)/;
  const candidates = wb.SheetNames.filter(n => want.test(norm(n)) && norm(n).includes(y));
  return candidates[0];
}

function parseCardSheet(wb: XLSX.WorkBook, year: number, which: "amex" | "mc"): CardTxn[] {
  const name = findSheetName(wb, year, which);
  if (!name) return [];
  const sh = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json<any>(sh, { raw: false, defval: "" });

  // Header aliases
  const isod = (x: any) => parseISO(x) ?? "";
  const out: CardTxn[] = [];
  for (const r of rows) {
    const date = isod(
      pickField(r, ["date", "posted", "posted date", "transaction date", "posteddate"])
    );
    if (!date || !date.startsWith(String(year))) continue;

    const desc = pickField<string>(r, ["description", "merchant", "merchantraw", "narrative", "details"]);
    const cat  = pickField<string>(r, ["category", "categoryraw", "cat"]);
    // Amount: prefer “amount” or “spend”; if card exports split debit/credit, collapse to spend
    let amt = Number(
      pickField(r, ["amount", "spend", "value", "debit"])
      ?? 0
    );
    if (!isFinite(amt)) amt = 0;
    amt = Math.abs(amt); // treat spend as positive

    out.push({
      source: which,
      postedDate: date,
      amount: amt,
      descriptionRaw: desc,
      category: (cat ?? "").toString().trim(),
      raw: r,
    });
  }

  console.log(`[cards] ${which === "amex" ? "AMEX" : "MC"}: using sheet "${name}" with ${out.length} data rows`);
  return out;
}

// ---------- bank category inference ----------

function getBankCategory(b: BankTxn): string {
  // 1) if a category-like field exists, use it
  const cat = (b as any).category ?? (b as any).categoryRaw;
  if (typeof cat === "string" && cat.trim()) return cat.trim();

  const hay = `${b.merchantRaw ?? ""} ${b.descriptionRaw ?? ""}`.toLowerCase();

  // Suppress obvious non-spend bucket here? (we still return "Payment" if a card bill)
  if (/\b(american\s*express|master\s*card|mastercard)\b.*\b(dd|direct\s*debit|payment)\b/.test(hay)) {
    return "Payment";
  }

  // Heuristic buckets — tune as needed
  if (/amazon/.test(hay)) return "Amazon";
  if (/\b(tesco|sainsbury'?s|waitrose|morrisons|asda|aldi|lidl|whole\s*foods)\b/.test(hay)) return "Grocery";
  if (/\b(oyster|tfl|transport\sfor\slondon|london\sunderground)\b/.test(hay)) return "Oyster";
  if (/\b(uber\s*trip|bolt|free\s*now)\b/.test(hay)) return "UK cabs";
  if (/\b(uber\seats|deliveroo|just\s*eat|doordash)\b/.test(hay)) return "Restaurants";
  if (/\b(starbucks|costa|pret|caff[eé])\b/.test(hay)) return "Restaurants";
  if (/\b(ba\s|british\sairways|easyjet|ryanair|wizz|airlines?|hotel|booking\.com|airbnb|trainline)\b/.test(hay)) return "Travel";
  if (/\b(zara|uniqlo|h&m|primark|gap|nike|adidas|footlocker|next)\b/.test(hay)) return "Clothes";
  if (/\b(curry'?s|argos|apple|pc\s*world|scan|ebuyer|micro\s*center)\b/.test(hay)) return "Electronics";
  if (/\b(baby|pampers|mothercare|mamas\s*&\s*papas|bugaboo)\b/.test(hay)) return "Baby";
  if (/\b(gift|hamleys|smiths|etsy)\b/.test(hay)) return "Gift";
  if (/\b(restaurant|bar|pub|pizza|burger|noodle|sushi|grill|bistro)\b/.test(hay)) return "Restaurants";
  if (/\b(services|fee|charge|subscription|netflix|spotify|icloud|prime|microsoft|google)\b/.test(hay)) return "Services";
  if (/\b(screwfix|b&q|ikea|homebase)\b/.test(hay)) return "Kitchen";
  if (/\b(stationery|paperchase)\b/.test(hay)) return "Supplies";
  if (/\b(entertainment|cinema|theatre|ticketmaster|eventbrite)\b/.test(hay)) return "Entertainment";
  if (/\b(taxi|cab)\b/.test(hay)) return "UK cabs";

  return ""; // uncategorised
}

// ---------- main ----------
async function main() {
  const file = process.argv[2];
  const year = Number(process.argv[3] ?? new Date().getFullYear());
  if (!file) {
    console.error("Usage: tsx scripts/compare-categories-by-source.ts <xlsx-file> <year>");
    process.exit(1);
  }

  const wb = readWb(file, { cellDates: false });

  const amex = parseCardSheet(wb, year, "amex");
  const mc   = parseCardSheet(wb, year, "mc");

  let bankArr = parseBankFile(excelPath, year);

  if (process.env.DEBUG_BANK_CAT) {
    const allKeys = new Map<string, number>();
    let empty = 0, nonEmpty = 0;
    for (const b of bankArr.slice(0, 10)) {
      Object.keys(b||{}).forEach(k => allKeys.set(k, (allKeys.get(k)||0)+1));
    }
    for (const b of bankArr) {
      const cat = getBankCategory(b);
      if (cat) nonEmpty++; else empty++;
    }
    console.log("[bank] sample keys (first 10 rows):", Array.from(allKeys.keys()));
    console.log(`[bank] category non-empty=${nonEmpty} empty=${empty}`);
    const sampleBlanks = bankArr.filter(b => !getBankCategory(b)).slice(0, 3);
    sampleBlanks.forEach((b, i) => {
      console.log(`[bank] blank example ${i+1}`, {
        source: b.source, account: b.account, postedDate: b.postedDate,
        amount: b.amount, merchantRaw: b.merchantRaw, descriptionRaw: b.descriptionRaw
      });
    });
  }

  if (process.env.BANK_SUPPRESS_CARD_BILLS) {
    bankArr = localSuppressCardBillPayments(bankArr);
  }

  const cards = [...amex, ...mc];
  const diag = `[diag] year=${year} AMAZON_SUPPRESS=${!!process.env.AMAZON_SUPPRESS_PARENTS} BANK_SUPPRESS_BILLS=${!!process.env.BANK_SUPPRESS_CARD_BILLS} amex=${amex.length} mc=${mc.length} bank=${bankArr.length}`;
  console.log(diag);

  // --- rollups
  type Bucket = { cards: number; bank: number };
  const buckets = new Map<string, Bucket>();

  const monthKey = (iso: string) => Number(iso.slice(5, 7) || "0");

  for (const c of cards) {
    const m = monthKey(c.postedDate);
    const cat = (c.category ?? "").trim();
    const key = `${m}||${cat}`;
    const b = buckets.get(key) ?? { cards: 0, bank: 0 };
    b.cards += c.amount || 0;
    buckets.set(key, b);
  }

  for (const b of bankArr) {
    const m = monthKey(b.postedDate);
    const cat = getBankCategory(b);
    const key = `${m}||${cat}`;
    const bk = buckets.get(key) ?? { cards: 0, bank: 0 };
    bk.bank += Math.abs(b.amount || 0);
    buckets.set(key, bk);
  }

  // --- output
  console.log(`Category reconciliation by SOURCE — ${year}`);
  console.log(`Month | Category | Cards | Bank | OurSum | Detail | Δ | OK?`);
  console.log(`------+----------+-------+------+--------+--------+---+-----`);

  const keys = Array.from(buckets.keys())
    .sort((a, b) => {
      const [ma, ca] = a.split("||"); const [mb, cb] = b.split("||");
      const am = Number(ma), bm = Number(mb);
      if (am !== bm) return am - bm;
      return (ca || "").localeCompare(cb || "");
    });

  for (const k of keys) {
    const [mStr, cat] = k.split("||");
    const m = Number(mStr);
    const v = buckets.get(k)!;
    const our = v.cards;
    const det = v.bank;
    const delta = our - det;
    const ok = Math.abs(delta) < 0.01 ? "✅" : "❌";
    const catDisp = (cat || "").padEnd(14, " ").slice(0, 14);
    console.log(
      `${String(m).padStart(3, " ")} | ${catDisp} | ${money(v.cards).padStart(7)} | ${money(v.bank).padStart(6)} | ${money(our).padStart(8)} | ${money(det).padStart(8)} | ${delta >= 0 ? " " : ""}${money(delta)} | ${ok}`
    );
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
