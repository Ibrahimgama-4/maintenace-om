import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, isAdmin } from "@/lib/utils/role";
import { Card, Badge } from "@/components/ui/Card";
import { DeleteButton } from "@/components/shared/DeleteButton";
import { dmy, fmt2 } from "@/lib/utils/spout";
import type { SpoutSheet } from "@/lib/utils/spoutExport";
import { SheetPdfButton } from "./SheetPdfButton";
import { ProductionSignOff } from "./ProductionSignOff";

export default async function SpoutSheetPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [role, { data: raw }, { data: userData }] = await Promise.all([
    getCurrentUserRole(),
    supabase.from("spout_calibrations").select("*, spout_calibration_readings(*)").eq("id", params.id).single(),
    supabase.auth.getUser(),
  ]);
  if (!raw) notFound();

  const sheet: SpoutSheet = { ...(raw as any), readings: (raw as any).spout_calibration_readings ?? [] };
  const rows = [...sheet.readings].sort((a, b) => a.seq - b.seq);
  const mine = userData?.user?.id && (raw as any).performed_by === userData.user.id;
  const withinDay = Date.now() - new Date(sheet.created_at).getTime() < 24 * 60 * 60 * 1000;
  const canDelete = isAdmin(role) || (mine && withinDay);

  return (
    <div className="max-w-3xl space-y-4">
      <Link href={`/packer-calibration?line=${encodeURIComponent(sheet.line)}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" />
        Back to spout calibration
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {sheet.packer_name}
            {sheet.packer_code ? ` (${sheet.packer_code})` : ""} — {dmy(sheet.cal_date)}
          </h1>
          <p className="text-sm text-gray-500">
            {sheet.line} · {sheet.spout_count} spouts
          </p>
        </div>
        {canDelete && <DeleteButton table="spout_calibrations" id={sheet.id} label="Delete sheet" redirectTo="/packer-calibration" />}
      </div>

      <SheetPdfButton sheet={sheet} />

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[480px] text-center text-sm">
          <thead>
            <tr className="bg-brand-600 text-white">
              <th rowSpan={2} className="p-2.5 text-left font-semibold">
                M/N
              </th>
              <th colSpan={2} className="border-l border-white/30 p-2 font-semibold">
                BEFORE
              </th>
              <th colSpan={2} className="border-l border-white/30 p-2 font-semibold">
                AFTER
              </th>
              <th rowSpan={2} className="border-l border-white/30 p-2.5 font-semibold">
                Error %
              </th>
            </tr>
            <tr className="bg-brand-600/90 text-xs text-white">
              <th className="border-l border-white/30 p-1.5">Zero</th>
              <th className="p-1.5">Span</th>
              <th className="border-l border-white/30 p-1.5">Zero</th>
              <th className="p-1.5">Span</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.seq} className={i % 2 ? "bg-gray-50" : ""}>
                <td className="p-2.5 text-left font-semibold text-gray-900">{r.label}</td>
                <td className="p-2.5">{fmt2(r.zero_before)}</td>
                <td className="p-2.5">{fmt2(r.span_before)}</td>
                <td className="p-2.5">{fmt2(r.zero_after)}</td>
                <td className="p-2.5">{fmt2(r.span_after)}</td>
                <td className="p-2.5 font-semibold">{fmt2(r.error_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-gray-400">Error % = (Span before − Span after) × 2, from the 50 kg reference span.</p>
      {sheet.notes && (
        <Card className="text-sm text-gray-700">
          <span className="font-medium">Notes: </span>
          {sheet.notes}
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Instrumentation department</p>
          <p className="font-medium text-gray-900">{sheet.performed_by_name ?? "Unknown"}</p>
          <p className="text-sm text-gray-500">{sheet.performed_by_sap ? `SAP ${sheet.performed_by_sap}` : "SAP not set"}</p>
          <p className="mt-1 text-xs text-gray-400">Recorded {new Date(sheet.created_at).toLocaleString()}</p>
          <Badge tone="green" className="mt-2">
            Signed
          </Badge>
        </Card>
        <Card>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Production department</p>
          {sheet.prod_signed_at ? (
            <>
              <p className="font-medium text-gray-900">{sheet.prod_name}</p>
              <p className="text-sm text-gray-500">{sheet.prod_staff_no ? `Staff no. ${sheet.prod_staff_no}` : "Staff no. not given"}</p>
              {sheet.prod_remarks && <p className="mt-1 text-sm italic text-gray-600">“{sheet.prod_remarks}”</p>}
              <p className="mt-1 text-xs text-gray-400">Signed {new Date(sheet.prod_signed_at).toLocaleString()}</p>
              <Badge tone="green" className="mt-2">
                Signed
              </Badge>
            </>
          ) : (
            <ProductionSignOff sheetId={sheet.id} />
          )}
        </Card>
      </div>
    </div>
  );
}
