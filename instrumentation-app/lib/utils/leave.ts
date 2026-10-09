import { addDays, diffDays, isLeave, patternDuty, type DutyCode, type LeaveCode, type ShiftConfig } from "@/lib/utils/shifts";

export interface LeaveDay {
  staff_id: string;
  duty_date: string;
  code: string;
}

export interface LeaveBlock {
  staff_id: string;
  code: LeaveCode;
  start: string;
  end: string;
  /** Number of leave days in the block (rest days that stay off are not counted). */
  days: number;
  /** True when rest days inside the block are also marked as leave. */
  includesRestDays: boolean;
}

/** Dates a leave covers. "working" keeps the person's normal rest days (O, or Sunday for General) off. */
export function planDates(group: string, from: string, to: string, mode: "working" | "all", cfg: ShiftConfig): string[] {
  const out: string[] = [];
  if (!from || !to || to < from) return out;
  const span = Math.min(diffDays(to, from), 365);
  for (let i = 0; i <= span; i++) {
    const d = addDays(from, i);
    if (mode === "working" && patternDuty(group, d, cfg) === "O") continue;
    out.push(d);
  }
  return out;
}

/**
 * Groups leave days into periods: consecutive days of one leave type. A gap made only of rest days
 * (normal O days with no leave marked) does not split a period, so "12 to 20 Oct" stays one period.
 */
export function leaveBlocks(days: LeaveDay[], groupOf: (staffId: string) => string, cfg: ShiftConfig): LeaveBlock[] {
  const valid = days.filter((d) => isLeave(d.code));
  const marked = new Set(valid.map((d) => `${d.staff_id}|${d.duty_date}`));
  const sorted = [...valid].sort((a, b) => (a.staff_id + a.code + a.duty_date).localeCompare(b.staff_id + b.code + b.duty_date));
  const blocks: LeaveBlock[] = [];
  let cur: LeaveBlock | null = null;
  let last = "";
  for (const d of sorted) {
    const code = d.code as LeaveCode;
    let joins = false;
    if (cur && cur.staff_id === d.staff_id && cur.code === code) {
      joins = true;
      for (let n = diffDays(d.duty_date, last) - 1; n > 0; n--) {
        const gap = addDays(d.duty_date, -n);
        if (marked.has(`${d.staff_id}|${gap}`) || patternDuty(groupOf(d.staff_id), gap, cfg) !== "O") joins = false;
      }
    }
    if (cur && joins) {
      cur.end = d.duty_date;
      cur.days++;
    } else {
      if (cur) blocks.push(cur);
      cur = { staff_id: d.staff_id, code, start: d.duty_date, end: d.duty_date, days: 1, includesRestDays: false };
    }
    if (patternDuty(groupOf(d.staff_id), d.duty_date, cfg) === "O") cur.includesRestDays = true;
    last = d.duty_date;
  }
  if (cur) blocks.push(cur);
  return blocks.sort((a, b) => a.start.localeCompare(b.start));
}

export interface LeaveTotals {
  AL: number;
  SL: number;
  CA: number;
  total: number;
  taken: number;
  planned: number;
}

/** Days per leave type for one person; "taken" = up to and including `today`, "planned" = after it. */
export function leaveTotals(days: LeaveDay[], staffId: string, today: string): LeaveTotals {
  const t: LeaveTotals = { AL: 0, SL: 0, CA: 0, total: 0, taken: 0, planned: 0 };
  for (const d of days) {
    if (d.staff_id !== staffId || !isLeave(d.code)) continue;
    t[d.code as LeaveCode]++;
    t.total++;
    if (d.duty_date <= today) t.taken++;
    else t.planned++;
  }
  return t;
}

export const fmtDate = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const fmtRange = (a: string, b: string) => (a === b ? fmtDate(a) : `${fmtDate(a)} to ${fmtDate(b)}`);
export type { DutyCode };
