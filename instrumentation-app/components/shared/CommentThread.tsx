"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export interface CommentWithAuthor {
  id: string;
  body: string;
  created_at: string;
  author_name: string;
}

export function CommentThread({
  entityType,
  entityId,
  comments,
}: {
  entityType: string;
  entityId: string;
  comments: CommentWithAuthor[];
}) {
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
      await supabase.from("comments").insert({
        entity_type: entityType,
        entity_id: entityId,
        user_id: user.id,
        body: body.trim(),
      });
      setBody("");
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <MessageSquare className="h-3.5 w-3.5" />
        Shift updates & notes
      </p>

      {comments.length === 0 ? (
        <p className="text-sm text-gray-400">
          No updates yet. Use this to tell the next shift where things stand — still in progress, waiting on a
          part, fully resolved, etc.
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-gray-50 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                <span className="font-medium text-gray-700">{c.author_name}</span>
                <span>{new Date(c.created_at).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap text-gray-800">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <textarea
          rows={2}
          placeholder="e.g. Still investigating — waiting on replacement transmitter, handing to night shift."
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <Button type="submit" disabled={saving || !body.trim()} className="gap-1.5">
          <Send className="h-3.5 w-3.5" />
          Post
        </Button>
      </form>
    </div>
  );
}
