import { SupabaseClient } from "@supabase/supabase-js";

export type NotificationCategory = "breakdowns" | "announcements";

/**
 * Returns how many new rows exist in a category since this user last viewed it.
 * On a user's very first check for a category, it records "now" as seen and
 * returns 0 — so existing history doesn't flood them with a huge count.
 */
export async function getUnreadCounts(
  supabase: SupabaseClient,
  userId: string
): Promise<{ breakdowns: number; announcements: number }> {
  const { data: seenRows } = await supabase
    .from("notification_seen")
    .select("category, last_seen_at")
    .eq("user_id", userId);

  const seenMap = new Map((seenRows ?? []).map((r) => [r.category, r.last_seen_at]));

  const categories: NotificationCategory[] = ["breakdowns", "announcements"];
  const missing = categories.filter((c) => !seenMap.has(c));

  if (missing.length > 0) {
    const now = new Date().toISOString();
    await supabase
      .from("notification_seen")
      .upsert(missing.map((category) => ({ user_id: userId, category, last_seen_at: now })));
    for (const c of missing) seenMap.set(c, now);
  }

  const [{ count: breakdownCount }, { count: announcementCount }] = await Promise.all([
    supabase
      .from("breakdowns")
      .select("id", { count: "exact", head: true })
      .gt("created_at", seenMap.get("breakdowns")!),
    supabase
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .gt("created_at", seenMap.get("announcements")!),
  ]);

  return {
    breakdowns: breakdownCount ?? 0,
    announcements: announcementCount ?? 0,
  };
}

/** Marks a category as seen right now, clearing its unread count going forward. */
export async function markSeen(
  supabase: SupabaseClient,
  userId: string,
  category: NotificationCategory
) {
  await supabase
    .from("notification_seen")
    .upsert({ user_id: userId, category, last_seen_at: new Date().toISOString() });
}
