import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardList, ListChecks, ImageOff, MapPin, ClipboardCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, Badge } from "@/components/ui/Card";
import { PLANT_LOCATIONS } from "@/lib/constants";

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Tasks assigned to ME, still open — shown first so it's the first thing seen on login.
  const { data: myTasks } = user
    ? await supabase
        .from("breakdowns")
        .select("id, fault_description, priority, status, location, assignment_note")
        .eq("assigned_to", user.id)
        .neq("status", "closed")
        .order("created_at", { ascending: false })
    : { data: [] };

  const { data: breakdowns } = await supabase
    .from("breakdowns")
    .select("id, fault_description, priority, status, created_at, equipment_id")
    .order("created_at", { ascending: false })
    .limit(8);

  const active = (breakdowns ?? []).filter((b) => b.status !== "closed");
  const critical = active.filter((b) => b.priority === "critical");
  const completed = (breakdowns ?? []).filter((b) => b.status === "closed");

  const { data: activeByLocation } = await supabase
    .from("breakdowns")
    .select("location, priority")
    .neq("status", "closed");

  const locationCounts = new Map<string, { total: number; critical: number }>();
  for (const loc of PLANT_LOCATIONS) locationCounts.set(loc, { total: 0, critical: 0 });
  for (const b of activeByLocation ?? []) {
    const key = b.location ?? "Unspecified";
    const entry = locationCounts.get(key) ?? { total: 0, critical: 0 };
    entry.total += 1;
    if (b.priority === "critical") entry.critical += 1;
    locationCounts.set(key, entry);
  }

  const breakdownIds = (breakdowns ?? []).map((b) => b.id);
  const photoByBreakdown = new Map<string, string>();

  if (breakdownIds.length > 0) {
    const { data: photos } = await supabase
      .from("breakdown_photos")
      .select("breakdown_id, storage_path, created_at")
      .in("breakdown_id", breakdownIds)
      .order("created_at", { ascending: false });

    for (const p of photos ?? []) {
      if (!photoByBreakdown.has(p.breakdown_id)) {
        const url = supabase.storage.from("breakdown-photos").getPublicUrl(p.storage_path).data.publicUrl;
        photoByBreakdown.set(p.breakdown_id, url);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-r from-brand-700 to-brand-900 p-5 text-white shadow-sm">
        <h1 className="text-xl font-semibold">Department Dashboard</h1>
        <p className="mt-1 text-sm text-blue-100">Live overview of instrumentation department activity</p>
      </div>

      {myTasks && myTasks.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-amber-700" />
            <h2 className="text-sm font-semibold text-amber-900">Assigned to You ({myTasks.length})</h2>
          </div>
          <div className="space-y-2">
            {myTasks.map((t) => (
              <Link
                key={t.id}
                href={`/breakdowns/${t.id}`}
                className="block rounded-lg border border-amber-200 bg-white p-3 transition-colors hover:border-amber-400"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">{t.fault_description}</p>
                  <Badge tone={t.priority === "critical" ? "red" : t.priority === "high" ? "amber" : "gray"}>
                    {t.priority}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">{t.location}</p>
                {t.assignment_note && (
                  <p className="mt-1 text-xs italic text-gray-600">"{t.assignment_note}"</p>
                )}
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Active Breakdowns" value={active.length} icon={ClipboardList} />
        <StatCard
          label="Critical Faults"
          value={critical.length}
          icon={AlertTriangle}
          tone={critical.length > 0 ? "critical" : "default"}
        />
        <StatCard label="Completed (recent)" value={completed.length} icon={CheckCircle2} />
        <StatCard label="Total Logged" value={breakdowns?.length ?? 0} icon={ListChecks} />
      </div>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-semibold text-gray-900">Active Breakdowns by Line</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {Array.from(locationCounts.entries()).map(([loc, counts]) => (
            <Link
              key={loc}
              href={`/breakdowns?location=${encodeURIComponent(loc)}`}
              className="rounded-lg border border-gray-100 p-3 text-center transition-colors hover:border-brand-200 hover:bg-brand-50/40"
            >
              <p className="text-xs font-medium text-gray-500">{loc}</p>
              <p className={`mt-1 text-xl font-semibold ${counts.critical > 0 ? "text-red-600" : "text-gray-900"}`}>
                {counts.total}
              </p>
              {counts.critical > 0 && (
                <p className="mt-0.5 text-[10px] font-medium text-red-500">{counts.critical} critical</p>
              )}
            </Link>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Recent Breakdowns</h2>
          <Link href="/breakdowns" className="text-sm text-brand-600 hover:underline">
            View all
          </Link>
        </div>

        {!breakdowns || breakdowns.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No breakdowns logged yet.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {breakdowns.map((b) => {
              const photoUrl = photoByBreakdown.get(b.id);
              return (
                <Link
                  key={b.id}
                  href={`/breakdowns/${b.id}`}
                  className="flex items-center gap-3 py-3 transition-colors hover:bg-gray-50/60"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                    {photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <ImageOff className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{b.fault_description}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tone={b.priority === "critical" ? "red" : b.priority === "high" ? "amber" : "gray"}>
                        {b.priority}
                      </Badge>
                      <Badge tone="blue">{b.status}</Badge>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
