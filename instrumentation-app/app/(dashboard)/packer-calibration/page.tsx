import Link from "next/link";
import { Scale, PlusCircle, Settings2, CheckCircle2, Moon, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, canManage } from "@/lib/utils/role";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LineFilter } from "@/components/shared/LineFilter";
import { PLANT_LOCATIONS } from "@/lib/constants";
import { parseLineParam, shortLine } from "@/lib/utils/lines";
import { dmy, fmt2, plantToday, rotationFor, sortPackers } from "@/lib/utils/spout";
import type { SpoutSheet } from "@/lib/utils/spoutExport";
import { SpoutExportButtons } from "./SpoutExportButtons";

const inputCls = "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm";

export default async function PackerCalibrationPage({
  searchParams,
}: {
  searchParams: { line?: string; packer?: string; from?: string; to?: string };
}) {
  const supabase = createClient();
  const { packer, from, to } = searchParams;
  const active = parseLineParam(searchParams.line);

  let q = supabase
    .from("spout_calibrations")
    .select("*, spout_calibration_readings(*)")
    .order("cal_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (from) q = q.gte("cal_date", from);
  if (to) q = q.lte("cal_date", to);
  if (packer) q = q.eq("packer_id", packer);

  const [role, { data: packerRows }, { data: recent }, { data: raw }] = await Promise.all([
    getCurrentUserRole(),
    supabase.from("packers").select("id, line, name, code, spout_count, sort_order").eq("active", true),
    supabase.from("spout_calibrations").select("packer_id, line, cal_date, created_at").order("cal_date", { ascending: false }).order("created_at", { ascending: false }).limit(300),
    q,
  ]);

  const today = plantToday();
  const packers = packerRows ?? [];

  const all: SpoutSheet[] = (raw ?? []).map((s: any) => ({ ...s, readings: s.spout_calibration_readings ?? [] }));
  const counts: Record<string, number> = {};
  PLANT_LOCATIONS.forEach((l) => (counts[l] = all.filter((s) => s.line === l).length));
  const sheets = active ? all.filter((s) => s.line === active) : all;

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-brand-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Packer Spout Calibration</h1>
            <p className="text-sm text-gray-500">Zero and span before and after, error %, and sign-off, by production line</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canManage(role) && (
            <Link href="/packer-calibration/setup">
              <Button variant="secondary" className="gap-1.5">
                <Settings2 className="h-4 w-4" />
                Packer setup
              </Button>
            </Link>
          )}
          <Link href={active ? `/packer-calibration/new?line=${encodeURIComponent(active)}` : "/packer-calibration/new"}>
            <Button className="gap-1.5">
              <PlusCircle className="h-4 w-4" />
              New sheet
            </Button>
          </Link>
        </div>
      </div>

      {/* Daily rotation: one packer per line per day, no calibration on Sundays */}
      <div className="grid gap-3 sm:grid-cols-2">
        {PLANT_LOCATIONS.map((line) => {
          const lp = sortPackers(packers.filter((p: any) => p.line === line));
          const ls = (recent ?? []).filter((s: any) => s.line === line);
          const rot = rotationFor(lp, ls as any, today);
          const lastDone = (id: string) => (ls as any[]).find((s) => s.packer_id === id)?.cal_date;
          return (
            <Card key={line} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium text-gray-900">{shortLine(line)}</p>
                <span className="text-xs text-gray-400">{lp.length} packer{lp.length === 1 ? "" : "s"} · {lp[0]?.spout_count ?? "—"} spouts</span>
              </div>
              {rot.state === "none" && (
                <p className="text-sm text-gray-500">
                  No packers set up yet.{" "}
                  {canManage(role) ? (
                    <Link href="/packer-calibration/setup" className="font-medium text-brand-600 hover:underline">
                      Set up packers
                    </Link>
                  ) : (
                    "Ask an engineer to set them up."
                  )}
                </p>
              )}
              {rot.state === "due" && (
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm text-amber-700">
                    <Clock className="h-4 w-4" /> Due today: <b>{rot.packer.name}</b>
                  </p>
                  <Link href={`/packer-calibration/new?line=${encodeURIComponent(line)}&packer=${rot.packer.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                    Start sheet
                  </Link>
                </div>
              )}
              {rot.state === "done" && (
                <p className="flex items-center gap-1.5 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" /> Done today: <b>{rot.packer.name}</b>
                  {rot.next && <span className="text-gray-400"> · next: {rot.next.name}</span>}
                </p>
              )}
              {rot.state === "sunday" && (
                <p className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Moon className="h-4 w-4" /> No calibration on Sundays{rot.next ? ` · next: ${rot.next.name}` : ""}
                </p>
              )}
              {lp.length > 0 && (
                <p className="mt-2 text-xs text-gray-400">
                  {lp.map((p) => `${p.name}: ${lastDone(p.id) ? dmy(lastDone(p.id)) : "never"}`).join("  ·  ")}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <Card>
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs font-medium text-gray-600">
            Line
            <select name="line" defaultValue={active ?? ""} className={`${inputCls} mt-1`}>
              <option value="">All lines</option>
              {PLANT_LOCATIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-600">
            Packer
            <select name="packer" defaultValue={packer ?? ""} className={`${inputCls} mt-1`}>
              <option value="">All packers</option>
              {sortPackers(packers as any).map((p: any) => (
                <option key={p.id} value={p.id}>
                  {shortLine(p.line)} · {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-600">
            From
            <input type="date" name="from" defaultValue={from ?? ""} className={`${inputCls} mt-1`} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            To
            <input type="date" name="to" defaultValue={to ?? ""} className={`${inputCls} mt-1`} />
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit">Apply</Button>
            <Link href="/packer-calibration">
              <Button type="button" variant="secondary">
                Reset
              </Button>
            </Link>
          </div>
        </form>
      </Card>

      <LineFilter basePath="/packer-calibration" active={active} counts={counts} total={all.length} />

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Downloads include <b>all {sheets.length}</b> sheet{sheets.length === 1 ? "" : "s"} shown by the filters, with every reading and the sign-off details.
        </p>
        <SpoutExportButtons sheets={sheets} />
      </Card>

      <Card className="overflow-x-auto p-0">
        {sheets.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400">No calibration sheets match. Tap New sheet to record one.</p>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="p-3">Date</th>
                <th className="p-3">Line / packer</th>
                <th className="p-3">Readings</th>
                <th className="p-3">Max error %</th>
                <th className="p-3">Calibrated by</th>
                <th className="p-3">Production</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {sheets.map((s) => {
                const errs = s.readings.map((r) => r.error_pct).filter((v): v is number => v !== null && v !== undefined);
                const maxErr = errs.length ? Math.max(...errs.map((v) => Math.abs(Number(v)))) : null;
                return (
                  <tr key={s.id} className="border-b border-gray-50 align-top last:border-0">
                    <td className="whitespace-nowrap p-3 text-gray-700">{dmy(s.cal_date)}</td>
                    <td className="p-3">
                      <span className="font-medium text-gray-900">{s.packer_name}</span>
                      <span className="block text-xs text-gray-400">{shortLine(s.line)}</span>
                    </td>
                    <td className="p-3 text-gray-600">{s.readings.length}</td>
                    <td className="p-3 font-medium">{maxErr === null ? "—" : fmt2(maxErr)}</td>
                    <td className="p-3">
                      {s.performed_by_name ?? "Unknown"}
                      {s.performed_by_sap && <span className="block text-xs text-gray-400">SAP {s.performed_by_sap}</span>}
                    </td>
                    <td className="p-3">{s.prod_signed_at ? <Badge tone="green">{s.prod_name}</Badge> : <Badge tone="amber">Pending</Badge>}</td>
                    <td className="p-3">
                      <Link href={`/packer-calibration/${s.id}`} className="font-medium text-brand-600 hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
