/**
 * Time-tracking module — Phase 5.D.
 *
 * The per-IWO posting form lives in `src/modules/delivery/` (it needs
 * the rate-card + budget context); this module hosts the cross-IWO
 * read view and (in future) the team-utilisation roll-up for managers.
 */

export {
  subscribeMyTimeEntries,
  weekRange,
  totalMinutes,
  groupByIwo,
  dayKey,
  formatMinutes,
  type IwoBucket,
} from './services/time-tracking.service';

export { AddTimeEntryDialog } from './components/AddTimeEntryDialog';
