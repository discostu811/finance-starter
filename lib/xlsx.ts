import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';

// ... other helpers ...

export function loadWorkbook(path: string) {
  const buf = readFileSync(path);
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: false });
  return wb;
}
