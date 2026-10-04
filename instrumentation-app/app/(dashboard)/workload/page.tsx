import Link from "next/link";
import { Gauge, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, canManage } from "@/lib/utils/role";
import { Card, Badge } from "@/components/ui/Card";

const WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const PRIORITY_TONE: Record<string, "red" | "amber" | "gray"> = { critical: "red", high: "amber", medium: "gray", low: "gray" };

function level(score: number): { label: string; tone: "green" | "blue" | "amber" | "red"; bar: string } {
  if (score === 0) return { label: "Available", tone: "green", bar: "bg-green-500" };
  if (score <= 4) return { label: "Light", tone: "blue", bar: "bg-blue-500" };
  if (score <= 9) return { label: "Busy", tone: "amber", bar: "bg-amber-500" };
  return { label: "Overloaded", tone: "red", bar: "bg-red-500" };
}

export default async function WorkloadPage() {
  const role = await getCurrentUserRole();
  if (!canManage(role)) {
    return (
      <Card className="max-w-xl p-8 text-center text-sm text-gray-500">
        Team Workload is available to engineers and administrators.
      </Card>
    );
  }

  const supabase = createClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: staff }, { data: open }, { data: done }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, sap_number, role, active").order("full_name"),
    supabase
      .from("breakdowns")
      .select("id, fault_description, priority, status, location, assigned_to, start_time")
      .not("status", "in", "(restored,closed)")
      .order("start_time"),
    supabase
      .from("breakdowns")
      .select("assigned_to, downtime_minutes")
      .in("status", ["restored", "closed"])
      .gte("end_time", since),
  ]);

  const people = (staff ?? []).filter((p: any) => p.active !== false);
  const openList = (open ?? []) as any[];
  const unassigned = openList.filter((b) => !b.assigned_to);

  const cards = people
    .map((p: any) => {
      const mine = openList.filter((b) => b.assigned_to === p.id);
      const finished = (done ?? []).filter((b: any) => b.assigned_to === p.id);
      const dts = finished.map((b: any) => b.downtime_minutes).filter((v: any) => typeof v === "number");
      const score = mine.reduce((sum, b) => sum + (WEIGHT[b.priority] ?? 1), 0);
      return {
        ...p,
        mine,
        score,
        finished: finished.length,
        avgDowntime: dts.length ? Math.round(dts.reduce((a: number, b: number) => a + b, 0) / dts.length) : null,
        oldestDays: mine.length ? Math.floor((Date.now() - new Date(mine[0].start_time).getTime()) / 86400000) : null,
      };
    })
    .sort((a, b) => b.score - a.score || a.full_name.localeCompare(b.full_name));

  const available = cards.filter((c) => c.score === 0).length;
  const lightest = [...cards].sort((a, b) => a.score - b.score || a.full_name.localeCompare(b.full_name))[0];

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center gap-2">
        <Gauge className="h-5 w-5 text-brand-600" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Team Workload</h1>
          <p className="text-sm text-gray-500">Open work per person, weighted by priority</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Open breakdowns", value: openList.length },
          { label: "Unassigned", value: unassigned.length, red: unassigned.length > 0 },
          { label: "Staff available", value: available },
          { label: "Lightest load", value: lightest ? lightest.full_name.split(" ")[0] : "—" },
        ].map((s) => (
          <Card key={s.label} className="p-3 sm:p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{s.label}</p>
            <p className={`mt-1 truncate text-2xl font-semibold ${(s as any).red ? "text-red-600" : "text-gray-900"}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {unassigned.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            {unassigned.length} open breakdown{unassigned.length > 1 ? "s have" : " has"} no assignee
            {lightest && <span className="font-normal"> · suggested: {lightest.full_name}</span>}
          </div>
          <ul className="space-y-1">
            {unassigned.slice(0, 6).map((b) => (
              <li key={b.id}>
                <Link href={`/breakdowns/${b.id}`} className="flex items-center justify-between gap-2 text-sm text-amber-900 hover:underline">
                  <span className="truncate">{b.fault_description}</span>
                  <Badge tone={PRIORITY_TONE[b.priority] ?? "gray"}>{b.priority}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {cards.map((c) => {
          const lv = level(c.score);
          return (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{c.full_name}</p>
                  <p className="text-xs text-gray-400">
                    {c.sap_number ? `SAP ${c.sap_number} · ` : ""}
                    <span className="capitalize">{c.role}</span>
                  </p>
                </div>
                <Badge tone={lv.tone}>{lv.label}</Badge>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                <div className={`h-full rounded-full ${lv.bar}`} style={{ width: `${Math.min(100, (c.score / 10) * 100)}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span>{c.mine.length} open</span>
                <span>{c.finished} finished (30 d)</span>
                {c.avgDowntime !== null && <span>avg downtime {c.avgDowntime} min</span>}
                {c.oldestDays !== null && c.oldestDays > 0 && <span>oldest open {c.oldestDays} d</span>}
              </div>

              {c.mine.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-gray-100 pt-2">
                  {c.mine.slice(0, 5).map((b: any) => (
                    <li key={b.id}>
                      <Link href={`/breakdowns/${b.id}`} className="flex items-center justify-between gap-2 text-sm text-gray-700 hover:text-brand-600">
                        <span className="truncate">{b.fault_description}</span>
                        <Badge tone={PRIORITY_TONE[b.priority] ?? "gray"}>{b.priority}</Badge>
                      </Link>
                    </li>
                  ))}
                  {c.mine.length > 5 && <li className="text-xs text-gray-400">+{c.mine.length - 5} more</li>}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-gray-400">
        Load score: critical = 4, high = 3, medium = 2, low = 1 per open breakdown. Available 0 · Light 1–4 · Busy 5–9 · Overloaded 10+.
      </p>
    </div>
  );
}
