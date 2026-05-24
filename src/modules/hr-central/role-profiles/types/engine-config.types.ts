/**
 * Engine Config — Addendum v1.2 §2.4.
 *
 * Tuneable knobs the assigner and watcher agents read. Stored as a
 * single doc at `engine_config/global` (with future room for per-brand
 * overrides if Zeus opens that lever). All times are UTC under the
 * hood; the EAT working-hours window is enforced by the assigner when
 * it decides whether to defer a notification.
 *
 * Default values are Uganda/Kenya operations: 08:00–17:00 EAT Mon-Fri,
 * critical SLA 4h → low 72h, reminder cadence 24h / 4h / 1h.
 */

import type { Timestamp } from 'firebase/firestore';
import type { BriefTier, TierSlaHoursByPriority } from './tier-sla.types';

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/** Reminder cadence in hours before a deadline crosses. */
export interface ReminderCadence {
  firstReminderHoursBefore: number;
  secondReminderHoursBefore: number;
  finalReminderHoursBefore: number;
}

/** Working-hours envelope for the operating timezone. */
export interface WorkingHours {
  /** IANA timezone, e.g. 'Africa/Kampala'. */
  timezone: string;
  /** HH:mm 24h, in the configured timezone. */
  startTime: string;
  endTime: string;
  workDays: Weekday[];
}

/** Overdue-escalation thresholds in hours past `slaDueAt`, per priority. */
export interface OverdueEscalationThresholds {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

/**
 * Global engine config. One doc; the v1.2 spec lets us add per-brand
 * overrides later if needed.
 */
export interface EngineConfig {
  id: 'global';
  workingHours: WorkingHours;

  /**
   * SLA hours by task priority. Resolved from the brief tier × the
   * priority of the spawned task — a TIER_1 critical task has more
   * runway than a TIER_3 critical task.
   */
  slaHoursByTier: Record<BriefTier, TierSlaHoursByPriority>;

  /**
   * Default cap on concurrent tasks per person, used when a role profile
   * doesn't declare its own `typicalTaskLoad.maxConcurrent`.
   */
  defaultMaxConcurrentTasks: number;

  overdueEscalation: OverdueEscalationThresholds;
  reminderCadence: ReminderCadence;

  updatedBy: string;
  updatedAt: Timestamp;
}
