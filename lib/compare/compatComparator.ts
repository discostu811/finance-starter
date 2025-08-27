
/**
 * Compatibility layer to obtain a stable comparison builder regardless of how lib/comparator exports are shaped.
 * Prefers a named `buildComparison`, falls back to default or legacy names.
 */
import * as All from "../comparator";

type Builder = (workbook: any, year: number) => any;

function getFirst<T>(...candidates: Array<T | undefined>): T | undefined {
  for (const c of candidates) if (typeof c !== "undefined") return c as T;
  return undefined;
}

export function getBuildComparison(): Builder {
  const candidates: Array<Builder | undefined> = [
    (All as any).buildComparison,
    (All as any).default,
    (All as any).compare2024,
    (All as any).runComparison,
    (All as any).compareToTruth,
    (All as any).compare,
  ];
  const found = getFirst<Builder>(...candidates);
  if (!found) {
    const available = Object.keys(All);
    throw new Error("Could not locate a comparison builder in lib/comparator. Tried buildComparison, default, compare2024, runComparison, compareToTruth, compare. Available exports: [" + available.join(",") + "]");
  }
  return found;
}
