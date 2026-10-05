"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PLANT_LOCATIONS } from "@/lib/constants";
import { errorPct, isSunday, plantToday, rotationFor, sheetRows, sortPackers, type PackerLite } from "@/lib/utils/spout";

interface PackerRow extends PackerLite {
  line: string;
  spout_count: number;
}
interface Row {
  kind: "packer" | "spout" | "checkweigher";
  label: string;
  zb: string;
  sb: string;
  za: string;
  sa: string;
}

const sel = "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm";
const cellIn = "w-full min-w-[4.2rem] rounded border border-gray-300 px-2 py-1.5 text-center text-sm";
const num = (v: string) => (v.trim() === "" ? null : Number(v));

export default function NewSpoutSheetPage() {
  const router = useRouter();
  const supabase = createClient();
  const [packers, setPackers] = useState<PackerRow[]>([]);
  const [recent, setRecent] = useState<{ packer_id: string | null; line: string; cal_date: string; created_at: string }[]>([]);
  const [me, setMe] = useState<{ full_name: string; sap_number: string | null } | null>(null);
  const [line, setLine] = useState("");
  const [packerId, setPackerId] = useState("");
  const [date, setDate] = useState(plantToday());
  const [rows, setRows] = useState<Row[]>([]);
  const [notes, setNotes] = useState("");
  const [prodName, setProdName] = useState("");
  const [prodStaff, setProdStaff] = useState("");
  const [prodRemarks, setProdRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const builtFor = useRef<string>("");

  useEffect(() => {
    supabase.from("packers").select("id, line, name, code, spout_count, sort_order").eq("active", true).then(({ data }) => {
      setPackers((data as PackerRow[]) ?? []);
      const qs = new URLSearchParams(window.location.search);
      const l = qs.get("line");
      const p = qs.get("packer");
      if (l && (PLANT_LOCATIONS as readonly string[]).includes(l)) setLine(l);
      if (p) setPackerId(p);
    });
    supabase.from("spout_calibrations").select("packer_id, line, cal_date, created_at").order("cal_date", { ascending: false }).order("created_at", { ascending: false }).limit(300).then(({ data }) => setRecent((data as any) ?? []));
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) supabase.from("profiles").select("full_name, sap_number").eq("id", user.id).single().then(({ data }) => setMe(data as any));
    });
  }, [supabase]);

  const linePackers = sortPackers(packers.filter((p) => p.line === line));
  const rotation = line ? rotationFor(linePackers, recent.filter((r) => r.line === line), date) : null;
  const suggested = rotation && (rotation.state === "due" ? rotation.packer : rotation.state === "none" ? null : rotation.next);

  // Choosing a line picks the packer that is next in that line's rotation.
  useEffect(() => {
    if (!line) return;
    if (!linePackers.some((p) => p.id === packerId)) setPackerId(suggested?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, packers.length, recent.length]);

  // Build the sheet rows (packer, SP1..SPn, check weigher) once per chosen packer.
  useEffect(() => {
    const p = packers.find((x) => x.id === packerId);
    if (!p || builtFor.current === p.id) return;
    builtFor.current = p.id;
    setRows(sheetRows(p.code, p.spout_count).map((r) => ({ ...r, zb: "", sb: "", za: "", sa: "" })));
  }, [packerId, packers]);

  const setCell = (i: number, k: "zb" | "sb" | "za" | "sa", v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const fillAfter = () => setRows((rs) => rs.map((r) => (r.zb.trim() || r.sb.trim() ? { ...r, za: r.za.trim() ? r.za : "0.00", sa: r.sa.trim() ? r.sa : "50.00" } : r)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!packerId) return setError("Choose the line and the packer.");
    const used = rows.filter((r) => [r.zb, r.sb, r.za, r.sa].some((v) => v.trim() !== ""));
    if (used.length === 0) return setError("Enter at least one reading.");
    for (const r of used) {
      for (const v of [r.zb, r.sb, r.za, r.sa]) {
        if (v.trim() !== "" && Number.isNaN(Number(v))) return setError(`${r.label}: "${v}" is not a number.`);
      }
    }
    setSaving(true);
    const { data, error: err } = await supabase.rpc("record_spout_calibration", {
      p_packer_id: packerId,
      p_date: date,
      p_readings: used.map((r) => ({ kind: r.kind, label: r.label, zero_before: num(r.zb), span_before: num(r.sb), zero_after: num(r.za), span_after: num(r.sa) })),
      p_notes: notes.trim() || null,
      p_prod_name: prodName.trim() || null,
      p_prod_staff_no: prodStaff.trim() || null,
      p_prod_remarks: prodRemarks.trim() || null,
    });
    setSaving(false);
    if (err) {
      setError(err.message.includes("record_spout_calibration") ? "Ask your administrator to run the v26 database update." : err.message);
      return;
    }
    router.push(`/packer-calibration/${data}`);
  }

  const packer = packers.find((p) => p.id === packerId);

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">New Spout Calibration Sheet</h1>

      <Card className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm font-medium text-gray-700">
            Production line *
            <select className={sel} value={line} onChange={(e) => { setLine(e.target.value); setPackerId(""); builtFor.current = ""; }} required>
              <option value="">-- Select line --</option>
              {PLANT_LOCATIONS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Packer *
            <select className={sel} value={packerId} onChange={(e) => { setPackerId(e.target.value); builtFor.current = ""; }} required disabled={!line}>
              <option value="">{line ? (linePackers.length ? "-- Select packer --" : "-- No packers set up for this line --") : "-- Select a line first --"}</option>
              {linePackers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ""} · {p.spout_count} spouts</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Date *
            <input type="date" className={sel} value={date} max={plantToday()} onChange={(e) => setDate(e.target.value)} required />
          </label>
        </div>
        {rotation && rotation.state === "due" && <p className="text-xs text-gray-500">Next in this line's rotation: <b>{rotation.packer.name}</b></p>}
        {rotation && rotation.state === "done" && <p className="text-xs text-green-700">{rotation.packer.name} was already calibrated today. Next in rotation: {rotation.next?.name}</p>}
        {isSunday(date) && <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">This date is a Sunday. Spout calibration is normally not done on Sundays.</p>}
        {line && linePackers.length === 0 && <p className="text-sm text-amber-700">No packers are set up on this line yet. An engineer can add them under Packer setup.</p>}
      </Card>

      {packer && (
        <Card className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 p-3">
            <p className="text-sm font-medium text-gray-900">
              {packer.name} · {packer.spout_count} spouts
              <span className="ml-2 text-xs font-normal text-gray-400">Leave a row empty to skip it.</span>
            </p>
            <Button type="button" variant="secondary" onClick={fillAfter}>
              Fill “After” with 0.00 / 50.00
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th rowSpan={2} className="p-2 text-left">M/N</th>
                  <th colSpan={2} className="border-l border-gray-200 p-1.5">Before</th>
                  <th colSpan={2} className="border-l border-gray-200 p-1.5">After</th>
                  <th rowSpan={2} className="border-l border-gray-200 p-2">Error %</th>
                </tr>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="border-l border-gray-200 p-1">Zero</th>
                  <th className="p-1">Span</th>
                  <th className="border-l border-gray-200 p-1">Zero</th>
                  <th className="p-1">Span</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const err = errorPct(num(r.sb), num(r.sa));
                  return (
                    <tr key={r.label} className="border-t border-gray-100">
                      <td className="p-2 font-semibold text-gray-900">{r.label}</td>
                      {(["zb", "sb", "za", "sa"] as const).map((k) => (
                        <td key={k} className="p-1">
                          <input inputMode="decimal" className={cellIn} value={r[k]} onChange={(e) => setCell(i, k, e.target.value)} placeholder="0.00" />
                        </td>
                      ))}
                      <td className="p-2 text-center font-semibold text-gray-900">{err === null ? "—" : err.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-gray-100 p-3 text-xs text-gray-400">Error % = (Span before − Span after) × 2, worked out automatically.</p>
        </Card>
      )}

      <Card className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Notes (optional)
          <textarea className={sel} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-gray-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Instrumentation department</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{me?.full_name ?? "…"}</p>
            <p className="text-xs text-gray-500">{me?.sap_number ? `SAP ${me.sap_number}` : "Your name and SAP number are recorded automatically."}</p>
          </div>
          <div className="rounded-md border border-gray-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Production department (can be signed later)</p>
            <input className={sel} placeholder="Representative name" value={prodName} onChange={(e) => setProdName(e.target.value)} />
            <input className={sel} placeholder="Staff / SAP number" value={prodStaff} onChange={(e) => setProdStaff(e.target.value)} />
            <input className={sel} placeholder="Remarks (optional)" value={prodRemarks} onChange={(e) => setProdRemarks(e.target.value)} />
          </div>
        </div>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={saving || !packerId}>
        {saving ? "Saving..." : "Save calibration sheet"}
      </Button>
    </form>
  );
}
