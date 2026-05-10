-- Accessory weight tracking
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS accessory_log (
  id text PRIMARY KEY,
  date text NOT NULL,
  day_num integer NOT NULL,
  exercise text NOT NULL,
  weight_lb real,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acc_day ON accessory_log(day_num);
CREATE INDEX IF NOT EXISTS idx_acc_exercise ON accessory_log(exercise);
