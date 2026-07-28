import {
  RETOUCH_DAILY_MAX,
  RETOUCH_EXTRA_COST,
  RETOUCH_FREE_PER_CYCLE,
} from "@/lib/data";

export type PortraitRetouchState = {
  portraitId: string;
  createdAt: number;
  /** Free edits remaining for the focused draft (#60: 1) */
  freeRemaining: number;
  nextDayEntryCharged: boolean;
};

function sameCalendarDay(a: number, b: number) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export type RetouchAttemptResult =
  | {
      ok: true;
      cost: number;
      freeRemaining: number;
      state: PortraitRetouchState;
      nextTimestamps: number[];
    }
  | {
      ok: false;
      reason: "throttle" | "daily_limit" | "insufficient_credits";
      cost?: number;
      nextTimestamps: number[];
    };

/**
 * #60 policy:
 * - 1 free edit on selected draft
 * - further edits / regenerates: 1 credit each
 */
export function evaluateRetouchRequest(params: {
  state: PortraitRetouchState | null;
  portraitId: string;
  createdAt: number;
  now?: number;
  credits: number;
  dailyRetouchCount: number;
  recentTimestamps: number[];
  /** regenerate always costs 1 credit (no free) */
  mode?: "retouch" | "regenerate";
}): RetouchAttemptResult {
  const now = params.now ?? Date.now();
  const mode = params.mode ?? "retouch";
  const windowMs = 10_000;
  const recent = params.recentTimestamps.filter((t) => now - t < windowMs);

  if (recent.length >= 4) {
    return { ok: false, reason: "throttle", nextTimestamps: recent };
  }

  if (params.dailyRetouchCount >= RETOUCH_DAILY_MAX) {
    return { ok: false, reason: "daily_limit", nextTimestamps: [...recent, now] };
  }

  let state: PortraitRetouchState = params.state ?? {
    portraitId: params.portraitId,
    createdAt: params.createdAt,
    freeRemaining: RETOUCH_FREE_PER_CYCLE,
    nextDayEntryCharged: false,
  };

  if (!sameCalendarDay(state.createdAt, now) && !state.nextDayEntryCharged) {
    state = {
      ...state,
      freeRemaining: RETOUCH_FREE_PER_CYCLE,
      nextDayEntryCharged: true,
    };
  }

  let cost = 0;
  if (mode === "regenerate") {
    cost = RETOUCH_EXTRA_COST;
  } else if (state.freeRemaining > 0) {
    state = { ...state, freeRemaining: state.freeRemaining - 1 };
  } else {
    cost = RETOUCH_EXTRA_COST;
  }

  if (params.credits < cost) {
    return { ok: false, reason: "insufficient_credits", cost, nextTimestamps: recent };
  }

  return {
    ok: true,
    cost,
    freeRemaining: state.freeRemaining,
    state,
    nextTimestamps: [...recent, now],
  };
}
