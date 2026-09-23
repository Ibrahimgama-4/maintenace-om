import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, canManage, isAdmin } from "@/lib/utils/role";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DeleteButton } from "@/components/shared/DeleteButton";

export default async function EquipmentPage() {
  const supabase = createClient();
  const role = await getCurrentUserRole();

  const { data: equipment } = await supabase
    .from("equipment")
    .select("id, tag_number, name, type, plant_section, status")
    .order("tag_number");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Equipment Database</h1>
          <p className="text-sm text-gray-500">Instruments and control devices across the plant</p>
        </div>
        {canManage(role) && (
          <Link href="/equipment/new">
            <Button>Add Equipment</Button>
          </Link>
        )}
      </div>

      <Card className="p-0">
        {!equipment || equipment.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">No equipment registered yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-400">
                <th className="p-3">Tag Number</th>
                <th className="p-3">Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">Section</th>
                <th className="p-3">Status</th>
                {isAdmin(role) && <th className="p-3"></th>}
              </tr>
            </thead>
            <tbody>
              {equipment.map((eq) => (
                <tr key={eq.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-3">
                    <Link href={`/equipment/${eq.id}`} className="font-medium hover:underline">
                      {eq.tag_number}
                    </Link>
                  </td>
                  <td className="p-3">{eq.name}</td>
                  <td className="p-3 text-gray-500">{eq.type}</td>
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
