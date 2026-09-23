import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { CalendarDays, Download } from "lucide-react";
import { getCurrentUserRole, isAdmin } from "@/lib/utils/role";
import { RosterUploadForm } from "./RosterUploadForm";

export default async function ShiftRosterPage() {
  const supabase = createClient();
  const role = await getCurrentUserRole();

  const { data: rosters } = await supabase
    .from("shift_rosters")
    .select("id, title, storage_path, created_at")
    .order("created_at", { ascending: false });

  const rostersWithUrl = (rosters ?? []).map((r) => ({
    ...r,
    url: supabase.storage.from("shift-rosters").getPublicUrl(r.storage_path).data.publicUrl,
  }));

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-brand-600" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Shift Roster</h1>
          <p className="text-sm text-gray-500">Monthly shift schedule for the department</p>
        </div>
      </div>

      {isAdmin(role) && (
        <Card>
          <RosterUploadForm />
        </Card>
      )}

      {rostersWithUrl.length === 0 ? (
        <Card className="p-8 text-center text-sm text-gray-400">No roster uploaded yet.</Card>
      ) : (
        <div className="space-y-2">
          {rostersWithUrl.map((r) => (
            <Card key={r.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{r.title}</p>
                <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
