import { Card, CardContent } from '@/components/ui/card';
import { CalendarDays } from 'lucide-react';
import StatusLegend from './StatusLegend';
import JobCard from './CustomerJobCard';
import type { RequestKind } from './CustomerRequests';
import type { PortalJob } from './portalTypes';

export default function UpcomingJobs({ jobs, onRequest }: { jobs: PortalJob[]; onRequest: (kind: RequestKind, job: PortalJob) => void }) {
  return (
    <div className="space-y-3">
      <StatusLegend />
      {jobs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No upcoming jobs scheduled.</p>
          </CardContent>
        </Card>
      ) : jobs.map(j => <JobCard key={j.id} job={j} showInstructions showRelativeTime onRequest={onRequest} />)}
    </div>
  );
}

