import type { CleanerJob } from './CleanerApp';
import JobCard from './JobCard';
import ConfirmVisitCard from './ConfirmVisitCard';
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
      {/*
        🆕 §15 (Sesiunea 158) — întrebarea „poți veni?" stă **deasupra** cardului vizitei, nu în el:
        `JobCard.tsx` e exact la clichetul lui de mărime, iar răspunsul e prima faptă a curățătorului
        pe o vizită viitoare, deci și locul de sus e cel corect.
      */}
      {jobs.map(job => (
        <div key={job.id} className="space-y-2">
          <ConfirmVisitCard job={job} />
          <JobCard job={job} showDate />
        </div>
      ))}
    </div>
  );
}

