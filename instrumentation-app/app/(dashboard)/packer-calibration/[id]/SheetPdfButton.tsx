"use client";

import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { downloadSheetPdf, downloadSheetsCsv, type SpoutSheet } from "@/lib/utils/spoutExport";

export function SheetPdfButton({ sheet }: { sheet: SpoutSheet }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" className="gap-1.5" onClick={() => downloadSheetPdf(sheet)}>
        <FileDown className="h-4 w-4" />
        Download PDF (print with signature boxes)
      </Button>
      <Button type="button" variant="secondary" onClick={() => downloadSheetsCsv([sheet])}>
        CSV
      </Button>
    </div>
  );
}
