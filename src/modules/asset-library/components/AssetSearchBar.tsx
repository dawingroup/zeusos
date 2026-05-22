/**
 * AssetSearchBar — text input plus active tag-filter pills.
 *
 * The parent owns the `search` and `tags` state; this component just
 * renders the controls. Clicking a pill removes that tag from the active
 * filter set.
 */

interface Props {
  search: string;
  onSearchChange: (next: string) => void;
  activeTags: string[];
  onRemoveTag: (tag: string) => void;
  placeholder?: string;
}

export function AssetSearchBar({
  search,
  onSearchChange,
  activeTags,
  onRemoveTag,
  placeholder,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={placeholder ?? 'Search assets by name or tag…'}
        className="w-72 rounded border px-2 py-1 text-sm"
      />
      {activeTags.map((tag) => (
        <button
          key={tag}
          onClick={() => onRemoveTag(tag)}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/70"
          title="Remove filter"
        >
          #{tag}
          <span aria-hidden="true">✕</span>
        </button>
      ))}
    </div>
  );
}
