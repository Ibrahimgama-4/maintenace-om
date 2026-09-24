import { createClient } from "@/lib/supabase/server";
import { Card, Badge } from "@/components/ui/Card";
import { RoleSelect } from "./RoleSelect";
import { SapNumberInput } from "./SapNumberInput";
import { FullNameInput } from "./FullNameInput";
import type { UserRole } from "@/types/database";
import { ShieldCheck } from "lucide-react";

export default async function AdminUsersPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: myProfile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const isAdmin = myProfile?.role === "admin";

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, active, sap_number")
    .order("full_name");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-brand-600" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500">
            {isAdmin ? "Edit staff names, SAP numbers, and roles below — updates apply immediately." : "Staff directory (read-only)."}
          </p>
        </div>
      </div>

      <Card className="overflow-x-auto p-0">
        {!profiles || profiles.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">No users yet.</p>
        ) : (
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="p-3">Name</th>
                <th className="p-3">SAP Number</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50/60">
                  <td className="p-3">
                    <FullNameInput userId={p.id} initialValue={p.full_name} disabled={!isAdmin} />
                  </td>
                  <td className="p-3">
                    <SapNumberInput userId={p.id} initialValue={p.sap_number ?? ""} disabled={!isAdmin} />
                  </td>
                  <td className="p-3">
                    <RoleSelect
                      userId={p.id}
                      currentRole={p.role as UserRole}
                      disabled={!isAdmin || p.id === user?.id}
                    />
                  </td>
                  <td className="p-3">
                    <Badge tone={p.active ? "green" : "gray"}>{p.active ? "Active" : "Inactive"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {isAdmin && (
        <Card className="bg-blue-50/50 text-sm text-gray-600">
          You can&apos;t change your own role here, to avoid accidentally locking yourself out of admin access.
          Ask another admin, or use the Supabase SQL Editor if you&apos;re the only one. Staff can also update their
          own name and SAP number from their My Profile page.
        </Card>
      )}
    </div>
  );
}
