"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function FullNameInput({
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
    if (value === initialValue || !value.trim()) return;
    setSaving(true);
    await supabase.from("profiles").update({ full_name: value.trim() }).eq("id", userId);
    setSaving(false);
    router.refresh();
  }

  if (disabled) {
    return <span className="font-medium text-gray-900">{initialValue}</span>;
  }

  return (
    <input
      className="w-40 rounded-md border border-gray-300 px-2 py-1 text-sm font-medium disabled:opacity-50"
      value={value}
      disabled={saving}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
    />
  );
}
