import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, canManage, isAdmin } from "@/lib/utils/role";
import { Card } from "@/components/ui/Card";
import { PackerSetup, type PackerRecord } from "./PackerSetup";

export default async function PackerSetupPage() {
  const supabase = createClient();
  const [role, { data }] = await Promise.all([
    getCurrentUserRole(),
    supabase.from("packers").select("id, line, name, code, spout_count, sort_order, active").order("sort_order"),
  ]);

  if (!canManage(role)) {
    return <Card className="max-w-xl p-8 text-center text-sm text-gray-500">Packer setup is available to engineers and administrators.</Card>;
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/packer-calibration" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" />
        Back to spout calibration
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Packer Setup</h1>
        <p className="text-sm text-gray-500">
          Add the packers on each line and set how many spouts each has. Packers are calibrated one per day, in this order, and not on Sundays.
        </p>
      </div>
      <PackerSetup initial={(data ?? []) as PackerRecord[]} canDelete={isAdmin(role)} />
    </div>
  );
}
