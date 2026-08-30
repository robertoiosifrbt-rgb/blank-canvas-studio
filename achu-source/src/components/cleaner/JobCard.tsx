import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { StatusBadge, fmtDate, fmtDateTime } from '@/lib/format';
import { updateJobStatus, saveCleanerNotes, getJobChecklist, cleanerOnTheWay } from '@/lib/endpoints';
import { toast } from 'sonner';
import {
  Play, CheckCircle, Ban, FileText, Phone, MapPin, Clock, User, Hash, Calendar, AlertCircle, RefreshCw, CheckCircle2, PlusCircle, Car,
} from 'lucide-react';
import type { CleanerJob } from './CleanerApp';
// §36 (Sesiunea 142) — a IEȘIT din acest fișier ca să încapă cardul nou; vezi antetul lui.
import WorkDetailsSection from './WorkDetailsSection';
// §36 (Sesiunea 142) — trei întrebări despre cum a mers vizita. ⛔ Nimic despre client.
import VisitReportCard from './VisitReportCard';
import { ukToday } from '@/lib/ukDate';
import WorkChecklist from './WorkChecklist';
// ACHU-514 — nota și pozele clientului, extrase la ACHU-575 ca să încapă cardul de mai jos.
import PropertyFromCustomerCard from './PropertyFromCustomerCard';
// 🔴 §32 (Sesiunea 148) — pozele „before/after” ale curățătorului, imediat sub cele ale
// clientului: aceeași întrebare, două voci. ⚠️ Condiția de afișare a cardului de deasupra a
// coborât ÎN el, ca rândul de mai jos să încapă fără să crească fișierul (clichet 486) — iar
// un comentariu JSX ar fi costat el însuși un rând, fiindcă `*/}` se numără drept cod.
import VisitEvidenceCard from './VisitEvidenceCard';
// ACHU-575 — ce poate merge prost la casă, singurul lucru din fișa casei care ajunge aici.
import PropertyRiskCard from './PropertyRiskCard';
// ACHU-576 — cum se intră la casa acestei vizite. Card propriu, ca cel de mai sus.
import PropertyAccessCard from './PropertyAccessCard';
import AccessibilityNoteCard from './AccessibilityNoteCard';
// ACHU-577 — ce se face de fiecare dată la casa asta.
import StandingWorkCard from './StandingWorkCard';
// ACHU-578 — unde se parchează și ce zone cu taxă sunt pe drum. Plus orele reale, extrase
// din fișierul acesta ca felia să încapă sub clichetul de mărime.
import GettingThereCard from './GettingThereCard';
import ActualTimesRows from './ActualTimesRows';
import { errMsg } from '@/lib/errorMessage';

/** ACHU-116: Generate a unique request token for idempotency */
let tokenCounter = 0;
function genToken(): string {
  return `${Date.now()}-${++tokenCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/** ACHU-116: Request timeout */
const REQUEST_TIMEOUT = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

const FRIENDLY_ERROR = "We couldn't complete this action because the connection was lost.";
const TIMEOUT_ERROR = "The request timed out. Please check your connection and retry.";

function classifyFetchError(e: unknown): string {
  const msg: string = (errMsg(e) ?? '').toLowerCase();
  if (msg.includes('timed out') || msg.includes('timeout')) return TIMEOUT_ERROR;
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('err_') || msg.includes('load')) return FRIENDLY_ERROR;
  return errMsg(e) || 'Something went wrong.';
}

export default function JobCard({
  job,
  showDate,
  onRefresh,
  actionsEnabled,
}: {
  job: CleanerJob;
  showDate?: boolean;
  onRefresh?: () => void;
  actionsEnabled?: boolean;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesText, setNotesText] = useState('');

  // Inline error state with retry support
  const [inlineError, setInlineError] = useState<string | null>(null);
  const retryRef = useRef<(() => Promise<void>) | null>(null);
  const retryingRef = useRef(false);
  const [retrying, setRetrying] = useState(false);

  // ACHU-116: Track mounted state to cancel stale updates
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // ACHU-116: Lock to prevent duplicate mutations
  const actionLockRef = useRef(false);

  // Completion confirmation dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [checklistProgress, setChecklistProgress] = useState<{ completed: number; total: number } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

  const clearError = () => { setInlineError(null); retryRef.current = null; };

  // ACHU-116: Safe setState that respects mounted
  const safeSet = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
    if (mountedRef.current) setter(value);
  };

  // ACHU-116: Stable token ref — generated once per action, reused on retry
  const actionTokenRef = useRef<string>('');

  const doCompleteJob = useCallback(async (reason?: string, reuseToken?: string) => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    const token = reuseToken || genToken();
    if (!reuseToken) actionTokenRef.current = token;
    safeSet(setActionLoading, 'Completed');
    safeSet(setConfirmOpen, false);
    clearError();
    try {
      // ACHU-115: Send override reason separately, never in cleanerCompletionNotes
      const statusResult = await withTimeout(updateJobStatus({
        id: job.id,
        status: 'Completed',
        requestToken: token,
        ...(reason ? { checklistOverrideReason: reason } : {}),
      }), REQUEST_TIMEOUT);
      if (mountedRef.current) {
        if (statusResult.auditWarning) {
          toast.warning('Status updated, but audit history could not be updated.', { duration: 6000 });
        } else if (statusResult.resolvedStatus === 'Completion Review') {
          // ACHU-139: incomplete checklist + override reason no longer completes
          // the job outright — it's submitted for Admin approval instead.
          toast.success('Submitted for Admin review — checklist was incomplete');
        } else {
          toast.success('Job completed');
        }
      }
      onRefresh?.();
    } catch (e) {
      if (mountedRef.current) {
        safeSet(setInlineError, classifyFetchError(e));
        retryRef.current = async () => {
          // ACHU-116: Refetch authoritative state before retry
          onRefresh?.();
          return doCompleteJob(reason, token);
        };
      }
    } finally {
      actionLockRef.current = false;
      safeSet(setActionLoading, null);
    }
  }, [job.id, onRefresh]);

  const handleMarkCompleted = useCallback(async () => {
    if (actionLockRef.current) return;
    safeSet(setConfirmLoading, true);
    try {
      const cl = await withTimeout(getJobChecklist({ jobId: job.id }), REQUEST_TIMEOUT);
      if (cl.hasChecklist && cl.total > 0 && cl.completed < cl.total) {
        safeSet(setChecklistProgress, { completed: cl.completed, total: cl.total });
        safeSet(setOverrideReason, '');
        safeSet(setConfirmOpen, true);
        safeSet(setConfirmLoading, false);
        return;
      }
    } catch { /* if checklist fails, try completing — backend will enforce */ }
    safeSet(setConfirmLoading, false);
    doCompleteJob();
  }, [job.id, doCompleteJob]);

  /**
   * ACHU-565 — ⚠️ **indirecție printr-un ref, ca `doOnTheWay` să nu se refere la sine.**
   *
   * Forma firească — `retryRef.current = () => doOnTheWay()` — e o auto-referință în interiorul
   * propriului `useCallback`, pe care `react-hooks/immutability` o semnalează. Celelalte
   * acțiuni din fișier o au deja (patru avertismente), dar **clichetul de lint e EXACT**, deci
   * unul nou l-ar sparge — iar `CLAUDE.md` §2.1a spune să scoți avertismentul, nu să ridici
   * pragul. ⛔ **Retry-ul NU se poate pur și simplu omite:** `handleRetry` iese devreme când
   * `retryRef.current` e `null`, deci butonul ar arăta activ și n-ar face nimic — exact
   * defectul ACHU-451, care a trecut neobservat de la ACHU-116.
   */
  const onTheWayRef = useRef<() => Promise<void>>(async () => {});

  /**
   * ACHU-565 — anunță clientul că a plecat.
   *
   * ⚠️ **Aceleași apărări ca celelalte acțiuni** (lacătul, timeout-ul, `safeSet`), fiindcă e
   * apăsat pe un telefon, în mașină, pe o rețea proastă — exact contextul pentru care
   * ACHU-116 le-a adăugat pe toate trei.
   *
   * ⛔ **Nu trimite nicio oră.** Ceasul telefonului poate fi orice; ora e a serverului.
   */
  const doOnTheWay = useCallback(async () => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    safeSet(setActionLoading, 'on-the-way');
    clearError();
    try {
      const result = await withTimeout(cleanerOnTheWay(job.id), REQUEST_TIMEOUT);
      if (mountedRef.current) {
        // ⚠️ `alreadySent` NU e o eroare — e a doua apăsare, de regulă pe un telefon care a
        // părut că nu răspunde. Omul trebuie să afle că mesajul plecase deja, nu că a greșit.
        toast.success(result.alreadySent ? 'They already know you are on the way' : 'We have let them know');
      }
      onRefresh?.();
    } catch (e) {
      if (mountedRef.current) {
        safeSet(setInlineError, classifyFetchError(e));
        retryRef.current = async () => { onRefresh?.(); return onTheWayRef.current(); };
      }
    } finally {
      actionLockRef.current = false;
      safeSet(setActionLoading, null);
    }
  }, [job.id, onRefresh]);

  // Ținut la zi după fiecare randare, ca retry-ul să cheme mereu versiunea curentă.
  useEffect(() => { onTheWayRef.current = doOnTheWay; }, [doOnTheWay]);

  const doAction = useCallback(async (status: string, reuseToken?: string) => {
    if (status === 'Completed') {
      handleMarkCompleted();
      return;
    }
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    const token = reuseToken || genToken();
    if (!reuseToken) actionTokenRef.current = token;
    safeSet(setActionLoading, status);
    clearError();
    try {
      const statusResult = await withTimeout(updateJobStatus({ id: job.id, status, requestToken: token }), REQUEST_TIMEOUT);
      if (mountedRef.current) {
        if (statusResult.auditWarning) {
          toast.warning('Status updated, but audit history could not be updated.', { duration: 6000 });
        } else {
          toast.success(
            status === 'In Progress' ? 'Job started' :
            status === 'No Access' ? 'Marked as No Access' : 'Status updated'
          );
        }
      }
      onRefresh?.();
    } catch (e) {
      if (mountedRef.current) {
        safeSet(setInlineError, classifyFetchError(e));
        retryRef.current = async () => {
          // ACHU-116: Refetch authoritative state before retry
          onRefresh?.();
          return doAction(status, token);
        };
      }
    } finally {
      actionLockRef.current = false;
      safeSet(setActionLoading, null);
    }
  }, [job.id, onRefresh, handleMarkCompleted]);

  const saveNotes = useCallback(async (reuseToken?: string) => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    const token = reuseToken || genToken();
    if (!reuseToken) actionTokenRef.current = token;
    safeSet(setActionLoading, 'notes');
    clearError();
    try {
      await withTimeout(saveCleanerNotes({ jobId: job.id, cleanerCompletionNotes: notesText, requestToken: token }), REQUEST_TIMEOUT);
      if (mountedRef.current) {
        toast.success('Notes saved');
        setNotesOpen(false);
      }
      onRefresh?.();
    } catch (e) {
      if (mountedRef.current) {
        safeSet(setInlineError, classifyFetchError(e));
        retryRef.current = async () => {
          onRefresh?.();
          return saveNotes(token);
        };
      }
    } finally {
      actionLockRef.current = false;
      safeSet(setActionLoading, null);
    }
  }, [job.id, notesText, onRefresh]);

  const handleRetry = useCallback(async () => {
    if (retryingRef.current || !retryRef.current) return;
    // ACHU-451: captured BEFORE clearError() — clearError() sets retryRef.current
    // to null (it exists to wipe a stale retry when a fresh action starts), so
    // calling it first and then reading retryRef.current here always retried
    // against null. The Retry button threw `TypeError: retryRef.current is not
    // a function` on every use since ACHU-116 and never re-sent anything.
    const retry = retryRef.current;
    retryingRef.current = true;
    safeSet(setRetrying, true);
    clearError();
    try {
      await retry();
    } finally {
      retryingRef.current = false;
      safeSet(setRetrying, false);
    }
  }, []);

  /**
   * ACHU-565 — „am plecat spre client".
   *
   * ⚠️ **Aceleași condiții ca pe server** (`backend/src/lib/onTheWayPolicy.ts`): doar din
   * `Booked`/`Confirmed` și **doar în ziua vizitei**. Ecranul le repetă ca să nu ofere un
   * buton pe care serverul îl refuză — ⛔ dar **serverul rămâne poarta**; asta e comoditate,
   * nu regulă. Un ceas de telefon greșit nu poate păcăli decât afișarea.
   *
   * 🔴 **Butonul dispare după apăsare** și e înlocuit cu ce s-a spus clientului. Un buton
   * care rămâne acolo invită la o a doua apăsare, iar omul care apasă crede că prima n-a mers.
   */
  const isToday = job.jobDate === ukToday();
  const canGoOnTheWay = actionsEnabled && isToday && !job.onTheWayAt
    && (job.status === 'Booked' || job.status === 'Confirmed');

  const canStart = actionsEnabled && (job.status === 'Booked' || job.status === 'Confirmed');
  const canComplete = actionsEnabled && job.status === 'In Progress';
  const canNoAccess = actionsEnabled && ['Booked', 'Confirmed', 'In Progress'].includes(job.status ?? '');
  const canNotes = actionsEnabled;
  const hasPhone = !!job.customerPhone;
  const hasAddress = !!job.address;
  const busy = !!actionLoading || retrying;

  // ACHU-115: Validate override reason (min 10 chars, non-whitespace)
  const trimmedOverride = overrideReason.trim();
  const overrideValid = trimmedOverride.length >= 10;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                <Hash className="h-3 w-3" />{job.jobId}
              </span>
              {showDate && job.jobDate && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />{fmtDate(job.jobDate)}
                </span>
              )}
            </div>
            <p className="font-semibold text-base mt-1">{job.service || 'Cleaning'}</p>
          </div>
          <StatusBadge status={job.status} />
        </div>

        {/* Details */}
        <div className="text-sm space-y-1.5">
          <p className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{job.customerName || '—'}</span>
          </p>
          <p className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <span className="break-words">{job.address || '—'}</span>
          </p>
          <p className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Scheduled:</span>
            <span>{job.startTime || '—'}{job.finishTime ? ` – ${job.finishTime}` : ''}</span>
          </p>
          {/* ACHU-578 — vezi `ActualTimesRows`. ⛔ ACHU-401 (felia 19): cele două `as any` de aici nu afirmau nimic (`CleanerJob` E `any`, vezi `CleanerApp.tsx`) — un cast care se citea ca o verificare fără să verifice. Forma rutei rămâne de publicat. */}
          <ActualTimesRows startedAt={job.actualStartTime} finishedAt={job.actualFinishTime} />
        </div>

        {/* 🔴 ACHU-578 — DRUMUL PÂNĂ ACOLO (§5, Grupul D). DEASUPRA lui „Getting in", fiindcă
            asta e ordinea zilei: întâi conduci și parchezi, apoi descui. ⛔ Fără niciun preț —
            costul îl suportă firma (14/08/2026), deci nu e nimic de discutat la ușă. */}
        {job.propertyTravel && <GettingThereCard travel={job.propertyTravel} />}

        {/* ACHU-239, mutat pe CASĂ la ACHU-576: cum se intră la casa ACESTEI vizite — altceva
            decât `customerInstructions`, care e despre ziua asta. Deasupra lor, și în cardul lui
            propriu (`PropertyAccessCard`), fiindcă a treia bucată de conținut în fișierul ăsta
            l-ar fi împins peste clichetul de mărime. */}
        {job.propertyAccess && <PropertyAccessCard access={job.propertyAccess} />}

        {/* 🔴 ACHU-549 — despre PERSOANA din spatele ușii, nu despre ușă. Sub „Getting in",
            fiindcă se citesc în același moment: unul spune cum intri, celălalt cum te porți
            când ai intrat. ⚠️ Mutat în fișier propriu la ACHU-577, ca cele dinaintea lui. */}
        {job.accessibilityNote && <AccessibilityNoteCard note={job.accessibilityNote} />}

        {/* 🔴 ACHU-577 — ce se face DE FIECARE DATĂ la casa asta (§5, Grupul E). Sub cum se
            intră, fiindcă asta e ordinea zilei: ajungi înăuntru, apoi faci treaba. ⚠️ Altceva
            decât `customerInstructions`, care e despre ziua asta — vezi antetul cardului. */}
        {job.standardInstructions && <StandingWorkCard instructions={job.standardInstructions} />}

        {/* ACHU-513: the customer confirmed access for THIS visit.
            ⛔ Shown ONLY when it happened. There is deliberately no "not confirmed" line:
            confirming is voluntary and new, so most visits will never have one, and a
            "not confirmed" banner on every card would read as a warning about the
            customer and would teach cleaners to ignore the box that matters.
            ⚠️ Nor is it permission to skip a visit — a cleaner still travels. It is one
            fewer phone call when it IS there. */}
        {job.accessConfirmedAt && (
          <div className="rounded-lg border border-green-600/30 bg-green-50 p-2.5">
            <p className="text-xs font-semibold flex items-center gap-1.5 text-green-800">
              <CheckCircle2 className="h-3.5 w-3.5" />Customer confirmed access
            </p>
            <p className="mt-0.5 text-[11px] text-green-900/80">
              They told us on {new Date(job.accessConfirmedAt).toLocaleDateString('en-GB', { timeZone: 'Europe/London' })} that
              you will be able to get in.
            </p>
          </div>
        )}

        {/*
          ACHU-514 — ce a scris și a fotografiat CLIENTUL despre casa lui, pentru vizita asta.
          ⚠️ Mutat într-un fișier propriu la ACHU-575 (`PropertyFromCustomerCard.tsx`): motivele
          întregi sunt în antetul lui, iar clichetul de mărime al acestui fișier era atins exact
          când a venit cardul de mai jos (`CLAUDE.md` §2.1a — se extrage, nu se ridică plafonul).
        */}
        <PropertyFromCustomerCard notes={job.propertyNotes} photos={job.propertyPhotos ?? []} />
        <VisitEvidenceCard jobId={job.id} photos={job.visitPhotos ?? []} cancelled={job.status === 'Cancelled'} />

        {/*
          🔴 ACHU-575 — CE POATE MERGE PROST LA CASA ASTA (§5, Grupul C).

          Consemnat de birou pe fișa casei, citit AICI de omul care descuie ușa. Fără rândul
          acesta, cele șapte câmpuri ar fi un formular mai complet și nimic altceva — biroul ar
          crede că a spus, iar incidentul s-ar întâmpla la fel (ACHU-569).

          ⚠️ Lângă nota clientului, fiindcă răspund la aceeași întrebare — în ce intru — dar
          SUB ea: ce a scris omul care locuiește acolo trece înaintea a ce a consemnat biroul.

          ⛔ Serverul trimite `null` pe o vizită închisă ȘI când nu s-a consemnat nimic, deci nu
          e niciun caz de tratat aici. Un card gol care apare pe fiecare vizită ar învăța pe
          cineva să nu se mai uite la el.
        */}
        {job.propertyRisk && <PropertyRiskCard risk={job.propertyRisk} />}

        {/*
          ACHU-556 (Sesiunea 122) — ce s-a cerut IN PLUS la vizita asta.

          🔴 Ajunge aici fiindca altfel nu il face nimeni. Biroul scrie „curatat cuptorul" pe
          fisa vizitei, clientul il vede pe a lui si il asteapta — iar omul care ajunge la usa
          nu are de unde sti ca i se cere altceva decat curatenia obisnuita. Exact tiparul
          ACHU-514, unde nota si pozele scrise de client nu ajungeau la curatator.

          ⛔ FARA pret, si nu doar aici: serverul nu il trimite deloc (`cleanerJobs.ts`). Ce
          trebuie facut e treaba curatatorului; cat s-a facturat nu e — iar un pret langa o
          sarcina invita la o conversatie la usa pe care el nu o poate purta.

          ⚠️ Serverul nu trimite nimic pe o vizita inchisa, deci nu e niciun caz de tratat aici.
        */}
        {(job.serviceExtras?.length ?? 0) > 0 && (
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-2.5">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <PlusCircle className="h-3.5 w-3.5" />Extra work booked for this job
            </p>
            <ul className="mt-1 space-y-0.5">
              {job.serviceExtras.map((extra: { id: string; description: string }) => (
                <li key={extra.id} className="text-sm break-words">{extra.description}</li>
              ))}
            </ul>
          </div>
        )}

        {job.customerInstructions && (
          <div className="text-sm bg-muted/50 p-3 rounded-lg break-words">
            <span className="font-medium text-muted-foreground">Customer instructions:</span>
            <p className="mt-0.5 whitespace-pre-wrap">{job.customerInstructions}</p>
          </div>
        )}

        {/* Job Details / Work Required — expandable */}
        <WorkDetailsSection job={job} />

        {/* Work Checklist — ACHU-117: lazy loaded on expand only */}
        <WorkChecklist jobId={job.id} />

        {/*
          §36 (Sesiunea 142) — „cum a mers?", doar pe o vizită ÎNCHEIATĂ, și doar acolo: pe una
          viitoare întrebarea nu are răspuns, iar serverul o refuză oricum. ⚠️ Deasupra notelor
          proprii, fiindcă cele trei butoane se ating în două secunde, iar un text se scrie doar
          când omul are chef — puse invers, întrebările ar fi rămas sub un câmp gol.
        */}
        {job.status === 'Completed' && <VisitReportCard jobId={job.id} />}

        {/* Existing completion notes */}
        {job.cleanerCompletionNotes && !notesOpen && (
          <div className="text-sm bg-primary/5 p-3 rounded-lg break-words">
            <span className="font-medium text-muted-foreground">Your notes:</span>
            <p className="mt-0.5 whitespace-pre-wrap">{job.cleanerCompletionNotes}</p>
          </div>
        )}

        {/* Notes editor */}
        {notesOpen && (
          <div className="space-y-2">
            <Textarea aria-label="Notes for the office about this job"
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              placeholder="Add completion notes..."
              rows={3}
              className="text-base"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveNotes()} disabled={busy} className="min-h-[40px]">
                {actionLoading === 'notes' ? 'Saving...' : 'Save Notes'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setNotesOpen(false); clearError(); }} className="min-h-[40px]">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Inline error with retry */}
        {inlineError && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-2" role="alert">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{inlineError}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="min-h-[40px] border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={handleRetry}
              disabled={retrying}
            >
              {retrying ? (
                <><RefreshCw className="h-4 w-4 animate-spin mr-1.5" />Retrying…</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-1.5" />Retry</>
              )}
            </Button>
          </div>
        )}

        {/*
          ACHU-565 — ce s-a spus clientului, în locul butonului.

          🔴 **Un buton care rămâne acolo după apăsare invită la o a doua apăsare**, iar omul
          care apasă crede că prima n-a mers. Rândul acesta îi spune că a mers, și când.
        */}
        {job.onTheWayAt && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
            <Car className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">
              They know you are on the way — told at {fmtDateTime(job.onTheWayAt)}
            </span>
          </div>
        )}

        {/* Actions */}
        {actionsEnabled && (
          <div className="space-y-2 pt-1">
            <div className="flex gap-2 flex-wrap">
              {/*
                ACHU-565 — înaintea lui „Start Job", fiindcă asta e ordinea reală: pleci, apoi
                ajungi. ⚠️ `variant="outline"`, ca butonul principal al ecranului să rămână
                cel care mișcă vizita.
              */}
              {canGoOnTheWay && (
                <Button size="sm" variant="outline" className="flex-1 min-h-[44px]" onClick={doOnTheWay} disabled={busy}>
                  <Car className="h-4 w-4 mr-1.5" />{actionLoading === 'on-the-way' ? 'Telling them…' : "I'm on my way"}
                </Button>
              )}
              {canStart && (
                <Button size="sm" className="flex-1 min-h-[44px]" onClick={() => doAction('In Progress')} disabled={busy}>
                  <Play className="h-4 w-4 mr-1.5" />Start Job
                </Button>
              )}
              {canComplete && (
                <Button size="sm" className="flex-1 min-h-[44px]" onClick={() => doAction('Completed')} disabled={busy || confirmLoading}>
                  <CheckCircle className="h-4 w-4 mr-1.5" />{confirmLoading ? 'Checking...' : 'Mark Completed'}
                </Button>
              )}
              {canNoAccess && (
                <Button size="sm" variant="outline" className="min-h-[44px]" onClick={() => doAction('No Access')} disabled={busy}>
                  <Ban className="h-4 w-4 mr-1.5" />No Access
                </Button>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              {canNotes && !notesOpen && (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() => { setNotesOpen(true); setNotesText(job.cleanerCompletionNotes ?? ''); clearError(); }}
                >
                  <FileText className="h-4 w-4 mr-1.5" />Notes
                </Button>
              )}
              {hasPhone && (
                <Button size="sm" variant="outline" className="min-h-[44px]" asChild>
                  <a href={`tel:${job.customerPhone}`}>
                    <Phone className="h-4 w-4 mr-1.5" />Call
                  </a>
                </Button>
              )}
              {hasAddress && (
                <Button size="sm" variant="outline" className="min-h-[44px]" asChild>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address!)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin className="h-4 w-4 mr-1.5" />Maps
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}
        {/* ACHU-115: Completion confirmation dialog with proper override */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Some checklist items are still incomplete</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                    <span className="text-sm text-foreground">Completed</span>
                    <span className="font-semibold text-foreground">{checklistProgress?.completed ?? 0} / {checklistProgress?.total ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                    <span className="text-sm text-foreground">Remaining</span>
                    <span className="font-semibold text-foreground">{(checklistProgress?.total ?? 0) - (checklistProgress?.completed ?? 0)}</span>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1">Reason for completing anyway *</label>
                    <Textarea aria-label="Reason for completing anyway"
                      value={overrideReason}
                      onChange={e => setOverrideReason(e.target.value)}
                      placeholder="Explain why remaining items are not needed (min 10 characters)..."
                      rows={2}
                      className="text-sm"
                    />
                    {trimmedOverride.length > 0 && trimmedOverride.length < 10 && (
                      <p className="text-xs text-destructive mt-1">
                        {10 - trimmedOverride.length} more character{10 - trimmedOverride.length === 1 ? '' : 's'} needed
                      </p>
                    )}
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
              <AlertDialogCancel className="min-h-[44px]">Return to Checklist</AlertDialogCancel>
              <Button
                className="min-h-[44px] w-full"
                disabled={!overrideValid}
                onClick={() => doCompleteJob(trimmedOverride)}
              >
                Complete Anyway
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

