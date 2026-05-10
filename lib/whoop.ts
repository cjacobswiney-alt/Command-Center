const CLIENT_ID = process.env.WHOOP_CLIENT_ID!;
const CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET!;
const SCOPES = "read:recovery read:sleep read:cycles read:workout read:profile offline";

const AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const API_BASE = "https://api.prod.whoop.com/developer";

export function getWhoopAuthUrl(redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    state,
  });
  return `${AUTH_URL}?${params}`;
}

export async function exchangeWhoopCode(code: string, redirectUri: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  return res.json();
}

export async function refreshWhoopToken(refresh_token: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token,
      grant_type: "refresh_token",
      scope: "offline",
    }),
  });
  return res.json();
}

async function whoopFetch<T>(path: string, accessToken: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`WHOOP API ${res.status}: ${await res.text()}`);
  return res.json();
}

export interface WhoopUser {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface WhoopRecovery {
  cycle_id: number;
  sleep_id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  score_state: "SCORED" | "PENDING_SCORE" | "UNSCORABLE";
  score?: {
    user_calibrating: boolean;
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
    spo2_percentage?: number;
    skin_temp_celsius?: number;
  };
}

export interface WhoopSleep {
  id: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  nap: boolean;
  score_state: string;
  score?: {
    stage_summary: {
      total_in_bed_time_milli: number;
      total_awake_time_milli: number;
      total_light_sleep_time_milli: number;
      total_slow_wave_sleep_time_milli: number;
      total_rem_sleep_time_milli: number;
      sleep_cycle_count: number;
      disturbance_count: number;
    };
    sleep_needed: { baseline_milli: number; need_from_sleep_debt_milli: number; need_from_recent_strain_milli: number; need_from_recent_nap_milli: number };
    respiratory_rate: number;
    sleep_performance_percentage: number;
    sleep_consistency_percentage: number;
    sleep_efficiency_percentage: number;
  };
}

export interface WhoopCycle {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end?: string;
  timezone_offset: string;
  score_state: string;
  score?: { strain: number; kilojoule: number; average_heart_rate: number; max_heart_rate: number };
}

export interface WhoopWorkout {
  id: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  sport_id: number;
  score_state: string;
  score?: {
    strain: number;
    average_heart_rate: number;
    max_heart_rate: number;
    kilojoule: number;
    percent_recorded: number;
    distance_meter?: number;
    altitude_gain_meter?: number;
    altitude_change_meter?: number;
    zone_duration: Record<string, number>;
  };
}

interface PagedResponse<T> { records: T[]; next_token?: string }

export async function fetchWhoopProfile(accessToken: string) {
  return whoopFetch<WhoopUser>("/v2/user/profile/basic", accessToken);
}

export async function fetchWhoopRecovery(accessToken: string, params?: { start?: string; end?: string; limit?: string; nextToken?: string }) {
  return whoopFetch<PagedResponse<WhoopRecovery>>("/v2/recovery", accessToken, params);
}

export async function fetchWhoopSleep(accessToken: string, params?: { start?: string; end?: string; limit?: string; nextToken?: string }) {
  return whoopFetch<PagedResponse<WhoopSleep>>("/v2/activity/sleep", accessToken, params);
}

export async function fetchWhoopCycles(accessToken: string, params?: { start?: string; end?: string; limit?: string; nextToken?: string }) {
  return whoopFetch<PagedResponse<WhoopCycle>>("/v2/cycle", accessToken, params);
}

export async function fetchWhoopWorkouts(accessToken: string, params?: { start?: string; end?: string; limit?: string; nextToken?: string }) {
  return whoopFetch<PagedResponse<WhoopWorkout>>("/v2/activity/workout", accessToken, params);
}
