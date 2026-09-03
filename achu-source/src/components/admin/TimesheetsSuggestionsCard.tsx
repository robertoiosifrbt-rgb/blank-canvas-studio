import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function TimesheetsSuggestionsCard({ suggestions, busy, onAdd }) {
  if (suggestions.length === 0) return null;
  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div>
          <h2 className="font-medium">From jobs already marked done</h2>
          <p className="text-xs text-muted-foreground">
            The app stamped these times when each job changed status. They are a starting
            point, not a record of hours — the stamp is when the status moved, and it belongs to the job
            rather than to one person, so a job worked by two people would otherwise be counted twice.
            Check each one before adding it.
          </p>
        </div>
        <div className="space-y-2">
          {suggestions.map(sg => (
            <div key={sg.jobId} className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm">
              <span className="font-medium">{sg.workDate}</span>
              <span className="text-muted-foreground">#{sg.jobReference} {sg.service}</span>
              {/* ⚠️ `HH:MM` de pe server. Până pe 15/08/2026 ajungea aici marcajul întreg,
                  iar fiecare rând purta o eroare roșie — vezi `lib/actualStampReading.ts`. */}
              <span>{sg.startTime && sg.finishTime ? `${sg.startTime}–${sg.finishTime}` : 'no usable time'}</span>
              {sg.problem
                ? <Badge variant="outline" className="text-red-700 dark:text-red-400">{sg.problem}</Badge>
                : <Badge variant="outline">{(sg.workedMinutes / 60).toFixed(2)}h</Badge>}
              {/* 🔴 Butonul dispare când nu e nimic de pus în formular: altfel deschide un
                  formular gol și omul crede că a adăugat ceva. */}
              {sg.startTime && sg.finishTime ? (
                <Button
                  className="ml-auto" size="sm" variant="outline" disabled={busy}
                  onClick={() => onAdd(sg)}
                >
                  Check and add
                </Button>
              ) : (
                <span className="ml-auto text-xs text-muted-foreground">Type these hours by hand</span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

