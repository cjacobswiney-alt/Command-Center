-- WHOOP recovery — one per cycle (sleep) the previous night
create table if not exists whoop_recovery (
  cycle_id bigint primary key,
  sleep_id text,
  user_id bigint,
  recovery_score smallint,
  resting_heart_rate smallint,
  hrv_rmssd_milli numeric,
  spo2_percentage numeric,
  skin_temp_celsius numeric,
  score_state text,
  user_calibrating boolean,
  created_at timestamptz,
  updated_at timestamptz,
  raw jsonb
);
create index if not exists idx_whoop_recovery_created on whoop_recovery(created_at desc);

-- WHOOP sleep
create table if not exists whoop_sleep (
  id text primary key,
  user_id bigint,
  start_at timestamptz,
  end_at timestamptz,
  nap boolean,
  total_in_bed_milli bigint,
  total_awake_milli bigint,
  total_light_milli bigint,
  total_slow_wave_milli bigint,
  total_rem_milli bigint,
  cycle_count smallint,
  disturbance_count smallint,
  sleep_performance_pct numeric,
  sleep_consistency_pct numeric,
  sleep_efficiency_pct numeric,
  respiratory_rate numeric,
  score_state text,
  created_at timestamptz,
  updated_at timestamptz,
  raw jsonb
);
create index if not exists idx_whoop_sleep_start on whoop_sleep(start_at desc);

-- WHOOP cycles (day strain)
create table if not exists whoop_cycles (
  id bigint primary key,
  user_id bigint,
  start_at timestamptz,
  end_at timestamptz,
  strain numeric,
  kilojoule numeric,
  average_heart_rate smallint,
  max_heart_rate smallint,
  score_state text,
  created_at timestamptz,
  updated_at timestamptz,
  raw jsonb
);
create index if not exists idx_whoop_cycles_start on whoop_cycles(start_at desc);

-- WHOOP workouts
create table if not exists whoop_workouts (
  id text primary key,
  user_id bigint,
  start_at timestamptz,
  end_at timestamptz,
  sport_id smallint,
  strain numeric,
  average_heart_rate smallint,
  max_heart_rate smallint,
  kilojoule numeric,
  percent_recorded numeric,
  distance_meter numeric,
  zone_duration jsonb,
  score_state text,
  created_at timestamptz,
  updated_at timestamptz,
  raw jsonb
);
create index if not exists idx_whoop_workouts_start on whoop_workouts(start_at desc);
