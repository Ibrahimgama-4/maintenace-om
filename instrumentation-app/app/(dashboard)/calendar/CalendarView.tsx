"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { DUTY_META, GROUPS, addDays, cyclePosition, dutyClass, groupLabel, isLeave, patternDuty, phaseText, dayOfWeek, type DutyCode, type ShiftConfig } from "@/lib/utils/shifts";

export interface CalEvent {
  key: string;
  type: "pm" | "pm_overdue" | "pm_next" | "breakdown" | "cal" | "cal_overdue";
  /** PM events: calendar date (YYYY-MM-DD). */
  date?: string;
  /** Breakdowns: timestamp, grouped by the viewer's local day. */
  at?: string;
  title: string;
  sub: string;
  priority?: string;
  href: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const localKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function dotClass(e: CalEvent) {
  if (e.type === "cal_overdue") return "bg-red-500";
  if (e.type === "cal") return "bg-purple-500";
  if (e.type === "pm_overdue") return "bg-red-500";
  if (e.type === "pm") return "bg-blue-500";
  if (e.type === "pm_next") return "border border-blue-400 bg-blue-100";
  return e.priority === "critical" ? "bg-red-500" : e.priority === "high" ? "bg-amber-500" : "bg-gray-400";
}
function chipClass(e: CalEvent) {
  if (e.type === "cal_overdue") return "bg-red-50 text-red-700";
  if (e.type === "cal") return "bg-purple-50 text-purple-700";
  if (e.type === "pm_overdue") return "bg-red-50 text-red-700";
  if (e.type === "pm") return "bg-blue-50 text-blue-700";
  if (e.type === "pm_next") return "border border-dashed border-blue-200 text-blue-500";
  return e.priority === "critical" ? "bg-red-50 text-red-700" : e.priority === "high" ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-700";
}

export function CalendarView({
  month,
  prevHref,
  nextHref,
  todayHref,
  events,
  shiftConfig,
  myGroup,
  myDuty,
  savedShift,
  userId,
}: {
  month: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  events: CalEvent[];
  shiftConfig: ShiftConfig | null;
  myGroup: string | null;
  myDuty: Record<string, string>;
  savedShift: string | null;
  userId: string | null;
}) {
  const [y, m] = month.split("-").map(Number);
  const todayKey = localKey(new Date());
  const [showPm, setShowPm] = useState(true);
  const [showProjected, setShowProjected] = useState(true);
  const [showBd, setShowBd] = useState(true);
  const [showCal, setShowCal] = useState(true);
  // Duty overlay: which shift's Morning (D) / Night (N) / Off (O) days to mark on the calendar.
  const [duty, setDuty] = useState<string>("");
  useEffect(() => {
    // 1) the shift they chose before (saved on their account), 2) this device's choice, 3) their own shift on the duty roster
    if (savedShift === "none") return setDuty("");
    if (savedShift && (GROUPS as string[]).includes(savedShift)) return setDuty(savedShift);
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem("calendarDuty");
    } catch {}
    if (saved !== null && (saved === "" || (GROUPS as string[]).includes(saved))) setDuty(saved);
    else if (myGroup) setDuty(myGroup);
  }, [myGroup, savedShift]);
  const chooseDuty = (v: string) => {
    setDuty(v);
    try {
      window.localStorage.setItem("calendarDuty", v);
    } catch {}
    // Remember the choice on their account too, so it follows them to any phone.
    if (userId) void createClient().from("profiles").update({ calendar_shift: v || "none" }).eq("id", userId).then(() => undefined);
  };
  // What the selected shift is doing on a date. For your own shift this includes changes and leave.
  const dutyInfo = (key: string): { code: DutyCode; changed: boolean } | null => {
    if (!shiftConfig || !duty) return null;
    const own = duty === myGroup ? (myDuty[key] as DutyCode | undefined) : undefined;
    if (own && own in DUTY_META) return { code: own, changed: !isLeave(own) };
    return { code: patternDuty(duty, key, shiftConfig), changed: false };
  };
  const [selected, setSelected] = useState<string>(todayKey.startsWith(month) ? todayKey : `${month}-01`);

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      if (e.type === "cal" || e.type === "cal_overdue" ? !showCal : e.type === "breakdown" ? !showBd : e.type === "pm_next" ? !(showPm && showProjected) : !showPm) continue;
      const k = e.date ?? localKey(new Date(e.at as string));
      if (!k.startsWith(month)) continue;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return map;
  }, [events, month, showPm, showProjected, showBd, showCal]);

  const daysInMonth = new Date(y, m, 0).getDate();
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday-first
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const title = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const selectedEvents = byDay.get(selected) ?? [];

  return (
    <>
      <Card className="p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Link href={prevHref} aria-label="Previous month" className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <h2 className="min-w-[9rem] text-center text-base font-semibold text-gray-900">{title}</h2>
            <Link href={nextHref} aria-label="Next month" className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100">
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
          <Link href={todayHref} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
            Today
          </Link>
        </div>

        <div className="mb-3 rounded-lg bg-gray-50 p-3">
          <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-700">
            Show my duty days for
            <select value={duty} onChange={(e) => chooseDuty(e.target.value)} className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm font-normal">
              <option value="">-- No shift --</option>
              {GROUPS.map((g) => (
                <option key={g} value={g}>
                  {groupLabel(g)}
                </option>
              ))}
            </select>
          </label>
          {myGroup && (
            <p className="mt-1.5 text-xs text-gray-600">
              Your shift on the duty roster: <b>{groupLabel(myGroup)}</b>. It is shown automatically. Choose another shift above to see that one instead.
            </p>
          )}
          {!shiftConfig && <p className="mt-1.5 text-xs text-amber-700">The shift pattern is not set up yet. Ask your administrator to run the v27 database update.</p>}
          {shiftConfig && duty && (
            <>
              <p className="mt-2 text-xs text-gray-600">
                <b>{groupLabel(duty)}</b> today: <b>{duty === "G" ? (dayOfWeek(todayKey) === 0 ? "Off (Sunday)" : "General duty") : phaseText(cyclePosition(shiftConfig, duty as "A" | "B" | "C", todayKey))}</b>
              </p>
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
                {Array.from({ length: 7 }, (_, i) => addDays(todayKey, i)).map((d, i) => {
                  const di = dutyInfo(d)!;
                  const c = di.code;
                  return (
                    <div key={d} className="flex min-w-[2.6rem] flex-col items-center rounded-md border border-gray-200 bg-white py-1 text-[10px] text-gray-500">
                      <span>{i === 0 ? "Today" : new Date(d + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "short" })}</span>
                      <span className={clsx("mt-0.5 rounded px-1.5 text-xs font-bold", dutyClass(c, di.changed))}>{c}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-gray-500">D = Morning, N = Night, O = Off{duty === "G" ? ", G = General (Mon to Sat)" : ""}{duty === myGroup ? ". On your own shift, yellow = your leave (AL, SL, CA) and green = a day the admin changed or added for you." : ""}</p>
            </>
          )}
        </div>

        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={showPm} onChange={(e) => setShowPm(e.target.checked)} />
            <span className="h-2 w-2 rounded-full bg-blue-500" /> PM due
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={showProjected} onChange={(e) => setShowProjected(e.target.checked)} />
            <span className="h-2 w-2 rounded-full border border-blue-400 bg-blue-100" /> Projected PM
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={showBd} onChange={(e) => setShowBd(e.target.checked)} />
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Breakdowns
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={showCal} onChange={(e) => setShowCal(e.target.checked)} />
            <span className="h-2 w-2 rounded-full bg-purple-500" /> Calibration due
          </label>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500" /> Overdue / critical
          </span>
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 text-xs">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="bg-gray-50 py-1.5 text-center font-semibold uppercase tracking-wide text-gray-500">
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (!day) return <div key={`b${i}`} className="min-h-[56px] bg-gray-50 sm:min-h-[92px]" />;
            const key = `${month}-${pad(day)}`;
            const list = byDay.get(key) ?? [];
            const di = dutyInfo(key);
            return (
              <button
                type="button"
                key={key}
                onClick={() => setSelected(key)}
                className={clsx(
                  "flex min-h-[56px] flex-col items-start gap-1 bg-white p-1 text-left transition-colors hover:bg-blue-50 sm:min-h-[92px] sm:p-1.5",
                  selected === key && "ring-2 ring-inset ring-brand-500"
                )}
              >
                <span className="flex w-full items-start justify-between">
                  <span
                    className={clsx(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                      key === todayKey ? "bg-brand-600 text-white" : "text-gray-700"
                    )}
                  >
                    {day}
                  </span>
                  {di && <span className={clsx("rounded px-1 text-[11px] font-bold leading-5 sm:px-1.5 sm:text-xs", dutyClass(di.code, di.changed))}>{di.code}</span>}
                </span>
                <span className="flex flex-wrap gap-0.5 sm:hidden">
                  {list.slice(0, 4).map((e) => (
                    <span key={e.key} className={clsx("h-1.5 w-1.5 rounded-full", dotClass(e))} />
                  ))}
                </span>
                <span className="hidden w-full space-y-0.5 sm:block">
                  {list.slice(0, 2).map((e) => (
                    <span key={e.key} className={clsx("block truncate rounded px-1 py-0.5 text-[10px] leading-tight", chipClass(e))}>
                      {e.title}
                    </span>
                  ))}
                  {list.length > 2 && <span className="block text-[10px] text-gray-500">+{list.length - 2} more</span>}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">
          {new Date(selected + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        </h3>
        {shiftConfig && (
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            {GROUPS.map((g) => {
              const own = g === myGroup ? (myDuty[selected] as DutyCode | undefined) : undefined;
              const c: DutyCode = own && own in DUTY_META ? own : patternDuty(g, selected, shiftConfig);
              return (
                <span key={g} className={clsx("rounded-full px-2.5 py-1 font-medium", dutyClass(c, !!own && !isLeave(c)), g === duty && "ring-2 ring-brand-500")}>
                  {groupLabel(g)}: {c} · {DUTY_META[c].label}
                </span>
              );
            })}
          </div>
        )}
        {selectedEvents.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing scheduled or reported on this day.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {selectedEvents.map((e) => (
              <li key={e.key}>
                <Link href={e.href} className="flex items-start gap-2.5 py-2.5 hover:bg-gray-50">
                  <span className={clsx("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", dotClass(e))} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-900">{e.title}</span>
                    <span className="block text-xs text-gray-500">
                      {e.type === "breakdown" ? "Breakdown" : e.type === "cal_overdue" ? "Calibration overdue" : e.type === "cal" ? "Calibration due" : e.type === "pm_overdue" ? "PM overdue" : e.type === "pm_next" ? "PM projected" : "PM due"}
                      {e.sub ? ` · ${e.sub}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
