export type UserRole = "admin" | "engineer" | "technician";
export type BreakdownPriority = "low" | "medium" | "high" | "critical";
export type BreakdownStatus =
  | "reported"
  | "assigned"
  | "investigation"
  | "repair"
  | "testing"
  | "restored"
  | "closed";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  active: boolean;
  created_at: string;
}

export interface Equipment {
  id: string;
  tag_number: string;
  name: string;
  type: string;
  location: string | null;
  plant_section: string | null;
  manufacturer: string | null;
  model: string | null;
  install_date: string | null;
  status: string;
  created_at: string;
  created_by: string | null;
}

export interface Breakdown {
  id: string;
  equipment_id: string | null;
  reported_by: string;
  assigned_to: string | null;
  location: string | null;
  fault_description: string;
  alarm_code: string | null;
  priority: BreakdownPriority;
  status: BreakdownStatus;
  findings: string | null;
  root_cause: string | null;
  corrective_action: string | null;
  ai_suggestion: string | null;
  start_time: string;
  end_time: string | null;
  downtime_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface SparePart {
  id: string;
  part_number: string;
  name: string;
  equipment_compatible: string[] | null;
  stock_qty: number;
  min_stock_qty: number;
  created_at: string;
}

// Minimal Database type placeholder — replace with `supabase gen types typescript`
// output once your project is live, for full query type-safety.
export type Database = Record<string, unknown>;
