"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Download, FileDown, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DUTY_META, DUTY_ORDER, GROUPS, addDays, daysInMonth, dayOfWeek, groupLabel, patternDuty, type DutyCode, type ShiftConfig } from "@/lib/utils/shifts";
import { downloadRosterCsv, downloadRosterPdf, type RosterRow } from "@/lib/utils/rosterExport";

export interface StaffRow {
  id: string;
  profile_id: string | null;
  full_name: string;
  sap_number: string | null;
  shift_group: string;
}

const sel = "rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm";

export function RosterGrid({
  month,
  staff,
  overrides,
  config,
  isAdmin,
  meId,
}: {
  month: string;
  staff: StaffRow[];
  overrides: Record<string, DutyCode>; // key: `${staffId}|${date}`
  config: ShiftConfig;
  isAdmin: boolean;
  meId: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [ov, setOv] = useState(overrides);
  const [edit, setEdit] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const days = daysInMonth(month);
  const dates = useMemo(() => Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`), [month, days]);

  const dutyOf = (s: StaffRow, d: string): DutyCode => ov[`${s.id}|${d}`] ?? patternDuty(s.shift_group, d, config);

  const rows: RosterRow[] = staff.map((s) => ({ id: s.id, name: s.full_name, sap: s.sap_number ?? "", group: s.shift_group, codes: dates.map((d) => dutyOf(s, d)) }));

  // Tap a cell to step D -> N -> O -> G; landing back on the normal pattern clears the change.
  async function cycle(s: StaffRow, d: string) {
    if (!isAdmin || !edit) return;
    const cur = dutyOf(s, d);
    const next = DUTY_ORDER[(DUTY_ORDER.indexOf(cur) + 1) % DUTY_ORDER.length];
    const normal = patternDuty(s.shift_group, d, config);
    const key = `${s.id}|${d}`;
    const before = ov;
    const after = { ...ov };
    if (next === normal) delete after[key];
    else after[key] = next;
    setOv(after);
    setMsg(null);
    const { error } =
      next === normal
        ? await supabase.from("duty_overrides").delete().eq("staff_id", s.id).eq("duty_date", d)
        : await supabase.from("duty_overrides").upsert({ staff_id: s.id, duty_date: d, code: next }, { onConflict: "staff_id,duty_date" });
    if (error) {
      setOv(before);
      setMsg(error.message);
    }
  }

  // Quick set: one duty for a person or a whole shift across a date range.
  const [qWho, setQWho] = useState("all");
  const [qFrom, setQFrom] = useState(dates[0]);
  const [qTo, setQTo] = useState(dates[0]);
  const [qCode, setQCode] = useState<string>("O");

  async function quickSet() {
    setBusy(true);
    setMsg(null);
    const targets = staff.filter((s) => qWho === "all" || qWho === s.id || qWho === `g:${s.shift_group}`);
    const span: string[] = [];
    for (let d = qFrom; d <= qTo && span.length < 62; d = addDays(d, 1)) span.push(d);
    if (targets.length === 0 || span.length === 0) {
      setBusy(false);
      return setMsg("Choose who and a valid date range.");
    }
    const reset = qCode === "pattern";
    const rowsUp = targets.flatMap((s) => span.map((d) => ({ staff_id: s.id, duty_date: d, code: qCode })));
    let error: { message: string } | null = null;
    if (reset) {
      for (const s of targets) {
        const r = await supabase.from("duty_overrides").delete().eq("staff_id", s.id).gte("duty_date", span[0]).lte("duty_date", span[span.length - 1]);
        if (r.error) error = r.error;
      }
    } else {
      for (let i = 0; i < rowsUp.length; i += 400) {
        const r = await supabase.from("duty_overrides").upsert(rowsUp.slice(i, i + 400), { onConflict: "staff_id,duty_date" });
        if (r.error) error = r.error;
      }
    }
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg(`Updated ${targets.length} ${targets.length === 1 ? "person" : "people"} for ${span.length} day${span.length === 1 ? "" : "s"}.`);
    router.refresh();
    // refresh local copy
    setOv((cur) => {
      const n = { ...cur };
      for (const s of targets) for (const d of span) (reset ? delete n[`${s.id}|${d}`] : (n[`${s.id}|${d}`] = qCode as DutyCode));
      // drop changes equal to the pattern so the ring only marks real differences
      for (const k of Object.keys(n)) {
        const [sid, d] = k.split("|");
        const st = staff.find((x) => x.id === sid);
        if (st && n[k] === patternDuty(st.shift_group, d, config)) delete n[k];
      }
      return n;
    });
  }

  const counts = (c: DutyCode) => dates.map((d) => staff.filter((s) => dutyOf(s, d) === c).length);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 text-xs">
          {DUTY_ORDER.map((c) => (
            <span key={c} className={clsx("rounded-full px-2.5 py-1 font-medium", DUTY_META[c].cls)}>
              {c} {DUTY_META[c].label}
            </span>
          ))}
          {isAdmin && <span className="rounded-full border-2 border-brand-500 px-2.5 py-0.5 font-medium text-brand-700">Changed by admin</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Button type="button" variant={edit ? "primary" : "secondary"} className="gap-1.5" onClick={() => setEdit((v) => !v)}>
              <Pencil className="h-4 w-4" />
              {edit ? "Editing: tap a day" : "Edit duty"}
            </Button>
          )}
          <Button type="button" variant="secondary" className="gap-1.5" disabled={rows.length === 0} onClick={() => downloadRosterCsv(month, rows)}>
            <Download className="h-4 w-4" />
            CSV (Excel)
          </Button>
          <Button type="button" className="gap-1.5" disabled={rows.length === 0} onClick={() => downloadRosterPdf(month, rows)}>
            <FileDown className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </Card>
      {edit && <p className="rounded-md bg-blue-50 p-2.5 text-xs text-blue-800">Tap a day to step through D, N, O and G. Landing back on the normal pattern removes the change. Use Quick set below for a whole range.</p>}
      {msg && <p className="text-sm text-gray-700">{msg}</p>}

      <Card className="overflow-x-auto p-0">
        {staff.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400">No staff on the roster yet. {isAdmin ? "Add people under Manage staff." : "An administrator can add them."}</p>
        ) : (
          <table className="border-collapse text-center text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 z-10 min-w-[10.5rem] border-b border-r border-gray-200 bg-gray-50 p-2 text-left text-gray-500">Name / SAP</th>
                {dates.map((d, i) => (
                  <th key={d} className={clsx("min-w-[1.9rem] border-b border-gray-200 px-0.5 py-1 font-medium", dayOfWeek(d) === 0 ? "bg-red-50 text-red-600" : "text-gray-500", d === today && "bg-brand-100 text-brand-700")}>
                    <div>{i + 1}</div>
                    <div className="text-[9px] font-normal">{new Date(d + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "narrow", timeZone: "UTC" })}</div>
                  </th>
                ))}
                <th className="min-w-[2.2rem] border-b border-l border-gray-200 p-1 text-gray-500">D</th>
                <th className="min-w-[2.2rem] border-b border-gray-200 p-1 text-gray-500">N</th>
                <th className="min-w-[2.2rem] border-b border-gray-200 p-1 text-gray-500">O</th>
                <th className="min-w-[2.2rem] border-b border-gray-200 p-1 text-gray-500">G</th>
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((g) => {
                const list = staff.filter((s) => s.shift_group === g);
                if (list.length === 0) return null;
                return [
                  <tr key={`h-${g}`}>
                    <td colSpan={days + 5} className="sticky left-0 bg-brand-600 px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-white">
                      {groupLabel(g)}
                    </td>
                  </tr>,
                  ...list.map((s, ri) => {
                    const codes = dates.map((d) => dutyOf(s, d));
                    return (
                      <tr key={s.id} className={ri % 2 ? "bg-gray-50/60" : ""}>
                        <td className="sticky left-0 z-10 min-w-[10.5rem] border-r border-gray-200 bg-white p-1.5 text-left">
                          <span className="block font-medium text-gray-900">
                            {s.full_name}
                            {meId && s.profile_id === meId && <span className="ml-1 rounded bg-brand-100 px-1 text-[10px] text-brand-700">you</span>}
                          </span>
                          <span className="block text-[10px] text-gray-400">{s.sap_number ? `SAP ${s.sap_number}` : "No SAP"}</span>
                        </td>
                        {dates.map((d, i) => {
                          const changed = ov[`${s.id}|${d}`] !== undefined;
                          return (
                            <td key={d} className="p-0.5">
                              <button
                                type="button"
                                disabled={!isAdmin || !edit}
                                onClick={() => cycle(s, d)}
                                className={clsx(
                                  "h-6 w-6 rounded text-[11px] font-bold leading-6 sm:h-6 sm:w-7",
                                  DUTY_META[codes[i]].cls,
                                  changed && "ring-2 ring-brand-500",
                                  isAdmin && edit ? "cursor-pointer hover:brightness-95" : "cursor-default"
                                )}
                              >
                                {codes[i]}
                              </button>
                            </td>
                          );
                        })}
                        {DUTY_ORDER.map((c, k) => (
                          <td key={c} className={clsx("p-1 font-semibold text-gray-700", k === 0 && "border-l border-gray-200")}>
                            {codes.filter((x) => x === c).length}
                          </td>
                        ))}
                      </tr>
                    );
                  }),
                ];
              })}
              {(["D", "N", "G"] as DutyCode[]).map((c) => (
                <tr key={`t-${c}`} className="border-t border-gray-200 bg-gray-50">
                  <td className="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 p-1.5 text-left text-[11px] font-semibold text-gray-600">On {DUTY_META[c].label.toLowerCase()} duty</td>
                  {counts(c).map((n, i) => (
                    <td key={i} className="p-0.5 text-[11px] font-semibold text-gray-600">
                      {n}
                    </td>
                  ))}
                  <td colSpan={4} />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {isAdmin && staff.length > 0 && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Quick set</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-gray-600">
              Who
              <select className={`${sel} mt-1 block`} value={qWho} onChange={(e) => setQWho(e.target.value)}>
                <option value="all">Everyone</option>
                {GROUPS.map((g) => (
                  <option key={g} value={`g:${g}`}>
                    All of {groupLabel(g)}
                  </option>
                ))}
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                    {s.sap_number ? ` (${s.sap_number})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-600">
              From
              <input type="date" className={`${sel} mt-1 block`} value={qFrom} min={dates[0]} max={dates[dates.length - 1]} onChange={(e) => setQFrom(e.target.value)} />
            </label>
            <label className="text-xs text-gray-600">
              To
              <input type="date" className={`${sel} mt-1 block`} value={qTo} min={dates[0]} max={dates[dates.length - 1]} onChange={(e) => setQTo(e.target.value)} />
            </label>
            <label className="text-xs text-gray-600">
              Duty
              <select className={`${sel} mt-1 block`} value={qCode} onChange={(e) => setQCode(e.target.value)}>
                {DUTY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {c}: {DUTY_META[c].label}
                  </option>
                ))}
                <option value="pattern">Back to normal pattern</option>
              </select>
            </label>
            <Button type="button" onClick={quickSet} disabled={busy}>
              {busy ? "Applying..." : "Apply"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
