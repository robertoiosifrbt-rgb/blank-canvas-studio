import type { CleanerJob } from './CleanerApp';
import JobCard from './JobCard';
import { CalendarDays } from 'lucide-react';

export default function UpcomingTab({ jobs }: { jobs: CleanerJob[] }) {
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CalendarDays className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground font-medium">No upcoming jobs assigned.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map(job => (
        <JobCard key={job.id} job={job} showDate />
      ))}
    </div>
  );
}
