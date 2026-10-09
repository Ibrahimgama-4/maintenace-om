"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DeleteButton } from "@/components/shared/DeleteButton";
import { GROUPS, groupLabel } from "@/lib/utils/shifts";

export interface RosterPerson {
  id: string;
  profile_id: string | null;
  full_name: string;
  sap_number: string | null;
  shift_group: string;
  active: boolean;
  sort_order: number;
}
export interface ProfileOption {
  id: string;
  full_name: string;
  sap_number: string | null;
}

const fld = "rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm";

function PersonRow({ p }: { p: RosterPerson }) {
  const router = useRouter();
  const supabase = createClient();
  const [v, setV] = useState({ name: p.full_name, sap: p.sap_number ?? "", group: p.shift_group, active: p.active });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = v.name !== p.full_name || v.sap !== (p.sap_number ?? "") || v.group !== p.shift_group || v.active !== p.active;

  async function save() {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("roster_staff").update({ full_name: v.name.trim(), sap_number: v.sap.trim() || null, shift_group: v.group, active: v.active }).eq("id", p.id);
    setBusy(false);
    if (error) return setErr(error.message);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-gray-100 py-2.5">
      <label className="text-xs text-gray-500">
        Name
        <input className={`${fld} mt-0.5 block w-44`} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </label>
      <label className="text-xs text-gray-500">
        SAP
        <input className={`${fld} mt-0.5 block w-28`} value={v.sap} onChange={(e) => setV({ ...v, sap: e.target.value })} />
      </label>
      <label className="text-xs text-gray-500">
        Shift
        <select className={`${fld} mt-0.5 block`} value={v.group} onChange={(e) => setV({ ...v, group: e.target.value })}>
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {groupLabel(g)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 pb-2 text-xs text-gray-600">
        <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /> On roster
      </label>
      {p.profile_id && <span className="pb-2 text-[11px] text-gray-400">app user</span>}
      {dirty && (
        <Button type="button" onClick={save} disabled={busy || !v.name.trim()} className="py-1.5">
          {busy ? "Saving..." : "Save"}
        </Button>
      )}
      <DeleteButton table="roster_staff" id={p.id} label="Remove" confirmText="Remove this person from the roster? Their duty changes are deleted too." />
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}

export function StaffManager({ people, available }: { people: RosterPerson[]; available: ProfileOption[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [pick, setPick] = useState("");
  const [pickGroup, setPickGroup] = useState("A");
  const [name, setName] = useState("");
  const [sap, setSap] = useState("");
  const [group, setGroup] = useState("A");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const nextOrder = people.reduce((m, p) => Math.max(m, p.sort_order), 0) + 1;

  async function add(row: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.from("roster_staff").insert({ ...row, sort_order: nextOrder });
    setBusy(false);
    if (error) return setMsg(error.message.includes("does not exist") ? "Ask your administrator to run the v27 database update." : error.message);
    setPick("");
    setName("");
    setSap("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Add an app user</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-gray-600">
            Person (name and SAP)
            <select className={`${fld} mt-1 block min-w-[15rem]`} value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">-- Select --</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                  {p.sap_number ? ` (SAP ${p.sap_number})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-600">
            Shift
            <select className={`${fld} mt-1 block`} value={pickGroup} onChange={(e) => setPickGroup(e.target.value)}>
              {GROUPS.map((g) => (
                <option key={g} value={g}>
                  {groupLabel(g)}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            disabled={busy || !pick}
            onClick={() => {
              const u = available.find((a) => a.id === pick);
              if (u) add({ profile_id: u.id, full_name: u.full_name, sap_number: u.sap_number, shift_group: pickGroup });
            }}
          >
            Add to roster
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Or type a name and SAP number</h2>
        <p className="mb-2 text-xs text-gray-500">For staff who do not use the app.</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-gray-600">
            Name
            <input className={`${fld} mt-1 block w-48`} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="text-xs text-gray-600">
            SAP number
            <input className={`${fld} mt-1 block w-32`} value={sap} onChange={(e) => setSap(e.target.value)} />
          </label>
          <label className="text-xs text-gray-600">
            Shift
            <select className={`${fld} mt-1 block`} value={group} onChange={(e) => setGroup(e.target.value)}>
              {GROUPS.map((g) => (
                <option key={g} value={g}>
                  {groupLabel(g)}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" disabled={busy || !name.trim()} onClick={() => add({ full_name: name.trim(), sap_number: sap.trim() || null, shift_group: group })}>
            Add to roster
          </Button>
        </div>
      </Card>
      {msg && <p className="text-sm text-red-600">{msg}</p>}

      {GROUPS.map((g) => {
        const list = people.filter((p) => p.shift_group === g);
        return (
          <Card key={g}>
            <h2 className="text-sm font-semibold text-gray-900">
              {groupLabel(g)} <span className="font-normal text-gray-400">({list.length})</span>
            </h2>
            {list.length === 0 ? <p className="mt-1 text-sm text-gray-400">No one yet.</p> : list.map((p) => <PersonRow key={p.id} p={p} />)}
          </Card>
        );
      })}
    </div>
  );
}
