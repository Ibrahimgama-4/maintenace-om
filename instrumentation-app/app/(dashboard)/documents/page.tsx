import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Library, FileText, Download } from "lucide-react";
import { PLANT_LOCATIONS } from "@/lib/constants";
import { getCurrentUserRole, canManage } from "@/lib/utils/role";
import { DocumentUploadForm } from "./DocumentUploadForm";
import clsx from "clsx";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: { location?: string };
}) {
  const supabase = createClient();
  const role = await getCurrentUserRole();
  const activeLocation = searchParams.location;

  let documents: { id: string; title: string; storage_path: string; created_at: string }[] = [];

  if (activeLocation) {
    const { data } = await supabase
      .from("machine_documents")
      .select("id, title, storage_path, created_at")
      .eq("location", activeLocation)
      .order("title");
    documents = data ?? [];
  }

  const documentsWithUrl = documents.map((d) => ({
    ...d,
    url: supabase.storage.from("machine-documents").getPublicUrl(d.storage_path).data.publicUrl,
  }));

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <Library className="h-5 w-5 text-brand-600" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Machine Documents</h1>
          <p className="text-sm text-gray-500">
            Troubleshooting manuals and manufacturer documentation, by line
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PLANT_LOCATIONS.map((loc) => (
          <Link
            key={loc}
            href={`/documents?location=${encodeURIComponent(loc)}`}
            className={clsx(
              "rounded-full px-3 py-1.5 text-sm font-medium",
              activeLocation === loc ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {loc}
          </Link>
        ))}
      </div>

      {!activeLocation ? (
        <Card className="p-10 text-center text-sm text-gray-400">
          Select a line above to see its documents.
        </Card>
      ) : (
        <>
          {canManage(role) && (
            <Card>
              <DocumentUploadForm location={activeLocation} />
            </Card>
          )}

          {documentsWithUrl.length === 0 ? (
            <Card className="p-8 text-center text-sm text-gray-400">
              No documents uploaded yet for {activeLocation}.
            </Card>
          ) : (
            <div className="space-y-2">
              {documentsWithUrl.map((d) => (
                <Card key={d.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                    <p className="text-sm font-medium text-gray-900">{d.title}</p>
                  </div>
                  
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
                  >
                    <Download className="h-4 w-4" />
                    Open
                  </a>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
