import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, MessageSquareWarning, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getJobLinkedRecords, type JobLinkedIncident, type JobLinkedRequest } from '@/lib/endpoints';
import { fmtDate } from '@/lib/format';

/**
 * §9 „Linked incident" + „Linked complaint" (Sesiunea 158) — CE S-A RAPORTAT DESPRE VIZITA ASTA.
 *
 * ─── 🔴 Ce lipsea, și de ce costa o conversație ─────────────────────────────
 * ⚠️ Legăturile existau în bază (`Incident.jobId`, `CustomerRequest.jobId`), dar ecranul vizitei avea
 * asignări, casă, checklist, extra-servicii și facturi — și **nimic** despre incidentul sau
 * reclamația de pe aceeași vizită. 🔴 Clientul sună despre marți, biroul deschide vizita de marți și
 * nu vede nimic: reclamația e pe alt ecran, incidentul pe al treilea. **Cine nu știe că există nu le
 * caută.**
 *
 * ─── ⛔ Ce NU face ──────────────────────────────────────────────────────────
 * Nu deschide, nu închide și nu schimbă nimic. ⚠️ Un rând duce la ecranul unde se lucrează dosarul
 * (§29 incidente · §20 cereri). 🔴 O a doua cale de scriere ar fi însemnat două locuri în care se
 * schimbă gravitatea unui incident.
 *
 * ─── Ce se vede când nu e nimic ─────────────────────────────────────────────
 * ⛔ **Nimic.** O vizită fără incidente și fără reclamații e cazul obișnuit, iar un „0 incidente" pe
 * fiecare vizită ar fi un rând care nu spune nimic pe toate ecranele, ca să spună ceva pe unul.
 */

/** ⚠️ Roșu numai pentru ce cere ceva de la om: un dosar ÎNCHIS nu mai cere. */
function statusTone(status: string, open: boolean): string {
  if (!open) return 'bg-muted text-muted-foreground border-border';
  return status === 'Open' || status === 'Investigating'
    ? 'bg-destructive/10 text-destructive border-destructive/30'
    : 'bg-amber-50 text-amber-800 border-amber-300';
}

const CLOSED_INCIDENT = ['Closed', 'Resolved'];
const CLOSED_REQUEST = ['Resolved', 'Declined'];

/**
 * ⚠️ **Felul se scrie cum îl citește un om**, nu cum îl scrie baza: `PauseSeries` → „Pause series".
 * ⛔ Fără un tabel de traduceri: un fel nou apărut pe server trebuie să se vadă, chiar dacă se vede
 * cu spațiu în loc de majusculă — un `Record` incomplet l-ar fi ascuns.
 */
function humanKind(kind: string): string {
  const spaced = kind.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export default function JobLinkedRecordsSection({ jobId }: { jobId: string }) {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<JobLinkedIncident[]>([]);
  const [requests, setRequests] = useState<JobLinkedRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getJobLinkedRecords({ jobId })
      .then(res => {
        if (!alive) return;
        setIncidents(res.incidents ?? []);
        setRequests(res.requests ?? []);
      })
      /**
       * ⛔ **Un eșec NU se raportează cu un toast.** Secțiunea e informativă, iar o vizită se
       * deschide de zeci de ori pe zi: o notificare de eroare peste formular ar învăța biroul să
       * închidă mesajele fără să le citească. ⚠️ Rămâne goală, exact ca o vizită fără incidente —
       * iar aceea e limita pe care o accept aici, scrisă ca să nu pară o scăpare.
       */
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [jobId]);

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground">
        <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Checking what was reported…
      </p>
    );
  }

  if (incidents.length === 0 && requests.length === 0) return null;

  return (
    <div className="space-y-1.5" data-testid="job-linked-records">
      {incidents.map(i => {
        const open = !CLOSED_INCIDENT.includes(i.status);
        return (
          <button
            key={i.id}
            type="button"
            onClick={() => navigate('/admin/incidents')}
            className="flex w-full items-start gap-2 rounded-md border border-border px-2 py-1.5 text-left text-xs hover:bg-muted/50"
            title={`Incident #${i.reference} — open the incident register`}
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">
                Incident #{i.reference} — {humanKind(i.kind)}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                {fmtDate(i.occurredOn)} · {i.severity}
                {/* ⛔ „Numește un curățător", niciodată pe cine: contextul e în dosar. */}
                {i.namesACleaner ? ' · names a cleaner' : ''}
              </span>
            </span>
            <Badge variant="outline" className={`shrink-0 text-[10px] ${statusTone(i.status, open)}`}>
              {i.status}
            </Badge>
          </button>
        );
      })}

      {requests.map(r => {
        const open = !CLOSED_REQUEST.includes(r.status);
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => navigate('/admin/customer-requests')}
            className="flex w-full items-start gap-2 rounded-md border border-border px-2 py-1.5 text-left text-xs hover:bg-muted/50"
            title={`Customer request #${r.reference} — open the requests screen`}
          >
            <MessageSquareWarning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">
                {humanKind(r.kind)} #{r.reference}
              </span>
              <span className="block text-[11px] text-muted-foreground">{fmtDate(r.createdAt)}</span>
            </span>
            <Badge variant="outline" className={`shrink-0 text-[10px] ${statusTone(r.status, open)}`}>
              {r.status}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}

