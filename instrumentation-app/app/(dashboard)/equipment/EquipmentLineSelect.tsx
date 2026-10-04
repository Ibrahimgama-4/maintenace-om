"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PLANT_LOCATIONS } from "@/lib/constants";

/** Lets engineers and admins move an item to the correct production line. */
export function EquipmentLineSelect({ id, value }: { id: string; value: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: string) {
    if (!next) return;
    setSaving(true);
    setError(null);
    const { error: e } = await supabase.from("equipment").update({ location: next }).eq("id", id);
    setSaving(false);
    if (e) {
      setError("Not allowed");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <select
        value={value}
        disabled={saving}
        onChange={(e) => change(e.target.value)}
        className={`max-w-[11rem] rounded-md border px-2 py-1 text-xs ${value ? "border-gray-300 text-gray-700" : "border-amber-400 bg-amber-50 text-amber-800"}`}
        aria-label="Production line"
      >
        {!value && <option value="">Assign line…</option>}
        {PLANT_LOCATIONS.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      {error && <span className="ml-1 text-xs text-red-600">{error}</span>}
    </div>
  );
}
