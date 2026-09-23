export const PLANT_LOCATIONS = [
  "Line 1 & 2 Packing Plant",
  "Line 3 Packing Plant",
  "Line 4 Packing Plant",
  "Line 5 Packing Plant",
] as const;

export type PlantLocation = (typeof PLANT_LOCATIONS)[number];

export const SHIFT_TYPES = ["General", "Morning", "Night"] as const;

export type ShiftType = (typeof SHIFT_TYPES)[number];
