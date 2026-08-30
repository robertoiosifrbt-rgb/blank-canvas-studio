/**
 * Sesiunea 42 (ACHU-238) — where the office answers what customers asked for.
 *
 * This page was built in the same pass as the customer's request form, not after it. The
 * reason is a mistake found earlier the same day: Quote Requests could be created and
 * stored while Admin had no screen, no menu entry and no search that reached them. A record
 * nobody can open is worse than a missing feature, because the customer has already been
 * told "we will come back to you".
 *
 * Defaults to Open, because that is the only state that needs anyone. The other two are a
 * filter away rather than a separate screen — an answered request is still the record of
 * what was agreed, and it is looked for on the same page it was answered on.
 */
import { useEffect, useState, useCallback } from 'react';
import { getCustomerRequests } from '@/lib/endpoints';
// ACHU-401 (felia 13) — formele vin de la funcția care le produce, nu declarate aici.
import type { CustomerRequestsResponse } from '@/lib/customerRequestEndpoints';

/**
 * 🔴 ACHU-629 — dialogul de răspuns a plecat în `CustomerRequestAnswerDialog.tsx`: felia a atins
 * trimiterea răspunsului, iar fișierul era peste plafon (`AGENT_RULES` §7.4).
 */
import AnswerDialog, { type AnsweringItem } from './CustomerRequestAnswerDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquareWarning, CalendarClock, XCircle, RefreshCw, AlertCircle, Inbox, PauseCircle, UserCog, UserX, Sparkles, BanknoteArrowDown } from 'lucide-react';
import { fmtDate } from '@/lib/format';
import { useTrackedRequest } from '@/lib/useTrackedRequest';

/** ACHU-560 — cuvintele scurte pentru pastila de gravitate. Cele lungi sunt pe server. */
const SEVERITY_TEXT: Record<string, string> = { low: 'Minor', medium: 'Significant', high: 'Serious' };

const KIND_ICON: Record<string, typeof CalendarClock> = {
  Reschedule: CalendarClock,
  Cancellation: XCircle,
  Problem: MessageSquareWarning,
  PauseSeries: PauseCircle,
  CancelSeries: XCircle,
  ProfileCorrection: UserCog,
  AccountClosure: UserX,
  Reclean: Sparkles,
  RefundRequest: BanknoteArrowDown,
};

const KIND_LABEL: Record<string, string> = {
  Reschedule: 'Wants a different date',
  Cancellation: 'Wants to cancel',
  Problem: 'Reported a problem',
  PauseSeries: 'Wants to pause a contract',
  CancelSeries: 'Wants to cancel a contract',
  ProfileCorrection: 'Wants their name/email corrected',
  /**
   * ACHU-529. ⛔ Textul spune biroului CE SĂ FACĂ, nu doar ce a cerut clientul: cererea se
   * onorează prin ecranul GDPR existent (Customers → clientul → butonul de ștergere), nu
   * prin marcarea cererii ca rezolvată. Un rând care ar spune doar „vrea să închidă contul"
   * lasă pe cineva să apese Resolved fără să fi șters nimic — iar termenul legal e de o lună.
   */
  AccountClosure: 'Wants their account closed — erase via Customers → GDPR (1-month legal deadline)',
  /** ACHU-532. Spune și DESPRE CE vizită, fiindcă cererea e mereu legată de una anume. */
  Reclean: 'Wants a job re-cleaned',
  /** ⛔ ACHU-533. Spune biroului că e o CERERE, nu o rambursare aprobată — nu există
   *  nicio politică de rambursare, deci decizia e a lui, de la zero, în fiecare caz. */
  RefundRequest: 'Asking for a refund — decide and reply; there is no standing refund policy',
};

const STATUS_STYLE: Record<string, string> = {
  Open: 'bg-amber-100 text-amber-800',
  Resolved: 'bg-emerald-100 text-emerald-800',
  Declined: 'bg-muted text-muted-foreground',
};

export default function CustomerRequestsPage() {
  /**
   * ACHU-560 — răspunsul poartă acum și listele de clasificare, și defalcarea reclamațiilor.
   * ⚠️ Amândouă vin ODATĂ cu lista, nu pe rute separate: dacă a doua chemare ar eșua tăcut,
   * dialogul ar afișa selectoare goale, iar biroul ar crede că nu are ce alege.
   */
  const req = useTrackedRequest<CustomerRequestsResponse>({ timeoutMs: 30000 });
  const [status, setStatus] = useState('Open');
  /**
   * ⚠️ `intent` NU vine de pe server — e adăugat de ecran când se apasă Resolve/Decline, ca
   * dialogul să știe pe ce buton s-a intrat. De-aia e o intersecție, nu un câmp în forma de
   * pe sârmă: acolo ar fi fost o minciună despre ce trimite ruta.
   */
  const [answering, setAnswering] = useState<AnsweringItem | null>(null);

  const load = useCallback(() => {
    req.fire(() => getCustomerRequests(status === 'All' ? {} : { status }));
  }, [req.fire, status]);

  useEffect(() => { load(); }, [load]);

  const records = req.data?.records ?? [];
  const showSkeleton = !req.data && !req.error;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-muted-foreground" />
          {/* ACHU-434: matches the sidebar label. The route stays /admin/customer-requests. */}
          <h2 className="text-2xl font-bold">Client Issues</h2>
          {(req.data?.openCount ?? 0) > 0 && status === 'Open' && (
            <Badge className="bg-amber-100 text-amber-800">{req.data!.openCount} awaiting reply</Badge>
          )}
          {/* 🔴 ACHU-693 — insigna numără TOT registrul, deci lista tăiată trebuie să o spună. */}
          {req.data?.listNote && <p className="text-xs text-muted-foreground">{req.data.listNote}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]" aria-label="Filter by status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Open">Awaiting reply</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
              <SelectItem value="Declined">Declined</SelectItem>
              <SelectItem value="All">All</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={req.loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${req.loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>
      </div>

      {req.error && (
        <div className="rounded-lg p-3 flex items-center gap-2 bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm flex-1 text-destructive">{req.error}</p>
          <Button variant="ghost" size="sm" onClick={load} disabled={req.loading}>Retry</Button>
        </div>
      )}

      {/*
        🔴 ACHU-560 — „ce ne strică cel mai des". Rândul de backlog cerea „metrici"; asta e
        singura formă a lor care se poate ACȚIONA: o listă de cauze spune ce e de schimbat,
        una de categorii spune doar ce se sparge.

        ⚠️ Spune „din cele N de mai jos", fiindcă se numără pe lista FILTRATĂ. Deliberat
        diferit de media notelor (ACHU-537), unde filtrarea ar fi produs o cifră falsă despre
        firmă: acolo cifra e despre companie, aici e o defalcare a ce are biroul în față.

        🔴 Iar `closedWithoutCause` e afișat, nu ascuns: fără el, o listă de cauze arată
        completă chiar când jumătate din reclamații s-au închis neclasificate — adică exact
        cazul în care concluzia ei e falsă.
      */}
      {(req.data?.complaintBreakdown?.total ?? 0) > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-medium flex items-center gap-2">
                <MessageSquareWarning className="h-4 w-4" />What keeps going wrong
              </p>
              <p className="text-xs text-muted-foreground">
                From the {req.data!.complaintBreakdown!.total} complaint{req.data!.complaintBreakdown!.total === 1 ? '' : 's'} listed below
                {req.data!.complaintBreakdown!.oldestOpenDays !== null && (
                  <> · oldest still open: {req.data!.complaintBreakdown!.oldestOpenDays} days</>
                )}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Why it happened</p>
                {req.data!.complaintBreakdown!.byCause.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nothing classified yet.</p>
                ) : req.data!.complaintBreakdown!.byCause.map(c => (
                  <div key={c.value} className="flex items-center justify-between gap-2 text-sm">
                    <span>{c.label}</span><span className="tabular-nums text-muted-foreground">{c.count}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">What it was about</p>
                {req.data!.complaintBreakdown!.byCategory.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nothing classified yet.</p>
                ) : req.data!.complaintBreakdown!.byCategory.map(c => (
                  <div key={c.value} className="flex items-center justify-between gap-2 text-sm">
                    <span>{c.label}</span><span className="tabular-nums text-muted-foreground">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
            {req.data!.complaintBreakdown!.closedWithoutCause > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                {req.data!.complaintBreakdown!.closedWithoutCause} closed without a cause recorded — those are missing from the figures above.
              </p>
            )}
            {/*
              ACHU-563 — cum stăm față de ce i-am promis clientului (2 zile lucrătoare).

              🔴 **Cele două cifre stau ÎMPREUNĂ, deliberat.** Doar întârzierile curente arată
              curat exact în ziua în care cineva a închis, târziu, tot ce era restant — aceeași
              regulă ca `closedWithoutCause`: **o tăiere tăcută arată ca un întreg.**
            */}
            {(req.data!.complaintBreakdown!.overdueOpen > 0 || req.data!.complaintBreakdown!.answeredLate > 0) && (
              <p className="text-xs">
                {req.data!.complaintBreakdown!.overdueOpen > 0 && (
                  <span className="text-destructive font-medium">
                    {req.data!.complaintBreakdown!.overdueOpen} past the reply target and still open
                  </span>
                )}
                {req.data!.complaintBreakdown!.overdueOpen > 0 && req.data!.complaintBreakdown!.answeredLate > 0 && (
                  <span className="text-muted-foreground"> · </span>
                )}
                {req.data!.complaintBreakdown!.answeredLate > 0 && (
                  <span className="text-muted-foreground">
                    {req.data!.complaintBreakdown!.answeredLate} answered late
                  </span>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {showSkeleton ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
      ) : records.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          {status === 'Open' ? 'Nothing awaiting a reply.' : 'Nothing here.'}
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {records.map(r => {
            const Icon = KIND_ICON[r.kind] ?? MessageSquareWarning;
            return (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-2 min-w-0">
                      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm">
                          <span className="font-mono text-xs text-muted-foreground mr-1.5">#{r.customerRequestId}</span>
                          {KIND_LABEL[r.kind] ?? r.kind}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.customerName}
                          {r.customerPhone ? ` · ${r.customerPhone}` : ''}
                          {r.customerEmail ? <span className="break-all"> · {r.customerEmail}</span> : ''}
                        </p>
                      </div>
                    </div>
                    <Badge className={STATUS_STYLE[r.status] ?? ''}>{r.status === 'Open' ? 'Awaiting reply' : r.status}</Badge>
                  </div>

                  {/*
                    ACHU-560 — ce s-a clasificat, și ce lipsește.

                    🔴 Rândul „still missing" e cel care ține registrul viu. Fără el, o
                    reclamație închisă fără cauză arată identic cu una clasificată, iar
                    raportul de mai sus se golește tăcut. ⛔ Nu blochează nimic — spune.

                    ⚠️ Ce LIPSEȘTE e calculat pe server (`missingDetail`), nu aici: aceeași
                    listă trebuie citită și de raport, iar două copii ar diverge.
                  */}
                  {r.complaint && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {r.complaint.complaintSeverity && (
                        <Badge variant="outline" className="text-[10px]">{SEVERITY_TEXT[r.complaint.complaintSeverity] ?? r.complaint.complaintSeverity}</Badge>
                      )}
                      {r.complaint.complaintCategory && (
                        <Badge variant="outline" className="text-[10px]">{r.complaint.complaintCategory}</Badge>
                      )}
                      {r.complaint.complaintCause && (
                        <Badge variant="outline" className="text-[10px]">cause: {r.complaint.complaintCause}</Badge>
                      )}
                      {r.status === 'Open' && r.complaint.ageDays > 0 && (
                        <span className="text-[10px] text-muted-foreground">open {r.complaint.ageDays} day{r.complaint.ageDays === 1 ? '' : 's'}</span>
                      )}
                      {/*
                        ACHU-563 — pe RÂND, nu doar în panoul de sus (lecția ACHU-552): panoul
                        spune „trei sunt în întârziere", rândul spune CARE. Fără al doilea,
                        biroul deschide reclamațiile una câte una ca să afle.

                        ⛔ Nimic nu se afișează pentru o reclamație răspunsă la timp: un marcaj
                        pe fiecare rând nu mai distinge niciun rând.
                      */}
                      {r.complaint.response?.status === 'overdue' && (
                        <Badge variant="outline" className="text-[10px] border-destructive text-destructive" title={r.complaint.response.label}>
                          overdue by {r.complaint.response.daysLate}d
                        </Badge>
                      )}
                      {r.complaint.response?.status === 'due-today' && (
                        <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700 dark:text-amber-400" title={r.complaint.response.label}>
                          reply due today
                        </Badge>
                      )}
                      {r.complaint.response?.status === 'answered-late' && (
                        <span className="text-[10px] text-muted-foreground" title={r.complaint.response.label}>
                          answered {r.complaint.response.daysLate}d late
                        </span>
                      )}
                      {r.complaint.missing.length > 0 && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-500">
                          still missing: {r.complaint.missing.join(', ')}
                        </span>
                      )}
                    </div>
                  )}

                  {r.jobLabel && (
                    <p className="text-xs text-muted-foreground">
                      Job: <span className="text-foreground">{r.jobLabel}</span>
                      {r.jobStatus ? ` · ${r.jobStatus}` : ''}
                    </p>
                  )}
                  {r.seriesLabel && (
                    <p className="text-xs text-muted-foreground">
                      Contract: <span className="text-foreground">{r.seriesLabel}</span>
                      {r.seriesStatus ? ` · ${r.seriesStatus}` : ''}
                    </p>
                  )}
                  {r.preferredDate && (
                    <p className="text-xs">
                      <span className="text-muted-foreground">They suggested: </span>
                      <span className="font-medium">{fmtDate(r.preferredDate)}{r.preferredTime ? ` at ${r.preferredTime}` : ''}</span>
                    </p>
                  )}

                  <p className="text-sm whitespace-pre-wrap bg-muted/40 rounded-lg p-2.5">{r.message}</p>
                  <p className="text-xs text-muted-foreground">Sent {fmtDate(r.createdAt)}</p>

                  {r.adminResponse ? (
                    <div className="rounded-lg border border-border p-2.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        Replied by {r.resolvedBy || '—'}{r.resolvedAt ? ` · ${fmtDate(r.resolvedAt)}` : ''}
                      </p>
                      <p className="text-sm mt-0.5 whitespace-pre-wrap">{r.adminResponse}</p>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={() => setAnswering({ ...r, intent: 'Resolved' })}>Resolve</Button>
                      <Button size="sm" variant="outline" onClick={() => setAnswering({ ...r, intent: 'Declined' })}>Decline</Button>
                    </div>
                  )}

                  {/*
                    Deliberately NOT here: a button that cancels or moves the job. Answering
                    a request and changing a booking are separate acts — the second goes
                    through the Job's own status rules (and, once a cancellation-charge
                    policy exists, through that too). Wiring them together here would let a
                    reply quietly cancel paid work.
                  */}
                  {r.status === 'Open' && (r.kind === 'Reschedule' || r.kind === 'Cancellation') && (
                    <p className="text-[11px] text-muted-foreground">
                      Answering this does not change the job — update the job itself in Jobs.
                    </p>
                  )}
                  {r.status === 'Open' && (r.kind === 'PauseSeries' || r.kind === 'CancelSeries') && (
                    <p className="text-[11px] text-muted-foreground">
                      Answering this does not change the contract — pause or cancel it yourself in Work → Recurring.
                    </p>
                  )}
                  {r.status === 'Open' && r.kind === 'ProfileCorrection' && (
                    <p className="text-[11px] text-muted-foreground">
                      Answering this does not change the record — update the name/email yourself on the customer's record in Customers.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AnswerDialog
        item={answering}
        options={req.data?.complaintOptions}
        onClose={() => setAnswering(null)}
        onAnswered={() => { setAnswering(null); load(); }}
      />
    </div>
  );
}

