"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function DocumentUploadForm({ location }: { location: string }) {
  const router = useRouter();
  const supabase = createClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInput.current?.files?.[0];
    if (!file || !title.trim()) {
      setError("Give it a title and choose a file.");
      return;
    }

    setUploading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const path = `${encodeURIComponent(location)}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const { error: uploadError } = await supabase.storage.from("machine-documents").upload(path, file);

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from("machine_documents").insert({
      title: title.trim(),
      location,
      storage_path: path,
      uploaded_by: user?.id,
    });

    if (insertError) {
      setError(insertError.message);
      setUploading(false);
      return;
    }

    setTitle("");
    if (fileInput.current) fileInput.current.value = "";
    setUploading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Upload Drawing/Document for {location}
      </p>
      <input
        placeholder="e.g. FLSmidth Packer Model X - Troubleshooting Guide"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        ref={fileInput}
        type="file"
        accept=".pdf,.doc,.docx,image/*"
        className="w-full text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button type="submit" disabled={uploading} className="gap-1.5">
        <Upload className="h-4 w-4" />
        {uploading ? "Uploading..." : "Upload Document"}
      </Button>
    </form>
  );
}
