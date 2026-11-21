/**
 * UTC calendar helpers. All game dates are UTC calendar dates ("YYYY-MM-DD");
 * the day boundary resets globally at 00:00 UTC.
 */

import type { UtcDate } from "./types";
import { now } from "./clock";

export function utcDateOf(d: Date): UtcDate {
  return d.toISOString().slice(0, 10);
}

export function utcToday(): UtcDate {
  return utcDateOf(now());
}

export function isUtcDate(value: unknown): value is UtcDate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && utcDateOf(date) === value;
}

export function datePlusDays(date: UtcDate, days: number): UtcDate {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return utcDateOf(d);
}

export function compareDates(a: UtcDate, b: UtcDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Next 00:00 UTC strictly after `now`, as an ISO instant. */
export function nextResetIso(nowD: Date): string {
  const date = utcDateOf(nowD);
  const nextMidnight = new Date(datePlusDays(date, 1) + "T00:00:00Z");
  return nextMidnight.toISOString();
}

/** Latest instant at which a daily attempt for `date` may still finish: 00:30 UTC next day. */
export function dailyFinishWindowEndIso(date: UtcDate): string {
  return new Date(datePlusDays(date, 1) + "T00:30:00Z").toISOString();
}

export function isWithinFinishWindow(date: UtcDate, nowD: Date): boolean {
  const end = new Date(dailyFinishWindowEndIso(date));
  return nowD.getTime() < end.getTime() && utcDateOf(nowD) !== date
    ? true
    : utcDateOf(nowD) === date && nowD.getTime() >= new Date(date + "T00:00:00Z").getTime();
}

/** Consecutive-run helpers over a sorted ascending list of released dates. */

export function currentStreak(releasedDates: UtcDate[], completedDates: Set<UtcDate>, today: UtcDate): number {
  const released = releasedDates.filter((d) => compareDates(d, today) <= 0);
  if (released.length === 0) return 0;
  let startIdx: number;
  if (completedDates.has(today)) {
    startIdx = released.length - 1;
  } else {
    // most recent released date strictly before today
    startIdx = -1;
    for (let i = released.length - 1; i >= 0; i--) {
      if (compareDates(released[i], today) < 0) {
        startIdx = i;
        break;
      }
    }
  }
  if (startIdx < 0 || !completedDates.has(released[startIdx])) return 0;
  let streak = 0;
  for (let i = startIdx; i >= 0; i--) {
    if (completedDates.has(released[i])) streak++;
    else break;
  }
  return streak;
}

export function bestStreak(releasedDates: UtcDate[], completedDates: Set<UtcDate>): number {
  const dates = releasedDates.filter((d) => completedDates.has(d));
  if (dates.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    if (compareDates(datePlusDays(dates[i - 1], 1), dates[i]) === 0) {
      run++;
    } else {
      run = 1;
    }
    if (run > best) best = run;
  }
  return best;
}
