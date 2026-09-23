"use client";

import { useState } from "react";
import { Download, FileText, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (val: unknown) => `"${String(val ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildBrandedPdf(title: string, rows: Record<string, unknown>[], columns: string[]) {
  const doc = new jsPDF({ orientation: "landscape" });

  // Header band
  doc.setFillColor(30, 58, 138); // brand navy
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("Instrumentation Engineering O&M System", 10, 10);
  doc.setFontSize(10);
  doc.text(title, 10, 17);

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString()}`, doc.internal.pageSize.getWidth() - 10, 17, { align: "right" });

  autoTable(doc, {
    startY: 28,
    head: [columns],
    body: rows.map((r) => columns.map((c) => String(r[c] ?? ""))),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [29, 78, 216] }, // brand blue
    alternateRowStyles: { fillColor: [243, 244, 246] },
    margin: { left: 10, right: 10 },
  });

  return doc;
}

export default function ReportsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const breakdownColumns = [
    "fault_description",
    "priority",
    "status",
    "location",
    "root_cause",
    "corrective_action",
    "downtime_minutes",
    "created_at",
  ];
  const equipmentColumns = ["tag_number", "name", "type", "plant_section", "status"];

  async function fetchBreakdowns() {
    return supabase
      .from("breakdowns")
      .select(
        "fault_description, alarm_code, priority, status, location, findings, root_cause, corrective_action, start_time, end_time, downtime_minutes, created_at"
      )
      .order("created_at", { ascending: false });
  }

  async function fetchEquipment() {
    return supabase
      .from("equipment")
      .select("tag_number, name, type, location, plant_section, manufacturer, model, status")
      .order("tag_number");
  }

  async function exportBreakdownsCsv() {
    setLoading("breakdowns-csv");
    setError(null);
    const { data, error } = await fetchBreakdowns();
    if (error) setError(error.message);
    else downloadFile(`breakdowns-report-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(data ?? []), "text/csv;charset=utf-8;");
    setLoading(null);
  }

  async function exportBreakdownsPdf() {
    setLoading("breakdowns-pdf");
    setError(null);
    const { data, error } = await fetchBreakdowns();
    if (error) {
      setError(error.message);
    } else {
      const doc = buildBrandedPdf("Breakdown Report", data ?? [], breakdownColumns);
      doc.save(`breakdowns-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    }
    setLoading(null);
  }

  async function exportEquipmentCsv() {
    setLoading("equipment-csv");
    setError(null);
    const { data, error } = await fetchEquipment();
    if (error) setError(error.message);
    else downloadFile(`equipment-report-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(data ?? []), "text/csv;charset=utf-8;");
    setLoading(null);
  }

  async function exportEquipmentPdf() {
    setLoading("equipment-pdf");
    setError(null);
    const { data, error } = await fetchEquipment();
    if (error) {
      setError(error.message);
    } else {
      const doc = buildBrandedPdf("Equipment Report", data ?? [], equipmentColumns);
      doc.save(`equipment-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    }
    setLoading(null);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-brand-600" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500">Export as CSV (Excel) or a branded PDF</p>
        </div>
      </div>

      <Card className="space-y-3">
        <p className="text-sm font-medium text-gray-900">Breakdown Report</p>
        <p className="text-xs text-gray-500">All breakdowns with findings, root cause, and downtime</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportBreakdownsPdf} disabled={loading !== null} className="gap-1.5">
            <FileDown className="h-4 w-4" />
            {loading === "breakdowns-pdf" ? "Generating..." : "Export PDF"}
          </Button>
          <Button onClick={exportBreakdownsCsv} disabled={loading !== null} variant="secondary" className="gap-1.5">
            <Download className="h-4 w-4" />
            {loading === "breakdowns-csv" ? "Exporting..." : "Export CSV"}
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <p className="text-sm font-medium text-gray-900">Equipment Report</p>
        <p className="text-xs text-gray-500">Full equipment database</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportEquipmentPdf} disabled={loading !== null} className="gap-1.5">
            <FileDown className="h-4 w-4" />
            {loading === "equipment-pdf" ? "Generating..." : "Export PDF"}
          </Button>
          <Button onClick={exportEquipmentCsv} disabled={loading !== null} variant="secondary" className="gap-1.5">
            <Download className="h-4 w-4" />
            {loading === "equipment-csv" ? "Exporting..." : "Export CSV"}
          </Button>
        </div>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
