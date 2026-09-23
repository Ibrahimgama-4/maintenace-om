import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge } from "@/components/ui/Card";

export default async function EquipmentDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: equipment } = await supabase.from("equipment").select("*").eq("id", params.id).single();
  if (!equipment) notFound();

  const { data: breakdowns } = await supabase
    .from("breakdowns")
    .select("id, fault_description, status, priority, created_at")
    .eq("equipment_id", params.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">
          {equipment.tag_number} — {equipment.name}
        </h1>
        <p className="text-sm text-gray-500">{equipment.plant_section}</p>
      </div>

      <Card>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Type</dt>
            <dd>{equipment.type}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Manufacturer / Model</dt>
            <dd>
              {equipment.manufacturer ?? "—"} {equipment.model ?? ""}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Location</dt>
            <dd>{equipment.location ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Status</dt>
            <dd>
              <Badge tone={equipment.status === "operational" ? "green" : "amber"}>{equipment.status}</Badge>
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Breakdown History</h2>
        {!breakdowns || breakdowns.length === 0 ? (
          <p className="text-sm text-gray-400">No breakdowns recorded for this equipment.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {breakdowns.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/breakdowns/${b.id}`} className="hover:underline">
                  {b.fault_description}
                </Link>
                <Badge tone="blue">{b.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
