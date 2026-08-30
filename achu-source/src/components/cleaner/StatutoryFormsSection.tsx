import { useEffect, useState } from 'react';
import { FileDown, FileText } from 'lucide-react';
import { getMyForms, type MyStatutoryFormsResponse, type MyP60 } from '@/lib/endpoints';
// ACHU-354. The same generators the office uses — see statutoryFormPdf.ts.
import { generateP60Pdf, generateP45Pdf } from '@/lib/statutoryFormPdf';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * ─── ACHU-354: the employee's own P60 and P45 ──────────────────────────────
 *
 * ⚠️ A separate section from the payslips, and a separate request, because these are
 * different documents with different duties. A P60 is an ANNUAL certificate, due by
 * 31 May after the year ends. A P45 exists only for somebody who has left.
 *
 * ⚠️ **The office's blockers never reach this screen.** The server sends one sentence
 * when a form is not ready — see `NOT_READY_FOR_EMPLOYEE` in `mySelfService.ts`.
 * "The employer PAYE reference is missing" is a fact a cleaner cannot act on, and
 * would read as a fault in their own record.
 *
 * ⚠️ **The same generator the office will use**, on data assembled by the same
 * policy. Not a simplified employee version — one P60, one generator, or the person
 * being paid ends up holding the copy that drifted.
 */
export function StatutoryFormsSection() {
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready'; data: MyStatutoryFormsResponse } | { kind: 'error' }>({ kind: 'loading' });
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getMyForms()
      .then(r => { if (alive) setState({ kind: 'ready', data: r }); })
      .catch(() => { if (alive) setState({ kind: 'error' }); });
    return () => { alive = false; };
  }, []);

  if (state.kind === 'loading') return <Skeleton className="h-24 rounded-xl" />;
  // Silent on failure, same reason as the payslips section: the rest of the page is
  // why somebody opened this tab, and Refresh retries everything.
  if (state.kind === 'error') return null;

  const p60s = state.kind === 'ready' ? state.data.p60s : [];
  const p45 = state.data?.p45 ?? null;

  async function downloadP60(entry: MyP60) {
    setBusy(`p60-${entry.taxYear}`);
    try { await generateP60Pdf(entry.p60); } finally { setBusy(null); }
  }

  async function downloadP45() {
    setBusy('p45');
    try { await generateP45Pdf(p45.p45); } finally { setBusy(null); }
  }

  return (
    <section className="bg-card border border-border rounded-xl p-4" aria-labelledby="pay-forms">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <h2 id="pay-forms" className="font-medium text-sm">Your tax forms</h2>
      </div>

      {p60s.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {/* Says WHY, not just "none". A P60 covers a finished tax year, so a new
              starter has none and nothing is wrong. */}
          No P60 yet. A P60 covers a whole tax year and is issued after 5 April, once the year has ended.
        </p>
      ) : (
        <ul className="space-y-2">
          {p60s.map(entry => (
            <li key={entry.taxYear} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">P60 <span className="text-muted-foreground font-normal">{entry.taxYear}</span></p>
                {/* ⚠️ The sentence comes from the server, so the screen cannot invent
                    a friendlier reason than the real one. */}
                {entry.notice && <p className="text-xs text-amber-700 dark:text-amber-500">{entry.notice}</p>}
              </div>
              <Button
                variant="outline" size="sm" className="min-h-[44px] shrink-0"
                aria-label={`Download P60 for ${entry.taxYear}`}
                // ⚠️ Disabled rather than hidden when it cannot be issued: a missing
                // button reads as a broken page, a disabled one next to a sentence
                // reads as "not yet".
                disabled={!entry.canIssue || busy === `p60-${entry.taxYear}`}
                onClick={() => downloadP60(entry)}
              >
                <FileDown className="h-4 w-4 mr-1.5" />PDF
              </Button>
            </li>
          ))}
        </ul>
      )}

      {p45 && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">P45</p>
              {p45.notice && <p className="text-xs text-amber-700 dark:text-amber-500">{p45.notice}</p>}
            </div>
            <Button
              variant="outline" size="sm" className="min-h-[44px] shrink-0"
              aria-label="Download P45"
              disabled={!p45.canIssue || busy === 'p45'}
              onClick={downloadP45}
            >
              <FileDown className="h-4 w-4 mr-1.5" />PDF
            </Button>
          </div>
          {/* 🔴 On screen as well as on the page. Somebody holding Parts 1A, 2 and 3
              would reasonably assume HMRC had been told they left. It has not. */}
          {p45.canIssue && <p className="mt-2 text-xs text-muted-foreground">{p45.part1Notice}</p>}
        </div>
      )}

      {/* ⚠️ Shown when there is no P45, because an absence invites the question and
          "you have not left" is the answer. */}
      {state.data?.p45Explanation && (
        <p className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">{state.data.p45Explanation}</p>
      )}
    </section>
  );
}

