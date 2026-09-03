import { useEffect, useState, useCallback } from 'react';
import { roleLabel } from '@/lib/roleLabels';
import { getErrorLog } from '@/lib/endpoints';
// ACHU-401 (felia 11): formele sunt citite din `backend/src/routes/errorLog.ts`, nu ghicite.
import type { ErrorLogResponse, ErrorLogRow } from '@/lib/errorLogTypes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Bug, CheckCircle2, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { fmtDateTime } from '@/lib/format';
import RefreshButton from '@/components/shared/RefreshButton';
import PageHeader from '@/components/shared/PageHeader';

/**
 * ACHU-261 (Sesiunea 63) — the error log nobody could read.
 *
 * The app has reported every crash it caught since Sesiunea 29: ErrorBoundary
 * calls `reportClientError`, the server stores it, and an Admin-only read endpoint
 * has existed the whole time with **zero callers**. Months of evidence about real
 * failures — including the white screen on the night of 30–31/07/2026 — collected
 * and never once looked at. Found by the ACHU-260 audit, which was itself prompted
 * by the owner asking whether things were being built and kept out of sight.
 *
 * ─── Grouped, because a list of 100 identical rows is not information ─────
 * One component stuck in a render loop fills every slot in the raw list and buries
 * every other fault. So the primary view is one row per DISTINCT message, with the
 * count, and the count comes from the server's `groupBy` over every live row — not
 * from the 100 that were fetched. A count derived from the page would be
 * confidently wrong exactly when it mattered most, which is the ACHU-258 mistake in
 * a different costume.
 *
 * ─── An empty screen here is good news, and should read that way ─────────
 * Every other list in this app treats "nothing" as a dead end to apologise for. An
 * empty error log means the app has not crashed on anybody, so it gets a green tick
 * and a plain sentence rather than a sad inbox.
 */

/**
 * A stack trace can incidentally contain fragments of data in an error message,
 * which is why this whole endpoint is Admin-only — so the detail is collapsed by
 * default rather than sprayed across the screen the moment the page loads.
 */
function Occurrence({ row }: { row: ErrorLogRow }) {
  const [open, setOpen] = useState(false);
  const hasDetail = Boolean(row.stack || row.componentStack);

  return (
    <div className="rounded-md border p-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{fmtDateTime(row.createdAt)}</span>
        {row.path && <code className="rounded bg-muted px-1.5 py-0.5">{row.path}</code>}
        {row.email && <span className="text-muted-foreground break-all">{row.email}{row.role ? ` (${roleLabel(row.role)})` : ''}</span>}
        {row.boundary && <Badge variant="outline">{row.boundary}</Badge>}
        {hasDetail && (
          <Button size="sm" variant="ghost" className="ml-auto h-6 px-2" onClick={() => setOpen(o => !o)}>
            {open ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
            Technical detail
          </Button>
        )}
      </div>

      {row.userAgent && (
        <p className="mt-1 text-muted-foreground break-all">{row.userAgent}</p>
      )}

      {open && (
        <div className="mt-2 space-y-2">
          {row.stack && (
            <div>
              <p className="font-medium">Stack</p>
              <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-[11px] leading-relaxed">{row.stack}</pre>
            </div>
          )}
          {row.componentStack && (
            <div>
              <p className="font-medium">Which part of the screen</p>
              <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-[11px] leading-relaxed">{row.componentStack}</pre>
            </div>
          )}
          {/* Production builds are minified, so a stack is often close to useless.
              Said here rather than letting somebody conclude the log is broken. */}
          <p className="text-muted-foreground">
            The live app is minified, so names in a stack are often shortened beyond recognition. The screen
            and the message above it are usually what locates the problem.
          </p>
        </div>
      )}
    </div>
  );
}

export default function ErrorLogPage() {
  const [data, setData] = useState<ErrorLogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback((message?: string) => {
    setError(null);
    getErrorLog(message ? { message } : undefined)
      .then(setData)
      .catch(e => setError(e?.message ?? 'Could not load the error log.'));
  }, []);

  useEffect(() => { load(selected ?? undefined); }, [load, selected]);

  const groups = data?.groups ?? [];
  const rows = data?.errors ?? [];
  const nothingEverRecorded = data != null && groups.length === 0;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Bug className="h-5 w-5" />}
        title="Error log"
        description="Every crash the app caught and reported. Until now it has been collecting these with no way to read them."
        actions={<RefreshButton onRefresh={() => load(selected ?? undefined)} />}
      />

      {error && (
        <Card>
          <CardContent className="pt-6 flex gap-3 text-sm">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {!data && !error && <Skeleton className="h-32 w-full" />}

      {/* An empty log is the good outcome, so it says so. */}
      {nothingEverRecorded && (
        <Card>
          <CardContent className="pt-6 flex gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Nothing to report — the app has not crashed on anybody.</p>
              <p className="mt-1 text-muted-foreground">
                Errors appear here automatically when a screen fails. There is nothing to switch on.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {data && groups.length > 0 && (
        <>
          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Distinct errors</p>
                  <p className="text-2xl font-semibold">{groups.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reports in total</p>
                  <p className="text-2xl font-semibold">
                    {groups.reduce((s, g) => s + g.count, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Most recent</p>
                  <p className="text-2xl font-semibold">
                    {fmtDateTime(groups.reduce((a, g) => (g.lastSeen > a ? g.lastSeen : a), groups[0].lastSeen))}
                  </p>
                </div>
              </div>
              {data.retentionNote && (
                <p className="flex gap-2 pt-2 text-xs text-muted-foreground">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{data.retentionNote}</span>
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-2">
              <h2 className="font-medium">
                {selected ? 'All errors' : 'Grouped by what went wrong'}
              </h2>
              <p className="text-xs text-muted-foreground">
                Most frequent first — the top one is usually the one worth fixing. Counts are over every report
                held, not only the ones shown below.
              </p>

              <div className="space-y-2 pt-1">
                {groups.map(g => {
                  const isSelected = selected === g.message;
                  return (
                    <button
                      key={g.message}
                      type="button"
                      onClick={() => setSelected(isSelected ? null : g.message)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted ${
                        isSelected ? 'border-primary bg-muted' : ''
                      }`}
                    >
                      <div className="flex flex-wrap items-start gap-2">
                        <Badge variant={g.count > 1 ? 'default' : 'outline'} className="shrink-0">
                          {g.count}×
                        </Badge>
                        <span className="flex-1 break-words text-sm font-medium">{g.message}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {g.firstSeen !== g.lastSeen
                          // Two dates rather than one: "started nine days ago and is
                          // still happening" is a different problem from "happened
                          // twice in a minute", and one date cannot tell them apart.
                          ? <>First {fmtDateTime(g.firstSeen)} · most recently {fmtDateTime(g.lastSeen)}</>
                          : <>{fmtDateTime(g.lastSeen)}</>}
                      </p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="mr-auto font-medium">
                  {selected ? 'Every time this happened' : 'Most recent reports'}
                </h2>
                {selected && (
                  <Button size="sm" variant="outline" onClick={() => setSelected(null)}>
                    Show everything
                  </Button>
                )}
              </div>

              {/* Truncation is stated, not implied. "100 rows" read as "100 reports"
                  is how somebody concludes a crash loop happened a hundred times. */}
              {data.truncated && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Showing the {rows.length} most recent of {data.total}. The counts above cover all of them.
                </p>
              )}

              <div className="space-y-2 pt-1">
                {rows.map(r => <Occurrence key={r.id} row={r} />)}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

