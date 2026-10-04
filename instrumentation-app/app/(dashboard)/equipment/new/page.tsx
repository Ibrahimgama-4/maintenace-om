"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PLANT_LOCATIONS } from "@/lib/constants";

const inputCls = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";

export default function NewEquipmentPage() {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({
    location: "",
    tag_number: "",
    name: "",
    type: "",
    plant_section: "",
    manufacturer: "",
    model: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Arriving from a line's filtered list (?line=...) pre-selects that line.
  useEffect(() => {
    const line = new URLSearchParams(window.location.search).get("line");
    if (line && (PLANT_LOCATIONS as readonly string[]).includes(line)) setForm((f) => ({ ...f, location: line }));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!form.location) {
      setError("Choose the production line this equipment belongs to.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("equipment").insert({
      ...form,
      tag_number: form.tag_number.trim(),
      plant_section: form.plant_section || null,
      manufacturer: form.manufacturer || null,
      model: form.model || null,
    });

    if (error) {
      setError(error.message.includes("duplicate") ? "That tag number is already registered. Tag numbers must be unique across the plant." : error.message);
      setLoading(false);
      return;
    }

    router.push(`/equipment?line=${encodeURIComponent(form.location)}`);
  }

  const text = (key: keyof typeof form, label: string, required = false, hint?: string) => (
    <div key={key}>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && " *"}
      </label>
      <input required={required} className={inputCls} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Add Equipment</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Production line *</label>
            <select required className={inputCls} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>
              <option value="">-- Select the line this equipment belongs to --</option>
              {PLANT_LOCATIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Each line has its own machines. This equipment will only be offered when someone selects this line.
            </p>
          </div>
          {text("tag_number", "Tag Number", true, "Must be unique across the plant.")}
          {text("name", "Name", true)}
          {text("type", "Type (e.g. transmitter, control_valve)", true)}
          {text("plant_section", "Machine / section on this line", false, "For example Packer 2, Palletizer, Bag applicator.")}
          {text("manufacturer", "Manufacturer")}
          {text("model", "Model")}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Equipment"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
