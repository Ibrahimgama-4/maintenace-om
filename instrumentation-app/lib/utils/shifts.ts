/**
 * Shift rotation: Shifts A, B and C each work 3 mornings (D), 3 nights (N) and 3 days off (O),
 * a 9-day cycle. General (G) staff work Monday to Saturday and are off on Sunday.
 */
export type DutyCode = "D" | "N" | "O" | "G" | "AL" | "SL" | "CA";
export type LeaveCode = "AL" | "SL" | "CA";
export type PatternCode = "D" | "N" | "O" | "G";
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
  // Normal duty colours avoid yellow and green, which are reserved for leave and for changed days.
  D: { label: "Morning", cls: "bg-blue-100 text-blue-800", rgb: [191, 219, 254] },
  N: { label: "Night", cls: "bg-violet-200 text-violet-900", rgb: [221, 214, 254] },
  O: { label: "Off", cls: "bg-gray-100 text-gray-500", rgb: [229, 231, 235] },
  G: { label: "General", cls: "bg-pink-100 text-pink-800", rgb: [252, 231, 243] },
  // All leave is yellow; the letters tell the types apart.
  AL: { label: "Annual leave", cls: "bg-yellow-200 text-yellow-900", rgb: [254, 240, 138] },
  SL: { label: "Sick leave", cls: "bg-yellow-200 text-yellow-900", rgb: [254, 240, 138] },
  CA: { label: "Casual leave", cls: "bg-yellow-200 text-yellow-900", rgb: [254, 240, 138] },
};
/** A day the admin changed (swapped or added duty) is shown green. */
export const CHANGED_CLS = "bg-green-300 text-green-900";
export const CHANGED_RGB: [number, number, number] = [134, 239, 172];
export const DUTY_ORDER: DutyCode[] = ["D", "N", "O", "G", "AL", "SL", "CA"];
export const LEAVE_CODES: LeaveCode[] = ["AL", "SL", "CA"];
export const isLeave = (c: string): c is LeaveCode => c === "AL" || c === "SL" || c === "CA";

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

export const codeAt = (pos: number): "D" | "N" | "O" => (pos < 3 ? "D" : pos < 6 ? "N" : "O");

/** Colour class for a duty cell: leave = yellow, a day changed by the admin = green, otherwise the normal colour. */
export function dutyClass(code: DutyCode, changed = false): string {
  if (isLeave(code)) return DUTY_META[code].cls;
  return changed ? CHANGED_CLS : DUTY_META[code].cls;
}
export function dutyRgb(code: DutyCode, changed = false): [number, number, number] {
  if (isLeave(code)) return DUTY_META[code].rgb;
  return changed ? CHANGED_RGB : DUTY_META[code].rgb;
}

/** "Night, day 2 of 3" */
export function phaseText(pos: number): string {
  const code = codeAt(pos);
  return `${DUTY_META[code].label}, day ${(pos % 3) + 1} of 3`;
}

/** The normal pattern duty for a group on a date (before any admin changes). */
export function patternDuty(group: string, iso: string, cfg: ShiftConfig): PatternCode {
  if (group === "G") return dayOfWeek(iso) === 0 ? "O" : "G";
  return codeAt(cyclePosition(cfg, group as "A" | "B" | "C", iso));
}

/** The 9 positions as selectable options, for the pattern settings form. */
export const POSITION_OPTIONS = Array.from({ length: CYCLE }, (_, i) => ({ value: i, label: phaseText(i) }));
