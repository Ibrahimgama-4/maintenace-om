import Link from "next/link";
import { History, ArrowLeft, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PLANT_LOCATIONS } from "@/lib/constants";
import { PartsHistoryExport, type UsageRow } from "./PartsHistoryExport";

const SHOW = 150;
const inputCls = "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm";

export default async function PartsHistoryPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; part?: string; location?: string; q?: string };
}) {
  const supabase = createClient();
  const { from, to, part, location, q } = searchParams;

  let query = supabase
    .from("breakdown_spare_parts")
    .select(
      "id, qty_used, used_at, breakdown_id, machine, location, notes, used_by_name, used_by_sap, spare_parts(part_number, name), profiles:used_by(full_name, sap_number), breakdowns(fault_description, location, equipment(tag_number, name))"
    )
    .order("used_at", { ascending: false })
    .limit(5000);
  if (from) query = query.gte("used_at", `${from}T00:00:00`);
  if (to) query = query.lte("used_at", `${to}T23:59:59.999`);
  if (part) query = query.eq("part_id", part);

  const [{ data: raw }, { data: partList }] = await Promise.all([
    query,
    supabase.from("spare_parts").select("id, part_number, name").order("part_number"),
  ]);

  let rows: UsageRow[] = (raw ?? []).map((r: any) => ({
    id: r.id,
    used_at: r.used_at,
    part_number: r.spare_parts?.part_number ?? "—",
    part_name: r.spare_parts?.name ?? "Unknown part",
    qty: r.qty_used,
    machine: r.machine ?? (r.breakdowns?.equipment ? `${r.breakdowns.equipment.tag_number} — ${r.breakdowns.equipment.name}` : "Not recorded"),
    location: r.location ?? r.breakdowns?.location ?? "Not recorded",
    used_by: r.used_by_name ?? r.profiles?.full_name ?? "Unknown",
    sap: r.used_by_sap ?? r.profiles?.sap_number ?? "",
    breakdown_id: r.breakdown_id,
    fault: r.breakdowns?.fault_description ?? "",
    notes: r.notes ?? "",
  }));

  if (location) rows = rows.filter((r) => r.location === location);
  const needle = (q ?? "").trim().toLowerCase();
  if (needle) {
    rows = rows.filter((r) =>
      [r.machine, r.location, r.used_by, r.sap, r.part_number, r.part_name, r.fault, r.notes].some((v) => v.toLowerCase().includes(needle))
    );
  }

  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const machines = new Set(rows.map((r) => r.machine)).size;
  const people = new Set(rows.map((r) => r.used_by)).size;
  const byLocation = new Map<string, number>();
  rows.forEach((r) => byLocation.set(r.location, (byLocation.get(r.location) ?? 0) + r.qty));

  const filterText = [
    from && `From ${from}`,
    to && `To ${to}`,
    part && partList?.find((p: any) => p.id === part) && `Part ${partList.find((p: any) => p.id === part)!.part_number}`,
    location && `Location: ${location}`,
    needle && `Search: "${q}"`,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <div className="max-w-6xl space-y-4">
      <Link href="/spare-parts" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" />
        Back to spare parts
      </Link>
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-brand-600" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Spare Parts Usage History</h1>
          <p className="text-sm text-gray-500">Who used which part, on which machine, where and when</p>
        </div>
      </div>

      <Card>
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs font-medium text-gray-600">
            From
            <input type="date" name="from" defaultValue={from ?? ""} className={`${inputCls} mt-1`} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            To
            <input type="date" name="to" defaultValue={to ?? ""} className={`${inputCls} mt-1`} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Part
            <select name="part" defaultValue={part ?? ""} className={`${inputCls} mt-1`}>
              <option value="">All parts</option>
              {(partList ?? []).map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.part_number} — {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-600">
            Location
            <select name="location" defaultValue={location ?? ""} className={`${inputCls} mt-1`}>
              <option value="">All locations</option>
              {PLANT_LOCATIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-600">
            Search machine, person, SAP...
            <input name="q" defaultValue={q ?? ""} placeholder="e.g. Packer 2 or 181351" className={`${inputCls} mt-1`} />
          </label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
            <Button type="submit" className="gap-1.5">
              <Search className="h-4 w-4" />
              Apply filters
            </Button>
            <Link href="/spare-parts/history">
              <Button type="button" variant="secondary">
                Reset
              </Button>
            </Link>
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: "Records", v: rows.length },
          { l: "Parts used (qty)", v: totalQty },
          { l: "Machines", v: machines },
          { l: "People", v: people },
        ].map((s) => (
          <Card key={s.l} className="p-3 sm:p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{s.l}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{s.v}</p>
          </Card>
        ))}
      </div>

      {byLocation.size > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {Array.from(byLocation.entries()).map(([l, n]) => (
            <span key={l} className="rounded-full bg-blue-50 px-3 py-1 text-blue-800">
              {l}: <b>{n}</b> used
            </span>
          ))}
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            Downloads include <b>all {rows.length}</b> matching record{rows.length === 1 ? "" : "s"}, not just those shown below.
          </p>
          <PartsHistoryExport rows={rows} filterText={filterText} />
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        {rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400">No parts usage matches these filters.</p>
        ) : (
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="p-3">Date / time</th>
                <th className="p-3">Part</th>
                <th className="p-3">Qty</th>
                <th className="p-3">Machine / equipment</th>
                <th className="p-3">Location</th>
                <th className="p-3">Used by</th>
                <th className="p-3">Breakdown</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, SHOW).map((r) => (
                <tr key={r.id} className="border-b border-gray-50 align-top last:border-0">
                  <td className="whitespace-nowrap p-3 text-gray-600">
                    {new Date(r.used_at).toLocaleDateString()}
                    <span className="block text-xs text-gray-400">{new Date(r.used_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </td>
                  <td className="p-3">
                    <span className="font-medium text-gray-900">{r.part_name}</span>
                    <span className="block text-xs text-gray-400">{r.part_number}</span>
                  </td>
                  <td className="p-3 font-semibold">{r.qty}</td>
                  <td className="p-3">
                    {r.machine}
                    {r.notes && <span className="block text-xs italic text-gray-400">“{r.notes}”</span>}
                  </td>
                  <td className="p-3 text-gray-600">{r.location}</td>
                  <td className="p-3">
                    {r.used_by}
                    {r.sap && <span className="block text-xs text-gray-400">SAP {r.sap}</span>}
                  </td>
                  <td className="p-3">
                    <Link href={`/breakdowns/${r.breakdown_id}`} className="text-brand-600 hover:underline">
                      {r.fault ? (r.fault.length > 40 ? r.fault.slice(0, 40) + "…" : r.fault) : "Open"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {rows.length > SHOW && <p className="text-xs text-gray-400">Showing the latest {SHOW} of {rows.length}. Use filters or download for the full list.</p>}
    </div>
  );
}
