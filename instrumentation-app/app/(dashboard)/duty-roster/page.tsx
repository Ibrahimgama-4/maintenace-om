import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, ClipboardList, Settings2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, isAdmin } from "@/lib/utils/role";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { daysInMonth, type DutyCode, type ShiftConfig } from "@/lib/utils/shifts";
import { RosterGrid, type StaffRow } from "./RosterGrid";

export default async function DutyRosterPage({ searchParams }: { searchParams: { m?: string } }) {
  const supabase = createClient();
  const now = new Date();
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.m ?? "")
    ? (searchParams.m as string)
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, mo] = month.split("-").map(Number);
  const first = `${month}-01`;
  const last = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(y, mo - 1 + delta, 1));
    return `/duty-roster?m=${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  const [role, { data: cfg }, { data: staffRows }, { data: ovRows }, { data: leaveRows }, { data: userData }] = await Promise.all([
    getCurrentUserRole(),
    supabase.from("shift_settings").select("anchor_date, a_offset, b_offset, c_offset").eq("id", 1).maybeSingle(),
    supabase.from("roster_staff").select("id, profile_id, full_name, sap_number, shift_group").eq("active", true).order("sort_order").order("full_name"),
    supabase.from("duty_overrides").select("staff_id, duty_date, code").gte("duty_date", first).lte("duty_date", last),
    supabase.from("duty_overrides").select("staff_id, duty_date, code").in("code", ["AL", "SL", "CA"]).gte("duty_date", `${y}-01-01`).lte("duty_date", `${y}-12-31`),
    supabase.auth.getUser(),
  ]);

  const admin = isAdmin(role);
  const overrides: Record<string, DutyCode> = {};
  (ovRows ?? []).forEach((r: any) => (overrides[`${r.staff_id}|${r.duty_date}`] = r.code));
  const title = new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-brand-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Monthly Duty Roster</h1>
            <p className="text-sm text-gray-500">Who is on Morning (D), Night (N), Off (O) or General (G) each day</p>
          </div>
        </div>
        {admin && (
          <div className="flex gap-2">
            <Link href="/duty-roster/staff">
              <Button variant="secondary" className="gap-1.5">
                <Users className="h-4 w-4" />
                Manage staff
              </Button>
            </Link>
            <Link href="/duty-roster/leave">
              <Button variant="secondary" className="gap-1.5">
                <ClipboardList className="h-4 w-4" />
                Leave record
              </Button>
            </Link>
            <Link href="/duty-roster/settings">
              <Button variant="secondary" className="gap-1.5">
                <Settings2 className="h-4 w-4" />
                Shift pattern
              </Button>
            </Link>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Link href={shift(-1)} aria-label="Previous month" className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h2 className="min-w-[10rem] text-center text-base font-semibold text-gray-900">{title}</h2>
        <Link href={shift(1)} aria-label="Next month" className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100">
          <ChevronRight className="h-5 w-5" />
        </Link>
        <Link href="/duty-roster" className="ml-2 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
          This month
        </Link>
      </div>

      {!cfg ? (
        <Card className="border-amber-200 bg-amber-50 text-sm text-amber-800">The duty roster is not set up yet. An administrator must run the v27 database update.</Card>
      ) : (
        <RosterGrid
          key={month}
          month={month}
          staff={(staffRows ?? []) as StaffRow[]}
          overrides={overrides}
          config={cfg as ShiftConfig}
          isAdmin={admin}
          meId={userData?.user?.id ?? null}
          leaveYear={(leaveRows ?? []) as { staff_id: string; duty_date: string; code: string }[]}
          year={y}
        />
      )}
    </div>
  );
}
