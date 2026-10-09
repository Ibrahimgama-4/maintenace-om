import Link from "next/link";
import { PlusCircle, Package, ShoppingCart, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, canManage, isAdmin } from "@/lib/utils/role";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DeleteButton } from "@/components/shared/DeleteButton";
import { suggestReorder, URGENCY_ORDER, type ReorderUrgency } from "@/lib/utils/reorder";
import { ReorderCsvButton, type ReorderRow } from "./ReorderCsvButton";

const URGENCY_LABEL: Record<ReorderUrgency, string> = {
  out: "Out of stock",
  low: "Low stock",
  watch: "Running low",
  ok: "OK",
};
const URGENCY_TONE: Record<ReorderUrgency, "red" | "amber" | "green"> = {
  out: "red",
  low: "red",
  watch: "amber",
  ok: "green",
};

export default async function SparePartsPage() {
  const supabase = createClient();
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [role, { data: parts }, { data: usage }] = await Promise.all([
    getCurrentUserRole(),
    supabase.from("spare_parts").select("id, part_number, name, stock_qty, min_stock_qty").order("part_number"),
    supabase.from("breakdown_spare_parts").select("part_id, qty_used").gte("used_at", since),
  ]);

  const used90 = new Map<string, number>();
  (usage ?? []).forEach((u: any) => used90.set(u.part_id, (used90.get(u.part_id) ?? 0) + (u.qty_used ?? 0)));

  const rows = (parts ?? []).map((p) => ({ part: p, s: suggestReorder(p, used90.get(p.id) ?? 0) }));
  const reorder = rows
    .filter((r) => r.s.urgency !== "ok")
    .sort((a, b) => URGENCY_ORDER[a.s.urgency] - URGENCY_ORDER[b.s.urgency] || a.part.part_number.localeCompare(b.part.part_number));
  const csvRows: ReorderRow[] = reorder.map((r) => ({
    part_number: r.part.part_number,
    name: r.part.name,
    stock: r.part.stock_qty,
    minimum: r.part.min_stock_qty,
    suggested_qty: r.s.qty,
    reason: r.s.reason,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-brand-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Spare Parts</h1>
            <p className="text-sm text-gray-500">Inventory levels, usage and reorder suggestions</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/spare-parts/history">
            <Button variant="secondary" className="gap-1.5">
              <History className="h-4 w-4" />
              Usage history
            </Button>
          </Link>
          {canManage(role) && (
            <Link href="/spare-parts/new">
              <Button className="gap-1.5">
                <PlusCircle className="h-4 w-4" />
                Add Part
              </Button>
            </Link>
          )}
        </div>
      </div>

      {parts && parts.length > 0 && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-semibold text-gray-900">Reorder suggestions</h2>
              {reorder.length > 0 && <Badge tone="red">{reorder.length}</Badge>}
            </div>
            {reorder.length > 0 && <ReorderCsvButton rows={csvRows} />}
          </div>
          {reorder.length === 0 ? (
            <p className="text-sm text-green-700">All parts are above their minimum levels. Nothing to order right now.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {reorder.map(({ part, s }) => (
                <li key={part.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {part.name} <span className="text-xs font-normal text-gray-400">{part.part_number}</span>
                    </p>
                    <p className="text-xs text-gray-500">{s.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={URGENCY_TONE[s.urgency]}>{URGENCY_LABEL[s.urgency]}</Badge>
                    <span className="text-sm font-semibold text-gray-900">Order {s.qty}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-gray-400">
            Suggested quantity brings stock up to the larger of twice the minimum level or about two months of recent usage.
          </p>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        {!parts || parts.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400">No spare parts registered yet.</p>
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="p-3">Part #</th>
                <th className="p-3">Name</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Min</th>
                <th className="p-3">Used (90 d)</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
                {isAdmin(role) && <th className="p-3"></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ part: p, s }) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0">
                  <td className="p-3">{p.part_number}</td>
                  <td className="p-3">{p.name}</td>
                  <td className="p-3 font-medium">{p.stock_qty}</td>
                  <td className="p-3 text-gray-500">{p.min_stock_qty}</td>
                  <td className="p-3 text-gray-500">{s.used90}</td>
                  <td className="p-3">
                    <Badge tone={URGENCY_TONE[s.urgency]}>{URGENCY_LABEL[s.urgency]}</Badge>
                  </td>
                  <td className="p-3">
                    <Link href={`/spare-parts/history?part=${p.id}`} className="text-xs font-medium text-brand-600 hover:underline">
                      History
                    </Link>
                  </td>
                  {isAdmin(role) && (
                    <td className="p-3">
                      <DeleteButton table="spare_parts" id={p.id} label="Delete" />
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
