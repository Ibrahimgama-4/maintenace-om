import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

/** Fetches the current signed-in user's role. Returns null if not signed in. */
export async function getCurrentUserRole(): Promise<UserRole | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  return (profile?.role as UserRole) ?? null;
}

export function canManage(role: UserRole | null): boolean {
  return role === "admin" || role === "engineer";
}

export function isAdmin(role: UserRole | null): boolean {
  return role === "admin";
}
