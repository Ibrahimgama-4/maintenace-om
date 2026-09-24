import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Megaphone } from "lucide-react";
import { AnnouncementForm } from "./AnnouncementForm";
import { markSeen } from "@/lib/utils/notifications";

export default async function AnnouncementsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await markSeen(supabase, user.id, "announcements");

  const { data: rawAnnouncements } = await supabase
    .from("announcements")
    .select("id, body, created_at, profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(50);

  const announcements = (rawAnnouncements ?? []).map((a: any) => ({
    id: a.id,
    body: a.body,
    created_at: a.created_at,
    author_name: a.profiles?.full_name ?? "Unknown",
  }));

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-brand-600" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Announcements</h1>
          <p className="text-sm text-gray-500">Department-wide updates and staff discussion</p>
        </div>
      </div>

      <Card>
        <AnnouncementForm />
      </Card>

      {announcements.length === 0 ? (
        <Card className="p-8 text-center text-sm text-gray-400">No announcements yet — be the first to post.</Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a.id}>
              <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                <span className="font-medium text-gray-700">{a.author_name}</span>
                <span>{new Date(a.created_at).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-800">{a.body}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
