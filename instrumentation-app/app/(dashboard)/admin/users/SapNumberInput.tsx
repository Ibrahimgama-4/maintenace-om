"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SapNumberInput({
  userId,
  initialValue,
  disabled,
}: {
  userId: string;
  initialValue: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  async function handleBlur() {
    if (value === initialValue) return;
    setSaving(true);
    await supabase.from("profiles").update({ sap_number: value || null }).eq("id", userId);
    setSaving(false);
    router.refresh();
  }

  if (disabled) {
    return <span className="text-sm text-gray-500">{initialValue || "—"}</span>;
  }

  return (
    <input
      className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
      value={value}
      disabled={saving}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      placeholder="SAP number"
    />
  );
}
