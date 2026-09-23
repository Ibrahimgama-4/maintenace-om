import Link from "next/link";
import { PlusCircle, Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default async function HandoverPage() {
  const supabase = createClient();
  const { data: handovers } = await supabase
    .from("shift_handovers")
    .select("id, shift_date, shift_type, outstanding_breakdowns, safety_concerns, notes")
    .order("created_at", { ascending: false })
    .limit(15);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="h-5 w-5 text-brand-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Shift Handover</h1>
            <p className="text-sm text-gray-500">Outstanding items passed between shifts</p>
          </div>
        </div>
        <Link href="/handover/new">
          <Button className="gap-1.5">
            <PlusCircle className="h-4 w-4" />
            New Handover
          </Button>
        </Link>
      </div>

      {!handovers || handovers.length === 0 ? (
        <Card className="p-10 text-center text-sm text-gray-400">No handovers logged yet.</Card>
      ) : (
        <div className="space-y-3">
          {handovers.map((h) => (
            <Card key={h.id}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold capitalize text-gray-900">
                  {h.shift_type} shift — {h.shift_date}
                </span>
              </div>
              {h.outstanding_breakdowns && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Outstanding: </span>
                  {h.outstanding_breakdowns}
                </p>
              )}
              {h.safety_concerns && (
                <p className="mt-1 text-sm text-red-600">
                  <span className="font-medium">Safety: </span>
                  {h.safety_concerns}
                </p>
              )}
              {h.notes && <p className="mt-1 text-sm text-gray-600">{h.notes}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
