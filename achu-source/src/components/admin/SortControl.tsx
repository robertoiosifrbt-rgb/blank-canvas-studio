import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown } from 'lucide-react';
import type { SortDir } from '@/lib/sorting';

interface SortOption { key: string; label: string }

export default function SortControl({
  options,
  sortBy,
  sortDir,
  onChange,
}: {
  options: SortOption[];
  sortBy: string;
  sortDir: SortDir;
  onChange: (sortBy: string, sortDir: SortDir) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">Sort by</span>
      <Select value={sortBy} onValueChange={v => onChange(v, sortDir)}>
        <SelectTrigger className="h-8 text-xs w-[140px] sm:w-[170px]" aria-label="Sort by">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
        onClick={() => onChange(sortBy, sortDir === 'asc' ? 'desc' : 'asc')}
      >
        {sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

