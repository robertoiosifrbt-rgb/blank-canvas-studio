import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ChevronDown, ChevronUp, Download, Loader2 } from 'lucide-react';
import { getCustomerConsentsAdmin } from '@/lib/endpoints';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { Button } from '@/components/ui/button';
import { generateConsentHistoryPdf } from '@/lib/consentHistoryPdf';
import type { DocSettings } from '@/lib/customerDocuments';
import { toast } from 'sonner';

/**
 * Sesiunea 97 (Backlog_Client_Prioritar) — the office VIEW of what a customer has
 * agreed to (ACHU-427, Sesiunea 93).
 *
 * ─── Why this exists ──────────────────────────────────────────────────────
 * The owner asked "how do we see the client's permissions?" and the honest
 * answer, until now, was: you can't from a screen — the route existed
 * (`GET /customers/:id/consents`) but nothing in `src/components/admin/`
 * called it. The customer's own answers were readable only as prose in the
 * audit trail. Exactly the ACHU-262/263/392/432/433 pattern: a capability
 * built on the server with nothing in the interface reaching it.
 *
 * ⛔ Read-only, deliberately, same as the route it calls. Consent is the
 * customer's own act, given in their portal — an Admin who could set it here
 * would be recording their own claim about somebody else's permission, which
 * is exactly the weak evidence the portal route exists to replace.
 *
 * ⚠️ The summary table shows the CURRENT answer per topic — one row, the
 * latest act. First shipped without the full trail below it, and the owner
 * pointed out that a single row is not enough: whether someone agreed once
 * and withdrew, or has always said no, is a different fact, and both look
 * identical if only the latest row is shown. The route already returns the
 * whole `history`, newest first — this was a rendering gap, not a data gap.
 */
interface Topic {
  key: string;
  label: string;
  granted: boolean | null;
  answeredAt: string | null;
  wordingChanged: boolean;
}

interface HistoryEntry {
  topic: string;
  label: string;
  granted: boolean;
  recordedAt: string;
  recordedBy: string | null;
  source: string | null;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CustomerConsentsSection({
  customerId, customerName, settings,
}: { customerId: string; customerName: string; settings: DocSettings }) {
  const req = useTrackedRequest<{ topics: Topic[]; history: HistoryEntry[] }>({ timeoutMs: 20000 });
  const [showHistory, setShowHistory] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Destructured rather than `[req.fire]`: the linter cannot see a member
  // expression is stable, and the lint gate is an exact ratchet (`CLAUDE.md` §2.1a).
  const { fire } = req;
  const load = useCallback(() => { fire(() => getCustomerConsentsAdmin({ customerId })); }, [fire, customerId]);
  useEffect(() => { load(); }, [load]);

  const topics = req.data?.topics ?? [];
  const history = req.data?.history ?? [];

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      await generateConsentHistoryPdf({
        customerName,
        history: history.map(h => ({ label: h.label, granted: h.granted, recordedAt: h.recordedAt })),
        settings,
      });
    } catch {
      toast.error('Could not create the PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Permissions this customer has given</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Set by the customer themselves, in their own portal. Read-only here — the office cannot change these for them.
      </p>

      {!req.data && !req.error && <div className="h-16 animate-pulse rounded bg-muted" />}

      {req.error && !req.data && (
        <div className="space-y-1">
          <p className="text-xs text-destructive">Could not load permissions.</p>
          <Button variant="outline" size="sm" onClick={load}>Try again</Button>
        </div>
      )}

      {req.data && (
        <div className="divide-y divide-border">
          {topics.map(t => (
            <div key={t.key} className="flex items-center justify-between gap-2 py-1.5">
              <span className="text-xs">{t.label}</span>
              <span className="text-xs text-right shrink-0">
                {/* Not answered is its own state, distinct from "said no" — same
                    rule as the customer's own screen (ConsentSettings.tsx). */}
                {t.granted === null ? (
                  <span className="text-muted-foreground">Not answered yet</span>
                ) : (
                  <>
                    <span className={t.granted ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground font-medium'}>
                      {t.granted ? 'Agreed' : 'Said no'}
                    </span>
                    {t.answeredAt && <span className="text-muted-foreground"> · {fmtDate(t.answeredAt)}</span>}
                  </>
                )}
              </span>
            </div>
          ))}
          {topics.some(t => t.wordingChanged) && (
            <p className="text-xs text-amber-600 dark:text-amber-500 pt-1.5">
              The question has been reworded since some of these answers were given.
            </p>
          )}

          {/* The table above shows only the LATEST act per topic — not enough on
              its own, because "agreed once, withdrew later" and "always said no"
              render identically otherwise. This is the full trail behind it. */}
          {history.length > 0 && (
            <div className="pt-1.5">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowHistory(v => !v)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {showHistory ? 'Hide full history' : `Show full history (${history.length} record${history.length === 1 ? '' : 's'})`}
                </button>
                <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1" disabled={downloading} onClick={downloadPdf}>
                  {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                  PDF
                </Button>
              </div>

              {showHistory && (
                <div className="mt-1.5 divide-y divide-border">
                  {history.map((h, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 py-1">
                      <span className="text-xs text-muted-foreground">{h.label}</span>
                      <span className="text-xs text-right shrink-0">
                        <span className={h.granted ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                          {h.granted ? 'Agreed' : 'Said no / withdrew'}
                        </span>
                        <span className="text-muted-foreground"> · {fmtDate(h.recordedAt)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

