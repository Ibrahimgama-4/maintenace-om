import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { QuickStatusActions } from "./QuickStatusActions";
import { PlusCircle, Wrench } from "lucide-react";
import { PLANT_LOCATIONS } from "@/lib/constants";
import { markSeen } from "@/lib/utils/notifications";
import clsx from "clsx";

export default async function BreakdownsPage({
  searchParams,
}: {
  searchParams: { location?: string };
}) {
  const supabase = createClient();
  const activeLocation = searchParams.location;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await markSeen(supabase, user.id, "breakdowns");

  let query = supabase
    .from("breakdowns")
    .select("id, fault_description, priority, status, created_at, location, assigned_to, profiles(full_name)")
    .order("created_at", { ascending: false });

  if (activeLocation) {
    query = query.eq("location", activeLocation);
  }

  const { data: breakdowns } = await query;

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-brand-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Breakdowns</h1>
            <p className="text-sm text-gray-500">All reported instrumentation faults</p>
          </div>
        </div>
        <Link href="/breakdowns/new">
          <Button className="w-full gap-1.5 sm:w-auto">
            <PlusCircle className="h-4 w-4" />
            Report Breakdown
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/breakdowns"
          className={clsx(
            "rounded-full px-3 py-1 text-xs font-medium",
            !activeLocation ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          All Lines
        </Link>
        {PLANT_LOCATIONS.map((loc) => (
          <Link
            key={loc}
            href={`/breakdowns?location=${encodeURIComponent(loc)}`}
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-medium",
              activeLocation === loc ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {loc}
          </Link>
        ))}
      </div>

      <Card className="overflow-x-auto p-0">
        {!breakdowns || breakdowns.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <Wrench className="h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-400">
              {activeLocation ? `No breakdowns reported for ${activeLocation}.` : "No breakdowns yet. Report the first one."}
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[740px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="p-3">Description</th>
                <th className="p-3">Location</th>
                <th className="p-3">Assigned To</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Work Status</th>
                <th className="p-3">Reported</th>
              </tr>
            </thead>
            <tbody>
              {breakdowns.map((b: any) => (
                <tr key={b.id} className="border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50/60">
                  <td className="p-3">
                    <Link href={`/breakdowns/${b.id}`} className="font-medium text-gray-900 hover:text-brand-600 hover:underline">
                      {b.fault_description}
                    </Link>
                  </td>
                  <td className="p-3 text-gray-500">{b.location ?? "—"}</td>
                  <td className="p-3 text-gray-500">{b.profiles?.full_name ?? "Unassigned"}</td>
                  <td className="p-3">
                    <Badge tone={b.priority === "critical" ? "red" : b.priority === "high" ? "amber" : "gray"}>
                      {b.priority}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <QuickStatusActions id={b.id} status={b.status} />
                  </td>
                  <td className="p-3 text-gray-500">{new Date(b.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
