/**
 * 🔴 §6 — LISTA DE CERERI DE OFERTĂ (coada de la intrare).
 *
 * ⛔ **Ieșită din `QuoteRequestPage.tsx` în Sesiunea 159, silit, nu din estetică:** pagina era EXACT
 * pe clichetul ei de 423 de rânduri, iar felia „Urgency / Flexible date" avea nevoie de spațiu (un
 * card nou pe fișa cererii, o coloană nouă în listă). ⚠️ Regula spune ce se face atunci — iese cod,
 * iar cifra din clichet COBOARĂ, nu urcă (`docs/Plan_Modularizare_ACHU.md` §5).
 *
 * ⚠️ **Comportament neatins.** Lista se randează exact ca înainte, din aceeași pagină, când nu e
 * niciun `?id=` în adresă; probele existente o conduc tot prin `QuoteRequestPage`.
 *
 * 🔴 **Coloana „Needed" e AFIȘARE, nimic mai mult** — lista nu se reordonează după urgență. Un
 * termen de răspuns e ce promitem în scris, deci o hotărâre a owner-ului (`AGENT_RULES` §2).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getQuoteRequests, GetQuoteRequestOutputType } from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText } from 'lucide-react';
import { fmtDate } from '@/lib/format';
import RefreshButton from '../shared/RefreshButton';
import RetentionNotice from './RetentionNotice';
import { STATUS_COLORS } from './quoteRequestStatusColors';

export default function QuoteRequestsList() {
  const nav = useNavigate();
  const [records, setRecords] = useState<GetQuoteRequestOutputType[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    getQuoteRequests({})
      .then(d => setRecords(d.records))
      .catch(e => setError(e?.message || 'Failed to load.'));
  };
  useEffect(load, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 text-muted-foreground" />
        {/* ACHU-434: matches the sidebar label. The route stays /admin/quote-requests. */}
        <h2 className="text-xl font-bold">New Enquiries</h2>
        <RefreshButton onRefresh={load} className="ml-auto" />
      </div>
      {/* ACHU-218 — ce se întâmplă singur cu cererile vechi, spus acolo unde se uită biroul. */}
      <RetentionNotice />
      {error ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <p className="mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={load}>Retry</Button>
        </CardContent></Card>
      ) : records === null ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : records.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No quote requests yet.</CardContent></Card>
      ) : (
        <div tabIndex={0} className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-muted/50">
              <th scope="col" className="text-left p-3 font-medium">ID</th>
              <th scope="col" className="text-left p-3 font-medium">Name</th>
              <th scope="col" className="text-left p-3 font-medium hidden md:table-cell">Email</th>
              <th scope="col" className="text-left p-3 font-medium">Status</th>
              {/* §6 (Sesiunea 159) — ⛔ afișare, nimic mai mult: lista NU se reordonează după ea. */}
              <th scope="col" className="text-left p-3 font-medium hidden lg:table-cell">Needed</th>
              <th scope="col" className="text-left p-3 font-medium hidden md:table-cell">Submitted</th>
            </tr></thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => nav(`/admin/quote-requests?id=${r.id}`)}>
                  <td className="p-3 font-mono text-xs">#{r.quoteRequestId}</td>
                  <td className="p-3">{r.fullName || '—'}</td>
                  <td className="p-3 hidden md:table-cell">{r.email || '—'}</td>
                  <td className="p-3"><Badge className={STATUS_COLORS[r.status ?? ''] ?? 'bg-muted text-muted-foreground'}>{r.status}</Badge></td>
                  <td className="p-3 hidden lg:table-cell">{r.urgency || '—'}</td>
                  <td className="p-3 hidden md:table-cell">{fmtDate(r.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

