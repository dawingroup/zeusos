import { useEffect, useState } from 'react';
import {
  peekRecordLabel,
  resolveRecordLabel,
  subscribeRecordLabels,
  type LabelledRecordType,
  type RecordLabel,
} from './recordLabels';

export interface RecordLabelState {
  label: RecordLabel | null | undefined;
  /** Still looking it up. */
  loading: boolean;
}

/**
 * The label for a record, from the shared cache. `label` is undefined while
 * loading, null when the record cannot be named, and the label otherwise.
 */
export function useRecordLabel(type: LabelledRecordType, id: string | null | undefined): RecordLabelState {
  const [label, setLabel] = useState<RecordLabel | null | undefined>(() => peekRecordLabel(type, id));

  useEffect(() => {
    if (!id) {
      setLabel(null);
      return;
    }
    let cancelled = false;
    const sync = () => {
      const next = peekRecordLabel(type, id);
      if (!cancelled) setLabel(next);
    };
    sync();
    const unsubscribe = subscribeRecordLabels(sync);
    void resolveRecordLabel(type, id).then(() => sync());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [type, id]);

  return { label, loading: !!id && label === undefined };
}
