import Link from "next/link";
import { PlusCircle, CalendarCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, canManage, isAdmin } from "@/lib/utils/role";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DeleteButton } from "@/components/shared/DeleteButton";
import { SectionTabs } from "@/components/shared/SectionTabs";
import { CsvButton } from "@/components/shared/CsvButton";
import { MarkDoneButton } from "./MarkDoneButton";

const TABS = [
  { href: "/pm-calibration", label: "PM schedules" },
  { href: "/pm-calibration/calibrations", label: "Calibration records" },
];

const dayDiff = (a: string, b: string) => Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);

export default async function PMCalibrationPage() {
  const supabase = createClient();
  const role = await getCurrentUserRole();
  const [{ data: pmSchedules }, { data: done }] = await Promise.all([
    supabase
      .from("pm_schedules")
      .select("id, task_name, next_due, last_done, frequency_days, location, equipment_description, equipment(tag_number, name), profiles:last_done_by(full_name)")
      .order("next_due"),
    supabase
      .from("pm_completions")
      .select("id, task_name, equipment_label, location, done_date, next_due, done_by_name, done_by_sap, notes")
      .order("done_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = (pmSchedules ?? []).filter((p: any) => p.next_due < today).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-brand-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">PM &amp; Calibration</h1>
            <p className="text-sm text-gray-500">Schedules, completion history and overdue items</p>
          </div>
        </div>
        {canManage(role) && (
          <Link href="/pm-calibration/new">
            <Button className="gap-1.5">
              <PlusCircle className="h-4 w-4" />
              Add Schedule
            </Button>
          </Link>
        )}
      </div>

      <SectionTabs items={TABS} active="/pm-calibration" />

      {overdueCount > 0 && (
        <Card className="border-red-200 bg-red-50 text-sm text-red-700">
          {overdueCount} PM task{overdueCount > 1 ? "s are" : " is"} overdue. Complete them and tap <b>Mark done</b>.
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        {!pmSchedules || pmSchedules.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400">No PM schedules yet.</p>
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="p-3">Task</th>
                <th className="p-3">Equipment</th>
                <th className="p-3">Location</th>
                <th className="p-3">Last done</th>
                <th className="p-3">Next due</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
                {isAdmin(role) && <th className="p-3"></th>}
              </tr>
            </thead>
            <tbody>
              {pmSchedules.map((pm: any) => {
                const days = dayDiff(pm.next_due, today);
                const overdue = days < 0;
                const soon = !overdue && days <= 7;
                const label = pm.equipment?.tag_number ? `${pm.equipment.tag_number} — ${pm.equipment.name}` : pm.equipment_description || "—";
                return (
                  <tr key={pm.id} className="border-b border-gray-50 align-top last:border-0">
                    <td className="p-3">
                      {pm.task_name}
                      <span className="block text-xs text-gray-400">every {pm.frequency_days} days</span>
                    </td>
                    <td className="p-3 text-gray-500">{label}</td>
                    <td className="p-3 text-gray-500">{pm.location ?? "—"}</td>
                    <td className="p-3 text-gray-500">
                      {pm.last_done ?? "Never"}
                      {pm.profiles?.full_name && <span className="block text-xs text-gray-400">by {pm.profiles.full_name}</span>}
                    </td>
                    <td className="p-3">{pm.next_due}</td>
                    <td className="p-3">
                      <Badge tone={overdue ? "red" : soon ? "amber" : "green"}>
                        {overdue ? `Overdue ${-days}d` : soon ? (days === 0 ? "Due today" : `Due in ${days}d`) : "On schedule"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <MarkDoneButton id={pm.id} taskName={pm.task_name} frequencyDays={pm.frequency_days} />
                    </td>
                    {isAdmin(role) && (
                      <td className="p-3">
                        <DeleteButton table="pm_schedules" id={pm.id} label="Delete" />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">PM completion history</h2>
          <CsvButton
            filename={`pm-completions-${today}.csv`}
            label="Download history (CSV)"
            headers={["Date done", "Task", "Equipment", "Location", "Done by", "SAP number", "Next due", "Notes"]}
            rows={(done ?? []).map((d: any) => [d.done_date, d.task_name, d.equipment_label, d.location, d.done_by_name, d.done_by_sap, d.next_due, d.notes])}
          />
        </div>
        {!done || done.length === 0 ? (
          <p className="text-sm text-gray-400">No PM tasks have been marked done yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {done.slice(0, 15).map((d: any) => (
              <li key={d.id} className="py-2.5 text-sm">
                <p className="font-medium text-gray-900">{d.task_name}</p>
                <p className="text-xs text-gray-500">
                  {d.done_date} · {[d.equipment_label, d.location].filter(Boolean).join(" · ")}
                </p>
                <p className="text-xs text-gray-400">
                  Done by {d.done_by_name ?? "Unknown"}
                  {d.done_by_sap ? ` · SAP ${d.done_by_sap}` : ""} · next due {d.next_due}
                  {d.notes ? ` · “${d.notes}”` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
        {done && done.length > 15 && <p className="mt-2 text-xs text-gray-400">Showing the latest 15 of {done.length}. The CSV contains all of them.</p>}
      </Card>
    </div>
  );
}
