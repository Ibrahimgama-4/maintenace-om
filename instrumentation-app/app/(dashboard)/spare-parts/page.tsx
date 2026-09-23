import Link from "next/link";
import { PlusCircle, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, canManage, isAdmin } from "@/lib/utils/role";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DeleteButton } from "@/components/shared/DeleteButton";

export default async function SparePartsPage() {
  const supabase = createClient();
  const role = await getCurrentUserRole();
  const { data: parts } = await supabase
    .from("spare_parts")
    .select("id, part_number, name, stock_qty, min_stock_qty")
    .order("part_number");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-brand-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Spare Parts</h1>
            <p className="text-sm text-gray-500">Inventory levels and low-stock alerts</p>
          </div>
        </div>
        {canManage(role) && (
          <Link href="/spare-parts/new">
            <Button className="gap-1.5">
              <PlusCircle className="h-4 w-4" />
              Add Part
            </Button>
          </Link>
        )}
      </div>

      <Card className="overflow-x-auto p-0">
        {!parts || parts.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400">No spare parts registered yet.</p>
        ) : (
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="p-3">Part #</th>
                <th className="p-3">Name</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Status</th>
                {isAdmin(role) && <th className="p-3"></th>}
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => {
                const low = p.stock_qty <= p.min_stock_qty;
                return (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0">
                    <td className="p-3">{p.part_number}</td>
                    <td className="p-3">{p.name}</td>
                    <td className="p-3">{p.stock_qty}</td>
                    <td className="p-3">
                      <Badge tone={low ? "red" : "green"}>{low ? "Low stock" : "OK"}</Badge>
                    </td>
                    {isAdmin(role) && (
                      <td className="p-3">
                        <DeleteButton table="spare_parts" id={p.id} label="Delete" />
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
