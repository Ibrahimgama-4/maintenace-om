"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PLANT_LOCATIONS } from "@/lib/constants";

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
  const [line, setLine] = useState("");
  const [personnel, setPersonnel] = useState("");
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

  // Arriving from a line's filtered list (?line=...) pre-selects that line.
  useEffect(() => {
    const l = new URLSearchParams(window.location.search).get("line");
    if (l && (PLANT_LOCATIONS as readonly string[]).includes(l)) setLine(l);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!line) {
      setError("Choose the production line this handover is for.");
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("shift_handovers").insert({
      location: line,
      shift_personnel: personnel.trim() || null,
      shift_type: shiftType,
      ...form,
      handed_over_by: user.id,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(`/handover?line=${encodeURIComponent(line)}`);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">New Shift Handover</h1>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Production line *</label>
            <select
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={line}
              onChange={(e) => setLine(e.target.value)}
            >
              <option value="">-- Select the line this handover is for --</option>
              {PLANT_LOCATIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">Each line has its own shift team and its own handover record.</p>
          </div>

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

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Shift personnel on this line (optional)</label>
            <textarea
              rows={2}
              placeholder="Outgoing: names / SAP numbers.  Incoming: names / SAP numbers."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={personnel}
              onChange={(e) => setPersonnel(e.target.value)}
            />
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
