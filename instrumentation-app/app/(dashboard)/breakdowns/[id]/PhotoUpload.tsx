"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export interface PhotoWithUrl {
  id: string;
  url: string;
}

const BUCKET = "breakdown-photos";

export function PhotoUpload({ breakdownId, photos }: { breakdownId: string; photos: PhotoWithUrl[] }) {
  const router = useRouter();
  const supabase = createClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const path = `${breakdownId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);

    if (uploadError) {
      setError(
        uploadError.message.includes("Bucket not found")
          ? "Storage bucket not set up yet — see the setup instructions for the 'breakdown-photos' bucket."
          : uploadError.message
      );
      setUploading(false);
      return;
    }

    await supabase.from("breakdown_photos").insert({ breakdown_id: breakdownId, storage_path: path });

    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
    router.refresh();
  }

  async function handleDelete(photoId: string, url: string) {
    // Best-effort: remove the DB record. Storage cleanup can be handled separately if needed.
    await supabase.from("breakdown_photos").delete().eq("id", photoId);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <Camera className="h-3.5 w-3.5" />
        Photos
      </p>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="Breakdown photo" className="h-full w-full object-cover" />
              <button
                onClick={() => handleDelete(p.id, p.url)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                title="Remove photo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          id="photo-upload-input"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
          className="gap-1.5"
        >
          <Camera className="h-4 w-4" />
          {uploading ? "Uploading..." : "Add Photo"}
        </Button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
