import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadCsv } from "@/lib/utils/csv";
import { DUTY_META, GROUPS, groupLabel, type DutyCode } from "@/lib/utils/shifts";

export interface RosterRow {
  id: string;
  name: string;
  sap: string;
  group: string;
  /** One duty code per day of the month, in order. */
  codes: DutyCode[];
}

const monthTitle = (ym: string) => new Date(ym + "-01T12:00:00Z").toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
const count = (r: RosterRow, c: DutyCode) => r.codes.filter((x) => x === c).length;
const dow = (ym: string, d: number) => new Date(`${ym}-${String(d).padStart(2, "0")}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "narrow", timeZone: "UTC" });

export function downloadRosterCsv(ym: string, rows: RosterRow[]) {
  const days = rows[0]?.codes.length ?? 0;
  const headers = ["Shift", "Name", "SAP number", ...Array.from({ length: days }, (_, i) => String(i + 1)), "Morning (D)", "Night (N)", "Off (O)", "General (G)"];
  const body = rows.map((r) => [groupLabel(r.group), r.name, r.sap, ...r.codes, count(r, "D"), count(r, "N"), count(r, "O"), count(r, "G")]);
  downloadCsv(`duty-roster-${ym}.csv`, headers, body);
}

export function downloadRosterPdf(ym: string, rows: RosterRow[]) {
  const doc = new jsPDF({ orientation: "landscape", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const days = rows[0]?.codes.length ?? 0;

  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, w, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text("Instrumentation Engineering O&M System", 8, 9);
  doc.setFontSize(10);
  doc.text(`Monthly Duty Roster: ${monthTitle(ym)}`, 8, 16);
  doc.setFontSize(8);
  doc.text(`Generated ${new Date().toLocaleString()}`, w - 8, 16, { align: "right" });

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(8);
  doc.text("D = Morning    N = Night    O = Off    G = General (Mon to Sat)", 8, 26);

  const head = [["Name / SAP", ...Array.from({ length: days }, (_, i) => `${i + 1}\n${dow(ym, i + 1)}`), "D", "N", "O", "G"]];
  const body: any[][] = [];
  for (const g of GROUPS) {
    const list = rows.filter((r) => r.group === g);
    if (list.length === 0) continue;
    body.push([{ content: groupLabel(g), colSpan: days + 5, styles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: "bold", halign: "left" } }]);
    for (const r of list) body.push([`${r.name}${r.sap ? `  (${r.sap})` : ""}`, ...r.codes, count(r, "D"), count(r, "N"), count(r, "O"), count(r, "G")]);
  }

  autoTable(doc, {
    startY: 29,
    head,
    body,
    theme: "grid",
    styles: { fontSize: 6.5, cellPadding: 0.9, halign: "center", valign: "middle", lineColor: [200, 200, 205], lineWidth: 0.15 },
    headStyles: { fillColor: [29, 78, 216], textColor: 255, fontSize: 6, halign: "center" },
    columnStyles: { 0: { halign: "left", cellWidth: 46, fontStyle: "bold" } },
    margin: { left: 8, right: 8 },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index >= 1 && d.column.index <= days && typeof d.cell.raw === "string" && d.cell.raw in DUTY_META) {
        d.cell.styles.fillColor = DUTY_META[d.cell.raw as DutyCode].rgb;
        d.cell.styles.fontStyle = "bold";
      }
    },
  });
  doc.save(`duty-roster-${ym}.pdf`);
}
