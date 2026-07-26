import { useState } from 'react';
import type { CleanerJob } from './CleanerApp';
import JobCard from './JobCard';
import { History, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** ACHU-117: Incremental loading — show 10 items initially, load more on demand */
const PAGE_SIZE = 10;

export default function HistoryTab({ jobs }: { jobs: CleanerJob[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <History className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground font-medium">No job history available.</p>
      </div>
    );
  }

  const shown = jobs.slice(0, visible);
  const hasMore = visible < jobs.length;

  return (
    <div className="space-y-3">
      {shown.map(job => (
        <JobCard key={job.id} job={job} showDate />
      ))}
      {hasMore && (
        <div className="flex justify-center pt-2 pb-4">
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            onClick={() => setVisible(v => v + PAGE_SIZE)}
          >
            <ChevronDown className="h-4 w-4 mr-1.5" />
            Show More ({jobs.length - visible} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}
