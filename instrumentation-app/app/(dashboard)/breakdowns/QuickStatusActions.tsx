"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Circle, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toWorkStatus, WORK_STATUS_TARGET, type WorkStatus } from "@/lib/utils/workStatus";
import type { BreakdownStatus } from "@/types/database";

const OPTIONS: { key: WorkStatus; label: string; icon: typeof Circle }[] = [
  { key: "pending", label: "Pending", icon: Circle },
  { key: "in_progress", label: "In Progress", icon: Loader2 },
  { key: "complete", label: "Complete", icon: CheckCircle2 },
];

export function QuickStatusActions({ id, status }: { id: string; status: BreakdownStatus }) {
  const router = useRouter();
  const supabase = createClient();
  const [current, setCurrent] = useState<WorkStatus>(toWorkStatus(status));
  const [saving, setSaving] = useState<WorkStatus | null>(null);

  async function setWorkStatus(target: WorkStatus) {
    if (target === current) return;
    setSaving(target);

    const nextStatus = WORK_STATUS_TARGET[target];
    const isClosing = nextStatus === "closed";

    await supabase
      .from("breakdowns")
      .update({
        status: nextStatus,
        ...(isClosing ? { end_time: new Date().toISOString() } : {}),
      })
      .eq("id", id);

    setCurrent(target);
    setSaving(null);
    router.refresh();
  }

  return (
    <div className="inline-flex overflow-hidden rounded-full border border-gray-200 bg-gray-50 p-0.5">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = current === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => setWorkStatus(opt.key)}
            disabled={saving !== null}
            title={`Mark as ${opt.label}`}
            className={clsx(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60",
              active
                ? opt.key === "complete"
                  ? "bg-green-600 text-white"
                  : opt.key === "in_progress"
                  ? "bg-amber-500 text-white"
                  : "bg-gray-500 text-white"
                : "text-gray-500 hover:bg-gray-100"
            )}
          >
            <Icon className={clsx("h-3.5 w-3.5", saving === opt.key && "animate-spin")} />
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
