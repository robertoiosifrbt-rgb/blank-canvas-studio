import { useEffect, useState, useRef } from 'react';
import { getJobAssignments, saveJobAssignment, deleteJobAssignment, getCleaners, type AwayCleaner } from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import DateField from '@/components/shared/DateField';
import InlineNote from '@/components/shared/InlineNote';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, UserPlus, Pencil, Check, X, Loader2, Phone, Mail, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { fmtDate } from '@/lib/format';
import { ukToday } from '@/lib/ukDate';
import { errMsg } from '@/lib/errorMessage';

const ROLES = ['Lead Cleaner', 'Cleaner', 'Assistant Cleaner'];

type JobInfo = {
  jobDate?: string;
  startTime?: string;
  service?: string;
  address?: string;
};

/**
 * ACHU-401 (Sesiunea 120, felia 8) — formele pe care le citește ecranul, în locul lui `any`.
 *
 * ⚠️ **Citite din rutele care le produc**, nu ghicite din numele câmpurilor:
 * `backend/src/routes/jobAssignments.ts` (`GET /`, care aplatizează curățătorul în
 * `cleanerName`/`cleanerPhone`/`cleanerEmail`/`cleanerActive`) și `routes/cleaners.ts`.
 *
 * ⛔ **Numai câmpurile pe care ecranul le randează.** Ruta trimite tot rândul Prisma; un tip
 * care l-ar copia integral ar fi o a doua schemă de ținut la zi.
 */
type Assignment = {
  id: string;
  assignmentRole: string | null;
  /** `YYYY-MM-DD` — tăiată în rută, deci fără oră. */
  assignedDate: string | null;
  notes: string | null;
  /**
   * 🔴 ACHU-551 — cheia curățătorului, iar ecranul citea `cleaner` în locul ei.
   *
   * Ruta face `{...a}` peste rândul brut și adaugă `cleaner` ca **obiect** cu numele și
   * telefonul. Codul de aici scria `Array.isArray(a.cleaner) ? a.cleaner[0] : a.cleaner`
   * — o formă rămasă din importul Zite — deci primea **obiectul**, nu un id.
   */
  cleanerId: string;
  cleanerName: string;
  cleanerPhone: string;
  cleanerEmail: string;
  /** ⚠️ Un curățător dezactivat rămâne pe vizitele lui vechi; ecranul îl marchează. */
  cleanerActive: boolean;
};

type CleanerOption = {
  id: string;
  cleanerName: string;
  active: boolean;
  /** Afișate sub numele curățătorului ales, ca biroul să-l poată suna fără să schimbe ecranul. */
  phone: string | null;
  email: string | null;
};

/**
 * ACHU-554 — o preferință a clientului despre un curățător, cum o trimite ruta de asignări.
 *
 * ⚠️ `kind` e un `string` liber aici, nu o uniune: felurile trăiesc pe server
 * (`backend/src/lib/cleanerPreferencePolicy.ts`), iar ecranul tratează orice altceva decât
 * `excluded` ca pe o preferință pozitivă. Un fel nou nu poate rupe ecranul.
 */
type CustomerCleanerPreference = {
  cleanerId: string;
  cleanerName: string;
  kind: string;
  reason: string | null;
};

/**
 * Avertismentul pentru un curățător anume, sau `null`.
 *
 * 🔴 **Întoarce un TEXT, nu o permisiune** — decizia Archanei a fost „avertizează, nu refuza",
 * iar un `boolean` numit `allowed` ar fi invitat prima persoană care citește codul să-l lege
 * de `disabled`. Cuvintele sunt aceleași ca pe server, cu excepția că aici nu avem nevoie de
 * ele pentru audit.
 */
function preferenceWarning(preferences: CustomerCleanerPreference[], cleanerId: string): { excluded: boolean; text: string } | null {
  const hit = preferences.find(p => p.cleanerId === cleanerId);
  if (!hit) return null;
  const excluded = hit.kind === 'excluded';
  const head = excluded
    ? `The customer asked us not to send ${hit.cleanerName}.`
    : `${hit.cleanerName} is this customer’s preferred cleaner.`;
  // ⚠️ Motivul doar dacă are conținut — „Reason given:" gol arată ca un defect.
  const reason = hit.reason?.trim();
  return { excluded, text: reason ? `${head} Reason given: ${reason}` : head };
}

/**
 * Notele de lângă curățătorul ales, ÎNTR-UN SINGUR LOC (Sesiunea 157; a doua notă la 158).
 *
 * ⚠️ **Se numea `PreferenceNote` până la ACHU-797**, iar numele a devenit fals în clipa în care a
 * început să arate și concediul: o funcție care spune „preferință" și desenează „e bolnav" e chiar
 * felul în care al treilea apelant pune nota greșită în locul greșit.
 *
 * ⚠️ Era scris de doua ori, aproape identic: pe formularul de adaugare si — de azi — pe cel de
 * editare. ⛔ Doua copii ale aceluiasi text se despart la prima schimbare, iar atunci ecranul ar
 * spune altceva la adaugare decat la inlocuire. 🔴 Si e chiar defectul pe care felia asta l-a reparat
 * (ACHU-793): jumatatea care lipsea.
 *
 * ⛔ Nu e legat de `disabled` pe niciun buton, deliberat (ACHU-554, decizia Archanei): se AVERTIZEAZA,
 * nu se blocheaza — intr-o dimineata cu doi bolnavi, singurul liber poate fi exact cel interzis.
 */
function AssignmentNotes({ preferences, away, outside, cleanerId }: {
  preferences: CustomerCleanerPreference[];
  /** 🆕 ACHU-797 — cine e plecat în ziua vizitei. */
  away: AwayCleaner[];
  /**
   * 🆕 §13 (Sesiunea 158) — cine e pus într-o zi care nu e din programul lui obișnuit.
   *
   * ⚠️ **A treia notă, nu o variantă a celei de-a doua:** o absență e un fapt consemnat („e în
   * concediu"), un program obișnuit e o obișnuință („de regulă nu lucrează sâmbăta"). ⛔ Amestecate,
   * a doua ar fi împrumutat greutatea celei dintâi.
   */
  outside: { cleanerId: string; note: string }[];
  cleanerId: string;
}) {
  const w = cleanerId ? preferenceWarning(preferences, cleanerId) : null;
  /**
   * ⛔ **AMÂNDOUĂ notele, nu una** — aceeași hotărâre ca pe server la asignarea în masă: „clientul
   * l-a refuzat" și „omul e plecat atunci" sunt motive diferite de a te opri. 🔴 A doua care ar
   * înlocui-o pe prima ar ascunde exact ce e mai greu de aflat altfel.
   */
  const hit = cleanerId ? away.find(a => a.cleanerId === cleanerId) : undefined;
  /** ⛔ Numai când se ȘTIE că nu e ziua lui: serverul nu trimite fișele fără program scris. */
  const off = cleanerId ? outside.find(o => o.cleanerId === cleanerId) : undefined;
  if (!w && !hit && !off) return null;
  /** ⚠️ Chenarul e comun locurilor care avertizează — vezi `shared/InlineNote.tsx`. */
  return (
    <>
      {w && <InlineNote tone={w.excluded ? 'refusal' : 'warning'}>{w.text}</InlineNote>}
      {hit && <InlineNote>{hit.message}</InlineNote>}
      {off && <InlineNote>{off.note}</InlineNote>}
    </>
  );
}

/**
 * 🔴 ACHU-797 — pastila de pe o asignare DEJA existentă, și ăsta e cazul invers celui de la adăugare:
 * concediul poate fi **aprobat după** ce omul a fost pus pe vizită. ⛔ Atunci nimic nu semnala nimic —
 * vizita rămânea în orar cu un om care nu vine, iar biroul afla în dimineața ei.
 *
 * ⚠️ **Galben, nu roșu.** Roșul de pe rândul acesta e al refuzurilor („Customer said no", „Inactive"),
 * iar un concediu nu e un refuz: se avertizează, nu se blochează. ⛔ În orar aceeași informație e
 * violetă, fiindcă acolo galbenul e deja al vizitelor fără curățător — culorile sunt ale ecranului,
 * propoziția e a serverului.
 *
 * 🔴 Propoziția întreagă (cu intervalul) stă în `title`: rândul e strâmt, dar motivul trebuie să fie la
 * un vârf de mouse.
 */
function AwayBadge({ away, cleanerId }: { away: AwayCleaner[]; cleanerId: string }) {
  const hit = away.find(a => a.cleanerId === cleanerId);
  if (!hit) return null;
  return (
    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-800" title={hit.message}>
      {hit.reason === 'sickness' ? 'Off sick' : 'On leave'}
    </Badge>
  );
}

export default function JobAssignmentsPanel({ jobId, jobInfo }: { jobId: string; jobInfo?: JobInfo }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [allCleaners, setAllCleaners] = useState<CleanerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ cleanerId: '', assignmentRole: '', assignedDate: '', notes: '' });
  const [newForm, setNewForm] = useState({ cleanerId: '', assignmentRole: 'Cleaner', assignedDate: ukToday(), notes: '' });
  /**
   * ACHU-554 (Sesiunea 121) — ce a cerut clientul despre curățători.
   *
   * **Decizia Archanei, 12/08/2026:** *„1.a"* — se **AVERTIZEAZĂ**, nu se blochează. Deci
   * lista nu filtrează nimic din dropdown: un curățător interzis rămâne selectabil.
   */
  const [preferences, setPreferences] = useState<CustomerCleanerPreference[]>([]);
  /**
   * 🆕 ACHU-797 (Sesiunea 158) — concediul aprobat și boala, în ziua ACESTEI vizite.
   *
   * ⛔ **Nu filtrează dropdown-ul.** Aceeași hotărâre ca la preferințe: se avertizează, nu se
   * refuză — într-o dimineață cu doi bolnavi, biroul poate avea motive să cheme pe cineva din
   * concediu, iar aplicația nu știe dacă omul s-a oferit.
   */
  const [away, setAway] = useState<AwayCleaner[]>([]);
  /** 🆕 §13 (Sesiunea 158) — cine e pus în afara programului lui obișnuit, în ziua vizitei. */
  const [outside, setOutside] = useState<{ cleanerId: string; cleanerName: string; note: string }[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const load = async () => {
    setLoading(true);
    const [aData, cData] = await Promise.all([getJobAssignments({ jobId }), getCleaners({})]);
    setAssignments(aData.assignments);
    // ⚠️ Vin ODATĂ cu asignările, nu pe o cerere separată: dacă aceea ar eșua tăcut,
    // avertismentul ar lipsi fără ca nimeni să afle (`backend/src/routes/jobAssignments.ts`).
    setPreferences(aData.customerPreferences ?? []);
    // ⚠️ Din același răspuns, pentru același motiv: un avertisment care lipsește tăcut e mai rău
    // decât niciunul, fiindcă ecranul arată exact ca atunci când nu e nimic de spus.
    setAway(aData.awayCleaners ?? []);
    setOutside(aData.outsidePattern ?? []);
    setAllCleaners(cData.records);
    setLoading(false);
  };

  useEffect(() => { load(); }, [jobId]);

  const activeCleaners = allCleaners.filter(c => c.active);
  /**
   * 🔴 ACHU-551 (Sesiunea 120) — **DEFECT REAL, găsit tipizând.**
   *
   * Rândul acesta compara `c.id` (un string) cu un **obiect**, deci `includes` era mereu
   * fals și `available` rămânea lista întreagă: dropdown-ul „Add" oferea curățători **deja
   * asignați** vizitei. Nimic nu arăta stricat — lista era doar mai lungă decât trebuia.
   */
  const assignedIds = assignments.map(a => a.cleanerId);
  const available = activeCleaners.filter(c => !assignedIds.includes(c.id));

  /**
   * NOU §12 "Replacement cleaner" (Sesiunea 157) - CINE POATE LUA LOCUL CUIVA.
   *
   * Serverul stia sa inlocuiasca de mult: o salvare care schimba curatatorul pe aceeasi asignare
   * anunta AMANDOI oameni (ACHU-632) si scrie randul de audit. Ecranul nu oferea alegerea:
   * formularul de editare avea rol, data si note, dar nu curatatorul - deci inlocuirea se facea in
   * doi pasi (scoate, adauga), iar intre ei vizita rămâne neasignata fara sa spuna nimeni nimic.
   *
   * Lista de aici e cea de la adaugare PLUS omul curent: fara el, dropdown-ul s-ar deschide gol pe
   * propria lui asignare. Iar cei deja pe vizita nu apar - i-ar da o a doua asignare, pe care
   * cheia unica o refuza (ACHU-028).
   */
  const editingAssignment = assignments.find(a => a.id === editingId);
  const replacementOptions = [
    ...(editingAssignment && !activeCleaners.some(c => c.id === editingAssignment.cleanerId)
      ? [{ id: editingAssignment.cleanerId, cleanerName: `${editingAssignment.cleanerName ?? 'Cleaner'} (inactive)` }]
      : []),
    ...activeCleaners.filter(c => c.id === editingAssignment?.cleanerId || !assignedIds.includes(c.id)),
  ];

  // Selected cleaner details for Add form
  const selectedCleaner = allCleaners.find(c => c.id === newForm.cleanerId);

  const handleAdd = async () => {
    if (!newForm.cleanerId || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const addResult = await saveJobAssignment({ jobId, cleanerId: newForm.cleanerId, assignmentRole: newForm.assignmentRole || undefined, assignedDate: newForm.assignedDate || undefined, notes: newForm.notes || undefined });
      // ACHU-047: Show audit warning if present
      if (addResult.auditWarning) {
        console.warn('[JobAssignmentsPanel] Audit warning:', addResult.auditWarning);
        toast.warning('Cleaner assigned, but audit history could not be updated.', { duration: 6000 });
      } else {
        toast.success('Cleaner assigned');
      }
      setNewForm({ cleanerId: '', assignmentRole: 'Cleaner', assignedDate: ukToday(), notes: '' });
      setShowAdd(false);
      await load();
    } catch (e) {
      toast.error(errMsg(e) ?? 'Failed to assign');
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  };

  const startEdit = (a: Assignment) => {
    // 🔴 ACHU-551, a doua față a aceluiași defect: `cleanerId` primea un obiect, deci
    // dropdown-ul de editare se deschidea GOL în loc să arate curățătorul curent.
    setEditForm({ cleanerId: a.cleanerId, assignmentRole: a.assignmentRole ?? '', assignedDate: a.assignedDate ?? '', notes: a.notes ?? '' });
    setEditingId(a.id);
  };

  const handleEditSave = async () => {
    if (!editingId || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const editResult = await saveJobAssignment({ id: editingId, jobId, cleanerId: editForm.cleanerId, assignmentRole: editForm.assignmentRole || undefined, assignedDate: editForm.assignedDate || undefined, notes: editForm.notes || undefined });
      // ACHU-047: Show audit warning if present
      if (editResult.auditWarning) {
        console.warn('[JobAssignmentsPanel] Audit warning:', editResult.auditWarning);
        toast.warning('Assignment updated, but audit history could not be updated.', { duration: 6000 });
      } else {
        toast.success('Assignment updated');
      }
      setEditingId(null);
      await load();
    } catch (e) {
      toast.error(errMsg(e) ?? 'Failed to update');
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  };

  /**
   * §48 „Undo for safe actions" (Sesiunea 154) — SCOATEREA UNUI OM DE PE O VIZITĂ SE POATE ÎNTOARCE.
   *
   * 🔴 Era o apăsare, fără confirmare și fără drum înapoi: cine nimerea coșul rândului de deasupra
   * trebuia să deschidă „Add", să caute omul în listă, să-i pună la loc rolul, data și nota — din
   * memorie. ⛔ Iar între timp vizita e nerepartizată, ceea ce pe ecranul de dispecerat arată exact
   * ca o vizită care chiar n-are pe nimeni.
   *
   * ⚠️ Întoarcerea trimite **rolul, data și nota** înapoi, nu doar omul: o repartizare pusă la loc
   * fără rol s-ar vedea reparată și n-ar fi — foaia de repartizare tipărită nu mai spune cine e Lead.
   */
  const remove = async (a: Assignment) => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      const delResult = await deleteJobAssignment({ id: a.id });
      // ACHU-047: Show audit warning if present
      if (delResult.auditWarning) {
        console.warn('[JobAssignmentsPanel] Audit warning:', delResult.auditWarning);
        toast.warning('Assignment removed, but audit history could not be updated.', { duration: 6000 });
      } else {
        toast.success(`${a.cleanerName || 'Cleaner'} removed from the job`, {
          action: { label: 'Undo', onClick: () => void undoRemove(a) },
        });
      }
      await load();
    } catch (e) {
      toast.error(errMsg(e) ?? 'Failed to remove');
    } finally {
      savingRef.current = false;
    }
  };

  const undoRemove = async (a: Assignment) => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      await saveJobAssignment({
        jobId,
        cleanerId: a.cleanerId,
        assignmentRole: a.assignmentRole || undefined,
        assignedDate: a.assignedDate || undefined,
        notes: a.notes || undefined,
      });
      toast.success(`${a.cleanerName || 'Cleaner'} is back on the job`);
      await load();
    } catch (e) {
      // ⚠️ Numele omului în mesaj: fără el, cineva cu trei vizite deschise nu știe ce n-a mers.
      toast.error(errMsg(e) ?? `Could not put ${a.cleanerName || 'the cleaner'} back on the job.`);
    } finally {
      savingRef.current = false;
    }
  };

  return (
    /* ACHU-523: titlu peste un GRUP (lista celor asignați, plus butoanele de adăugare și
       scoatere), nu eticheta unui câmp. */
    <div className="space-y-3" role="group" aria-labelledby="job-assignments-label">
      <Label id="job-assignments-label" className="flex items-center gap-1"><UserPlus className="h-4 w-4" /> Assigned Cleaners</Label>

      {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cleaners assigned yet</p>
      ) : (
        <div className="space-y-2">
          {assignments.map(a => editingId === a.id ? (
            <div key={a.id} className="border border-border rounded-lg p-3 space-y-2 bg-muted/20">
              {/*
                NOU §12 (Sesiunea 157) - inlocuirea, intr-un singur pas. Serverul face restul:
                schimbarea curatatorului pe o asignare existenta anunta amandoi oameni (ACHU-632).
              */}
              <div><Label htmlFor="jobassignm-edit-cleaner" className="text-xs">Cleaner</Label>
                <Select value={editForm.cleanerId} onValueChange={v => setEditForm(f => ({ ...f, cleanerId: v }))}>
                  <SelectTrigger id="jobassignm-edit-cleaner" className="h-8 text-sm"><SelectValue placeholder="Select cleaner" /></SelectTrigger>
                  <SelectContent>{replacementOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.cleanerName}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/*
                ACHU-554, si aici: avertismentul preferintei exista de mult pe formularul de
                ADAUGARE si lipsea de pe cel de editare - deci o inlocuire putea pune exact omul
                pe care clientul l-a refuzat, fara niciun semn. Aceeasi functie, acelasi text.
                Avertizeaza, nu blocheaza: intr-o dimineata cu doi bolnavi, singurul liber poate fi
                exact cel interzis.
              */}
              <AssignmentNotes preferences={preferences} away={away} outside={outside} cleanerId={editForm.cleanerId} />

              <div><Label htmlFor="jobassignm-assignment-role" className="text-xs">Assignment Role</Label>
                <Select value={editForm.assignmentRole} onValueChange={v => setEditForm(f => ({ ...f, assignmentRole: v }))}>
                  <SelectTrigger id="jobassignm-assignment-role" className="h-8 text-sm"><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="jobassignm-assigned-date" className="text-xs">Assigned Date</Label>
                <DateField id="jobassignm-assigned-date" className="h-8 text-sm" value={editForm.assignedDate} onChange={e => setEditForm(f => ({ ...f, assignedDate: e.target.value }))} />
              </div>
              <div><Label htmlFor="jobassignm-notes" className="text-xs">Notes</Label>
                <Textarea id="jobassignm-notes" className="text-sm" rows={2} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Assignment notes..." />
              </div>
              <div className="flex gap-2">
                <Button size="sm" aria-label="Save the assignment changes" title="Save the assignment changes" onClick={handleEditSave} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}</Button>
                <Button size="sm" variant="outline" aria-label="Discard the assignment changes" title="Discard the assignment changes" onClick={() => setEditingId(null)} disabled={saving}><X className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ) : (
            <div key={a.id} className="bg-muted rounded-lg px-3 py-2 text-sm space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{a.cleanerName}</p>
                    {a.cleanerActive === false && <Badge variant="destructive" className="text-[10px]">Inactive</Badge>}
                    {/* ⚠️ ACHU-554 — și pe cele DEJA asignate, nu doar la adăugare: preferința
                        poate fi scrisă DUPĂ ce cineva a fost pus pe vizită, iar atunci nimic
                        nu ar mai fi semnalat-o. */}
                    {preferenceWarning(preferences, a.cleanerId)?.excluded && (
                      <Badge variant="destructive" className="text-[10px]">Customer said no</Badge>
                    )}
                    <AwayBadge away={away} cleanerId={a.cleanerId} />
                  </div>
                  {a.assignmentRole && <p className="text-xs text-muted-foreground">{a.assignmentRole}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button aria-label={`Edit the assignment for ${a.cleanerName ?? 'this cleaner'}`} title={`Edit the assignment for ${a.cleanerName ?? 'this cleaner'}`} className="p-1 rounded hover:bg-muted-foreground/10" onClick={() => startEdit(a)}><Pencil className="h-3.5 w-3.5" /></button>
                  <button aria-label={`Remove ${a.cleanerName ?? 'this cleaner'} from the job`} title={`Remove ${a.cleanerName ?? 'this cleaner'} from the job`} className="p-1 rounded hover:bg-destructive/10 text-destructive" onClick={() => void remove(a)}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                {a.assignedDate && <span>Assigned: {fmtDate(a.assignedDate)}</span>}
                {a.cleanerPhone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" />{a.cleanerPhone}</span>}
                {a.cleanerEmail && <span className="flex items-center gap-0.5 min-w-0"><Mail className="h-3 w-3 shrink-0" /><span className="break-all">{a.cleanerEmail}</span></span>}
              </div>
              {a.notes && <p className="text-xs text-muted-foreground truncate">{a.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/10">
          {/* ACHU-046: Show Job context info */}
          {jobInfo && (
            <div className="bg-muted/30 rounded-md p-2 text-xs space-y-0.5">
              <p className="font-medium text-muted-foreground">Job Details</p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {jobInfo.jobDate && <span>Date: {fmtDate(jobInfo.jobDate)}</span>}
                {jobInfo.startTime && <span>Start: {jobInfo.startTime}</span>}
                {jobInfo.service && <span>Service: {jobInfo.service}</span>}
                {jobInfo.address && <span>Address: {jobInfo.address}</span>}
              </div>
            </div>
          )}

          <div><Label htmlFor="jobassignm-cleaner" className="text-xs">Cleaner *</Label>
            <Select value={newForm.cleanerId} onValueChange={v => setNewForm(f => ({ ...f, cleanerId: v }))}>
              <SelectTrigger id="jobassignm-cleaner" className="h-8 text-sm"><SelectValue placeholder="Select cleaner" /></SelectTrigger>
              <SelectContent>{available.map(c => <SelectItem key={c.id} value={c.id}>{c.cleanerName}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* ─── ACHU-554 (Sesiunea 121) — avertismentul, sub dropdown ────────────
              **Decizia Archanei:** *„1.a"* — se AVERTIZEAZĂ, nu se blochează. Deci
              curățătorul rămâne în listă și butonul de Add rămâne activ; ce se schimbă e că
              biroul VEDE ce a cerut clientul înainte să apese.

              ⛔ Nu e legat de `disabled` pe niciun buton, deliberat: într-o dimineață cu doi
              oameni bolnavi, singurul disponibil poate fi exact cel interzis, iar un refuz ar
              însemna că vizita nu se face deloc. */}
          <AssignmentNotes preferences={preferences} away={away} outside={outside} cleanerId={newForm.cleanerId} />

          {/* ACHU-046: Show selected cleaner details */}
          {selectedCleaner && (
            <div className="bg-muted/30 rounded-md p-2 text-xs space-y-0.5">
              <p className="font-medium text-muted-foreground">Cleaner Details</p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {selectedCleaner.phone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" />{selectedCleaner.phone}</span>}
                {selectedCleaner.email && <span className="flex items-center gap-0.5 min-w-0"><Mail className="h-3 w-3 shrink-0" /><span className="break-all">{selectedCleaner.email}</span></span>}
                <span>Active: {selectedCleaner.active ? 'Yes' : 'No'}</span>
              </div>
              {!selectedCleaner.active && (
                <p className="text-destructive flex items-center gap-1 mt-1"><AlertTriangle className="h-3 w-3" />This cleaner is inactive</p>
              )}
            </div>
          )}

          <div><Label htmlFor="jobassignm-assignment-role-2" className="text-xs">Assignment Role</Label>
            <Select value={newForm.assignmentRole} onValueChange={v => setNewForm(f => ({ ...f, assignmentRole: v }))}>
              <SelectTrigger id="jobassignm-assignment-role-2" className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* ACHU-046: Assigned Date visible during creation */}
          <div><Label htmlFor="jobassignm-assigned-date-2" className="text-xs">Assigned Date</Label>
            <DateField id="jobassignm-assigned-date-2" className="h-8 text-sm" value={newForm.assignedDate} onChange={e => setNewForm(f => ({ ...f, assignedDate: e.target.value }))} />
          </div>

          <div><Label htmlFor="jobassignm-notes-2" className="text-xs">Notes</Label>
            <Textarea id="jobassignm-notes-2" className="text-sm" rows={2} value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} placeholder="Assignment notes..." />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving || !newForm.cleanerId}>{saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Saving</> : <><Plus className="h-3.5 w-3.5 mr-1" />Assign</>}</Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      ) : available.length > 0 ? (
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}><Plus className="h-3.5 w-3.5 mr-1" />Add Cleaner</Button>
      ) : assignments.length > 0 ? (
        <p className="text-xs text-muted-foreground">All active cleaners are assigned</p>
      ) : null}
    </div>
  );
}

