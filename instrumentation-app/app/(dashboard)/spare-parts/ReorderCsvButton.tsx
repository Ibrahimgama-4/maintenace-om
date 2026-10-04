"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface ReorderRow {
  part_number: string;
  name: string;
  stock: number;
  minimum: number;
  suggested_qty: number;
  reason: string;
}

export function ReorderCsvButton({ rows }: { rows: ReorderRow[] }) {
  function download() {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const head = ["Part number", "Name", "In stock", "Minimum", "Suggested order qty", "Reason"];
    const lines = [head, ...rows.map((r) => [r.part_number, r.name, r.stock, r.minimum, r.suggested_qty, r.reason])]
      .map((l) => l.map(esc).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + lines], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reorder-list-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <Button type="button" variant="secondary" className="gap-1.5" onClick={download}>
      <Download className="h-4 w-4" />
      Reorder list (CSV)
    </Button>
  );
}
