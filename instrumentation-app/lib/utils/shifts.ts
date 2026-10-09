/**
 * Shift rotation: Shifts A, B and C each work 3 mornings (D), 3 nights (N) and 3 days off (O),
 * a 9-day cycle. General (G) staff work Monday to Saturday and are off on Sunday.
 */
export type DutyCode = "D" | "N" | "O" | "G";
export type ShiftGroup = "A" | "B" | "C" | "G";

export interface ShiftConfig {
  anchor_date: string; // YYYY-MM-DD: the reference date
  a_offset: number; // cycle position (0-8) of Shift A on the anchor date
  b_offset: number;
  c_offset: number;
}

export const CYCLE = 9;
export const GROUPS: ShiftGroup[] = ["A", "B", "C", "G"];
export const groupLabel = (g: string) => (g === "G" ? "General" : `Shift ${g}`);

export const DUTY_META: Record<DutyCode, { label: string; cls: string; rgb: [number, number, number] }> = {
  D: { label: "Morning", cls: "bg-amber-100 text-amber-800", rgb: [253, 230, 138] },
  N: { label: "Night", cls: "bg-indigo-100 text-indigo-800", rgb: [199, 210, 254] },
  O: { label: "Off", cls: "bg-gray-100 text-gray-500", rgb: [229, 231, 235] },
  G: { label: "General", cls: "bg-emerald-100 text-emerald-800", rgb: [167, 243, 208] },
};
export const DUTY_ORDER: DutyCode[] = ["D", "N", "O", "G"];

const toDay = (iso: string) => Math.floor(new Date(iso + "T00:00:00Z").getTime() / 86400000);
export const diffDays = (a: string, b: string) => toDay(a) - toDay(b);
export const addDays = (iso: string, n: number) => new Date((toDay(iso) + n) * 86400000).toISOString().slice(0, 10);
export const dayOfWeek = (iso: string) => new Date(iso + "T00:00:00Z").getUTCDay(); // 0 = Sunday
export const daysInMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** Position 0-8 in the 9-day cycle for a rotating shift on a date. */
export function cyclePosition(cfg: ShiftConfig, group: "A" | "B" | "C", iso: string): number {
  const base = group === "A" ? cfg.a_offset : group === "B" ? cfg.b_offset : cfg.c_offset;
  return (((base + diffDays(iso, cfg.anchor_date)) % CYCLE) + CYCLE) % CYCLE;
}

export const codeAt = (pos: number): DutyCode => (pos < 3 ? "D" : pos < 6 ? "N" : "O");

/** "Night, day 2 of 3" */
export function phaseText(pos: number): string {
  const code = codeAt(pos);
  return `${DUTY_META[code].label}, day ${(pos % 3) + 1} of 3`;
}

/** The normal pattern duty for a group on a date (before any admin changes). */
export function patternDuty(group: string, iso: string, cfg: ShiftConfig): DutyCode {
  if (group === "G") return dayOfWeek(iso) === 0 ? "O" : "G";
  return codeAt(cyclePosition(cfg, group as "A" | "B" | "C", iso));
}

/** The 9 positions as selectable options, for the pattern settings form. */
export const POSITION_OPTIONS = Array.from({ length: CYCLE }, (_, i) => ({ value: i, label: phaseText(i) }));
