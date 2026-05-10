// SBS Wave Loading Program — 21-week periodization

export const PROGRAM_WEEKS = [
  { week: 1,  phase: "Phase 1", wave: "Wave 1", pct: 0.650, reps: 6, rir: 4, wtype: "training" },
  { week: 2,  phase: "Phase 1", wave: "Wave 1", pct: 0.700, reps: 5, rir: 3, wtype: "training" },
  { week: 3,  phase: "Phase 1", wave: "Wave 1", pct: 0.750, reps: 4, rir: 3, wtype: "training" },
  { week: 4,  phase: "Phase 1", wave: "Wave 2", pct: 0.675, reps: 6, rir: 4, wtype: "training" },
  { week: 5,  phase: "Phase 1", wave: "Wave 2", pct: 0.725, reps: 5, rir: 3, wtype: "training" },
  { week: 6,  phase: "Phase 1", wave: "Wave 2", pct: 0.775, reps: 4, rir: 2, wtype: "training" },
  { week: 7,  phase: "Deload",  wave: "—",      pct: 0.550, reps: 8, rir: "-", wtype: "deload" },
  { week: 8,  phase: "Phase 2", wave: "Wave 1", pct: 0.700, reps: 5, rir: 3, wtype: "training" },
  { week: 9,  phase: "Phase 2", wave: "Wave 1", pct: 0.750, reps: 4, rir: 3, wtype: "training" },
  { week: 10, phase: "Phase 2", wave: "Wave 1", pct: 0.800, reps: 3, rir: 2, wtype: "training" },
  { week: 11, phase: "Phase 2", wave: "Wave 2", pct: 0.725, reps: 5, rir: 3, wtype: "training" },
  { week: 12, phase: "Phase 2", wave: "Wave 2", pct: 0.775, reps: 4, rir: 2, wtype: "training" },
  { week: 13, phase: "Phase 2", wave: "Wave 2", pct: 0.825, reps: 3, rir: 2, wtype: "training" },
  { week: 14, phase: "Deload",  wave: "—",      pct: 0.550, reps: 8, rir: "-", wtype: "deload" },
  { week: 15, phase: "Phase 3", wave: "Wave 1", pct: 0.750, reps: 4, rir: 2, wtype: "training" },
  { week: 16, phase: "Phase 3", wave: "Wave 1", pct: 0.800, reps: 3, rir: 2, wtype: "training" },
  { week: 17, phase: "Phase 3", wave: "Wave 1", pct: 0.825, reps: 3, rir: 1, wtype: "training" },
  { week: 18, phase: "Phase 3", wave: "Wave 2", pct: 0.775, reps: 4, rir: 2, wtype: "training" },
  { week: 19, phase: "Phase 3", wave: "Wave 2", pct: 0.825, reps: 3, rir: 1, wtype: "training" },
  { week: 20, phase: "Phase 3", wave: "Wave 2", pct: 0.850, reps: 3, rir: 1, wtype: "training" },
  { week: 21, phase: "Deload",  wave: "—",      pct: 0.550, reps: 8, rir: "-", wtype: "deload" },
];

export interface ProgramDay {
  name: string;
  compound: { key: string; name: string; unit: string; sets: number } | null;
  accessories: { name: string; sets: number; reps: string }[];
}

export const PROGRAM_DAYS: Record<number, ProgramDay> = {
  1: {
    name: "Day 1 — Chest + Priority Shoulders",
    compound: { key: "incline_db", name: "Incline DB Press", unit: "lb/hand", sets: 4 },
    accessories: [
      { name: "Cable Lateral Raise", sets: 4, reps: "15-20" },
      { name: "Weighted Dips", sets: 3, reps: "8-12" },
      { name: "Archer Cable Fly", sets: 3, reps: "15-20" },
      { name: "Cable Crunch", sets: 3, reps: "6-10" },
      { name: "Rope OH Triceps Extension", sets: 2, reps: "12-15" },
    ],
  },
  2: {
    name: "Day 2 — Back + Rear Delts + Biceps",
    compound: { key: "lat_pd", name: "Lat Pulldown", unit: "lb", sets: 4 },
    accessories: [
      { name: "Face Pull", sets: 4, reps: "15-20" },
      { name: "Chest-Supported Row", sets: 3, reps: "8-12" },
      { name: "Single-Arm Cable Row", sets: 2, reps: "12-15" },
      { name: "Ab Wheel Rollouts", sets: 3, reps: "8-12" },
      { name: "Incline DB Curl", sets: 2, reps: "10-12" },
      { name: "Hammer Curl", sets: 2, reps: "12-15" },
      { name: "Neck Extension", sets: 3, reps: "10" },
    ],
  },
  3: {
    name: "Day 3 — Shoulders + Arms",
    compound: { key: "ohp", name: "Standing OHP", unit: "lb", sets: 4 },
    accessories: [
      { name: "Dumbbell Lateral Raise", sets: 5, reps: "15-25" },
      { name: "Cable Lateral Raise (Behind)", sets: 3, reps: "12-20" },
      { name: "Decline Sit-Ups", sets: 3, reps: "12-15" },
      { name: "Rope Pushdown", sets: 3, reps: "12-15" },
      { name: "Face Pull / Rear Delt Row", sets: 3, reps: "15-20" },
    ],
  },
  4: {
    name: "Day 4 — Legs + Shoulder Pump",
    compound: { key: "rear_lunge", name: "Rear Lunge (Barbell)", unit: "lb", sets: 4 },
    accessories: [
      { name: "Seated Leg Curl", sets: 3, reps: "8-12" },
      { name: "Hip Abduction / Adduction", sets: 3, reps: "10" },
      { name: "Leg Extension", sets: 2, reps: "12-15" },
      { name: "Calf Raise", sets: 2, reps: "12-15" },
      { name: "Machine/Cable Lateral Raise", sets: 4, reps: "20-30" },
      { name: "Neck Extension", sets: 3, reps: "10" },
    ],
  },
  5: {
    name: "Day 5 — Chest + Back + Shoulders",
    compound: { key: "bench", name: "Flat Barbell Bench Press", unit: "lb", sets: 4 },
    accessories: [
      { name: "Bodyweight / Light Dips", sets: 3, reps: "12-15" },
      { name: "Straight-Arm Pulldown", sets: 2, reps: "12-15" },
      { name: "Hanging Leg Raise", sets: 3, reps: "8-10" },
      { name: "Cable Row", sets: 2, reps: "10-12" },
      { name: "Lateral Raise Machine", sets: 3, reps: "15-20" },
      { name: "Rear Delt Fly", sets: 3, reps: "15-20" },
    ],
  },
  6: {
    name: "Day 6 — Shoulders + Arms",
    compound: null,
    accessories: [
      { name: "Dumbbell Lateral Raise", sets: 5, reps: "15-25" },
      { name: "Upright Cable Lateral Raise", sets: 3, reps: "12-15" },
      { name: "L-Sit", sets: 3, reps: "Failure" },
      { name: "Alternating Dumbbell Curl", sets: 3, reps: "12" },
      { name: "Overhead Cable Triceps Extension", sets: 3, reps: "12-15" },
      { name: "Neck Flexion", sets: 3, reps: "10" },
    ],
  },
};

// Autoregulation: returns lb adjustment based on performance vs prescription
export function calculateAdjustment(setsCompleted: number, repsActual: number, prescribedReps: number): { adj: number; message: string } {
  if (setsCompleted < 3) return { adj: 5, message: "+5 lb — great session, could handle more" };
  if (setsCompleted > 4) return { adj: -5, message: "-5 lb — overreached, back off next session" };
  if (repsActual > prescribedReps + 1) return { adj: 5, message: "+5 lb — blew past rep target" };
  if (repsActual < prescribedReps - 1) return { adj: -5, message: "-5 lb — couldn't hit reps" };
  return { adj: 0, message: "No adjustment — right on target" };
}
