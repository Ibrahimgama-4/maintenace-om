"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const FIELDS: { key: string; label: string; placeholder?: string }[] = [
  { key: "outstanding_breakdowns", label: "Outstanding Breakdowns" },
  { key: "equipment_under_observation", label: "Equipment Under Observation" },
  { key: "temp_repairs", label: "Temporary Repairs in Place" },
  { key: "safety_concerns", label: "Safety Concerns" },
  { key: "bypassed_instruments", label: "Instruments Bypassed / Isolated" },
  { key: "notes", label: "Recommendations for Incoming Shift" },
];

export default function NewHandoverPage() {
  const router = useRouter();
  const supabase = createClient();
  const [shiftType, setShiftType] = useState("General");
  const [form, setForm] = useState<Record<string, string>>({
    outstanding_breakdowns: "",
    equipment_under_observation: "",
    temp_repairs: "",
    safety_concerns: "",
    bypassed_instruments: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("shift_handovers").insert({
      shift_type: shiftType,
      ...form,
      handed_over_by: user.id,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/handover");
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">New Shift Handover</h1>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Shift</label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={shiftType}
              onChange={(e) => setShiftType(e.target.value)}
            >
              <option value="General">General</option>
              <option value="Morning">Morning</option>
              <option value="Night">Night</option>
            </select>
          </div>

          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-sm font-medium text-gray-700">{f.label}</label>
              <textarea
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            </div>
          ))}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Submit Handover"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
