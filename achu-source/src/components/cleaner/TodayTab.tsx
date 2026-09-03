import type { CleanerJob } from './CleanerApp';
import JobCard from './JobCard';
import ConfirmVisitCard from './ConfirmVisitCard';
import HoursCard from './HoursCard';
import { CheckCircle, ListChecks, Briefcase } from 'lucide-react';

const CLOSED = ['Completed', 'Cancelled', 'No Access'];

export default function TodayTab({ jobs, onRefresh }: { jobs: CleanerJob[]; onRefresh: () => void }) {
  const completedCount = jobs.filter(j => j.status === 'Completed').length;
  const remaining = jobs.filter(j => !CLOSED.includes(j.status ?? '')).length;

  const activeJobs = jobs.filter(j => !CLOSED.includes(j.status ?? ''));
  const closedJobs = jobs.filter(j => CLOSED.includes(j.status ?? ''));

  if (jobs.length === 0) {
    return (
      <div className="space-y-4">
        {/*
          ACHU-268 — the hours card renders even with NO jobs today, and that is
          the point of putting it above the empty state. Travel, training, and a
          job the office never recorded are all real worked time, and a screen
          that offers no way to record them on exactly those days would send the
          person back to ringing the office.
        */}
        <HoursCard onChanged={onRefresh} />
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Briefcase className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground font-medium">No jobs assigned for today.</p>
          <p className="text-sm text-muted-foreground mt-1">Check Upcoming Jobs or contact Admin if you expected an assignment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <HoursCard onChanged={onRefresh} />
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard icon={<Briefcase className="h-5 w-5" />} label="Today's Jobs" value={jobs.length} />
        <SummaryCard icon={<ListChecks className="h-5 w-5" />} label="Remaining" value={remaining} />
        <SummaryCard icon={<CheckCircle className="h-5 w-5" />} label="Completed" value={completedCount} />
      </div>

      {/* Active job cards */}
      {activeJobs.length > 0 && (
        <div className="space-y-3">
          {/* 🆕 §15 (Sesiunea 158) — doar pe vizitele ACTIVE: pe una închisă nu mai e ce răspunde. */}
          {activeJobs.map(job => (
            <div key={job.id} className="space-y-2">
              <ConfirmVisitCard job={job} onRefresh={onRefresh} />
              <JobCard job={job} showDate onRefresh={onRefresh} actionsEnabled />
            </div>
          ))}
        </div>
      )}

      {/* Closed today jobs */}
      {closedJobs.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2">Completed / Closed</p>
          {closedJobs.map(job => (
            <JobCard key={job.id} job={job} showDate onRefresh={onRefresh} actionsEnabled />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 text-center">
      <div className="flex justify-center text-muted-foreground mb-1">{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

