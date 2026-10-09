"use client";

import { Download, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/Button";
import { downloadCsv } from "@/lib/utils/csv";

export interface LeaveSummaryRow {
  name: string;
  sap: string;
  shift: string;
  AL: number;
  SL: number;
  CA: number;
  total: number;
  taken: number;
  planned: number;
  periods: string;
}

const HEAD = ["Name", "SAP number", "Shift", "Annual leave (AL)", "Sick leave (SL)", "Casual leave (CA)", "Total days", "Taken to date", "Planned (upcoming)", "Leave periods"];

export function LeaveExport({ year, rows }: { year: number; rows: LeaveSummaryRow[] }) {
  const csv = () => downloadCsv(`leave-record-${year}.csv`, HEAD, rows.map((r) => [r.name, r.sap, r.shift, r.AL, r.SL, r.CA, r.total, r.taken, r.planned, r.periods]));

  function pdf() {
    const doc = new jsPDF({ orientation: "landscape" });
    const w = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, w, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.text("Instrumentation Engineering O&M System", 10, 10);
    doc.setFontSize(10);
    doc.text(`Staff Leave Record ${year}`, 10, 17);
    doc.setFontSize(8.5);
    doc.text(`Generated ${new Date().toLocaleString()}`, w - 10, 17, { align: "right" });
    autoTable(doc, {
      startY: 28,
      head: [["Name / SAP", "Shift", "AL", "SL", "CA", "Total", "Taken", "Planned", "Leave periods"]],
      body: rows.map((r) => [`${r.name}${r.sap ? `\nSAP ${r.sap}` : ""}`, r.shift, r.AL, r.SL, r.CA, r.total, r.taken, r.planned, r.periods]),
      styles: { fontSize: 8, cellPadding: 2, valign: "top" },
      headStyles: { fillColor: [29, 78, 216] },
      alternateRowStyles: { fillColor: [243, 244, 246] },
      columnStyles: { 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center" }, 5: { halign: "center", fontStyle: "bold" }, 6: { halign: "center" }, 7: { halign: "center" } },
      margin: { left: 10, right: 10 },
    });
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("AL = Annual leave, SL = Sick leave, CA = Casual leave. Taken = up to today; Planned = after today.", 10, doc.internal.pageSize.getHeight() - 6);
    doc.save(`leave-record-${year}.pdf`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" className="gap-1.5" disabled={rows.length === 0} onClick={csv}>
        <Download className="h-4 w-4" />
        CSV (Excel)
      </Button>
      <Button type="button" className="gap-1.5" disabled={rows.length === 0} onClick={pdf}>
        <FileDown className="h-4 w-4" />
        PDF
      </Button>
    </div>
  );
}
