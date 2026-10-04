"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PLANT_LOCATIONS } from "@/lib/constants";

const input = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";
const addMonths = (iso: string, m: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + m);
  return d.toISOString().slice(0, 10);
};

export default function NewCalibrationPage() {
  const router = useRouter();
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [equipment, setEquipment] = useState<{ id: string; tag_number: string; name: string }[]>([]);
  const [f, setF] = useState({
    equipment_id: "",
    equipment_text: "",
    location: PLANT_LOCATIONS[0] as string,
    date: today,
    result: "pass",
    as_found: "",
    as_left: "",
    standard: "",
    certificate: "",
    next_due: addMonths(today, 12),
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    supabase
      .from("equipment")
      .select("id, tag_number, name")
      .order("tag_number")
      .then(({ data }) => setEquipment(data ?? []));
  }, [supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!f.equipment_id && !f.equipment_text.trim()) {
      setError("Select the instrument from the list, or describe it manually.");
      return;
    }
    setSaving(true);
    const { error: err } = await supabase.rpc("record_calibration", {
      p_equipment_id: f.equipment_id || null,
      p_equipment_text: f.equipment_text || null,
      p_location: f.location,
      p_date: f.date,
      p_result: f.result,
      p_as_found: f.as_found || null,
      p_as_left: f.as_left || null,
      p_standard: f.standard || null,
      p_certificate: f.certificate || null,
      p_next_due: f.next_due || null,
      p_notes: f.notes || null,
    });
    setSaving(false);
    if (err) {
      setError(err.message.includes("record_calibration") ? "Ask your administrator to run the v24 database update." : err.message);
      return;
    }
    router.push("/pm-calibration/calibrations");
    router.refresh();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold text-gray-900">Add Calibration Record</h1>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Instrument (select if registered)
            <select className={`${input} mt-1`} value={f.equipment_id} onChange={(e) => set("equipment_id", e.target.value)}>
              <option value="">-- Not registered / describe manually below --</option>
              {equipment.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.tag_number} — {e.name}
                </option>
              ))}
            </select>
          </label>
          {!f.equipment_id && (
            <label className="block text-sm font-medium text-gray-700">
              Instrument description
              <input className={`${input} mt-1`} value={f.equipment_text} onChange={(e) => set("equipment_text", e.target.value)} placeholder="e.g. Packer 2 belt scale load cell" />
            </label>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-gray-700">
              Location
              <select className={`${input} mt-1`} value={f.location} onChange={(e) => set("location", e.target.value)}>
                {PLANT_LOCATIONS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Date calibrated
              <input type="date" max={today} className={`${input} mt-1`} value={f.date} onChange={(e) => set("date", e.target.value)} required />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-medium text-gray-700">
              Result
              <select className={`${input} mt-1`} value={f.result} onChange={(e) => set("result", e.target.value)}>
                <option value="pass">Pass (within tolerance)</option>
                <option value="adjusted">Adjusted</option>
                <option value="fail">Fail</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700">
              As found
              <input className={`${input} mt-1`} value={f.as_found} onChange={(e) => set("as_found", e.target.value)} placeholder="e.g. 4.12 mA @ 0%" />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              As left
              <input className={`${input} mt-1`} value={f.as_left} onChange={(e) => set("as_left", e.target.value)} placeholder="e.g. 4.00 mA @ 0%" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-gray-700">
              Standard / reference used
              <input className={`${input} mt-1`} value={f.standard} onChange={(e) => set("standard", e.target.value)} placeholder="e.g. Fluke 754 (S/N 1234)" />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Certificate number
              <input className={`${input} mt-1`} value={f.certificate} onChange={(e) => set("certificate", e.target.value)} />
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Next calibration due
              <input type="date" className={`${input} mt-1`} value={f.next_due} onChange={(e) => set("next_due", e.target.value)} />
            </label>
            <div className="mt-1.5 flex gap-2 text-xs">
              {[3, 6, 12].map((m) => (
                <button key={m} type="button" onClick={() => set("next_due", addMonths(f.date, m))} className="rounded-full border border-gray-300 px-2.5 py-1 text-gray-600 hover:bg-gray-50">
                  +{m} months
                </button>
              ))}
            </div>
          </div>
          <label className="block text-sm font-medium text-gray-700">
            Notes
            <textarea className={`${input} mt-1`} rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-gray-400">Your name and SAP number are recorded automatically as the person who performed the calibration.</p>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Calibration Record"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
