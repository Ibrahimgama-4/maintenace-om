"use client";

import { Download, FileDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { downloadSheetsCsv, downloadSheetsPdf, type SpoutSheet } from "@/lib/utils/spoutExport";

export function SpoutExportButtons({ sheets }: { sheets: SpoutSheet[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" className="gap-1.5" disabled={sheets.length === 0} onClick={() => downloadSheetsCsv(sheets)}>
        <Download className="h-4 w-4" />
        Download CSV (Excel)
      </Button>
      <Button type="button" className="gap-1.5" disabled={sheets.length === 0} onClick={() => downloadSheetsPdf(sheets)}>
        <FileDown className="h-4 w-4" />
        Download PDF (all sheets)
      </Button>
    </div>
  );
}
