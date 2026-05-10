import { supabase } from "@/lib/supabase";
import {
  refreshWhoopToken,
  fetchWhoopRecovery,
  fetchWhoopSleep,
  fetchWhoopCycles,
  fetchWhoopWorkouts,
  type WhoopRecovery,
  type WhoopSleep,
  type WhoopCycle,
  type WhoopWorkout,
} from "@/lib/whoop";

export async function getValidWhoopToken(): Promise<string | null> {
  const { data } = await supabase.from("oauth_tokens").select("*").eq("id", "whoop").single();
  if (!data) return null;

  if (new Date(data.expires_at) < new Date(Date.now() + 5 * 60 * 1000)) {
    const newTokens = await refreshWhoopToken(data.refresh_token);
    if (newTokens.error || !newTokens.access_token) {
      console.error("[whoop] refresh failed:", newTokens);
      return null;
    }
    await supabase.from("oauth_tokens").upsert({
      id: "whoop",
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || data.refresh_token,
      expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
    });
    return newTokens.access_token;
  }

  return data.access_token;
}

type PageFetcher<T> = (
  token: string,
  params: { start?: string; end?: string; limit?: string; nextToken?: string }
) => Promise<{ records: T[]; next_token?: string }>;

async function paginate<T>(fetcher: PageFetcher<T>, token: string, start?: string, end?: string): Promise<T[]> {
  const all: T[] = [];
  let nextToken: string | undefined;
  let safety = 50;
  do {
    const params: { start?: string; end?: string; limit?: string; nextToken?: string } = { limit: "25" };
    if (start) params.start = start;
    if (end) params.end = end;
    if (nextToken) params.nextToken = nextToken;
    const page = await fetcher(token, params);
    all.push(...page.records);
    nextToken = page.next_token;
  } while (nextToken && --safety > 0);
  return all;
}

export type WhoopSyncResult =
  | { ok: true; recovery: number; sleep: number; cycles: number; workouts: number }
  | { ok: false; error: string };

export async function syncWhoopData(start?: string, end?: string): Promise<WhoopSyncResult> {
  const token = await getValidWhoopToken();
  if (!token) return { ok: false, error: "not_authenticated" };

  const [recovery, sleep, cycles, workouts] = await Promise.all([
    paginate(fetchWhoopRecovery, token, start, end),
    paginate(fetchWhoopSleep, token, start, end),
    paginate(fetchWhoopCycles, token, start, end),
    paginate(fetchWhoopWorkouts, token, start, end),
  ]);

  if (recovery.length) {
    const rows = recovery.map((r: WhoopRecovery) => ({
      cycle_id: r.cycle_id,
      sleep_id: r.sleep_id,
      user_id: r.user_id,
      recovery_score: r.score?.recovery_score ?? null,
      resting_heart_rate: r.score?.resting_heart_rate ?? null,
      hrv_rmssd_milli: r.score?.hrv_rmssd_milli ?? null,
      spo2_percentage: r.score?.spo2_percentage ?? null,
      skin_temp_celsius: r.score?.skin_temp_celsius ?? null,
      score_state: r.score_state,
      user_calibrating: r.score?.user_calibrating ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
      raw: r,
    }));
    const { error } = await supabase.from("whoop_recovery").upsert(rows, { onConflict: "cycle_id" });
    if (error) console.error("[whoop-sync] recovery upsert:", error);
  }

  if (sleep.length) {
    const rows = sleep.map((s: WhoopSleep) => ({
      id: s.id,
      user_id: s.user_id,
      start_at: s.start,
      end_at: s.end,
      nap: s.nap,
      total_in_bed_milli: s.score?.stage_summary?.total_in_bed_time_milli ?? null,
      total_awake_milli: s.score?.stage_summary?.total_awake_time_milli ?? null,
      total_light_milli: s.score?.stage_summary?.total_light_sleep_time_milli ?? null,
      total_slow_wave_milli: s.score?.stage_summary?.total_slow_wave_sleep_time_milli ?? null,
      total_rem_milli: s.score?.stage_summary?.total_rem_sleep_time_milli ?? null,
      cycle_count: s.score?.stage_summary?.sleep_cycle_count ?? null,
      disturbance_count: s.score?.stage_summary?.disturbance_count ?? null,
      sleep_performance_pct: s.score?.sleep_performance_percentage ?? null,
      sleep_consistency_pct: s.score?.sleep_consistency_percentage ?? null,
      sleep_efficiency_pct: s.score?.sleep_efficiency_percentage ?? null,
      respiratory_rate: s.score?.respiratory_rate ?? null,
      score_state: s.score_state,
      created_at: s.created_at,
      updated_at: s.updated_at,
      raw: s,
    }));
    const { error } = await supabase.from("whoop_sleep").upsert(rows, { onConflict: "id" });
    if (error) console.error("[whoop-sync] sleep upsert:", error);
  }

  if (cycles.length) {
    const rows = cycles.map((c: WhoopCycle) => ({
      id: c.id,
      user_id: c.user_id,
      start_at: c.start,
      end_at: c.end ?? null,
      strain: c.score?.strain ?? null,
      kilojoule: c.score?.kilojoule ?? null,
      average_heart_rate: c.score?.average_heart_rate ?? null,
      max_heart_rate: c.score?.max_heart_rate ?? null,
      score_state: c.score_state,
      created_at: c.created_at,
      updated_at: c.updated_at,
      raw: c,
    }));
    const { error } = await supabase.from("whoop_cycles").upsert(rows, { onConflict: "id" });
    if (error) console.error("[whoop-sync] cycles upsert:", error);
  }

  if (workouts.length) {
    const rows = workouts.map((w: WhoopWorkout) => ({
      id: w.id,
      user_id: w.user_id,
      start_at: w.start,
      end_at: w.end,
      sport_id: w.sport_id,
      strain: w.score?.strain ?? null,
      average_heart_rate: w.score?.average_heart_rate ?? null,
      max_heart_rate: w.score?.max_heart_rate ?? null,
      kilojoule: w.score?.kilojoule ?? null,
      percent_recorded: w.score?.percent_recorded ?? null,
      distance_meter: w.score?.distance_meter ?? null,
      zone_duration: w.score?.zone_duration ?? null,
      score_state: w.score_state,
      created_at: w.created_at,
      updated_at: w.updated_at,
      raw: w,
    }));
    const { error } = await supabase.from("whoop_workouts").upsert(rows, { onConflict: "id" });
    if (error) console.error("[whoop-sync] workouts upsert:", error);
  }

  return { ok: true, recovery: recovery.length, sleep: sleep.length, cycles: cycles.length, workouts: workouts.length };
}
