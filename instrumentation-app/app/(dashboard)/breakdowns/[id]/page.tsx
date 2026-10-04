import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge } from "@/components/ui/Card";
import { BreakdownEditor } from "./BreakdownEditor";
import { QuickStatusActions } from "../QuickStatusActions";
import { CommentThread, type CommentWithAuthor } from "@/components/shared/CommentThread";
import { ReviewCommentThread } from "./ReviewCommentThread";
import { PhotoUpload, type PhotoWithUrl } from "./PhotoUpload";
import { PartsUsed, type PartUsage } from "./PartsUsed";
import { DeleteButton } from "@/components/shared/DeleteButton";
import { getCurrentUserRole, isAdmin, canManage } from "@/lib/utils/role";

export default async function BreakdownDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  // Run the role lookup and the breakdown lookup at the same time — neither depends on the other.
  const [role, { data: breakdown }] = await Promise.all([
    getCurrentUserRole(),
    supabase.from("breakdowns").select("*").eq("id", params.id).single(),
  ]);

  if (!breakdown) notFound();

  // Everything below only depends on `breakdown`, not on each other — fetch them all at once
  // instead of one after another. This is the single biggest speed win on this page.
  const [
    { data: equipment },
    { data: assignedStaff },
    { data: reporter },
    { data: rawComments },
    { data: rawReviewComments },
    { data: rawPhotos },
    { data: rawUsages },
    { data: partOptions },
    { data: equipmentRows },
  ] = await Promise.all([
    breakdown.equipment_id
      ? supabase.from("equipment").select("tag_number, name").eq("id", breakdown.equipment_id).single()
      : Promise.resolve({ data: null }),
    breakdown.assigned_to
      ? supabase.from("profiles").select("full_name, sap_number").eq("id", breakdown.assigned_to).single()
      : Promise.resolve({ data: null }),
    breakdown.reported_by
      ? supabase.from("profiles").select("full_name").eq("id", breakdown.reported_by).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("comments")
      .select("id, body, created_at, user_id, profiles(full_name)")
      .eq("entity_type", "breakdown")
      .eq("entity_id", params.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("comments")
      .select("id, body, created_at, user_id, profiles(full_name)")
      .eq("entity_type", "breakdown_review")
      .eq("entity_id", params.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("breakdown_photos")
      .select("id, storage_path")
      .eq("breakdown_id", params.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("breakdown_spare_parts")
      .select("id, qty_used, used_at, machine, location, notes, used_by_name, used_by_sap, spare_parts(part_number, name), profiles:used_by(full_name, sap_number)")
      .eq("breakdown_id", params.id)
      .order("used_at", { ascending: true }),
    supabase.from("spare_parts").select("id, part_number, name, stock_qty").order("part_number"),
    supabase.from("equipment").select("id, tag_number, name").order("tag_number"),
  ]);

  const usages: PartUsage[] = (rawUsages ?? []).map((u: any) => ({
    id: u.id,
    qty_used: u.qty_used,
    used_at: u.used_at ?? null,
    part_number: u.spare_parts?.part_number ?? "—",
    name: u.spare_parts?.name ?? "Unknown part",
    machine: u.machine ?? null,
    location: u.location ?? null,
    used_by: u.used_by_name ?? u.profiles?.full_name ?? null,
    used_by_sap: u.used_by_sap ?? u.profiles?.sap_number ?? null,
    notes: u.notes ?? null,
  }));
  const equipmentOptions = (equipmentRows ?? []).map((e: any) => ({ id: e.id, label: `${e.tag_number} — ${e.name}` }));

  const comments: CommentWithAuthor[] = (rawComments ?? []).map((c: any) => ({
    id: c.id,
    body: c.body,
    created_at: c.created_at,
    author_name: c.profiles?.full_name ?? "Unknown",
  }));

  const reviewComments: CommentWithAuthor[] = (rawReviewComments ?? []).map((c: any) => ({
    id: c.id,
    body: c.body,
    created_at: c.created_at,
    author_name: c.profiles?.full_name ?? "Unknown",
  }));

  const photos: PhotoWithUrl[] = (rawPhotos ?? []).map((p) => ({
    id: p.id,
    url: supabase.storage.from("breakdown-photos").getPublicUrl(p.storage_path).data.publicUrl,
  }));

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/breakdowns" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to breakdowns
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{breakdown.fault_description}</h1>
          {equipment && (
            <p className="text-sm text-gray-500">
              {equipment.tag_number} — {equipment.name}
            </p>
          )}
        </div>
        <Badge tone={breakdown.priority === "critical" ? "red" : breakdown.priority === "high" ? "amber" : "gray"}>
          {breakdown.priority} priority
        </Badge>
      </div>

      {isAdmin(role) && (
        <div className="flex justify-end">
          <DeleteButton
            table="breakdowns"
            id={breakdown.id}
            label="Delete this breakdown"
            confirmText="Delete this breakdown record permanently?"
            redirectTo="/breakdowns"
          />
        </div>
      )}

      <Card>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Quick status</p>
        <QuickStatusActions id={breakdown.id} status={breakdown.status} />
      </Card>

      <Card>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Assigned to</dt>
            <dd className="font-medium text-gray-900">
              {assignedStaff?.full_name
                ? `${assignedStaff.full_name}${assignedStaff.sap_number ? ` — SAP ${assignedStaff.sap_number}` : ""}`
                : "Unassigned"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Reported by</dt>
            <dd className="font-medium text-gray-900">{reporter?.full_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Alarm / Error Code</dt>
            <dd className="font-medium text-gray-900">{breakdown.alarm_code ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Location</dt>
            <dd className="font-medium text-gray-900">{breakdown.location ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Reported</dt>
            <dd className="font-medium text-gray-900">{new Date(breakdown.start_time).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Downtime</dt>
            <dd className="font-medium text-gray-900">
              {breakdown.downtime_minutes != null ? `${breakdown.downtime_minutes} min` : "In progress"}
            </dd>
          </div>
        </dl>
        {(breakdown as any).assignment_note && (
          <div className="mt-3 rounded-md bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Task Note</p>
            <p className="mt-1 text-sm text-gray-700">{(breakdown as any).assignment_note}</p>
          </div>
        )}
      </Card>

      <BreakdownEditor breakdown={breakdown} />

      <Card>
        <PartsUsed
          breakdownId={breakdown.id}
          usages={usages}
          parts={partOptions ?? []}
          equipment={equipmentOptions}
          defaultMachine={equipment ? `${equipment.tag_number} — ${equipment.name}` : ""}
          defaultLocation={breakdown.location ?? ""}
        />
      </Card>

      <Card>
        <PhotoUpload breakdownId={breakdown.id} photos={photos} />
      </Card>

      <Card>
        <ReviewCommentThread breakdownId={breakdown.id} comments={reviewComments} canPost={canManage(role)} />
      </Card>

      <Card>
        <CommentThread entityType="breakdown" entityId={breakdown.id} comments={comments} />
      </Card>
    </div>
  );
}
