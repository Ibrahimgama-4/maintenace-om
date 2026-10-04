import Link from "next/link";
import { PlusCircle, Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LineFilter } from "@/components/shared/LineFilter";
import { PLANT_LOCATIONS } from "@/lib/constants";
import { NO_LINE, parseLineParam, shortLine } from "@/lib/utils/lines";

export default async function HandoverPage({ searchParams }: { searchParams: { line?: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("shift_handovers")
    .select("id, shift_date, shift_type, location, shift_personnel, outstanding_breakdowns, equipment_under_observation, temp_repairs, safety_concerns, bypassed_instruments, notes, created_at, profiles:handed_over_by(full_name, sap_number)")
    .order("created_at", { ascending: false })
    .limit(150);

  const all = (data ?? []) as any[];
  const counts: Record<string, number> = {};
  PLANT_LOCATIONS.forEach((l) => (counts[l] = all.filter((h) => h.location === l).length));
  const noLine = all.filter((h) => !h.location).length;

  const active = parseLineParam(searchParams.line);
  const list = (active ? all.filter((h) => (active === NO_LINE ? !h.location : h.location === active)) : all).slice(0, 15);
  const newHref = active && active !== NO_LINE ? `/handover/new?line=${encodeURIComponent(active)}` : "/handover/new";

  // Latest handover on each line, so each line's incoming team sees their own picture first.
  const latest = PLANT_LOCATIONS.map((l) => ({ line: l, h: all.find((x) => x.location === l) }));

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Repeat className="h-5 w-5 text-brand-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Shift Handover</h1>
            <p className="text-sm text-gray-500">{active && active !== NO_LINE ? `Handovers for ${active}` : "Outstanding items passed between shifts, by line"}</p>
          </div>
        </div>
        <Link href={newHref}>
          <Button className="gap-1.5">
            <PlusCircle className="h-4 w-4" />
            New Handover
          </Button>
        </Link>
      </div>

      <LineFilter basePath="/handover" active={active} counts={counts} total={all.length} noLineLabel="Older (no line)" noLineCount={noLine} />

      {!active && (
        <div className="grid gap-2 sm:grid-cols-2">
          {latest.map(({ line, h }) => (
            <Link key={line} href={`/handover?line=${encodeURIComponent(line)}`}>
              <Card className="h-full p-3 hover:bg-gray-50">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{shortLine(line)}</p>
                {h ? (
                  <>
                    <p className="mt-1 text-sm font-medium capitalize text-gray-900">
                      {h.shift_type} shift · {h.shift_date}
                    </p>
                    <p className="text-xs text-gray-400">by {h.profiles?.full_name ?? "unknown"}</p>
                    {h.safety_concerns && <p className="mt-1 truncate text-xs text-red-600">Safety: {h.safety_concerns}</p>}
                  </>
                ) : (
                  <p className="mt-1 text-sm text-gray-400">No handover yet</p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <Card className="p-10 text-center text-sm text-gray-400">
          {active && active !== NO_LINE ? `No handovers logged for ${active} yet.` : "No handovers logged yet."}
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((h) => (
            <Card key={h.id}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-semibold capitalize text-gray-900">
                  {h.shift_type} shift — {h.shift_date}
                </span>
                {h.location ? <Badge tone="blue">{shortLine(h.location)}</Badge> : <Badge>No line</Badge>}
              </div>
              <p className="mb-2 text-xs text-gray-400">
                Handed over by {h.profiles?.full_name ?? "unknown"}
                {h.profiles?.sap_number ? ` · SAP ${h.profiles.sap_number}` : ""}
              </p>
              {h.shift_personnel && (
                <p className="mb-1 text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Personnel: </span>
                  {h.shift_personnel}
                </p>
              )}
              {h.outstanding_breakdowns && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Outstanding: </span>
                  {h.outstanding_breakdowns}
                </p>
              )}
              {h.equipment_under_observation && (
                <p className="mt-1 text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Under observation: </span>
                  {h.equipment_under_observation}
                </p>
              )}
              {h.temp_repairs && (
                <p className="mt-1 text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Temporary repairs: </span>
                  {h.temp_repairs}
                </p>
              )}
              {h.bypassed_instruments && (
                <p className="mt-1 text-sm text-amber-700">
                  <span className="font-medium">Bypassed / isolated: </span>
                  {h.bypassed_instruments}
                </p>
              )}
              {h.safety_concerns && (
                <p className="mt-1 text-sm text-red-600">
                  <span className="font-medium">Safety: </span>
                  {h.safety_concerns}
                </p>
              )}
              {h.notes && <p className="mt-1 text-sm text-gray-600">{h.notes}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
