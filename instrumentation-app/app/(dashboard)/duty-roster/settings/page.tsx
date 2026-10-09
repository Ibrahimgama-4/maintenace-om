import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, isAdmin } from "@/lib/utils/role";
import { Card } from "@/components/ui/Card";
import type { ShiftConfig } from "@/lib/utils/shifts";
import { PatternSettings } from "./PatternSettings";

export default async function ShiftPatternPage() {
  const supabase = createClient();
  const [role, { data: cfg }] = await Promise.all([
    getCurrentUserRole(),
    supabase.from("shift_settings").select("anchor_date, a_offset, b_offset, c_offset").eq("id", 1).maybeSingle(),
  ]);
  if (!isAdmin(role)) return <Card className="max-w-xl p-8 text-center text-sm text-gray-500">Only administrators can change the shift pattern.</Card>;
  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/duty-roster" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" />
        Back to duty roster
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Shift Pattern</h1>
        <p className="text-sm text-gray-500">Shifts A, B and C each work 3 mornings, 3 nights and 3 days off, then repeat. Tell the app where each shift is on a chosen day and it works out every other day.</p>
      </div>
      {cfg ? <PatternSettings config={cfg as ShiftConfig} /> : <Card className="border-amber-200 bg-amber-50 text-sm text-amber-800">Not set up yet. Run the v27 database update first.</Card>}
    </div>
  );
}
