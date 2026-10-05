"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DeleteButton } from "@/components/shared/DeleteButton";
import { PLANT_LOCATIONS, SPOUTS_BY_LINE } from "@/lib/constants";

export interface PackerRecord {
  id: string;
  line: string;
  name: string;
  code: string | null;
  spout_count: number;
  sort_order: number;
  active: boolean;
}

const small = "rounded-md border border-gray-300 px-2 py-1.5 text-sm";

function PackerEditRow({ p, canDelete }: { p: PackerRecord; canDelete: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const [v, setV] = useState(p);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = v.code !== p.code || v.spout_count !== p.spout_count || v.sort_order !== p.sort_order || v.active !== p.active;

  async function save() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.from("packers").update({ code: v.code || null, spout_count: v.spout_count, sort_order: v.sort_order, active: v.active }).eq("id", p.id);
    setBusy(false);
    if (error) return setMsg(error.message);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-gray-100 py-2.5 text-sm">
      <span className="w-24 font-medium text-gray-900">{p.name}</span>
      <label className="text-xs text-gray-500">
        Machine no.
        <input className={`${small} mt-0.5 block w-20`} value={v.code ?? ""} onChange={(e) => setV({ ...v, code: e.target.value })} placeholder="RP1" />
      </label>
      <label className="text-xs text-gray-500">
        Spouts
        <input type="number" min={1} max={24} className={`${small} mt-0.5 block w-20`} value={v.spout_count} onChange={(e) => setV({ ...v, spout_count: Number(e.target.value) || 1 })} />
      </label>
      <label className="text-xs text-gray-500">
        Order
        <input type="number" className={`${small} mt-0.5 block w-16`} value={v.sort_order} onChange={(e) => setV({ ...v, sort_order: Number(e.target.value) || 0 })} />
      </label>
      <label className="flex items-center gap-1.5 pb-2 text-xs text-gray-600">
        <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /> Active
      </label>
      {dirty && (
        <Button type="button" onClick={save} disabled={busy} className="py-1.5">
          {busy ? "Saving..." : "Save"}
        </Button>
      )}
      {canDelete && <DeleteButton table="packers" id={p.id} label="Delete" confirmText="Delete this packer? Past calibration sheets are kept." />}
      {msg && <span className="text-xs text-red-600">{msg}</span>}
    </div>
  );
}

function AddPackers({ line, existing }: { line: string; existing: PackerRecord[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [count, setCount] = useState(1);
  const [spouts, setSpouts] = useState(SPOUTS_BY_LINE[line] ?? 8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    const last = existing.reduce((m, p) => Math.max(m, Number(p.name.match(/\d+/)?.[0] ?? 0)), 0);
    const rows = Array.from({ length: count }, (_, i) => ({
      line,
      name: `Packer ${last + i + 1}`,
      code: `RP${last + i + 1}`,
      spout_count: spouts,
      sort_order: last + i + 1,
    }));
    const { error: e } = await supabase.from("packers").insert(rows);
    setBusy(false);
    if (e) return setError(e.message.includes("packers") && e.message.includes("does not exist") ? "Ask your administrator to run the v26 database update." : e.message);
    router.refresh();
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md bg-gray-50 p-3">
      <label className="text-xs text-gray-600">
        Add packers
        <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} className={`${small} mt-0.5 block w-20 bg-white`} />
      </label>
      <label className="text-xs text-gray-600">
        Spouts each
        <input type="number" min={1} max={24} value={spouts} onChange={(e) => setSpouts(Math.max(1, Number(e.target.value) || 1))} className={`${small} mt-0.5 block w-20 bg-white`} />
      </label>
      <Button type="button" onClick={add} disabled={busy}>
        {busy ? "Adding..." : "Add"}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export function PackerSetup({ initial, canDelete }: { initial: PackerRecord[]; canDelete: boolean }) {
  return (
    <div className="space-y-4">
      {PLANT_LOCATIONS.map((line) => {
        const list = initial.filter((p) => p.line === line).sort((a, b) => a.sort_order - b.sort_order);
        return (
          <Card key={line}>
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-gray-900">{line}</h2>
              <span className="text-xs text-gray-400">default {SPOUTS_BY_LINE[line] ?? 8} spouts per packer</span>
            </div>
            {list.length === 0 && <p className="mt-2 text-sm text-gray-400">No packers yet.</p>}
            {list.map((p) => (
              <PackerEditRow key={p.id} p={p} canDelete={canDelete} />
            ))}
            <AddPackers line={line} existing={list} />
          </Card>
        );
      })}
    </div>
  );
}
