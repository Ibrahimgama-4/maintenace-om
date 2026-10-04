"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Breakdown, BreakdownStatus } from "@/types/database";
import { PLANT_LOCATIONS } from "@/lib/constants";
import { equipmentForLine, lineOf } from "@/lib/utils/lines";

const STATUS_FLOW: BreakdownStatus[] = [
  "reported",
  "assigned",
  "investigation",
  "repair",
  "testing",
  "restored",
  "closed",
];

interface EquipmentRow {
  id: string;
  tag_number: string;
  name: string;
  location: string | null;
  plant_section: string | null;
}

interface StaffOption {
  id: string;
  full_name: string;
  sap_number: string | null;
}

export function BreakdownEditor({ breakdown }: { breakdown: Breakdown }) {
  const router = useRouter();
  const supabase = createClient();

  const [status, setStatus] = useState<BreakdownStatus>(breakdown.status);
  const [findings, setFindings] = useState(breakdown.findings ?? "");
  const [rootCause, setRootCause] = useState(breakdown.root_cause ?? "");
  const [correctiveAction, setCorrectiveAction] = useState(breakdown.corrective_action ?? "");
  const [assignedTo, setAssignedTo] = useState((breakdown as any).assigned_to ?? "");
  const [assignmentNote, setAssignmentNote] = useState((breakdown as any).assignment_note ?? "");
  const [location, setLocation] = useState(breakdown.location ?? PLANT_LOCATIONS[0]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [equipmentList, setEquipmentList] = useState<EquipmentRow[]>([]);
  const [equipmentId, setEquipmentId] = useState<string>((breakdown as any).equipment_id ?? "");
  const [saving, setSaving] = useState(false);
  const [savingCase, setSavingCase] = useState(false);
  const [caseSaved, setCaseSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name, sap_number")
      .order("full_name")
      .then(({ data }) => setStaffList((data as StaffOption[]) ?? []));

    supabase
      .from("equipment")
      .select("id, tag_number, name, location, plant_section")
      .order("tag_number")
      .then(({ data }) => setEquipmentList((data as EquipmentRow[]) ?? []));
  }, [supabase]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const isClosing = status === "closed" || status === "restored";

    const { error, data } = await supabase
      .from("breakdowns")
      .update({
        status,
        findings,
        root_cause: rootCause,
        corrective_action: correctiveAction,
        assigned_to: assignedTo || null,
        assignment_note: assignmentNote || null,
        location,
        equipment_id: equipmentId || null,
        ...(isClosing && !breakdown.end_time ? { end_time: new Date().toISOString() } : {}),
      })
      .eq("id", breakdown.id)
      .select();

    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }

    if (!data || data.length === 0) {
      setSaveError(
        "Save was blocked — you may not have permission to edit this breakdown (only the assigned technician, the reporter, or an engineer/admin can edit it)."
      );
      setSaving(false);
      return;
    }

    setSaving(false);
    router.refresh();
  }

  async function handleSaveToKnowledgeBase() {
    setSavingCase(true);
    const solution = [rootCause, correctiveAction].filter(Boolean).join(" — ") || findings || "Resolved.";

    await supabase.from("ai_knowledge_cases").insert({
      breakdown_id: breakdown.id,
      problem_summary: breakdown.fault_description,
      solution_summary: solution,
    });

    setSavingCase(false);
    setCaseSaved(true);
  }

  const canSaveCase = (rootCause || correctiveAction || findings) && !caseSaved;

  return (
    <Card className="space-y-4">
      <h2 className="text-sm font-semibold">Work Order Details</h2>

      <div className="rounded-md border border-dashed border-gray-300 p-3 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Assigned to</label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          >
            <option value="">-- Unassigned --</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
                {s.sap_number ? ` — SAP ${s.sap_number}` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">Who's doing this work — for tracing and accountability.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Task Note</label>
          <textarea
            rows={2}
            placeholder="Any specific instructions for the assignee..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={assignmentNote}
            onChange={(e) => setAssignmentNote(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Production line</label>
        <select
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={location}
          onChange={(e) => {
            const v = e.target.value;
            setLocation(v);
            // Equipment belongs to one line, so clear it if it is not on the newly chosen line.
            const cur = equipmentList.find((x) => x.id === equipmentId);
            if (cur && lineOf(cur.location) !== v) setEquipmentId("");
          }}
        >
          {!PLANT_LOCATIONS.includes(location as any) && (
            <option value={location}>{location} (old value — please reselect)</option>
          )}
          {PLANT_LOCATIONS.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Equipment on this line</label>
        <select
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={equipmentId}
          onChange={(e) => setEquipmentId(e.target.value)}
        >
          <option value="">
            {equipmentForLine(equipmentList, location).length > 0 ? "-- No equipment selected --" : "-- No equipment registered for this line --"}
          </option>
          {equipmentForLine(equipmentList, location).map((eq) => (
            <option key={eq.id} value={eq.id}>
              {eq.tag_number} — {eq.name}
              {eq.plant_section ? ` (${eq.plant_section})` : ""}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400">Only equipment registered on {location} is listed.</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
        <select
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as BreakdownStatus)}
        >
          {STATUS_FLOW.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Findings</label>
        <textarea
          rows={2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={findings}
          onChange={(e) => setFindings(e.target.value)}
          placeholder="What did you find on inspection? (technician-confirmed only)"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Root Cause</label>
        <textarea
          rows={2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={rootCause}
          onChange={(e) => setRootCause(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Corrective Action</label>
        <textarea
          rows={2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={correctiveAction}
          onChange={(e) => setCorrectiveAction(e.target.value)}
        />
      </div>

      {breakdown.ai_suggestion && (
        <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
          <p className="text-xs font-semibold uppercase text-blue-700">AI Suggestion (not confirmed)</p>
          <p className="mt-1 text-sm text-blue-900">{breakdown.ai_suggestion}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>

        <Button
          onClick={handleSaveToKnowledgeBase}
          variant="secondary"
          disabled={!canSaveCase || savingCase}
          className="gap-1.5"
          title={!canSaveCase && !caseSaved ? "Add findings, root cause, or corrective action first" : undefined}
        >
          {caseSaved ? <Check className="h-4 w-4 text-green-600" /> : <BookmarkPlus className="h-4 w-4" />}
          {caseSaved ? "Saved to Knowledge Base" : savingCase ? "Saving..." : "Save to Knowledge Base"}
        </Button>
      </div>

      {saveError && <p className="text-sm text-red-600">{saveError}</p>}
    </Card>
  );
}
