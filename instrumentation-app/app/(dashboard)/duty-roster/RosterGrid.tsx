"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Download, FileDown, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CHANGED_CLS, DUTY_META, DUTY_ORDER, GROUPS, LEAVE_CODES, addDays, daysInMonth, dayOfWeek, dutyClass, groupLabel, patternDuty, type DutyCode, type LeaveCode, type ShiftConfig } from "@/lib/utils/shifts";
import { fmtRange, leaveBlocks, planDates, type LeaveBlock, type LeaveDay } from "@/lib/utils/leave";
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
  meSap,
  leaveYear,
  year,
}: {
  month: string;
  staff: StaffRow[];
  overrides: Record<string, DutyCode>; // key: `${staffId}|${date}`
  config: ShiftConfig;
  isAdmin: boolean;
  meId: string | null;
  meSap: string | null;
  leaveYear: LeaveDay[]; // all leave days of the displayed year
  year: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [ov, setOv] = useState(overrides);
  useEffect(() => setOv(overrides), [overrides]);
  const [edit, setEdit] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const days = daysInMonth(month);
  const dates = useMemo(() => Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`), [month, days]);

  const dutyOf = (s: StaffRow, d: string): DutyCode => ov[`${s.id}|${d}`] ?? patternDuty(s.shift_group, d, config);

  const rows: RosterRow[] = staff.map((s) => ({ id: s.id, name: s.full_name, sap: s.sap_number ?? "", group: s.shift_group, codes: dates.map((d) => dutyOf(s, d)), changed: dates.map((d) => ov[`${s.id}|${d}`] !== undefined) }));

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
    } else router.refresh();
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


  // ---------- Leave: plan AL / SL / CA for a date interval (optional), and change periods later ----------
  const [lWho, setLWho] = useState("");
  const [lCode, setLCode] = useState<LeaveCode>("AL");
  const [lFrom, setLFrom] = useState(dates[0]);
  const [lTo, setLTo] = useState(dates[0]);
  const [lAll, setLAll] = useState(false);
  const groupOf = (id: string) => staff.find((x) => x.id === id)?.shift_group ?? "G";
  const blocks = useMemo(() => leaveBlocks(leaveYear.filter((d) => staff.some((s) => s.id === d.staff_id)), groupOf, config), [leaveYear, staff, config]);

  async function writeLeave(staffId: string, code: LeaveCode, from: string, to: string, includeRest: boolean) {
    const rowsUp = planDates(groupOf(staffId), from, to, includeRest ? "all" : "working", config).map((d) => ({ staff_id: staffId, duty_date: d, code }));
    for (let i = 0; i < rowsUp.length; i += 400) {
      const r = await supabase.from("duty_overrides").upsert(rowsUp.slice(i, i + 400), { onConflict: "staff_id,duty_date" });
      if (r.error) return r.error.message;
    }
    return rowsUp.length;
  }

  async function planLeave() {
    if (!lWho) return setMsg("Choose the person first.");
    if (!lFrom || !lTo || lTo < lFrom) return setMsg("Choose a valid date interval.");
    setBusy(true);
    setMsg(null);
    const r = await writeLeave(lWho, lCode, lFrom, lTo, lAll);
    setBusy(false);
    if (typeof r === "string") return setMsg(r);
    const who = staff.find((s) => s.id === lWho)?.full_name;
    setMsg(`${DUTY_META[lCode].label} planned for ${who}: ${r} day${r === 1 ? "" : "s"} (${fmtRange(lFrom, lTo)}).`);
    router.refresh();
  }

  async function changeBlock(b: LeaveBlock, from: string, to: string) {
    setBusy(true);
    setMsg(null);
    const del = await supabase.from("duty_overrides").delete().eq("staff_id", b.staff_id).eq("code", b.code).gte("duty_date", b.start).lte("duty_date", b.end);
    if (del.error) {
      setBusy(false);
      return setMsg(del.error.message);
    }
    const r = await writeLeave(b.staff_id, b.code, from, to, b.includesRestDays);
    setBusy(false);
    if (typeof r === "string") return setMsg(r);
    setMsg(`Leave updated: ${r} day${r === 1 ? "" : "s"} (${fmtRange(from, to)}).`);
    router.refresh();
  }

  async function removeBlock(b: LeaveBlock) {
    if (!window.confirm("Remove this leave? The days go back to the normal duty pattern.")) return;
    setBusy(true);
    const del = await supabase.from("duty_overrides").delete().eq("staff_id", b.staff_id).eq("code", b.code).gte("duty_date", b.start).lte("duty_date", b.end);
    setBusy(false);
    if (del.error) return setMsg(del.error.message);
    setMsg("Leave removed.");
    router.refresh();
  }

  const yearTotals = (id: string) => {
    const t = { AL: 0, SL: 0, CA: 0 };
    leaveYear.forEach((d) => d.staff_id === id && (t[d.code as LeaveCode] = (t[d.code as LeaveCode] ?? 0) + 1));
    return t;
  };

  const counts = (c: DutyCode) => dates.map((d) => staff.filter((s) => dutyOf(s, d) === c).length);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 text-xs">
          {DUTY_ORDER.filter((c) => !LEAVE_CODES.includes(c as LeaveCode)).map((c) => (
            <span key={c} className={clsx("rounded-full px-2.5 py-1 font-medium", DUTY_META[c].cls)}>
              {c} {DUTY_META[c].label}
            </span>
          ))}
          <span className={clsx("rounded-full px-2.5 py-1 font-medium", DUTY_META.AL.cls)}>AL / SL / CA Leave</span>
          <span className={clsx("rounded-full px-2.5 py-1 font-medium", CHANGED_CLS)}>Changed or added duty</span>
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
                {DUTY_ORDER.map((c, k) => (
                  <th key={c} className={clsx("min-w-[2.2rem] border-b border-gray-200 p-1 text-gray-500", k === 0 && "border-l")}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((g) => {
                const list = staff.filter((s) => s.shift_group === g);
                if (list.length === 0) return null;
                return [
                  <tr key={`h-${g}`}>
                    <td colSpan={days + 8} className="sticky left-0 bg-brand-600 px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-white">
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
                            {((meId && s.profile_id === meId) || (meSap && s.sap_number && s.sap_number === meSap)) && <span className="ml-1 rounded bg-brand-100 px-1 text-[10px] text-brand-700">you</span>}
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
                                  dutyClass(codes[i], changed),
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
              <tr className="border-t border-gray-200 bg-gray-50">
                <td className="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 p-1.5 text-left text-[11px] font-semibold text-gray-600">On leave (AL, SL, CA)</td>
                {dates.map((d) => (
                  <td key={d} className="p-0.5 text-[11px] font-semibold text-gray-600">
                    {staff.filter((s) => LEAVE_CODES.includes(dutyOf(s, d) as LeaveCode)).length}
                  </td>
                ))}
                <td colSpan={7} />
              </tr>
              {(["D", "N", "G"] as DutyCode[]).map((c) => (
                <tr key={`t-${c}`} className="border-t border-gray-200 bg-gray-50">
                  <td className="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 p-1.5 text-left text-[11px] font-semibold text-gray-600">On {DUTY_META[c].label.toLowerCase()} duty</td>
                  {counts(c).map((n, i) => (
                    <td key={i} className="p-0.5 text-[11px] font-semibold text-gray-600">
                      {n}
                    </td>
                  ))}
                  <td colSpan={7} />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {isAdmin && staff.length > 0 && (
        <Card>
          <h2 className="mb-1 text-sm font-semibold text-gray-900">Plan leave (optional)</h2>
          <p className="mb-3 text-xs text-gray-500">Mark Annual (AL), Sick (SL) or Casual (CA) leave for a date interval. The days are counted against the person for the year.</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-gray-600">
              Person
              <select className={`${sel} mt-1 block min-w-[12rem]`} value={lWho} onChange={(e) => setLWho(e.target.value)}>
                <option value="">-- Select --</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                    {s.sap_number ? ` (${s.sap_number})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-600">
              Leave type
              <select className={`${sel} mt-1 block`} value={lCode} onChange={(e) => setLCode(e.target.value as LeaveCode)}>
                {LEAVE_CODES.map((c) => (
                  <option key={c} value={c}>
                    {c}: {DUTY_META[c].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-600">
              From
              <input type="date" className={`${sel} mt-1 block`} value={lFrom} onChange={(e) => setLFrom(e.target.value)} />
            </label>
            <label className="text-xs text-gray-600">
              To
              <input type="date" className={`${sel} mt-1 block`} value={lTo} min={lFrom} onChange={(e) => setLTo(e.target.value)} />
            </label>
            <Button type="button" onClick={planLeave} disabled={busy}>
              {busy ? "Saving..." : "Plan leave"}
            </Button>
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={lAll} onChange={(e) => setLAll(e.target.checked)} />
            Also count rest days (O / Sunday) inside the interval as leave. Unticked, rest days stay off and are not counted.
          </label>

          <h3 className="mb-1.5 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">Leave in {year}</h3>
          {blocks.length === 0 ? (
            <p className="text-sm text-gray-400">No leave planned for {year}.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {staff
                .filter((s) => blocks.some((b) => b.staff_id === s.id))
                .map((s) => {
                  const t = yearTotals(s.id);
                  return (
                    <li key={s.id} className="py-2.5">
                      <p className="text-sm font-medium text-gray-900">
                        {s.full_name} <span className="text-xs font-normal text-gray-400">{s.sap_number ? `SAP ${s.sap_number}` : ""}</span>
                      </p>
                      <p className="mb-1 text-xs text-gray-500">
                        {year} total: AL <b>{t.AL}</b> · SL <b>{t.SL}</b> · CA <b>{t.CA}</b> = <b>{t.AL + t.SL + t.CA}</b> days
                      </p>
                      <div className="space-y-1.5">
                        {blocks
                          .filter((b) => b.staff_id === s.id)
                          .map((b) => (
                            <BlockRow key={`${b.code}${b.start}`} b={b} busy={busy} onSave={changeBlock} onRemove={removeBlock} />
                          ))}
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </Card>
      )}

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
                {DUTY_ORDER.filter((c) => !LEAVE_CODES.includes(c as LeaveCode)).map((c) => (
                  <option key={c} value={c}>
                    {c}: {DUTY_META[c].label}
                  </option>
                ))}
                <option value="pattern">Back to normal pattern (also removes leave)</option>
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

function BlockRow({ b, busy, onSave, onRemove }: { b: LeaveBlock; busy: boolean; onSave: (b: LeaveBlock, from: string, to: string) => void; onRemove: (b: LeaveBlock) => void }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(b.start);
  const [to, setTo] = useState(b.end);
  return (
    <div className="rounded-md bg-gray-50 p-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className={clsx("mr-2 rounded px-1.5 py-0.5 font-bold", DUTY_META[b.code].cls)}>{b.code}</span>
          {fmtRange(b.start, b.end)} · <b>{b.days}</b> day{b.days === 1 ? "" : "s"}
        </span>
        <span className="flex gap-3">
          <button type="button" className="font-medium text-brand-600 hover:underline" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "Change days"}
          </button>
          <button type="button" className="font-medium text-red-600 hover:underline" onClick={() => onRemove(b)} disabled={busy}>
            Remove
          </button>
        </span>
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-gray-600">
            From
            <input type="date" className={`${sel} mt-0.5 block`} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-gray-600">
            To
            <input type="date" className={`${sel} mt-0.5 block`} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
          <Button type="button" className="py-1.5" disabled={busy || !from || !to || to < from} onClick={() => { onSave(b, from, to); setOpen(false); }}>
            Save
          </Button>
          <span className="pb-1.5 text-[11px] text-gray-500">Move the end later to add days, or earlier to reduce them.</span>
        </div>
      )}
    </div>
  );
}
