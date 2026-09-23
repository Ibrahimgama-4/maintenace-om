"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";

export function RoleSelect({
  userId,
  currentRole,
  disabled,
}: {
  userId: string;
  currentRole: UserRole;
  disabled: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [role, setRole] = useState<UserRole>(currentRole);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(newRole: UserRole) {
    const previous = role;
    setRole(newRole);
    setSaving(true);
    setError(null);

    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId);

    if (error) {
      setError(error.message);
      setRole(previous); // revert on failure
    } else {
      router.refresh();
    }
    setSaving(false);
  }

  if (disabled) {
    return <span className="text-sm capitalize text-gray-500">{currentRole}</span>;
  }

  return (
    <div>
      <select
        className="rounded-md border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
        value={role}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value as UserRole)}
      >
        <option value="technician">Technician</option>
        <option value="engineer">Engineer</option>
        <option value="admin">Admin</option>
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
