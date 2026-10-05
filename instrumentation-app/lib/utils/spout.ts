import { PLANT_TIME_ZONE } from "@/lib/constants";

/** Error % = (span before - span after) x 2, from the 50 kg reference span. */
export function errorPct(spanBefore: number | null | undefined, spanAfter: number | null | undefined): number | null {
  if (spanBefore == null || spanAfter == null || Number.isNaN(spanBefore) || Number.isNaN(spanAfter)) return null;
  return Math.round((spanBefore - spanAfter) * 2 * 100) / 100;
}

export const fmt2 = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? "—" : Number(v).toFixed(2));

/** Today's date (YYYY-MM-DD) in the plant's time zone. */
export function plantToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PLANT_TIME_ZONE }).format(new Date());
}

export const isSunday = (iso: string) => new Date(iso + "T12:00:00Z").getUTCDay() === 0;

/** 2026-09-21 -> 21/09/2026 */
export const dmy = (iso: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

export interface PackerLite {
  id: string;
  name: string;
  code: string | null;
  sort_order: number;
}
export interface SheetLite {
  packer_id: string | null;
  cal_date: string;
  created_at?: string;
}

export const sortPackers = <T extends PackerLite>(list: T[]) =>
  [...list].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, undefined, { numeric: true }));

/** The packer after `afterId` in the line's rotation (wraps round; first packer if none yet). */
export function packerAfter<T extends PackerLite>(packers: T[], afterId: string | null): T | null {
  const sorted = sortPackers(packers);
  if (sorted.length === 0) return null;
  const i = sorted.findIndex((p) => p.id === afterId);
  return sorted[(i + 1) % sorted.length];
}

export type Rotation =
  | { state: "none" }
  | { state: "due"; packer: PackerLite }
  | { state: "done"; packer: PackerLite; next: PackerLite | null }
  | { state: "sunday"; next: PackerLite | null };

/**
 * One packer per line per day, in order, no calibration on Sundays.
 * `sheets` are all sheets for the line, newest first.
 */
export function rotationFor(packers: PackerLite[], sheets: SheetLite[], today: string): Rotation {
  if (packers.length === 0) return { state: "none" };
  const last = sheets.find((s) => s.packer_id && packers.some((p) => p.id === s.packer_id)) ?? null;
  const doneToday = sheets.find((s) => s.cal_date === today && s.packer_id);
  if (doneToday) {
    const p = packers.find((x) => x.id === doneToday.packer_id);
    if (p) return { state: "done", packer: p, next: packerAfter(packers, p.id) };
  }
  const next = packerAfter(packers, last?.packer_id ?? null);
  if (isSunday(today)) return { state: "sunday", next };
  return { state: "due", packer: next as PackerLite };
}

/** Row labels for a new sheet: packer (RP1), SP1..SPn, check weigher (CW-1). */
export function sheetRows(packerCode: string | null, spoutCount: number) {
  const num = (packerCode?.match(/\d+/) ?? ["1"])[0];
  return [
    { kind: "packer" as const, label: packerCode || `RP${num}` },
    ...Array.from({ length: spoutCount }, (_, i) => ({ kind: "spout" as const, label: `SP${i + 1}` })),
    { kind: "checkweigher" as const, label: `CW-${num}` },
  ];
}
