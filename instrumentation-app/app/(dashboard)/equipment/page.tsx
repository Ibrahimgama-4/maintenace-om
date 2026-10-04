import Link from "next/link";
import { Cpu, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, canManage, isAdmin } from "@/lib/utils/role";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DeleteButton } from "@/components/shared/DeleteButton";
import { LineFilter } from "@/components/shared/LineFilter";
import { PLANT_LOCATIONS } from "@/lib/constants";
import { lineOf, NO_LINE, parseLineParam, shortLine } from "@/lib/utils/lines";
import { EquipmentLineSelect } from "./EquipmentLineSelect";

export default async function EquipmentPage({ searchParams }: { searchParams: { line?: string } }) {
  const supabase = createClient();
  const [role, { data }] = await Promise.all([
    getCurrentUserRole(),
    supabase.from("equipment").select("id, tag_number, name, type, location, plant_section, status").order("tag_number"),
  ]);

  const all = (data ?? []).map((e: any) => ({ ...e, line: lineOf(e.location) }));
  const counts: Record<string, number> = {};
  PLANT_LOCATIONS.forEach((l) => (counts[l] = all.filter((e) => e.line === l).length));
  const noLine = all.filter((e) => !e.line).length;

  const active = parseLineParam(searchParams.line);
  const equipment = active ? all.filter((e) => (active === NO_LINE ? !e.line : e.line === active)) : all;
  const addHref = active && active !== NO_LINE ? `/equipment/new?line=${encodeURIComponent(active)}` : "/equipment/new";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-brand-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Equipment Database</h1>
            <p className="text-sm text-gray-500">
              {active && active !== NO_LINE ? `Equipment on ${active}` : "Instruments and control devices, by production line"}
            </p>
          </div>
        </div>
        {canManage(role) && (
          <Link href={addHref}>
            <Button>Add Equipment</Button>
          </Link>
        )}
      </div>

      <LineFilter basePath="/equipment" active={active} counts={counts} total={all.length} noLineLabel="No line" noLineCount={noLine} />

      {canManage(role) && noLine > 0 && (
        <Card className="flex items-start gap-2 border-amber-200 bg-amber-50 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {noLine} item{noLine > 1 ? "s have" : " has"} no production line, so {noLine > 1 ? "they do" : "it does"} not appear in the line pickers on breakdown, PM and calibration forms. Use the
            amber <b>Assign line</b> menu on {noLine > 1 ? "each" : "the"} row to fix it.
          </span>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        {equipment.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">
            {active && active !== NO_LINE ? `No equipment registered on ${active} yet.` : "No equipment registered yet."}
          </p>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-400">
                <th className="p-3">Tag Number</th>
                <th className="p-3">Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">Line</th>
                <th className="p-3">Section</th>
                <th className="p-3">Status</th>
                {isAdmin(role) && <th className="p-3"></th>}
              </tr>
            </thead>
            <tbody>
              {equipment.map((eq: any) => (
                <tr key={eq.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-3">
                    <Link href={`/equipment/${eq.id}`} className="font-medium hover:underline">
                      {eq.tag_number}
                    </Link>
                  </td>
                  <td className="p-3">{eq.name}</td>
                  <td className="p-3 text-gray-500">{eq.type}</td>
                  <td className="p-3 text-gray-600">
                    {canManage(role) ? (
                      <EquipmentLineSelect id={eq.id} value={eq.line ?? ""} />
                    ) : eq.line ? (
                      shortLine(eq.line)
                    ) : (
                      <span className="text-amber-700">No line</span>
                    )}
                  </td>
                  <td className="p-3 text-gray-500">{eq.plant_section ?? "—"}</td>
                  <td className="p-3">
                    <Badge tone={eq.status === "operational" ? "green" : "amber"}>{eq.status}</Badge>
                  </td>
                  {isAdmin(role) && (
                    <td className="p-3">
                      <DeleteButton table="equipment" id={eq.id} label="Delete" />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
