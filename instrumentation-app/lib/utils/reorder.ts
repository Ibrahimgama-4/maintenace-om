export interface PartForReorder {
  id: string;
  part_number: string;
  name: string;
  stock_qty: number;
  min_stock_qty: number;
}

export type ReorderUrgency = "out" | "low" | "watch" | "ok";

export interface ReorderSuggestion {
  urgency: ReorderUrgency;
  /** Suggested quantity to order (0 when nothing is needed). */
  qty: number;
  used90: number;
  /** Approximate days of stock left at the recent usage rate, or null when there is no usage. */
  daysLeft: number | null;
  reason: string;
}

/**
 * Suggests a reorder from stock level, minimum level and the last 90 days of recorded usage.
 * - out:   stock is zero
 * - low:   at or below the minimum stock level
 * - watch: above minimum but fewer than 21 days left at the recent usage rate
 * Target level = the larger of 2x minimum stock or about two months of usage.
 */
export function suggestReorder(part: PartForReorder, used90: number): ReorderSuggestion {
  const monthly = used90 / 3;
  const daysLeft = monthly > 0 ? Math.floor(part.stock_qty / (monthly / 30)) : null;
  const target = Math.max(part.min_stock_qty * 2, Math.ceil(monthly * 2), 1);

  let urgency: ReorderUrgency = "ok";
  if (part.stock_qty <= 0) urgency = "out";
  else if (part.stock_qty <= part.min_stock_qty) urgency = "low";
  else if (daysLeft !== null && daysLeft <= 21) urgency = "watch";

  const qty = urgency === "ok" ? 0 : Math.max(target - part.stock_qty, 1);

  const bits: string[] = [];
  if (urgency === "out") bits.push("Out of stock");
  else if (urgency === "low") bits.push(`Stock ${part.stock_qty} is at or below the minimum of ${part.min_stock_qty}`);
  else if (urgency === "watch") bits.push(`Above minimum, but only about ${daysLeft} days of stock left at current usage`);
  if (used90 > 0) bits.push(`Used ${used90} in the last 90 days (about ${Math.round(monthly * 10) / 10} per month)`);

  return { urgency, qty, used90, daysLeft, reason: bits.join(". ") };
}

export const URGENCY_ORDER: Record<ReorderUrgency, number> = { out: 0, low: 1, watch: 2, ok: 3 };
