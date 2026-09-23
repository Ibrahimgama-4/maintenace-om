import Link from "next/link";
import { PlusCircle, CalendarCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, canManage, isAdmin } from "@/lib/utils/role";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DeleteButton } from "@/components/shared/DeleteButton";

export default async function PMCalibrationPage() {
  const supabase = createClient();
  const role = await getCurrentUserRole();
  const { data: pmSchedules } = await supabase
    .from("pm_schedules")
    .select("id, task_name, next_due, location, equipment_id, equipment_description, equipment(tag_number, name)")
    .order("next_due");

  const today = new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-brand-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Preventive Maintenance & Calibration</h1>
            <p className="text-sm text-gray-500">Schedules, due dates, and overdue items</p>
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

      <Card className="overflow-x-auto p-0">
        {!pmSchedules || pmSchedules.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400">No PM schedules yet.</p>
        ) : (
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="p-3">Task</th>
                <th className="p-3">Equipment</th>
                <th className="p-3">Location</th>
                <th className="p-3">Next Due</th>
                <th className="p-3">Status</th>
                {isAdmin(role) && <th className="p-3"></th>}
              </tr>
            </thead>
            <tbody>
              {pmSchedules.map((pm: any) => {
                const overdue = new Date(pm.next_due) < today;
                const equipmentLabel = pm.equipment?.tag_number
                  ? `${pm.equipment.tag_number} — ${pm.equipment.name}`
                  : pm.equipment_description || "—";
                return (
                  <tr key={pm.id} className="border-b border-gray-50 last:border-0">
                    <td className="p-3">{pm.task_name}</td>
                    <td className="p-3 text-gray-500">{equipmentLabel}</td>
                    <td className="p-3 text-gray-500">{pm.location ?? "—"}</td>
                    <td className="p-3">{pm.next_due}</td>
                    <td className="p-3">
                      <Badge tone={overdue ? "red" : "green"}>{overdue ? "Overdue" : "On schedule"}</Badge>
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
    </div>
  );
}
