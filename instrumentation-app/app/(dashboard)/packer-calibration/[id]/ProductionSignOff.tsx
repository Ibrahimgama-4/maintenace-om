"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

const input = "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm";

export function ProductionSignOff({ sheetId }: { sheetId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [staffNo, setStaffNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("sign_off_spout_calibration", {
      p_sheet_id: sheetId,
      p_name: name,
      p_staff_no: staffNo || null,
      p_remarks: remarks || null,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-gray-600">The production representative who witnessed the calibration signs here.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-gray-600">
          Name *
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="block text-xs font-medium text-gray-600">
          Staff / SAP number
          <input className={input} value={staffNo} onChange={(e) => setStaffNo(e.target.value)} />
        </label>
      </div>
      <label className="block text-xs font-medium text-gray-600">
        Remarks (optional)
        <input className={input} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={busy || !name.trim()}>
        {busy ? "Saving..." : "Sign off for Production"}
      </Button>
    </form>
  );
}
