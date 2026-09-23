import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/shared/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  return (
    <DashboardShell
      userName={profile?.full_name ?? user.email ?? "User"}
      role={profile?.role ?? "technician"}
      userEmail={user.email ?? ""}
      userId={user.id}
      debugError={profileError ? `${profileError.message} (code: ${profileError.code})` : null}
    >
      {children}
    </DashboardShell>
  );
}
