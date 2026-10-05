import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadCsv } from "@/lib/utils/csv";
import { dmy, fmt2 } from "@/lib/utils/spout";

export interface SpoutReading {
  seq: number;
  kind: string;
  label: string;
  zero_before: number | null;
  span_before: number | null;
  zero_after: number | null;
  span_after: number | null;
  error_pct: number | null;
}

export interface SpoutSheet {
  id: string;
  cal_date: string;
  line: string;
  packer_name: string;
  packer_code: string | null;
  spout_count: number;
  notes: string | null;
  performed_by_name: string | null;
  performed_by_sap: string | null;
  created_at: string;
  prod_name: string | null;
  prod_staff_no: string | null;
  prod_remarks: string | null;
  prod_signed_at: string | null;
  readings: SpoutReading[];
}

const sorted = (s: SpoutSheet) => [...s.readings].sort((a, b) => a.seq - b.seq);

function drawSheet(doc: jsPDF, s: SpoutSheet, first: boolean) {
  if (!first) doc.addPage();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, w, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("Instrumentation Engineering O&M System", 12, 10);
  doc.setFontSize(10.5);
  doc.text("Packer Spout Calibration Record", 12, 18);
  doc.setFontSize(8.5);
  doc.text(`Generated ${new Date().toLocaleString()}`, w - 12, 18, { align: "right" });

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  const info: [string, string][] = [
    ["Production line", s.line],
    ["Packer", `${s.packer_name}${s.packer_code ? ` (${s.packer_code})` : ""} · ${s.spout_count} spouts`],
    ["Date", dmy(s.cal_date)],
    ["Calibrated by", `${s.performed_by_name ?? "Unknown"}${s.performed_by_sap ? ` (SAP ${s.performed_by_sap})` : ""}`],
  ];
  info.forEach(([k, v], i) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, 12, 33 + i * 6.5);
    doc.setFont("helvetica", "normal");
    doc.text(v, 52, 33 + i * 6.5);
  });

  autoTable(doc, {
    startY: 62,
    head: [
      [
        { content: "M/N", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "BEFORE", colSpan: 2, styles: { halign: "center" } },
        { content: "AFTER", colSpan: 2, styles: { halign: "center" } },
        { content: "Error %", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
      ],
      [
        { content: "Zero", styles: { halign: "center" } },
        { content: "Span", styles: { halign: "center" } },
        { content: "Zero", styles: { halign: "center" } },
        { content: "Span", styles: { halign: "center" } },
      ],
    ],
    body: sorted(s).map((r) => [r.label, fmt2(r.zero_before), fmt2(r.span_before), fmt2(r.zero_after), fmt2(r.span_after), fmt2(r.error_pct)]),
    styles: { fontSize: 9.5, cellPadding: 2.4, halign: "center", lineColor: [190, 190, 200], lineWidth: 0.2 },
    headStyles: { fillColor: [29, 78, 216], textColor: 255 },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    alternateRowStyles: { fillColor: [243, 244, 246] },
    margin: { left: 12, right: 12 },
  });

  let y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? 100) + 6;
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text("Error % = (Span before - Span after) x 2   (50 kg reference span)", 12, y);
  if (s.notes) {
    y += 5;
    doc.text(`Notes: ${s.notes}`, 12, y, { maxWidth: w - 24 });
  }

  // Sign-off boxes: Instrumentation and Production departments
  y += 10;
  if (y + 52 > h - 10) {
    doc.addPage();
    y = 20;
  }
  const bw = (w - 24 - 8) / 2;
  const box = (x: number, title: string, name: string, no: string, date: string, extra?: string) => {
    doc.setDrawColor(120, 120, 130);
    doc.setLineWidth(0.3);
    doc.rect(x, y, bw, 48);
    doc.setFillColor(30, 58, 138);
    doc.rect(x, y, bw, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(title, x + 3, y + 5);
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`Name: ${name}`, x + 3, y + 15);
    doc.text(`SAP / Staff no.: ${no}`, x + 3, y + 22);
    doc.text("Signature:", x + 3, y + 33);
    doc.line(x + 22, y + 33.5, x + bw - 4, y + 33.5);
    doc.text(`Date: ${date}`, x + 3, y + 41);
    if (extra) {
      doc.setFontSize(7.5);
      doc.setTextColor(90, 90, 90);
      doc.text(extra, x + 3, y + 46, { maxWidth: bw - 6 });
    }
  };
  box(12, "INSTRUMENTATION DEPARTMENT", s.performed_by_name ?? "", s.performed_by_sap ?? "", dmy(s.created_at));
  box(12 + bw + 8, "PRODUCTION DEPARTMENT", s.prod_name ?? "", s.prod_staff_no ?? "", s.prod_signed_at ? dmy(s.prod_signed_at) : "", s.prod_remarks ? `Remarks: ${s.prod_remarks}` : undefined);

  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  doc.text(`Sheet ${s.id.slice(0, 8)}`, w - 12, h - 6, { align: "right" });
}

export function downloadSheetPdf(s: SpoutSheet) {
  const doc = new jsPDF({ orientation: "portrait" });
  drawSheet(doc, s, true);
  doc.save(`spout-calibration-${s.line.replace(/\s*Packing Plant/, "").replace(/\s+/g, "")}-${s.packer_name.replace(/\s+/g, "")}-${s.cal_date}.pdf`);
}

export function downloadSheetsPdf(list: SpoutSheet[]) {
  if (list.length === 0) return;
  const doc = new jsPDF({ orientation: "portrait" });
  list.forEach((s, i) => drawSheet(doc, s, i === 0));
  doc.save(`spout-calibration-records-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function downloadSheetsCsv(list: SpoutSheet[]) {
  const headers = [
    "Date", "Line", "Packer", "Machine no. (M/N)", "Type", "Before zero", "Before span", "After zero", "After span", "Error %",
    "Instrumentation: name", "Instrumentation: SAP", "Recorded at", "Production: name", "Production: staff no.", "Production: signed at", "Production: remarks", "Notes",
  ];
  const rows = list.flatMap((s) =>
    sorted(s).map((r) => [
      s.cal_date, s.line, s.packer_name, r.label, r.kind,
      r.zero_before, r.span_before, r.zero_after, r.span_after, r.error_pct,
      s.performed_by_name, s.performed_by_sap, s.created_at, s.prod_name, s.prod_staff_no, s.prod_signed_at, s.prod_remarks, s.notes,
    ])
  );
  downloadCsv(`spout-calibration-records-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}
