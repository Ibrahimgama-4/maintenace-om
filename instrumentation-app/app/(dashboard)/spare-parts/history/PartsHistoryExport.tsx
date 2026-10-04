"use client";

import { FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/Button";
import { CsvButton } from "@/components/shared/CsvButton";

export interface UsageRow {
  id: string;
  used_at: string;
  part_number: string;
  part_name: string;
  qty: number;
  machine: string;
  location: string;
  used_by: string;
  sap: string;
  breakdown_id: string;
  fault: string;
  notes: string;
}

const HEADERS = ["Date", "Time", "Part number", "Part name", "Qty", "Machine / equipment", "Location", "Used by", "SAP number", "Breakdown", "Notes"];

const dateOf = (iso: string) => new Date(iso).toLocaleDateString();
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function PartsHistoryExport({ rows, filterText }: { rows: UsageRow[]; filterText: string }) {
  const csvRows = rows.map((r) => [dateOf(r.used_at), timeOf(r.used_at), r.part_number, r.part_name, r.qty, r.machine, r.location, r.used_by, r.sap, r.fault, r.notes]);

  function pdf() {
    const doc = new jsPDF({ orientation: "landscape" });
    const w = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, w, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text("Instrumentation Engineering O&M System", 10, 10);
    doc.setFontSize(10);
    doc.text("Spare Parts Usage Audit Record", 10, 17);
    doc.setFontSize(8.5);
    doc.text(`Generated ${new Date().toLocaleString()}  ·  ${rows.length} record${rows.length === 1 ? "" : "s"}`, w - 10, 10, { align: "right" });
    doc.text(filterText || "All records", w - 10, 17, { align: "right" });
    autoTable(doc, {
      startY: 30,
      head: [["Date / time", "Part", "Qty", "Machine / equipment", "Location", "Used by", "Breakdown", "Notes"]],
      body: rows.map((r) => [
        `${dateOf(r.used_at)} ${timeOf(r.used_at)}`,
        `${r.part_number}\n${r.part_name}`,
        String(r.qty),
        r.machine,
        r.location,
        `${r.used_by}${r.sap ? `\nSAP ${r.sap}` : ""}`,
        r.fault,
        r.notes,
      ]),
      styles: { fontSize: 7.5, cellPadding: 2, valign: "top" },
      headStyles: { fillColor: [29, 78, 216] },
      alternateRowStyles: { fillColor: [243, 244, 246] },
      columnStyles: { 0: { cellWidth: 28 }, 2: { cellWidth: 10, halign: "center" } },
      margin: { left: 10, right: 10 },
      didDrawPage: () => {
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(`Page ${doc.getNumberOfPages()}`, w - 10, doc.internal.pageSize.getHeight() - 6, { align: "right" });
      },
    });
    doc.save(`spare-parts-usage-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <CsvButton filename={`spare-parts-usage-${new Date().toISOString().slice(0, 10)}.csv`} headers={HEADERS} rows={csvRows} label="Download CSV (Excel)" />
      <Button type="button" className="gap-1.5" disabled={rows.length === 0} onClick={pdf}>
        <FileDown className="h-4 w-4" />
        Download PDF
      </Button>
    </div>
  );
}
