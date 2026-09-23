import type { BreakdownStatus } from "@/types/database";

export type WorkStatus = "pending" | "in_progress" | "complete";

export function toWorkStatus(status: BreakdownStatus): WorkStatus {
  if (status === "reported" || status === "assigned") return "pending";
  if (status === "restored" || status === "closed") return "complete";
  return "in_progress"; // investigation, repair, testing
}

export const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  complete: "Complete",
};

export const WORK_STATUS_TONE: Record<WorkStatus, "gray" | "amber" | "green"> = {
  pending: "gray",
  in_progress: "amber",
  complete: "green",
};

// The underlying detailed status each quick action sets.
export const WORK_STATUS_TARGET: Record<WorkStatus, BreakdownStatus> = {
  pending: "reported",
  in_progress: "investigation",
  complete: "closed",
};
