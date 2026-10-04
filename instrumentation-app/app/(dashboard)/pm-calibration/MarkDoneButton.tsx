"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function MarkDoneButton({ id, taskName, frequencyDays }: { id: string; taskName: string; frequencyDays: number }) {
  const router = useRouter();
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("complete_pm_schedule", { p_pm_id: id, p_done_date: date, p_notes: notes.trim() || null });
    setBusy(false);
    if (e) {
      setError(e.message.includes("complete_pm_schedule") ? "Ask your administrator to run the v24 database update." : e.message);
      return;
    }
    setOpen(false);
    setNotes("");
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Mark done
      </button>
    );
  }

  return (
    <div className="w-64 space-y-2 rounded-md border border-gray-200 bg-white p-3 text-left shadow-sm">
      <p className="text-xs font-semibold text-gray-900">Complete: {taskName}</p>
      <label className="block text-xs text-gray-600">
        Date done
        <input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="block text-xs text-gray-600">
        Notes (optional)
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Findings, parts, observations" className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
      </label>
      <p className="text-xs text-gray-400">The next due date moves forward {frequencyDays} days from the date done.</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" onClick={submit} disabled={busy || !date}>
          {busy ? "Saving..." : "Confirm"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
