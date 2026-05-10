-- Health & Optimization Tables for Command Center
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- Daily health check-ins (one per day)
CREATE TABLE IF NOT EXISTS daily_checkins (
  id text PRIMARY KEY,
  date text NOT NULL UNIQUE,
  weight_lb real,
  sleep_hrs real,
  sleep_qual integer CHECK (sleep_qual BETWEEN 1 AND 10),
  energy integer CHECK (energy BETWEEN 1 AND 10),
  stress integer CHECK (stress BETWEEN 1 AND 10),
  focus integer CHECK (focus BETWEEN 1 AND 10),
  motivation integer CHECK (motivation BETWEEN 1 AND 10),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkins_date ON daily_checkins(date);

-- Workout sessions
CREATE TABLE IF NOT EXISTS workouts (
  id text PRIMARY KEY,
  date text NOT NULL,
  session_name text,
  duration_min integer,
  overall_rpe real,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date);

-- Individual exercise sets within a workout
CREATE TABLE IF NOT EXISTS workout_sets (
  id text PRIMARY KEY,
  workout_id text NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise text NOT NULL,
  set_num integer,
  reps integer,
  weight_lb real,
  rpe real,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_sets_workout ON workout_sets(workout_id);
CREATE INDEX IF NOT EXISTS idx_sets_exercise ON workout_sets(exercise);

-- Body measurements (waist, chest, arms, bf%, etc.)
CREATE TABLE IF NOT EXISTS measurements (
  id text PRIMARY KEY,
  date text NOT NULL,
  type text NOT NULL,
  value real NOT NULL,
  unit text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meas_type_date ON measurements(type, date);

-- Supplement cycling tracker
CREATE TABLE IF NOT EXISTS supplement_cycles (
  id text PRIMARY KEY,
  supplement_name text NOT NULL UNIQUE,
  on_days integer NOT NULL,
  off_days integer NOT NULL,
  current_day integer DEFAULT 0,
  detail text,
  updated_at timestamptz DEFAULT now()
);

-- Seed default supplement cycles
INSERT INTO supplement_cycles (id, supplement_name, on_days, off_days, current_day, detail) VALUES
  ('cyc_bromantane', 'Bromantane', 28, 42, 0, '3–4 wks on / 5–6 wks off. Effects persist 1+ month after stopping.'),
  ('cyc_modafinil', 'Modafinil', 5, 2, 0, '3–5 days/week max. Not daily.'),
  ('cyc_phenylpiracetam', 'Phenylpiracetam', 2, 5, 0, '1–2x/week ONLY, never consecutive days.'),
  ('cyc_reuteri', 'L. Reuteri', 60, 14, 0, '60 days on / 14-day oregano oil between cycles.'),
  ('cyc_pinealon', 'Pinealon', 10, 20, 0, '10 days on / 10–20 days off at sunrise.'),
  ('cyc_noopept', 'Noopept', 45, 30, 0, '6 weeks on / 4–5 weeks off.')
ON CONFLICT (supplement_name) DO NOTHING;
