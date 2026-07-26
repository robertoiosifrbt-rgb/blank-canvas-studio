import type { CleanerJob } from './CleanerApp';
import JobCard from './JobCard';
import { CheckCircle, ListChecks, Briefcase } from 'lucide-react';

const CLOSED = ['Completed', 'Cancelled', 'No Access'];

export default function TodayTab({ jobs, onRefresh }: { jobs: CleanerJob[]; onRefresh: () => void }) {
  const completedCount = jobs.filter(j => j.status === 'Completed').length;
  const remaining = jobs.filter(j => !CLOSED.includes(j.status ?? '')).length;

  const activeJobs = jobs.filter(j => !CLOSED.includes(j.status ?? ''));
  const closedJobs = jobs.filter(j => CLOSED.includes(j.status ?? ''));

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Briefcase className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground font-medium">No jobs assigned for today.</p>
        <p className="text-sm text-muted-foreground mt-1">Check Upcoming Jobs or contact Admin if you expected an assignment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard icon={<Briefcase className="h-5 w-5" />} label="Today's Jobs" value={jobs.length} />
        <SummaryCard icon={<ListChecks className="h-5 w-5" />} label="Remaining" value={remaining} />
        <SummaryCard icon={<CheckCircle className="h-5 w-5" />} label="Completed" value={completedCount} />
      </div>

      {/* Active job cards */}
      {activeJobs.length > 0 && (
        <div className="space-y-3">
          {activeJobs.map(job => (
            <JobCard key={job.id} job={job} onRefresh={onRefresh} actionsEnabled />
          ))}
        </div>
      )}

      {/* Closed today jobs */}
      {closedJobs.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2">Completed / Closed</p>
          {closedJobs.map(job => (
            <JobCard key={job.id} job={job} onRefresh={onRefresh} actionsEnabled />
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
