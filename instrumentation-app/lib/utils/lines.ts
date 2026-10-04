import { PLANT_LOCATIONS } from "@/lib/constants";

const CANON = PLANT_LOCATIONS as readonly string[];

/** Query-string value used for items that have no recognised production line. */
export const NO_LINE = "none";

/**
 * Returns the canonical production line for a stored location, or null if it is not a line.
 * Accepts older free-text such as "Line 4" or "line 1 and 2".
 */
export function lineOf(loc?: string | null): string | null {
  if (!loc) return null;
  const t = loc.trim();
  if (CANON.includes(t)) return t;
  const l = t.toLowerCase();
  if (/^line\s*1\s*(&|and|\+|,|\/|-)\s*(line\s*)?2(\D|$)/.test(l)) return CANON[0];
  const m = l.match(/^line\s*([345])(\D|$)/);
  if (m) return CANON.find((c) => c.startsWith(`Line ${m[1]} `)) ?? null;
  return null;
}

/** Only the equipment registered on the given production line. */
export function equipmentForLine<T extends { location?: string | null }>(list: T[], line: string): T[] {
  return list.filter((e) => lineOf(e.location) === line);
}

/** "Line 4 Packing Plant" -> "Line 4" (for compact chips). */
export const shortLine = (l: string) => l.replace(" Packing Plant", "");

/** Resolves a ?line= query value to a canonical line, NO_LINE, or undefined (= all). */
export function parseLineParam(v?: string): string | undefined {
  if (!v) return undefined;
  if (v === NO_LINE) return NO_LINE;
  return CANON.includes(v) ? v : undefined;
}
