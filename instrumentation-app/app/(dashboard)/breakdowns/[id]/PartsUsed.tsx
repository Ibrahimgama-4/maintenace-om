"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export interface PartUsage {
  id: string;
  qty_used: number;
  used_at: string | null;
  part_number: string;
  name: string;
}

export interface PartOption {
  id: string;
  part_number: string;
  name: string;
  stock_qty: number;
}

export function PartsUsed({
  breakdownId,
  usages,
  parts,
}: {
  breakdownId: string;
  usages: PartUsage[];
  parts: PartOption[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [partId, setPartId] = useState("");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = parts.find((p) => p.id === partId);

  async function addPart() {
    if (!partId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const { data, error: rpcError } = await supabase.rpc("use_spare_part", {
      p_breakdown_id: breakdownId,
      p_part_id: partId,
      p_qty: qty,
    });
    setBusy(false);
    if (rpcError) {
      setError(
        rpcError.message.includes("use_spare_part")
          ? "Parts tracking is not set up yet. Ask your administrator to run the v23 database update."
          : rpcError.message
      );
      return;
    }
    setNotice(`Recorded. ${selected?.part_number ?? "Part"} stock is now ${data}.`);
    setPartId("");
    setQty(1);
    router.refresh();
  }

  async function returnPart(u: PartUsage) {
    if (!window.confirm(`Remove ${u.qty_used} x ${u.part_number} from this breakdown and return it to stock?`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error: rpcError } = await supabase.rpc("return_spare_part", { p_usage_id: u.id });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setNotice("Returned to stock.");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Package className="h-4 w-4 text-brand-600" />
        <h2 className="text-sm font-semibold text-gray-900">Spare parts used</h2>
      </div>

      {usages.length === 0 ? (
        <p className="mb-3 text-sm text-gray-400">No parts recorded for this breakdown.</p>
      ) : (
        <ul className="mb-3 divide-y divide-gray-100 rounded-md border border-gray-100">
          {usages.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 p-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">
                  {u.qty_used} x {u.name}
                </p>
                <p className="text-xs text-gray-400">
                  {u.part_number}
                  {u.used_at ? ` · ${new Date(u.used_at).toLocaleString()}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => returnPart(u)}
                disabled={busy}
                className="inline-flex shrink-0 items-center gap-1 text-xs text-gray-500 hover:text-red-600 disabled:opacity-50"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Return
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={partId}
          onChange={(e) => {
            setPartId(e.target.value);
            setQty(1);
          }}
        >
          <option value="">-- Select a part --</option>
          {parts.map((p) => (
            <option key={p.id} value={p.id} disabled={p.stock_qty <= 0}>
              {p.part_number} — {p.name} ({p.stock_qty} in stock)
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={selected?.stock_qty ?? undefined}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
          aria-label="Quantity used"
        />
        <Button type="button" onClick={addPart} disabled={busy || !partId}>
          {busy ? "Saving..." : "Add part"}
        </Button>
      </div>
      <p className="mt-1 text-xs text-gray-400">Adding a part deducts it from stock automatically. Use Return to undo a mistake.</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {notice && <p className="mt-2 text-sm text-green-700">{notice}</p>}
    </div>
  );
}
