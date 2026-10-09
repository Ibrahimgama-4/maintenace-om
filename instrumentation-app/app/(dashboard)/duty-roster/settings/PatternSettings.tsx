"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DUTY_META, POSITION_OPTIONS, addDays, codeAt, cyclePosition, type ShiftConfig } from "@/lib/utils/shifts";

const fld = "mt-1 block rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm";

export function PatternSettings({ config }: { config: ShiftConfig }) {
  const router = useRouter();
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  // Open the form showing what the app currently believes each shift is doing today.
  const [date, setDate] = useState(today);
  const [pos, setPos] = useState({
    A: cyclePosition(config, "A", today),
    B: cyclePosition(config, "B", today),
    C: cyclePosition(config, "C", today),
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.from("shift_settings").update({ anchor_date: date, a_offset: pos.A, b_offset: pos.B, c_offset: pos.C, updated_at: new Date().toISOString() }).eq("id", 1);
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: "Saved. The calendar and duty roster now use this pattern." });
    router.refresh();
  }

  return (
    <Card className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        On this date...
        <input type="date" className={fld} value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        {(["A", "B", "C"] as const).map((g) => (
          <label key={g} className="block text-sm font-medium text-gray-700">
            Shift {g} is on
            <select className={`${fld} w-full`} value={pos[g]} onChange={(e) => setPos({ ...pos, [g]: Number(e.target.value) })}>
              {POSITION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-500">Example: if today Shift B is on its second night, Shift C on its second morning and Shift A on its second day off, choose exactly that for today's date.</p>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Preview: next 14 days from the date above</p>
        <div className="overflow-x-auto">
          <table className="text-center text-xs">
            <tbody>
              {(["A", "B", "C"] as const).map((g) => (
                <tr key={g}>
                  <td className="pr-2 text-left font-medium text-gray-700">Shift {g}</td>
                  {Array.from({ length: 14 }, (_, i) => {
                    const cfg: ShiftConfig = { anchor_date: date, a_offset: pos.A, b_offset: pos.B, c_offset: pos.C };
                    const c = codeAt(cyclePosition(cfg, g, addDays(date, i)));
                    return (
                      <td key={i} className="p-0.5">
                        <span className={clsx("block h-6 w-6 rounded text-[11px] font-bold leading-6", DUTY_META[c].cls)}>{c}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td />
                {Array.from({ length: 14 }, (_, i) => (
                  <td key={i} className="text-[9px] text-gray-400">
                    {addDays(date, i).slice(8)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {msg && <p className={msg.ok ? "text-sm text-green-700" : "text-sm text-red-600"}>{msg.text}</p>}
      <Button type="button" onClick={save} disabled={busy}>
        {busy ? "Saving..." : "Save shift pattern"}
      </Button>
    </Card>
  );
}
