"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function AnnouncementForm() {
  const router = useRouter();
  const supabase = createClient();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase.from("announcements").insert({ user_id: user.id, body: body.trim() });
      setBody("");
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <textarea
        rows={2}
        placeholder="Post an announcement or start a discussion..."
        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <Button type="submit" disabled={saving || !body.trim()} className="gap-1.5">
        <Send className="h-3.5 w-3.5" />
        Post
      </Button>
    </form>
  );
}
