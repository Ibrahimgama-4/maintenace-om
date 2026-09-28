import { SupabaseClient } from "@supabase/supabase-js";
import { getAllPending, removePending } from "./db";

let syncing = false;

/**
 * Sends every locally-queued breakdown to Supabase, oldest first, and removes
 * each one from the queue only after it has genuinely been saved.
 * Safe to call repeatedly — it guards against overlapping runs.
 */
export async function syncPendingBreakdowns(
  supabase: SupabaseClient
): Promise<{ synced: number; failed: number }> {
  if (syncing) return { synced: 0, failed: 0 };
  syncing = true;

  let synced = 0;
  let failed = 0;

  try {
    const pending = await getAllPending();

    for (const item of pending) {
      const { error } = await supabase.from("breakdowns").insert({
        equipment_id: item.equipment_id,
        location: item.location,
        fault_description: item.fault_description,
        alarm_code: item.alarm_code,
        priority: item.priority,
        assigned_to: item.assigned_to,
        assignment_note: item.assignment_note,
        status: item.assigned_to ? "assigned" : "reported",
        reported_by: item.reportedBy,
        // Preserve the ORIGINAL time the fault was reported, not the time it finally synced,
        // so downtime and response-time figures stay accurate.
        start_time: new Date(item.createdAt).toISOString(),
      });

      if (error) {
        failed += 1;
        // Stop on first failure to preserve ordering; it will retry next time.
        break;
      }

      await removePending(item.localId);
      synced += 1;
    }
  } finally {
    syncing = false;
  }

  return { synced, failed };
}
