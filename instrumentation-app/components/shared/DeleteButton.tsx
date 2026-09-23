"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function DeleteButton({
  table,
  id,
  label = "Delete",
  confirmText = "Are you sure? This cannot be undone.",
  redirectTo,
}: {
  table: string;
  id: string;
  label?: string;
  confirmText?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    const { error } = await supabase.from(table).delete().eq("id", id);

    if (error) {
      setError(error.message);
      setDeleting(false);
      setConfirming(false);
      return;
    }

    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.refresh();
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-600">{confirmText}</span>
        <Button variant="danger" onClick={handleDelete} disabled={deleting} className="!px-2.5 !py-1 text-xs">
          {deleting ? "Deleting..." : "Yes, delete"}
        </Button>
        <button
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="text-xs text-gray-500 hover:underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:underline"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {label}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
