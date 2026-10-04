"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { downloadCsv } from "@/lib/utils/csv";

export function CsvButton({
  filename,
  headers,
  rows,
  label = "Download CSV",
}: {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  label?: string;
}) {
  return (
    <Button type="button" variant="secondary" className="gap-1.5" disabled={rows.length === 0} onClick={() => downloadCsv(filename, headers, rows)}>
      <Download className="h-4 w-4" />
      {label}
    </Button>
  );
}
