"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import type { CommentWithAuthor } from "@/components/shared/CommentThread";

export function ReviewCommentThread({
  breakdownId,
  comments,
  canPost,
}: {
  breakdownId: string;
  comments: CommentWithAuthor[];
  canPost: boolean;
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
        entity_type: "breakdown_review",
        entity_id: breakdownId,
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
        <MessageSquareText className="h-3.5 w-3.5" />
        Supervisor Feedback
      </p>

      {comments.length === 0 ? (
        <p className="text-sm text-gray-400">
          No feedback yet. Admins and engineers can leave notes here — recognizing good work or flagging
          something for further troubleshooting.
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-amber-50 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                <span className="font-medium text-gray-700">{c.author_name}</span>
                <span>{new Date(c.created_at).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap text-gray-800">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      {canPost && (
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            rows={2}
            placeholder="e.g. Good work resolving this quickly. Or: please check the wiring at the junction box too."
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button type="submit" disabled={saving || !body.trim()} className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Post
          </Button>
        </form>
      )}
    </div>
  );
}
