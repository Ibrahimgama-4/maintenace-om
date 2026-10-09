import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, isAdmin } from "@/lib/utils/role";
import { Card } from "@/components/ui/Card";
import { DUTY_META, groupLabel, type ShiftConfig } from "@/lib/utils/shifts";
import { fmtRange, leaveBlocks, leaveTotals, type LeaveDay } from "@/lib/utils/leave";
import { LeaveExport, type LeaveSummaryRow } from "./LeaveExport";

export default async function LeaveRecordPage({ searchParams }: { searchParams: { y?: string } }) {
  const supabase = createClient();
  const thisYear = new Date().getFullYear();
  const y = /^\d{4}$/.test(searchParams.y ?? "") ? Number(searchParams.y) : thisYear;
  const today = new Date().toISOString().slice(0, 10);

  const [role, { data: cfg }, { data: staffRows }, { data: leaveRows }] = await Promise.all([
    getCurrentUserRole(),
    supabase.from("shift_settings").select("anchor_date, a_offset, b_offset, c_offset").eq("id", 1).maybeSingle(),
    supabase.from("roster_staff").select("id, full_name, sap_number, shift_group, active").order("shift_group").order("full_name"),
    supabase.from("duty_overrides").select("staff_id, duty_date, code").in("code", ["AL", "SL", "CA"]).gte("duty_date", `${y}-01-01`).lte("duty_date", `${y}-12-31`),
  ]);

  if (!isAdmin(role)) return <Card className="max-w-xl p-8 text-center text-sm text-gray-500">The leave record is available to administrators.</Card>;
  if (!cfg) return <Card className="border-amber-200 bg-amber-50 text-sm text-amber-800">Not set up yet. Run the v27 and v28 database updates first.</Card>;

  const staff = (staffRows ?? []) as { id: string; full_name: string; sap_number: string | null; shift_group: string; active: boolean }[];
  const days = (leaveRows ?? []) as LeaveDay[];
  const groupOf = (id: string) => staff.find((s) => s.id === id)?.shift_group ?? "G";
  const blocks = leaveBlocks(days, groupOf, cfg as ShiftConfig);

  const rows: (LeaveSummaryRow & { id: string; active: boolean })[] = staff.map((s) => {
    const t = leaveTotals(days, s.id, today);
    return {
      id: s.id,
      active: s.active,
      name: s.full_name,
      sap: s.sap_number ?? "",
      shift: groupLabel(s.shift_group),
      ...t,
      periods: blocks
        .filter((b) => b.staff_id === s.id)
        .map((b) => `${b.code} ${fmtRange(b.start, b.end)} (${b.days}d)`)
        .join("; "),
    };
  });
  const sum = (k: "AL" | "SL" | "CA" | "total") => rows.reduce((a, r) => a + r[k], 0);

  return (
    <div className="max-w-5xl space-y-4">
      <Link href="/duty-roster" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" />
        Back to duty roster
      </Link>
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-brand-600" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Staff Leave Record</h1>
          <p className="text-sm text-gray-500">Days of annual, sick and casual leave per person, worked out from the duty roster</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Link href={`/duty-roster/leave?y=${y - 1}`} aria-label="Previous year" className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h2 className="min-w-[5rem] text-center text-base font-semibold text-gray-900">{y}</h2>
        <Link href={`/duty-roster/leave?y=${y + 1}`} aria-label="Next year" className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100">
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["AL", "SL", "CA", "total"] as const).map((k) => (
          <Card key={k} className="p-3 sm:p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{k === "total" ? "All leave" : DUTY_META[k].label}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{sum(k)}</p>
            <p className="text-[11px] text-gray-400">days in {y}</p>
          </Card>
        ))}
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">Counts update automatically whenever leave is planned, extended or reduced on the duty roster.</p>
        <LeaveExport year={y} rows={rows} />
      </Card>

      <Card className="overflow-x-auto p-0">
        {rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400">No staff on the roster yet.</p>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="p-3">Name</th>
                <th className="p-3">Shift</th>
                <th className="p-3 text-center">AL</th>
                <th className="p-3 text-center">SL</th>
                <th className="p-3 text-center">CA</th>
                <th className="p-3 text-center">Total</th>
                <th className="p-3 text-center">Taken</th>
                <th className="p-3 text-center">Planned</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 align-top last:border-0">
                  <td className="p-3">
                    <span className="font-medium text-gray-900">{r.name}</span>
                    {!r.active && <span className="ml-1.5 rounded bg-gray-100 px-1.5 text-[10px] text-gray-500">not on roster</span>}
                    <span className="block text-xs text-gray-400">{r.sap ? `SAP ${r.sap}` : "No SAP"}</span>
                    {r.periods && <span className="mt-1 block text-xs text-gray-500">{r.periods}</span>}
                  </td>
                  <td className="p-3 text-gray-600">{r.shift}</td>
                  <td className="p-3 text-center">{r.AL}</td>
                  <td className="p-3 text-center">{r.SL}</td>
                  <td className="p-3 text-center">{r.CA}</td>
                  <td className="p-3 text-center font-semibold">{r.total}</td>
                  <td className="p-3 text-center text-gray-600">{r.taken}</td>
                  <td className="p-3 text-center text-gray-600">{r.planned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="text-xs text-gray-400">Taken = leave days up to today. Planned = leave days after today. Rest days (O, or Sunday for General staff) are only counted if they were marked as leave.</p>
    </div>
  );
}
