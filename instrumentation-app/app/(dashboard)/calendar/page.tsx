import Link from "next/link";
import { CalendarRange, AlertTriangle, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { CalendarView, type CalEvent } from "./CalendarView";

const DAY = 24 * 60 * 60 * 1000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export default async function CalendarPage({ searchParams }: { searchParams: { m?: string } }) {
  const supabase = createClient();
  const now = new Date();
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.m ?? "")
    ? (searchParams.m as string)
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, mo] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(y, mo - 1, 1));
  const monthEnd = new Date(Date.UTC(y, mo, 0)); // last day of month
  const queryFrom = new Date(monthStart.getTime() - 2 * DAY).toISOString();
  const queryTo = new Date(monthEnd.getTime() + 3 * DAY).toISOString();
  const todayStr = ymd(now);

  const [{ data: pms }, { data: breakdowns }, { data: rosters }, { data: cals }] = await Promise.all([
    supabase
      .from("pm_schedules")
      .select("id, task_name, next_due, frequency_days, location, equipment_description, equipment(tag_number, name)")
      .order("next_due"),
    supabase
      .from("breakdowns")
      .select("id, fault_description, priority, status, location, start_time")
      .gte("start_time", queryFrom)
      .lte("start_time", queryTo)
      .order("start_time"),
    supabase
      .from("shift_rosters")
      .select("id, title, storage_path, created_at")
      .gte("created_at", queryFrom)
      .lte("created_at", queryTo)
      .order("created_at", { ascending: false }),
    supabase
      .from("calibrations")
      .select("id, calibration_date, next_due_date, equipment_id, equipment_label, location, equipment(tag_number, name)")
      .not("next_due_date", "is", null)
      .order("calibration_date", { ascending: false })
      .limit(2000),
  ]);

  const events: CalEvent[] = [];
  const overdue: any[] = [];

  (pms ?? []).forEach((pm: any) => {
    const label = pm.equipment?.tag_number
      ? `${pm.equipment.tag_number} — ${pm.equipment.name}`
      : pm.equipment_description || pm.location || "";
    const sub = [label, pm.location && label !== pm.location ? pm.location : ""].filter(Boolean).join(" · ");
    const due = new Date(pm.next_due + "T00:00:00Z");
    const isOverdue = pm.next_due < todayStr;
    if (isOverdue) overdue.push(pm);

    if (pm.next_due >= ymd(monthStart) && pm.next_due <= ymd(monthEnd)) {
      events.push({
        key: `pm-${pm.id}`,
        type: isOverdue ? "pm_overdue" : "pm",
        date: pm.next_due,
        title: pm.task_name,
        sub,
        href: "/pm-calibration",
      });
    }
    // Project future occurrences from the frequency so the month shows the recurring pattern.
    const freq = Number(pm.frequency_days) || 0;
    if (freq > 0) {
      for (let k = 1, t = due.getTime() + freq * DAY; k <= 400 && t <= monthEnd.getTime(); k++, t += freq * DAY) {
        if (t >= monthStart.getTime()) {
          events.push({ key: `pmn-${pm.id}-${k}`, type: "pm_next", date: ymd(new Date(t)), title: pm.task_name, sub: `${sub} (projected)`, href: "/pm-calibration" });
        }
      }
    }
  });

  (breakdowns ?? []).forEach((b: any) => {
    events.push({
      key: `bd-${b.id}`,
      type: "breakdown",
      at: b.start_time,
      title: b.fault_description,
      sub: [b.location, `${b.priority} · ${b.status}`].filter(Boolean).join(" · "),
      priority: b.priority,
      href: `/breakdowns/${b.id}`,
    });
  });

  // Only the latest record per instrument counts: an older record's due date is superseded.
  const seen = new Set<string>();
  let calOverdue = 0;
  (cals ?? []).forEach((c: any) => {
    const label = c.equipment_label ?? (c.equipment ? `${c.equipment.tag_number} — ${c.equipment.name}` : "Instrument");
    const key = c.equipment_id ?? label;
    if (seen.has(key)) return;
    seen.add(key);
    const isOverdue = c.next_due_date < todayStr;
    if (isOverdue) calOverdue++;
    if (c.next_due_date >= ymd(monthStart) && c.next_due_date <= ymd(monthEnd)) {
      events.push({
        key: `cal-${c.id}`,
        type: isOverdue ? "cal_overdue" : "cal",
        date: c.next_due_date,
        title: `Calibrate ${label}`,
        sub: c.location ?? "",
        href: "/pm-calibration/calibrations",
      });
    }
  });

  const rosterLinks = (rosters ?? [])
    .filter((r: any) => ymd(new Date(r.created_at)).slice(0, 7) === month)
    .map((r: any) => ({
      id: r.id,
      title: r.title,
      url: supabase.storage.from("shift-rosters").getPublicUrl(r.storage_path).data.publicUrl,
    }));

  const shift = (delta: number) => {
    const d = new Date(Date.UTC(y, mo - 1 + delta, 1));
    return `/calendar?m=${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center gap-2">
        <CalendarRange className="h-5 w-5 text-brand-600" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500">PM, calibration due dates, breakdowns and rosters by day</p>
        </div>
      </div>

      {(overdue.length > 0 || calOverdue > 0) && (
        <Link href={overdue.length > 0 ? "/pm-calibration" : "/pm-calibration/calibrations"} className="block">
          <Card className="flex items-center gap-2 border-red-200 bg-red-50 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {[overdue.length > 0 && `${overdue.length} PM task${overdue.length > 1 ? "s" : ""}`, calOverdue > 0 && `${calOverdue} calibration${calOverdue > 1 ? "s" : ""}`].filter(Boolean).join(" and ")} overdue. Tap to review.
          </Card>
        </Link>
      )}

      <CalendarView
        month={month}
        prevHref={shift(-1)}
        nextHref={shift(1)}
        todayHref="/calendar"
        events={events}
      />

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Shift rosters uploaded this month</h2>
          <Link href="/shift-roster" className="text-xs font-medium text-brand-600 hover:underline">
            All rosters
          </Link>
        </div>
        {rosterLinks.length === 0 ? (
          <p className="text-sm text-gray-400">No roster was uploaded this month.</p>
        ) : (
          <ul className="space-y-1.5">
            {rosterLinks.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-800">{r.title}</span>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
