"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function NewEquipmentPage() {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({
    tag_number: "",
    name: "",
    type: "",
    location: "",
    plant_section: "",
    manufacturer: "",
    model: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.from("equipment").insert(form);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/equipment");
  }

  const fields: { key: keyof typeof form; label: string; required?: boolean }[] = [
    { key: "tag_number", label: "Tag Number", required: true },
    { key: "name", label: "Name", required: true },
    { key: "type", label: "Type (e.g. transmitter, control_valve)", required: true },
    { key: "location", label: "Location" },
    { key: "plant_section", label: "Plant Section" },
    { key: "manufacturer", label: "Manufacturer" },
    { key: "model", label: "Model" },
  ];

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Add Equipment</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-sm font-medium text-gray-700">{f.label}</label>
              <input
                required={f.required}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            </div>
          ))}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Equipment"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
