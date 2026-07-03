export type Transition = { ts: number; up: 0 | 1 };

export type DayUptime = {
  /** ISO date, UTC */
  day: string;
  /** 0..1 fraction of the day's KNOWN seconds that were up, or null when nothing is known */
  uptime: number | null;
};

const DAY_SECONDS = 86_400;

/**
 * Integrates up/down transitions into per-day uptime fractions.
 *
 * State before the first transition is unknown, not assumed up: a component
 * that started reporting yesterday must not show 89 days of fake green. Days
 * with zero known seconds return null so the UI can render "no data".
 * Transitions must be sorted ascending by ts.
 */
export function dailyUptime(
  transitions: Transition[],
  days: number,
  nowTs: number,
): DayUptime[] {
  const endOfToday = Math.ceil(nowTs / DAY_SECONDS) * DAY_SECONDS;
  const rangeStart = endOfToday - days * DAY_SECONDS;

  const result: DayUptime[] = [];
  let idx = 0;

  // Establish state at rangeStart from the last transition before it.
  let state: 0 | 1 | null = null;
  while (idx < transitions.length && transitions[idx].ts <= rangeStart) {
    state = transitions[idx].up;
    idx += 1;
  }

  for (
    let dayStart = rangeStart;
    dayStart < endOfToday;
    dayStart += DAY_SECONDS
  ) {
    const dayEnd = Math.min(dayStart + DAY_SECONDS, nowTs);
    if (dayEnd <= dayStart) {
      result.push({ day: isoDay(dayStart), uptime: null });
      continue;
    }

    let upSeconds = 0;
    let knownSeconds = 0;
    let cursor = dayStart;

    while (idx < transitions.length && transitions[idx].ts < dayEnd) {
      const t = transitions[idx];
      if (t.ts > cursor && state !== null) {
        const span = t.ts - cursor;
        knownSeconds += span;
        if (state === 1) upSeconds += span;
      }
      cursor = Math.max(cursor, t.ts);
      state = t.up;
      idx += 1;
    }

    if (dayEnd > cursor && state !== null) {
      const span = dayEnd - cursor;
      knownSeconds += span;
      if (state === 1) upSeconds += span;
    }

    result.push({
      day: isoDay(dayStart),
      uptime: knownSeconds > 0 ? upSeconds / knownSeconds : null,
    });
  }

  return result;
}

function isoDay(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}
