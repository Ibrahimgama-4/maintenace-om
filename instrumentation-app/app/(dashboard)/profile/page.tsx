import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, sap_number, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500">
          Your name and SAP number are used to identify you across the app — on assignments, reports, and comments.
        </p>
      </div>

      <Card>
        <ProfileForm
          initialFullName={profile?.full_name ?? ""}
          initialSapNumber={profile?.sap_number ?? ""}
          role={profile?.role ?? "technician"}
        />
      </Card>
    </div>
  );
}
