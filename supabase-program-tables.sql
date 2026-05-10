-- Program Tracker Tables for Command Center
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS program_config (
  id text PRIMARY KEY,
  lift text NOT NULL UNIQUE,
  tm_lb real NOT NULL,
  adj_lb real NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS program_state (
  id text PRIMARY KEY DEFAULT 'default',
  current_week integer NOT NULL DEFAULT 1,
  start_date text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS program_log (
  id text PRIMARY KEY,
  date text NOT NULL,
  week_num integer NOT NULL,
  day_num integer NOT NULL,
  lift text NOT NULL,
  prescribed_weight real,
  prescribed_reps integer,
  rir_target text,
  sets_target integer,
  sets_completed integer,
  reps_actual real,
  weight_actual real,
  notes text,
  adj_applied real DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plog_date ON program_log(date);
CREATE INDEX IF NOT EXISTS idx_plog_week ON program_log(week_num);
CREATE INDEX IF NOT EXISTS idx_plog_lift ON program_log(lift);

-- Seed training maxes
INSERT INTO program_config (id, lift, tm_lb) VALUES
  ('lift_bench', 'bench', 285),
  ('lift_ohp', 'ohp', 165),
  ('lift_incline_db', 'incline_db', 95),
  ('lift_lat_pd', 'lat_pd', 220),
  ('lift_rear_lunge', 'rear_lunge', 205)
ON CONFLICT (lift) DO NOTHING;

-- Seed initial state
INSERT INTO program_state (id, current_week) VALUES ('default', 1)
ON CONFLICT (id) DO NOTHING;
