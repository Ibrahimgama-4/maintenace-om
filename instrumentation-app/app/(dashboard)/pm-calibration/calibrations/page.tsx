import Link from "next/link";
import { PlusCircle, Gauge } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, isAdmin } from "@/lib/utils/role";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DeleteButton } from "@/components/shared/DeleteButton";
import { SectionTabs } from "@/components/shared/SectionTabs";
import { CsvButton } from "@/components/shared/CsvButton";

const TABS = [
  { href: "/pm-calibration", label: "PM schedules" },
  { href: "/pm-calibration/calibrations", label: "Calibration records" },
];
const TONE: Record<string, "green" | "amber" | "red"> = { pass: "green", adjusted: "amber", fail: "red" };
const dayDiff = (a: string, b: string) => Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);

export default async function CalibrationsPage() {
  const supabase = createClient();
  const role = await getCurrentUserRole();
  const { data } = await supabase
    .from("calibrations")
    .select("id, calibration_date, result, next_due_date, equipment_label, location, as_found, as_left, standard_used, certificate_no, notes, performed_by_name, performed_by_sap, equipment(tag_number, name)")
    .order("calibration_date", { ascending: false })
    .limit(2000);

  const rows = (data ?? []).map((c: any) => ({
    ...c,
    label: c.equipment_label ?? (c.equipment ? `${c.equipment.tag_number} — ${c.equipment.name}` : "Unknown instrument"),
  }));
  const today = new Date().toISOString().slice(0, 10);

  // Latest record per instrument decides whether it is currently overdue / due soon.
  const latest = new Map<string, any>();
  rows.forEach((r) => !latest.has(r.label) && latest.set(r.label, r));
  const status = Array.from(latest.values()).filter((r) => r.next_due_date);
  const overdue = status.filter((r) => r.next_due_date < today).length;
  const soon = status.filter((r) => r.next_due_date >= today && dayDiff(r.next_due_date, today) <= 30).length;
  const failed = rows.filter((r) => r.result === "fail" && dayDiff(today, r.calibration_date) <= 90).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-brand-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Calibration Records</h1>
            <p className="text-sm text-gray-500">As-found / as-left results and next due dates</p>
          </div>
        </div>
        <Link href="/pm-calibration/calibrations/new">
          <Button className="gap-1.5">
            <PlusCircle className="h-4 w-4" />
            Add Record
          </Button>
        </Link>
      </div>

      <SectionTabs items={TABS} active="/pm-calibration/calibrations" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: "Records", v: rows.length, c: "" },
          { l: "Overdue", v: overdue, c: overdue ? "text-red-600" : "" },
          { l: "Due in 30 days", v: soon, c: soon ? "text-amber-600" : "" },
          { l: "Failed (90 days)", v: failed, c: failed ? "text-red-600" : "" },
        ].map((s) => (
          <Card key={s.l} className="p-3 sm:p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{s.l}</p>
            <p className={`mt-1 text-2xl font-semibold text-gray-900 ${s.c}`}>{s.v}</p>
          </Card>
        ))}
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">Overdue and due-soon counts use the latest record for each instrument.</p>
        <CsvButton
          filename={`calibration-records-${today}.csv`}
          headers={["Date", "Instrument", "Location", "Result", "As found", "As left", "Standard used", "Certificate no.", "Next due", "Performed by", "SAP number", "Notes"]}
          rows={rows.map((r) => [r.calibration_date, r.label, r.location, r.result, r.as_found, r.as_left, r.standard_used, r.certificate_no, r.next_due_date, r.performed_by_name, r.performed_by_sap, r.notes])}
        />
      </Card>

      <Card className="overflow-x-auto p-0">
        {rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400">No calibration records yet. Tap Add Record after calibrating an instrument.</p>
        ) : (
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="p-3">Date</th>
                <th className="p-3">Instrument</th>
                <th className="p-3">Result</th>
                <th className="p-3">As found → as left</th>
                <th className="p-3">Standard / certificate</th>
                <th className="p-3">Next due</th>
                <th className="p-3">Performed by</th>
                {isAdmin(role) && <th className="p-3"></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const d = r.next_due_date ? dayDiff(r.next_due_date, today) : null;
                return (
                  <tr key={r.id} className="border-b border-gray-50 align-top last:border-0">
                    <td className="whitespace-nowrap p-3 text-gray-600">{r.calibration_date}</td>
                    <td className="p-3">
                      {r.label}
                      {r.location && <span className="block text-xs text-gray-400">{r.location}</span>}
                      {r.notes && <span className="block text-xs italic text-gray-400">“{r.notes}”</span>}
                    </td>
                    <td className="p-3">
                      <Badge tone={TONE[r.result] ?? "gray"}>{r.result}</Badge>
                    </td>
                    <td className="p-3 text-gray-600">{r.as_found || r.as_left ? `${r.as_found || "—"} → ${r.as_left || "—"}` : "—"}</td>
                    <td className="p-3 text-gray-600">
                      {r.standard_used || "—"}
                      {r.certificate_no && <span className="block text-xs text-gray-400">Cert {r.certificate_no}</span>}
                    </td>
                    <td className="p-3">
                      {r.next_due_date ?? "—"}
                      {d !== null && d < 0 && <span className="block text-xs font-medium text-red-600">Overdue {-d}d</span>}
                      {d !== null && d >= 0 && d <= 30 && <span className="block text-xs font-medium text-amber-600">Due in {d}d</span>}
                    </td>
                    <td className="p-3">
                      {r.performed_by_name ?? "Unknown"}
                      {r.performed_by_sap && <span className="block text-xs text-gray-400">SAP {r.performed_by_sap}</span>}
                    </td>
                    {isAdmin(role) && (
                      <td className="p-3">
                        <DeleteButton table="calibrations" id={r.id} label="Delete" />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
