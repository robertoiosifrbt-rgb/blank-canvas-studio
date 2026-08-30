import { useEffect, useState } from 'react';
import { getNightWork, type NightWorkResponse } from '@/lib/endpoints';

/**
 * ─── Night work under the Working Time Regulations (ACHU-349, Sesiunea 82) ──
 *
 * ⚠️ It sits on the TIMESHEETS page, not with the payroll reports, and that is the
 * point of the whole slice: the 8-hour average is an obligation about HOURS, not
 * about pay. Filed under payroll it would be read as a money figure and looked at
 * once a month; here it is next to the hours it is computed from.
 *
 * ⚠️ **It renders NOTHING when there is nothing to say.** A permanent green
 * "compliant" panel would be the worst outcome available: the average is
 * indicative rather than conclusive (see `averageNotice`), and the health
 * assessment duty is not tracked at all — so an all-clear would assert two things
 * this app cannot know. Silence here means "no likely night workers in the window",
 * and the panel appears only once somebody is one.
 */
export default function NightWorkNotice() {
  const [d, setD] = useState<NightWorkResponse | null>(null);

  useEffect(() => {
    let live = true;
    // Failure is swallowed on purpose: this is an advisory panel beside the real
    // screen, and an error banner over the timesheets would be worse than its
    // absence. A backend that predates the route simply shows nothing.
    getNightWork().then(r => { if (live) setD(r); }).catch(() => {});
    return () => { live = false; };
  }, []);

  if (!d || !d.likelyNightWorkers) return null;

  const overCap = d.overCapCount > 0;

  return (
    <div
      role="status"
      className={`rounded border p-3 text-sm ${overCap
        ? 'border-destructive/40 bg-destructive/10'
        : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950'}`}
    >
      <p className="font-medium">
        {overCap
          ? `⚠️ ${d.overCapCount} night ${d.overCapCount === 1 ? 'worker averages' : 'workers average'} more than ${d.capHoursPer24} hours per 24`
          : `${d.likelyNightWorkers} likely night ${d.likelyNightWorkers === 1 ? 'worker' : 'workers'} in the last ${d.referencePeriod.weeks} weeks`}
      </p>
      {overCap && (
        <p className="mt-1">
          {/* Named, not counted. A number alone sends somebody hunting through a
              17-week window to find out who. */}
          <strong>{d.overCapNames.join(', ')}</strong> — the Working Time Regulations cap a night worker's normal
          hours at an average of {d.capHoursPer24} per 24 over the reference period. The remedy is the rota, not
          payroll.
        </p>
      )}
      <div tabIndex={0} className="overflow-x-auto">
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th scope="col" className="py-1 pr-2">Person</th>
              <th scope="col" className="py-1 pr-2 text-right">Night hours</th>
              <th scope="col" className="py-1 pr-2 text-right">Night shifts</th>
              <th scope="col" className="py-1 text-right">Average per 24h</th>
            </tr>
          </thead>
          <tbody>
            {d.people.filter(p => p.likelyNightWorker).map(p => (
              <tr key={p.cleanerId} className="border-b last:border-0">
                <td className="py-1 pr-2">{p.name}</td>
                <td className="py-1 pr-2 text-right">{p.nightHours}h</td>
                <td className="py-1 pr-2 text-right">
                  {p.nightShifts}
                  {/* An open shift has no length, so it is in no figure on this row.
                      Said per row, because the incompleteness belongs to the row. */}
                  {p.unmeasuredShifts > 0 && (
                    <span className="text-muted-foreground"> (+{p.unmeasuredShifts} unfinished)</span>
                  )}
                </td>
                <td className={`py-1 text-right ${p.overCap ? 'font-medium text-destructive' : ''}`}>
                  {p.averageHoursPer24 == null ? '—' : `${p.averageHoursPer24}h`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{d.averageNotice}</p>
      <p className="mt-1 text-xs text-muted-foreground">{d.healthAssessmentNotice}</p>
      <p className="mt-1 text-xs text-muted-foreground">{d.unapprovedNotice}</p>
    </div>
  );
}

