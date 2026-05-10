export interface Task {
  id: string;
  title: string;
  category: "buckingham" | "personal-tasks" | "tools" | "team";
  priority: "high" | "medium" | "low";
  notes: string | null;
  status: "todo" | "done";
  source: "manual" | "dump" | "email";
  created_at: string;
  created_date: string;
  completed_date: string | null;
  due_date: string | null;
}

export interface BriefingItem {
  title: string;
  reason: string;
  category: string;
  priority: string;
}

export interface Briefing {
  date: string;
  summary: string;
  items: BriefingItem[];
  scanned_at: string;
}

export interface DayLog {
  date: string;
  content: string;
  updated_at: string;
}

export const CATEGORIES = [
  { id: "buckingham", label: "Buckingham", color: "#1B3A5C" },
  { id: "personal-tasks", label: "Personal Tasks", color: "#C9A84C" },
  { id: "tools", label: "Tools", color: "#7C5CBF" },
  { id: "team", label: "Team", color: "#D4880F" },
] as const;

export const PRIORITIES = ["high", "medium", "low"] as const;

// ─── Health & Optimization ─────────────────────────────────

export interface DailyCheckin {
  id: string;
  date: string;
  weight_lb: number | null;
  sleep_hrs: number | null;
  sleep_qual: number | null;
  energy: number | null;
  stress: number | null;
  focus: number | null;
  motivation: number | null;
  notes: string | null;
  created_at: string;
}

export interface Workout {
  id: string;
  date: string;
  session_name: string;
  duration_min: number | null;
  overall_rpe: number | null;
  notes: string | null;
  created_at: string;
  set_count?: number;
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise: string;
  set_num: number;
  reps: number | null;
  weight_lb: number | null;
  rpe: number | null;
  notes: string | null;
}

export interface WorkoutDetail extends Workout {
  exercises: { name: string; sets: WorkoutSet[] }[];
}

export interface Measurement {
  id: string;
  date: string;
  type: string;
  value: number;
  unit: string;
  notes: string;
  created_at: string;
}

export interface SupplementCycle {
  id: string;
  supplement_name: string;
  on_days: number;
  off_days: number;
  current_day: number;
  detail: string | null;
  updated_at: string;
}

export interface HealthDashboard {
  latest_checkin: DailyCheckin | null;
  latest_workout: Workout | null;
  recent_checkins: DailyCheckin[];
  workouts_this_week: number;
  weight_history: { date: string; weight_lb: number }[];
  prs: { exercise: string; weight_lb: number; reps: number; date: string }[];
  total_sessions: number;
  total_days: number;
  streak: number;
}

export const MEASUREMENT_TYPES = [
  { id: "waist", label: "Waist (in)" },
  { id: "chest", label: "Chest (in)" },
  { id: "shoulders", label: "Shoulders (in)" },
  { id: "arms_l", label: "Left Arm (in)" },
  { id: "arms_r", label: "Right Arm (in)" },
  { id: "quads_l", label: "Left Quad (in)" },
  { id: "quads_r", label: "Right Quad (in)" },
  { id: "bf_pct", label: "Body Fat %" },
] as const;

export const SESSION_TEMPLATES: Record<string, string[]> = {
  "Push A": ["Barbell Bench Press", "Overhead Press (Standing)", "Incline DB Press", "Lateral Raises", "Tricep Pushdowns"],
  "Push B": ["Incline Barbell Press", "Dumbbell Bench Press", "Cable Fly / Pec Deck", "Arnold Press", "Overhead Tricep Extension"],
  "Pull A": ["Weighted Pull-Up / Chin", "Barbell Row", "Chest-Supported Row", "Face Pulls", "Barbell Curl"],
  "Pull B": ["Lat Pulldown (Wide)", "Seated Cable Row", "Single-Arm DB Row", "Straight-Arm Pulldown", "Hammer Curl"],
  "Legs A": ["Back Squat", "Romanian Deadlift", "Leg Press", "Walking Lunges", "Calf Raises"],
  "Legs B": ["Conventional Deadlift", "Front Squat", "Lying Leg Curl", "Bulgarian Split Squat", "Hip Thrust (Barbell)"],
};
