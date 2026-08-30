import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, Loader2 } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

/**
 * Sesiunea 28 (owner request) — replaces the plain dropdowns that listed
 * every Customer / every Job: "cand vrei sa adaugi customer... se deschide
 * drop down cu toti clientii... cand vor multi... trebuie sa scrolezi printre
 * toti. o caseta de search cred ca ar fi utila, ca la expenses".
 *
 * Same shape as the linked-job picker ExpenseDialog already had, extracted so
 * Jobs and Payments use one implementation instead of three copies. Searching
 * happens on the SERVER (`fetchOptions` hits an endpoint with a `search`
 * param), so the browser never has to hold the full list — that is the part
 * that actually scales, not just hiding a long list behind a filter box.
 */
export type PickerOption = {
  id: string;
  label: string;
  /** Muted text appended after the label, e.g. a date. */
  hint?: string;
  /**
   * Caller-defined payload handed straight back through `onSelect`, for
   * decisions the parent needs to make about the picked record without
   * re-fetching it (PaymentDialog uses it for the job's customerId).
   */
  data?: Record<string, unknown>;
};

export default function SearchablePicker({
  value,
  selectedLabel,
  onSelect,
  fetchOptions,
  placeholder = 'Search…',
  triggerLabel = 'Select',
  emptyLabel = 'No results found',
  disabled,
  labelId,
}: {
  value: string;
  /**
   * Label for `value` when it was already set before this component mounted —
   * i.e. opening an existing record for edit, where the parent already knows
   * the name and re-fetching it would be a wasted request.
   */
  selectedLabel?: string;
  /** Called with '' and null when the selection is cleared. */
  onSelect: (id: string, option: PickerOption | null) => void;
  fetchOptions: (query: string) => Promise<PickerOption[]>;
  placeholder?: string;
  triggerLabel?: string;
  emptyLabel?: string;
  disabled?: boolean;
  /**
   * ACHU-522 — the `id` of the <Label> above this picker, so a screen reader
   * says WHICH field it is announcing.
   *
   * ⚠️ `aria-labelledby`, not the caller's `htmlFor`, and that is forced by the
   * shape of this component rather than chosen: it renders two different things.
   * With a value picked it is a <span> and a clear button — no labelable
   * control for a `for=` to point at — and empty it is a trigger button that is
   * replaced by a search box once opened. A `htmlFor` would dangle in one state
   * and move in another; a label id stays true in all three.
   */
  labelId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<PickerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<PickerOption | null>(null);

  // Only the most recent search may write results: a slow early request must
  // not land after a later one and show stale options for the current query.
  const requestSeq = useRef(0);

  const runSearch = async (q: string) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const res = await fetchOptions(q);
      if (seq === requestSeq.current) setOptions(res);
    } catch {
      if (seq === requestSeq.current) setOptions([]);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  const debouncedSearch = useDebouncedCallback((q: string) => runSearch(q), 300);

  // Derived, not stored: if the parent resets `value` (dialog reopened, or the
  // selection cleared upstream), the chip disappears without needing an effect
  // to keep local state in sync.
  const label = value ? (picked?.id === value ? picked.label : selectedLabel) : undefined;

  const clear = () => {
    setPicked(null);
    onSelect('', null);
  };

  if (value && label) {
    return (
      <div role="group" aria-labelledby={labelId} className="flex items-center gap-2 p-2 border border-border rounded-lg bg-muted/30">
        <span className="flex-1 text-sm truncate">{label}</span>
        {!disabled && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear selection" title="Clear selection"
            className="p-1 rounded hover:bg-destructive/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={disabled}
        aria-labelledby={labelId ? `${labelId} ${labelId}-trigger` : undefined}
        id={labelId ? `${labelId}-trigger` : undefined}
        onClick={() => { setOpen(true); setQuery(''); runSearch(''); }}
      >
        {triggerLabel}
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          aria-labelledby={labelId}
          placeholder={placeholder}
          className="pl-8"
          value={query}
          onChange={e => { setQuery(e.target.value); debouncedSearch(e.target.value); }}
          autoFocus
        />
      </div>
      <div className="max-h-40 overflow-y-auto border border-border rounded-lg">
        {loading ? (
          <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />Loading…
          </div>
        ) : options.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">{emptyLabel}</div>
        ) : options.map(o => (
          <button
            key={o.id}
            type="button"
            onClick={() => { setPicked(o); onSelect(o.id, o); setOpen(false); setQuery(''); }}
            className="w-full text-left p-2 text-sm hover:bg-muted/50 border-b border-border last:border-b-0"
          >
            {o.label}
            {o.hint && <span className="text-muted-foreground"> {o.hint}</span>}
          </button>
        ))}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
    </div>
  );
}

