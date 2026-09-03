/**
 * ACHU-569 — registrul de incidente (`Backlog_Functionalitati_Viitoare` §29).
 *
 * ⚠️ **Un incident nu e o reclamație.** O reclamație vine de la client și îi datorezi un
 * răspuns; un incident îl deschide firma, adesea despre ceva ce clientul nu a văzut.
 *
 * 🔴 **Avertismentul legal vine de la SERVER** (`legalNote`), nu se compune aici — altfel
 * ecranul ar putea rămâne cu un text vechi despre o obligație care s-a schimbat.
 */
import { useState, useEffect, useCallback } from 'react';
import IncidentPhotos from './IncidentPhotos';
// 🔴 §29 (Sesiunea 150) — dosarul: ce s-a făcut, ce s-a aflat, ce s-a schimbat, cât a costat.
import IncidentDossier from './IncidentDossier';
// §29 „Audit history" (Sesiunea 150) — cine a atins dosarul, pe dosar. ⚠️ Se încarcă la cerere.
import AuditHistory from './AuditHistory';
// §43 „Related incident" (Sesiunea 150) — munca de urmărire, notată de pe dosar.
import TaskComposer from './TaskComposer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Plus, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import DateField from '@/components/shared/DateField';
import { getIncidents, createIncident, closeIncident, type IncidentRecord } from '@/lib/endpoints';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { errMsg } from '@/lib/errorMessage';
import { fmtDate } from '@/lib/format';

type Option = { value: string; label: string; reportable?: boolean; legalNote?: string | null };

/**
 * 🔴 **UN SINGUR TIP, nu o copie a lui** (Sesiunea 150). Pagina își declara propria formă de rând,
 * identică cu cea din catalogul de endpointuri — deci un câmp nou trebuia adăugat în două locuri, iar
 * cele două ar fi rămas în urmă una față de alta (`CLAUDE.md` §3.1b). ⚠️ Măsurat chiar aici: dosarul
 * de §29 a adăugat opt câmpuri.
 */
type IncidentRow = IncidentRecord;

const SEVERITY_STYLE: Record<string, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  low: 'bg-muted text-muted-foreground',
};

export default function IncidentsPage() {
  /** Tiparul casei pentru încărcare (`useTrackedRequest`), ca la celelalte ecrane de birou. */
  const req = useTrackedRequest<{
    records: IncidentRow[]; openCount: number;
    /** 🔴 ACHU-694 — propoziția care spune că lista e TĂIATĂ, compusă pe server (`lib/listCap.ts`). */
    listNote?: string | null;
    options: { kinds: Option[]; severities: Option[] };
    breakdown: {
      total: number; open: number; openReportable: number; closedReportableWithoutRecord: number;
      /** §29 — dosare grave închise fără să scrie nimeni ce s-a aflat sau ce s-a schimbat. */
      closedSeriousWithoutFollowUp: number;
    };
  }>({ timeoutMs: 30000 });
  const [status, setStatus] = useState('Open');
  const [opening, setOpening] = useState(false);
  const [closingRow, setClosingRow] = useState<IncidentRow | null>(null);

  // ⚠️ `fire` destructurat, nu `req.fire`: altfel `exhaustive-deps` cere tot obiectul `req`
  // ca dependență, iar clichetul de lint e EXACT (`CLAUDE.md` §2.1a).
  const { fire } = req;
  const load = useCallback(() => {
    fire(() => getIncidents(status === 'All' ? {} : { status }));
  }, [fire, status]);

  useEffect(() => { load(); }, [load]);

  const data = req.data;
  const error = req.error;
  const records = data?.records ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Incidents</h2>
          <p className="text-sm text-muted-foreground">
            Things that went wrong on a job — damage, injury, a lost key. Opened by the office.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36" aria-label="Filter by status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
              <SelectItem value="All">All</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setOpening(true)}><Plus className="h-4 w-4 mr-1.5" />Record an incident</Button>
        </div>
      </div>

      {/*
        🔴 ACHU-694 — cifrele de sus se numără în bază, deci pot depăși pagina. ⛔ Atunci lista
        tăiată trebuie să o spună, altfel „12 open" lângă 200 de rânduri pare o nepotrivire.
      */}
      {data?.listNote && <p className="text-xs text-muted-foreground">{data.listNote}</p>}

      {/*
        🔴 Cele două cifre stau ÎMPREUNĂ, ca la reclamații (ACHU-563): doar „câte sunt
        deschise" arată curat exact în ziua în care cineva a închis tot, fără să scrie dacă a
        raportat. A doua cifră e măsura calității registrului însuși.
      */}
      {data && (data.breakdown.openReportable > 0 || data.breakdown.closedReportableWithoutRecord > 0
        || data.breakdown.closedSeriousWithoutFollowUp > 0) && (
        <Card className="border-amber-500/40">
          <CardContent className="p-4 space-y-1">
            <p className="text-sm font-medium flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" />Needs a decision
            </p>
            {data.breakdown.openReportable > 0 && (
              <p className="text-sm">
                <span className="font-medium text-amber-700 dark:text-amber-400">{data.breakdown.openReportable}</span> open
                {' '}with a possible legal duty to report.
              </p>
            )}
            {data.breakdown.closedReportableWithoutRecord > 0 && (
              <p className="text-sm text-muted-foreground">
                {data.breakdown.closedReportableWithoutRecord} closed without recording whether it was reported — that is not
                proof anything was missed, but nobody wrote that they checked.
              </p>
            )}
            {/*
              🔴 §29 (Sesiunea 150) — a treia cifră, aceeași formă ca a doua: registrul arată cel mai
              curat exact în luna în care s-a închis tot pe fugă. ⛔ Nu e o acuzație — poate n-a fost
              nimic de aflat — dar peste un an diferența dintre cele două nu se mai poate face.
            */}
            {data.breakdown.closedSeriousWithoutFollowUp > 0 && (
              <p className="text-sm text-muted-foreground">
                {data.breakdown.closedSeriousWithoutFollowUp} serious {data.breakdown.closedSeriousWithoutFollowUp === 1 ? 'one was' : 'ones were'}
                {' '}closed with nothing written about what was found out or put right.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2" role="alert">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive flex-1">{error}</p>
          <Button size="sm" variant="outline" onClick={() => load()}>Retry</Button>
        </div>
      )}

      {!data && !error && <Skeleton className="h-24 rounded-xl" />}

      {data && records.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          No incidents {status === 'All' ? 'recorded' : `with status ${status.toLowerCase()}`}.
        </CardContent></Card>
      )}

      <div className="space-y-3">
        {records.map(r => (
          <Card key={r.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium">#{r.incidentId} — {r.kindLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(r.occurredOn)}
                    {r.customerName ? ` · ${r.customerName}` : ''}
                    {r.cleanerName ? ` · ${r.cleanerName}` : ''}
                    {r.jobLabel ? ` · ${r.jobLabel}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge className={SEVERITY_STYLE[r.severity] ?? ''}>{r.severityLabel}</Badge>
                  <Badge variant={r.status === 'Open' ? 'default' : 'outline'}>{r.status}</Badge>
                  {r.reportable && !r.reportedExternally && (
                    <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                      reporting not recorded
                    </Badge>
                  )}
                </div>
              </div>

              <p className="text-sm whitespace-pre-wrap">{r.description}</p>

              {r.status === 'Open' && r.legalNote && (
                <p className="text-xs text-amber-700 dark:text-amber-400">{r.legalNote}</p>
              )}

              {r.outcome && (
                <div className="rounded-lg bg-muted/50 px-3 py-2 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Closed{r.closedAt ? ` · ${fmtDate(r.closedAt)}` : ''}{r.closedBy ? ` · ${r.closedBy}` : ''}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{r.outcome}</p>
                  {r.customerConduct && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                      What the customer did: {r.customerConduct}
                    </p>
                  )}
                  {r.reportedExternally && (
                    <p className="text-xs text-muted-foreground">
                      Reported externally{r.reportedExternallyNote ? ` — ${r.reportedExternallyNote}` : ''}
                    </p>
                  )}
                </div>
              )}

              {/*
                §32 „Incident evidence" (Sesiunea 147). ⚠️ Arătat pe ORICE dosar, deschis sau
                închis: dovada apare des după închidere — asigurătorul cere o poză, clientul
                trimite una peste o săptămână. Motivul întreg: `lib/incidentPhotoPolicy.ts`.
              */}
              <IncidentPhotos incidentId={r.id} incidentNumber={r.incidentId} />

              {/*
                🔴 §29 (Sesiunea 150) — dosarul, pe ORICE incident, deschis sau închis: ce s-a aflat
                și cât a costat apar des după închidere. ⛔ Închis, arată ce E scris; nu cere nimic.
              */}
              <IncidentDossier record={r} onSaved={() => load()} />

              {/*
                🔴 §29 „Audit history" (Sesiunea 150) — **istoricul, pe dosarul lui.** ⛔ Rândurile se
                scriau de la ACHU-569 (deschis, închis, poze, iar de azi dosarul), dar se puteau citi
                doar pe ecranul general de audit, filtrând după tip și după id — adică nimeni nu le
                citea. ⚠️ Se încarcă la APĂSARE, ca pozele: lista poate avea zeci de rânduri, iar o
                cerere pe fiecare ar fi zeci de cereri la deschiderea ecranului.
              */}
              <AuditHistory entityType="Incident" entityId={r.id} />

              <div className="flex flex-wrap gap-2">
                {r.status === 'Open' && (
                  <Button size="sm" variant="outline" onClick={() => setClosingRow(r)}>Close this incident</Button>
                )}
                {/*
                  🔴 §43 „Related incident" (Sesiunea 150) — **munca de urmărire se notează DE AICI.**
                  ⛔ Un incident produce aproape mereu ceva de făcut („sună asigurătorul", „cere
                  factura de la atelier"), iar până azi acel ceva se scria pe lista de sarcini fără să
                  spună la ce se referă — adică peste o săptămână nimeni nu mai știa.
                  ⚠️ Arătat și pe un dosar ÎNCHIS, ca galeria de dovezi de deasupra și pentru același
                  motiv: urmărirea continuă după închidere.
                */}
                <TaskComposer
                  about={{ kind: 'incident', id: r.id, label: `incident #${r.incidentId}` }}
                  onCreated={() => toast.success('Task noted.')}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {opening && data && (
        <OpenDialog
          options={data.options}
          onClose={() => setOpening(false)}
          onSaved={() => { setOpening(false); load(); }}
        />
      )}
      {closingRow && (
        <CloseDialog
          row={closingRow}
          onClose={() => setClosingRow(null)}
          onSaved={() => { setClosingRow(null); load(); }}
        />
      )}
    </div>
  );
}

function OpenDialog({ options, onClose, onSaved }: { options: { kinds: Option[]; severities: Option[] }; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState('');
  const [severity, setSeverity] = useState('');
  const [occurredOn, setOccurredOn] = useState('');
  const [description, setDescription] = useState('');
  /**
   * §29 (Sesiunea 150) — ce s-a făcut pe loc.
   *
   * ⚠️ **Cerut aici, la deschidere, nu doar în dosar**, fiindcă e singura parte a dosarului care se
   * știe exact acum și se uită în câteva ore: cine a fost chemat, ce s-a oprit, ce s-a curățat.
   * ⛔ Opțional — uneori nu s-a putut face nimic pe loc, iar un câmp obligatoriu s-ar umple cu „n/a".
   */
  const [immediate, setImmediate] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const chosen = options.kinds.find(k => k.value === kind);

  const save = async () => {
    setSaving(true); setErr('');
    try {
      await createIncident({ kind, severity, occurredOn, description, immediateAction: immediate.trim() || null });
      toast.success('Incident recorded');
      onSaved();
    } catch (e) {
      setErr(errMsg(e) || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record an incident</DialogTitle>
          <DialogDescription>What happened, when, and how serious it was.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="incident-kind">What happened</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger id="incident-kind"><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>
                {options.kinds.map(k => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/*
            🔴 Avertismentul apare ÎNAINTE de a salva, nu după: e informația care schimbă ce
            face omul în continuare, iar pe ecranul de confirmare nu l-ar mai citi nimeni
            (lecția ACHU-561).
          */}
          {chosen?.legalNote && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-500/40 px-3 py-2">
              <p className="text-xs text-amber-800 dark:text-amber-300">{chosen.legalNote}</p>
            </div>
          )}

          <div>
            <Label htmlFor="incident-severity">How serious</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger id="incident-severity"><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>
                {options.severities.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="incident-date">When it happened</Label>
            <DateField id="incident-date" value={occurredOn} onChange={e => setOccurredOn(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="incident-description">What happened</Label>
            <Textarea id="incident-description" rows={4} value={description} onChange={e => setDescription(e.target.value)} maxLength={4000} />
          </div>

          <div>
            <Label htmlFor="incident-immediate">
              What we did straight away <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea id="incident-immediate" rows={2} value={immediate} onChange={e => setImmediate(e.target.value)} maxLength={2000} />
          </div>

          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button className="flex-1" onClick={() => void save()} disabled={saving || !kind || !severity || !occurredOn || !description.trim()}>
              {saving ? 'Saving…' : 'Record it'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CloseDialog({ row, onClose, onSaved }: { row: IncidentRow; onClose: () => void; onSaved: () => void }) {
  const [outcome, setOutcome] = useState('');
  const [conduct, setConduct] = useState('');
  const [reported, setReported] = useState(false);
  const [reportedNote, setReportedNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setSaving(true); setErr('');
    try {
      await closeIncident(row.id, {
        outcome,
        customerConduct: conduct.trim() || null,
        reportedExternally: reported,
        reportedExternallyNote: reportedNote.trim() || null,
      });
      toast.success('Incident closed');
      onSaved();
    } catch (e) {
      setErr(errMsg(e) || 'Could not close it.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Close incident #{row.incidentId}</DialogTitle>
          <DialogDescription>{row.kindLabel}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {row.legalNote && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-500/40 px-3 py-2">
              <p className="text-xs text-amber-800 dark:text-amber-300">{row.legalNote}</p>
            </div>
          )}

          <div>
            <Label htmlFor="incident-outcome">What we did</Label>
            <Textarea id="incident-outcome" rows={3} value={outcome} onChange={e => setOutcome(e.target.value)} maxLength={4000} />
          </div>

          {/* Rândul din `Backlog_Client_Prioritar`: ce a făcut CLIENTUL în incident. Opțional. */}
          <div>
            <Label htmlFor="incident-conduct">
              What the customer did <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea id="incident-conduct" rows={2} value={conduct} onChange={e => setConduct(e.target.value)} maxLength={2000} />
          </div>

          {/*
            ⛔ Bifa NU e obligatorie și NU se deduce din felul incidentului. Ce lipsește se
            NUMĂRĂ în panoul de sus, nu se impune aici — un birou care nu a decis încă trebuie
            să poată închide, iar registrul spune apoi câte s-au închis așa.
          */}
          {row.reportable && (
            <div className="rounded-lg border px-3 py-2 space-y-2">
              <div className="flex items-start gap-2">
                <Checkbox id="incident-reported" checked={reported} onCheckedChange={v => setReported(v === true)} />
                <Label htmlFor="incident-reported" className="text-sm font-normal leading-snug">
                  We reported this to somebody outside ACHU
                </Label>
              </div>
              {reported && (
                <Input
                  aria-label="Who it was reported to"
                  placeholder="Who, and when"
                  value={reportedNote}
                  onChange={e => setReportedNote(e.target.value)}
                  maxLength={2000}
                />
              )}
            </div>
          )}

          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button className="flex-1" onClick={() => void save()} disabled={saving || !outcome.trim()}>
              {saving ? 'Closing…' : 'Close it'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

