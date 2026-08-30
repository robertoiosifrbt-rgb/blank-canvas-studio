import { useState } from 'react';
import { getPayrollRunVersions, type PayrollRunVersionsResponse } from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/payrollRunsFormat';
import { errMsg } from '@/lib/errorMessage';

/**
 * ─── What did this period pay BEFORE it was corrected? (ACHU-372, Sesiunea 88) ──
 *
 * ⚠️ Why this panel exists at all. `recalculate` replaces a run's lines WHOLESALE —
 * deliberately, so that somebody whose payroll record was removed disappears from the
 * run instead of lingering with stale figures. The consequence: recalculating a REOPENED
 * run destroyed the figures that had actually been paid. The audit trail kept the
 * run-level net total and nothing per-person, so *"what did we pay this person before
 * the correction"* had no answer — the question an accountant asks a year later.
 *
 * 🔴 EVERY SENTENCE HERE IS THE SERVER'S, and this is not a style rule. The panel shows
 * figures that either WERE paid or were only agreed, and the difference is a claim about
 * a bank transaction. A component that composed its own wording would be the version on
 * screen while the tested one sat in a policy file — and the wrong one either invents a
 * payment or hides one. `payrollVersionPolicy.stanceFor` is the single place it is
 * decided.
 *
 * ⛔ There is no button that applies anything, and no endpoint behind one.
 */
export function VersionsPanel({ runId }: { runId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PayrollRunVersionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setOpen(true);
    if (data || loading) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getPayrollRunVersions(runId));
    } catch (e) {
      setError(errMsg(e) ?? 'Could not load what this period paid before it was corrected.');
    } finally { setLoading(false); }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={load} className="w-full">
        What did this period pay before it was corrected?
      </Button>
    );
  }

  return (
    <div className="rounded border p-3 space-y-3">
      <p className="font-medium">What this period paid before it was corrected</p>

      {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {data && (
        <>
          {/* Before any figure. A screen of before-and-after amounts is exactly what
              somebody mistakes for a list of adjustments that have been made. */}
          <p className="text-xs text-muted-foreground">{data.notice}</p>

          {/* 🔴 A gap NAMED rather than left as a short list. Two versions out of three
              looks complete: there is a list, it has entries, nothing says otherwise. */}
          {data.unrecordedVersions?.length > 0 && (
            <div className="rounded border border-amber-300 bg-amber-50 p-2 dark:border-amber-800 dark:bg-amber-950">
              <p className="text-xs">
                <strong>
                  Version{data.unrecordedVersions.length === 1 ? ' ' : 's '}
                  {data.unrecordedVersions.join(', ')} {data.unrecordedVersions.length === 1 ? 'was' : 'were'} superseded
                  before this record existed
                </strong>{' '}
                — those figures were not kept and cannot be recovered. Everything from here on is recorded.
              </p>
            </div>
          )}

          {data.versions?.length === 0 && data.unrecordedVersions?.length === 0 && (
            <p className="text-xs text-muted-foreground">
              This payroll has not been corrected, so there is only one version of it.
            </p>
          )}

          {data.versions.map(v => (
            <div key={v.version} className="rounded border p-2 space-y-2">
              <p className="text-xs font-medium">
                Version {v.version}
                {/* ⚠️ "Paid" vs "approved" is the server's word, not a ternary here. */}
                <span className="font-normal text-muted-foreground">
                  {' '}· {v.wasPaid ? 'paid' : 'approved only'} · superseded by {v.supersededBy}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">{v.stanceSentence}</p>
              <p className="text-xs">
                <span className="text-muted-foreground">Reason given: </span>“{v.reason}”
              </p>
              {(v.approvedBy || v.lockedBy) && (
                <p className="text-xs text-muted-foreground">
                  {v.approvedBy && <>Approved by {v.approvedBy}. </>}
                  {v.lockedBy && <>Locked by {v.lockedBy}.</>}
                </p>
              )}

              {v.nothingDiffers ? (
                <p className="text-xs text-muted-foreground">{v.nothingDiffers}</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    {[
                      ['People then', String(v.totals.peopleBefore)],
                      ['People now', String(v.totals.peopleAfter)],
                      ['Net then', money(v.totals.netPayBeforePence / 100)],
                      ['Net now', money(v.totals.netPayAfterPence / 100)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded border p-2">
                        <div className="text-muted-foreground">{label}</div>
                        <div className="font-medium">{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* 🔴 FIRST, above the ordinary changes. Somebody who was paid and is
                      no longer on the run is absent from the list being read, so it is
                      the one outcome no table of figures can carry. */}
                  {v.people.filter(p => p.presence === 'removed').map(p => (
                    <div key={p.cleanerId}
                      className="rounded border border-destructive/50 bg-destructive/5 p-2 space-y-1">
                      <p className="text-xs font-medium">{p.name} — no longer on this payroll</p>
                      <p className="text-xs">{p.removedSentence}</p>
                    </div>
                  ))}

                  {v.people.filter(p => p.presence === 'changed').map(p => (
                    <div key={p.cleanerId} className="rounded border p-2 space-y-1">
                      <p className="text-xs font-medium">
                        {p.name}
                        {p.taxCodeChange && (
                          <span className="font-normal text-muted-foreground">
                            {' '}· tax code {p.taxCodeChange.before} → {p.taxCodeChange.after}
                          </span>
                        )}
                        {p.niCategoryChange && (
                          <span className="font-normal text-muted-foreground">
                            {' '}· NI category {p.niCategoryChange.before} → {p.niCategoryChange.after}
                          </span>
                        )}
                      </p>
                      <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                        {p.changes.map(c => (
                          <div key={c.label}>
                            <span className="text-muted-foreground">{c.label}</span>{' '}
                            {money(c.beforePence / 100)} → {money(c.afterPence / 100)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {v.people.filter(p => p.presence === 'added').map(p => (
                    <p key={p.cleanerId} className="text-xs text-muted-foreground">
                      <span className="font-medium">{p.name}</span> was added by the correction — they were not on
                      version {v.version}.
                    </p>
                  ))}

                  {/* Counted, not listed. "Who else was on this period" matters, but a
                      row per unchanged person would bury the ones that moved. */}
                  {v.people.filter(p => p.presence === 'unchanged').length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {v.people.filter(p => p.presence === 'unchanged').length} other
                      {v.people.filter(p => p.presence === 'unchanged').length === 1 ? '' : 's'} on this period
                      with the same figures as now.
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
        </>
      )}

      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Hide</Button>
    </div>
  );
}

