/**
 * Working-time arithmetic for deadlines and escalation.
 *
 * An SLA counted in clock hours makes a task issued at 18:07 with an 8-hour
 * SLA due at 02:07 — overdue before anyone is at work, then escalated and
 * raised to critical overnight (DawinOS audit 2026-09-11: 219 of 309 open
 * tasks "escalated"). Hours here count only 08:00–17:00 Africa/Nairobi,
 * Monday to Friday.
 *
 * PURE: no Firebase imports.
 */

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000; // Africa/Nairobi, no DST
const MS_PER_HOUR = 60 * 60 * 1000;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 17;

const toLocal = (ms) => new Date(ms + EAT_OFFSET_MS);
const fromLocal = (local) => local.getTime() - EAT_OFFSET_MS;

function isWeekend(local) {
  const day = local.getUTCDay();
  return day === 0 || day === 6;
}

/** Move to the next working moment at or after `local` (a shifted Date). */
function nextWorkingMoment(local) {
  const t = new Date(local.getTime());
  for (let guard = 0; guard < 14; guard++) {
    const hour = t.getUTCHours() + t.getUTCMinutes() / 60 + t.getUTCSeconds() / 3600;
    if (!isWeekend(t) && hour >= DAY_START_HOUR && hour < DAY_END_HOUR) return t;
    if (isWeekend(t) || hour >= DAY_END_HOUR) {
      t.setUTCDate(t.getUTCDate() + 1);
    }
    t.setUTCHours(DAY_START_HOUR, 0, 0, 0);
    if (!isWeekend(t)) return t;
  }
  return t;
}

/** `startMs` plus `hours` of working time, as epoch ms. */
function addWorkingHours(startMs, hours) {
  let remaining = Math.max(0, hours) * MS_PER_HOUR;
  let local = nextWorkingMoment(toLocal(startMs));
  while (remaining > 0) {
    const endOfDay = new Date(local.getTime());
    endOfDay.setUTCHours(DAY_END_HOUR, 0, 0, 0);
    const available = endOfDay.getTime() - local.getTime();
    if (remaining <= available) {
      local = new Date(local.getTime() + remaining);
      remaining = 0;
    } else {
      remaining -= available;
      local = nextWorkingMoment(endOfDay);
    }
  }
  return fromLocal(local);
}

/** Is `ms` inside working time (08:00–17:00 Nairobi, Monday to Friday)? */
function isWorkingTime(ms) {
  const local = toLocal(ms);
  return nextWorkingMoment(local).getTime() === local.getTime();
}

/**
 * Working hours elapsed between two instants (0 when `endMs` is not later).
 * A task due Friday 16:00 is one working hour overdue on Monday 09:00.
 */
function workingHoursBetween(startMs, endMs) {
  if (!(endMs > startMs)) return 0;
  const endLocal = toLocal(endMs).getTime();
  let local = nextWorkingMoment(toLocal(startMs));
  let total = 0;
  for (let guard = 0; guard < 1000 && local.getTime() < endLocal; guard++) {
    const endOfDay = new Date(local.getTime());
    endOfDay.setUTCHours(DAY_END_HOUR, 0, 0, 0);
    total += Math.min(endOfDay.getTime(), endLocal) - local.getTime();
    local = nextWorkingMoment(endOfDay);
  }
  return total / MS_PER_HOUR;
}

/** 17:00 Nairobi on a 'YYYY-MM-DD' key, as ISO — "due at the end of that working day". */
function endOfWorkingDayIso(dateKey) {
  return new Date(Date.parse(`${dateKey}T00:00:00.000Z`) - EAT_OFFSET_MS + DAY_END_HOUR * MS_PER_HOUR).toISOString();
}

module.exports = {
  addWorkingHours,
  isWorkingTime,
  workingHoursBetween,
  endOfWorkingDayIso,
  DAY_START_HOUR,
  DAY_END_HOUR,
  EAT_OFFSET_MS,
};
