import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, isAdmin } from "@/lib/utils/role";
import { Card } from "@/components/ui/Card";
import { StaffManager, type RosterPerson, type ProfileOption } from "./StaffManager";

export default async function RosterStaffPage() {
  const supabase = createClient();
  const [role, { data: people }, { data: profiles }] = await Promise.all([
    getCurrentUserRole(),
    supabase.from("roster_staff").select("id, profile_id, full_name, sap_number, shift_group, active, sort_order").order("sort_order").order("full_name"),
    supabase.from("profiles").select("id, full_name, sap_number").eq("active", true).order("full_name"),
  ]);

  if (!isAdmin(role)) return <Card className="max-w-xl p-8 text-center text-sm text-gray-500">Only administrators can manage the duty roster staff.</Card>;

  const used = new Set((people ?? []).map((p: any) => p.profile_id).filter(Boolean));
  const available = ((profiles ?? []) as ProfileOption[]).filter((p) => !used.has(p.id));

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/duty-roster" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" />
        Back to duty roster
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Duty Roster Staff</h1>
        <p className="text-sm text-gray-500">Choose who is on the roster and which shift they work: A, B or C (3 mornings, 3 nights, 3 off) or General (Monday to Saturday).</p>
      </div>
      <StaffManager people={(people ?? []) as RosterPerson[]} available={available} />
    </div>
  );
}
