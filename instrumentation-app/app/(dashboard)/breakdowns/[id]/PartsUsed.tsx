"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Undo2, MapPin, User, Cog } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { PLANT_LOCATIONS } from "@/lib/constants";

export interface PartUsage {
  id: string;
  qty_used: number;
  used_at: string | null;
  part_number: string;
  name: string;
  machine: string | null;
  location: string | null;
  used_by: string | null;
  used_by_sap: string | null;
  notes: string | null;
}

export interface PartOption {
  id: string;
  part_number: string;
  name: string;
  stock_qty: number;
}

export interface EquipmentOption {
  id: string;
  label: string;
  line: string | null;
}

const inputCls = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";

export function PartsUsed({
  breakdownId,
  usages,
  parts,
  equipment,
  defaultMachine,
  defaultLocation,
}: {
  breakdownId: string;
  usages: PartUsage[];
  parts: PartOption[];
  equipment: EquipmentOption[];
  defaultMachine: string;
  defaultLocation: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [partId, setPartId] = useState("");
  const [qty, setQty] = useState(1);
  const [machine, setMachine] = useState(defaultMachine);
  const [location, setLocation] = useState(defaultLocation || PLANT_LOCATIONS[0]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = parts.find((p) => p.id === partId);
  const lineMachines = equipment.filter((e) => e.line === location);

  async function addPart() {
    if (!partId) return;
    if (!machine.trim()) {
      setError("Enter the machine / equipment the part is used on.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    // If the typed text matches a registered item, link it to the equipment registry for audit.
    const match = lineMachines.find((e) => e.label.toLowerCase() === machine.trim().toLowerCase());
    const { data, error: rpcError } = await supabase.rpc("use_spare_part", {
      p_breakdown_id: breakdownId,
      p_part_id: partId,
      p_qty: qty,
      p_equipment_id: match?.id ?? null,
      p_machine: match ? null : machine.trim(),
      p_location: location,
      p_notes: notes.trim() || null,
    });
    setBusy(false);
    if (rpcError) {
      setError(
        rpcError.message.includes("use_spare_part")
          ? "Parts tracking is not up to date. Ask your administrator to run the v24 database update."
          : rpcError.message
      );
      return;
    }
    setNotice(`Recorded. ${selected?.part_number ?? "Part"} stock is now ${data}.`);
    setPartId("");
    setQty(1);
    setNotes("");
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
        <ul className="mb-4 divide-y divide-gray-100 rounded-md border border-gray-100">
          {usages.map((u) => (
            <li key={u.id} className="p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">
                    {u.qty_used} x {u.name} <span className="text-xs font-normal text-gray-400">{u.part_number}</span>
                  </p>
                  <div className="mt-1 space-y-0.5 text-xs text-gray-500">
                    <p className="flex items-center gap-1.5">
                      <Cog className="h-3.5 w-3.5 shrink-0" /> {u.machine ?? "Machine not recorded"}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" /> {u.location ?? "Location not recorded"}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      {u.used_by ?? "Unknown"}
                      {u.used_by_sap ? ` · SAP ${u.used_by_sap}` : ""}
                      {u.used_at ? ` · ${new Date(u.used_at).toLocaleString()}` : ""}
                    </p>
                    {u.notes && <p className="italic text-gray-500">“{u.notes}”</p>}
                  </div>
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
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 rounded-md bg-gray-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Record a part used</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
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
            className="w-24 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            aria-label="Quantity used"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs font-medium text-gray-600">
            Machine / equipment *
            <input
              list="machine-options"
              value={machine}
              onChange={(e) => setMachine(e.target.value)}
              placeholder="Pick from registry or type"
              className={`${inputCls} mt-1 bg-white`}
            />
            <span className="mt-1 block font-normal text-gray-400">
              {lineMachines.length} machine{lineMachines.length === 1 ? "" : "s"} registered on this line. Type to search, or enter a machine not yet registered.
            </span>
            <datalist id="machine-options">
              {lineMachines.map((e) => (
                <option key={e.id} value={e.label} />
              ))}
            </datalist>
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Location *
            <select value={location} onChange={(e) => setLocation(e.target.value)} className={`${inputCls} mt-1 bg-white`}>
              {PLANT_LOCATIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
              {!(PLANT_LOCATIONS as readonly string[]).includes(location) && <option value={location}>{location}</option>}
            </select>
          </label>
        </div>
        <label className="block text-xs font-medium text-gray-600">
          Notes (optional)
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. replaced level pendulum on Packer 2, spout 3"
            className={`${inputCls} mt-1 bg-white`}
          />
        </label>
        <Button type="button" onClick={addPart} disabled={busy || !partId}>
          {busy ? "Saving..." : "Add part"}
        </Button>
        <p className="text-xs text-gray-400">
          Stock is deducted automatically. Who used it, the machine, the location and the time are saved for auditing. Use Return to undo a mistake.
        </p>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {notice && <p className="mt-2 text-sm text-green-700">{notice}</p>}
    </div>
  );
}
