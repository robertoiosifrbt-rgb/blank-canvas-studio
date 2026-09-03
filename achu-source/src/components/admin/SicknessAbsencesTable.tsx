import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Inbox, CalendarCheck, UserCheck, Pencil, Undo2 } from 'lucide-react';
import { fmt } from '@/lib/format';
import FitNoteCell from './FitNoteCell';

const STATUS_STYLE: Record<string, string> = {
  Open: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  Ended: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  Cancelled: 'bg-muted text-muted-foreground',
};

export default function SicknessAbsencesTable({
  data, absences, busy, onEdit, onEndClick, onReturnToWorkClick, onCancelClick, onFitNoteChanged,
}) {
  if (!data) return null;
  return (
    <Card>
      <CardContent className="pt-6">
        {absences.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No sickness recorded. That is good news, not a screen waiting to be switched on.
          </div>
        ) : (
          <div tabIndex={0} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3">Dates</th>
                  <th scope="col" className="py-2 pr-3">Person</th>
                  <th scope="col" className="py-2 pr-3">SSP</th>
                  <th scope="col" className="py-2 pr-3">Status</th>
                  <th scope="col" className="py-2" />
                </tr>
              </thead>
              <tbody>
                {absences.map(a => (
                  <tr key={a.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {a.startDate}
                      {a.endDate ? (a.endDate !== a.startDate ? <> → {a.endDate}</> : null) : <> → still off</>}
                      {a.notes && <span className="block text-xs text-muted-foreground">{a.notes}</span>}
                      {/* ACHU-392 — certificatul medical. Admin-only, decizia lui Roberto din 15/08/2026. */}
                      <FitNoteCell
                        absenceId={a.id}
                        hasFitNote={Boolean(a.fitNotePath)}
                        disabled={busy || a.status === 'Cancelled'}
                        onChanged={onFitNoteChanged}
                      />
                    </td>
                    <td className="py-2 pr-3">{a.cleanerName}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className="font-medium">{fmt(a.sspTotal)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {a.sspDaysPaid} day{a.sspDaysPaid === 1 ? '' : 's'}
                      </span>
                      {a.companySickPayDecided && a.companySickPayPence > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          + {fmt(a.companySickPayPence / 100)} company
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge className={STATUS_STYLE[a.status] ?? ''}>{a.status}</Badge>
                      {a.returnToWorkOn && (
                        <span className="block text-xs text-muted-foreground">back {a.returnToWorkOn}</span>
                      )}
                      {a.returnToWorkOutstanding && (
                        <span className="block text-xs text-amber-700 dark:text-amber-400">
                          no return-to-work
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1 justify-end">
                        {a.status === 'Open' && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => onEndClick(a)}>
                            <CalendarCheck className="h-4 w-4 mr-1" />End
                          </Button>
                        )}
                        {a.returnToWorkOutstanding && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => onReturnToWorkClick(a)}>
                            <UserCheck className="h-4 w-4 mr-1" />Return to work
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" disabled={busy || a.status === 'Cancelled'}
                          title={a.status === 'Cancelled' ? 'A cancelled record is part of the history and is not edited.' : undefined}
                          onClick={() => onEdit(a)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy || a.status === 'Cancelled'}
                          title="Cancel this record — it stays in the history, which is why there is no delete."
                          onClick={() => onCancelClick(a)}>
                          <Undo2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.companySickPayNote && (
          <p className="mt-4 text-xs text-muted-foreground">{data.companySickPayNote}</p>
        )}
      </CardContent>
    </Card>
  );
}

