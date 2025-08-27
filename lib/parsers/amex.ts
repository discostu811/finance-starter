// version: finance-v0.1b1
// date: 2025-08-25 09:17 Europe/London
// changelog: add robust Amex date parser handling UK/US formats, 2-digit years, Excel serials

export type AmexDateParseDiag = {
  raw: any;
  detected: string | null;
  excelSerial?: number;
};

const EXCEL_EPOCH = Date.UTC(1899, 11, 30); // Excel 1900 epoch (accounts for leap bug)

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fromExcelSerial(serial: number): Date {
  // Excel serial day -> UTC ms
  const ms = EXCEL_EPOCH + Math.round(serial * 86400000);
  return new Date(ms);
}

function parseDMY(s: string): [number, number, number] | null {
  const m = s.match(/^\s*(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\s*$/);
  if (!m) return null;
  let d = parseInt(m[1], 10);
  let mo = parseInt(m[2], 10);
  let y = parseInt(m[3], 10);
  if (y < 100) y += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return [y, mo, d];
}

function parseMDY(s: string): [number, number, number] | null {
  const m = s.match(/^\s*(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\s*$/);
  if (!m) return null;
  let mo = parseInt(m[1], 10);
  let d = parseInt(m[2], 10);
  let y = parseInt(m[3], 10);
  if (y < 100) y += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return [y, mo, d];
}

function parseYMD(s: string): [number, number, number] | null {
  const m = s.match(/^\s*(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})\s*$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return [y, mo, d];
}

const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","sept","oct","nov","dec"];

function parseDayMonYear(s: string): [number, number, number] | null {
  // e.g., 12-Jan-24 or 12 Jan 2024
  const m = s.trim().toLowerCase().match(/(\d{1,2})[\s\-\/]+([a-z]+)[\s\-\/]+(\d{2,4})/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const monStr = m[2].slice(0,3);
  let y = parseInt(m[3], 10);
  if (y < 100) y += 2000;
  const mi = MONTHS.indexOf(monStr);
  if (mi < 0) return null;
  return [y, mi+1, d];
}

export function parseAmexDateToISO(raw: unknown, diag?: AmexDateParseDiag): string | null {
  let s = "";
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const dt = fromExcelSerial(raw);
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth() + 1;
    const d = dt.getUTCDate();
    diag && (diag.excelSerial = raw, diag.detected = "excel-serial");
    return `${y}-${pad(m)}-${pad(d)}`;
  }
  s = String(raw).trim();
  const normalized = s.replace(/[\.]/g, "-").replace(/[ ]+/g, " ");
  // Heuristics:
  // 1) Try Y-M-D
  let parts: [number, number, number] | null = parseYMD(normalized);
  if (parts) { diag && (diag.detected = "ymd"); }
  // 2) If no, try D/M/Y (UK) — prefer this when day>12
  if (!parts) {
    const dmy = parseDMY(normalized);
    if (dmy) {
      const [y, mo, d] = dmy;
      if (d > 12) { parts = dmy; diag && (diag.detected = "dmy"); }
      else {
        // ambiguous day<=12 -> decide later
        parts = dmy; diag && (diag.detected = "dmy-ambig");
      }
    }
  }
  // 3) Try M/D/Y (US) and resolve ambiguity if needed
  if (parts && diag?.detected === "dmy-ambig") {
    const mdy = parseMDY(normalized);
    if (mdy) {
      const [yA, moA, dA] = parts;
      const [yB, moB, dB] = mdy;
      // Preference: UK (D/M/Y) for Amex UK exports unless US clearly intended
      // If moA <=12 and dA <=12 and both valid, pick D/M/Y by default.
      // If text contains explicit locale hints, extend here (todo).
      diag && (diag.detected = "dmy"); // choose D/M/Y
      parts = [yA, moA, dA];
    } else {
      diag && (diag.detected = "dmy"); // only dmy matched
    }
  } else if (!parts) {
    // 4) Try spelled month formats
    const dmyText = parseDayMonYear(normalized);
    if (dmyText) { parts = dmyText; diag && (diag.detected = "d-mmm-y"); }
  }
  if (!parts) return null;
  const [y, mo, d] = parts;
  // Construct in UTC to avoid TZ drift; we treat final date as local-calendar day
  return `${y}-${pad(mo)}-${pad(d)}`;
}
