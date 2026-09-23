"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Equipment } from "@/types/database";
import { PLANT_LOCATIONS } from "@/lib/constants";

export default function NewPMSchedulePage() {
  const router = useRouter();
  const supabase = createClient();
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [form, setForm] = useState({
    equipment_id: "",
    equipment_description: "",
    location: PLANT_LOCATIONS[0] as string,
    task_name: "",
    frequency_days: "30",
    next_due: new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase
      .from("equipment")
      .select("*")
      .order("tag_number")
      .then(({ data }) => setEquipmentList((data as Equipment[]) ?? []));
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!form.equipment_id && !form.equipment_description.trim()) {
      setError("Either select equipment from the list, or describe it manually.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("pm_schedules").insert({
      equipment_id: form.equipment_id || null,
      equipment_description: form.equipment_description || null,
      location: form.location || null,
      task_name: form.task_name,
      frequency_days: Number(form.frequency_days),
      next_due: form.next_due,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/pm-calibration");
  }

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Add PM Schedule</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Equipment (select if registered)
            </label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.equipment_id}
              onChange={(e) => setForm({ ...form, equipment_id: e.target.value })}
            >
              <option value="">-- Not registered / describe manually below --</option>
              {equipmentList.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.tag_number} — {eq.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Location *</label>
            <select
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            >
              {PLANT_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-md border border-dashed border-gray-300 p-3">
            <p className="mb-2 text-xs font-medium text-gray-500">
              Describe the equipment manually (use this if it isn't in the database yet)
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Equipment description
              </label>
              <input
                placeholder="e.g. Belt scale, Packer 2 feed conveyor"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.equipment_description}
                onChange={(e) => setForm({ ...form, equipment_description: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Task *</label>
            <input
              required
              placeholder="e.g. Calibrate pressure transmitter"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.task_name}
              onChange={(e) => setForm({ ...form, task_name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Frequency (days)</label>
              <input
                type="number"
                min={1}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.frequency_days}
                onChange={(e) => setForm({ ...form, frequency_days: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Next Due</label>
              <input
                type="date"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.next_due}
                onChange={(e) => setForm({ ...form, next_due: e.target.value })}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Schedule"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
