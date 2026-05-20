/**
 * IsolationToggle — Button to isolate/un-isolate selected entity
 *
 * When isolated, only the selected cabinet/assembly/part is visible.
 */

interface IsolationToggleProps {
  isolatedId?: string;
  selectedId?: string;
  onIsolate: (id: string) => void;
  onUnisolate: () => void;
}

export function IsolationToggle({
  isolatedId,
  selectedId,
  onIsolate,
  onUnisolate,
}: IsolationToggleProps) {
  const isIsolated = !!isolatedId;
  const canIsolate = !!selectedId && !isIsolated;

  if (isIsolated) {
    return (
      <button
        type="button"
        onClick={onUnisolate}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
        title="Show all (exit isolation)"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        Show All
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => selectedId && onIsolate(selectedId)}
      disabled={!canIsolate}
      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      title={canIsolate ? 'Isolate selected' : 'Select something first'}
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
      </svg>
      Isolate
    </button>
  );
}
