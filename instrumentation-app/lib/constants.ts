export const PLANT_LOCATIONS = [
  "Line 1 & 2 Packing Plant",
  "Line 3 Packing Plant",
  "Line 4 Packing Plant",
  "Line 5 Packing Plant",
] as const;

export type PlantLocation = (typeof PLANT_LOCATIONS)[number];

export const SHIFT_TYPES = ["General", "Morning", "Night"] as const;

export type ShiftType = (typeof SHIFT_TYPES)[number];

/** Spouts per packer: Line 1 & 2 packers have 12, packers on Lines 3, 4 and 5 have 8. */
export const SPOUTS_BY_LINE: Record<string, number> = {
  "Line 1 & 2 Packing Plant": 12,
  "Line 3 Packing Plant": 8,
  "Line 4 Packing Plant": 8,
  "Line 5 Packing Plant": 8,
};

/** Spout calibration is not done on Sundays; "today" is judged in the plant's time zone. */
export const PLANT_TIME_ZONE = "Africa/Lagos";
