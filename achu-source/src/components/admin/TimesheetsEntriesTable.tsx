import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Inbox, Check, X, Undo2, Trash2, Pencil } from 'lucide-react';
import { KIND_LABEL, type Entry } from '@/lib/timesheetsFormat';

const STATUS_STYLE: Record<string, string> = {
  Approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  Draft: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  Disputed: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
};

export default function TimesheetsEntriesTable({
  entries, busy, onApprove, onReopen, onDispute, onEditClick, onDelete,
}: {
  entries: Entry[];
  busy: boolean;
  onApprove: (id: string) => void;
  onReopen: (id: string) => void;
  onDispute: (e: Entry) => void;
  onEditClick: (e: Entry) => void;
  onDelete: (entry: Entry) => void;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        {entries.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No hours recorded for this person in this period.
          </div>
        ) : (
          <div tabIndex={0} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3">Date</th>
                  <th scope="col" className="py-2 pr-3">Times</th>
                  <th scope="col" className="py-2 pr-3">Break</th>
                  <th scope="col" className="py-2 pr-3">Hours</th>
                  <th scope="col" className="py-2 pr-3">What</th>
                  <th scope="col" className="py-2 pr-3">Status</th>
                  <th scope="col" className="py-2" />
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  /**
                   * 🔴 ACHU-498 — RÂNDUL ȘTERS RĂMÂNE LA VEDERE (Roberto, 15/08/2026:
                   * „da, sa ramana urma"). Înainte dispărea din tabel, iar singura urmă
                   * rămânea în Audit History, unde nu se uită nimeni: o intrare ștearsă
                   * din greșeală însemna o zi neplătită pe care n-o observa nimeni.
                   *
                   * ⚠️ Tăiat ȘI stins, nu doar tăiat: pe un tabel plin, o linie subțire
                   * trece neobservată la citirea rapidă, iar rândul ăsta trebuie să se
                   * citească drept „nu mai e", nu drept „încă unul".
                   */
                  <tr
                    key={e.id}
                    className={`border-b last:border-0 align-top ${e.isDeleted ? 'line-through opacity-55' : ''}`}
                  >
                    <td className="py-2 pr-3 whitespace-nowrap">{e.workDate}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{e.startTime}–{e.finishTime}</td>
                    <td className="py-2 pr-3">
                      {e.breakMinutes ? `${e.breakMinutes}m` : '—'}
                      {/*
                        🔴 §17 (Sesiunea 151) — CÂND a fost pauza, sub cât a ținut. ⚠️ Minutele de
                        deasupra sunt cele care scad din plată; ora e pentru o dispută de peste șase
                        luni. ⛔ Când cele două nu se potrivesc, serverul pune un avertisment în lista
                        de lângă ore — nu se corectează nimic aici.
                      */}
                      {e.pauseStart && e.pauseEnd && (
                        <span className="block text-xs text-muted-foreground">{e.pauseStart}–{e.pauseEnd}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-medium whitespace-nowrap">
                      {e.workedHours}h
                      {/*
                        🔴 ACHU-498, gaura 4 — ce e NEOBIȘNUIT la orele astea, lângă chiar cifra
                        despre care e vorba. ⛔ **Un avertisment, nu un blocaj**: câte ore poate
                        revendica cineva e o regulă de business, iar cleanerul nu-și mai poate
                        corecta singur orele — un refuz nou i-ar bloca ore reale fără nicio ieșire.
                        ⚠️ Serverul trimite `[]` când nu e nimic de spus, deci aici nu e niciun caz
                        de tratat: un semn care apare pe fiecare rând nu se mai citește.
                      */}
                      {(e.warnings ?? []).map((w: { code: string; message: string }) => (
                        <span
                          key={w.code}
                          className="mt-1 block rounded border-l-2 border-orange-400 bg-orange-50 px-2 py-1 text-xs font-normal dark:bg-orange-950"
                        >
                          {w.message}
                        </span>
                      ))}
                    </td>
                    <td className="py-2 pr-3">
                      {KIND_LABEL[e.kind] ?? e.kind}
                      {e.job && <span className="block text-xs text-muted-foreground">#{e.job.reference} {e.job.service}</span>}
                      {/* ACHU-498: a cleaner can no longer change their own figures, so this note
                          is the only thing they can say about them. Shown as a marked quote rather
                          than another line of grey text — it now blocks approval until it is read,
                          and something that blocks a button has to look different from a caption. */}
                      {e.notes && (
                        <span className="mt-1 block rounded border-l-2 border-amber-400 bg-amber-50 px-2 py-1 text-xs dark:bg-amber-950">
                          <strong>Note from the cleaner:</strong> {e.notes}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge className={STATUS_STYLE[e.status] ?? ''}>{e.status}</Badge>
                      {e.status === 'Approved' && e.approvedBy && (
                        <span className="block text-xs text-muted-foreground">by {e.approvedBy}</span>
                      )}
                      {e.disputeReason && (
                        <span className="block text-xs text-red-700 dark:text-red-400">{e.disputeReason}</span>
                      )}
                      {/*
                        🔴 §17 (Sesiunea 151) — DE CE au fost redeschise ore deja aprobate. ⚠️ Pe rândul
                        însuși, ca „cine le-a șters" de mai jos: întrebarea de peste un an e „de ce am
                        fost plătit 6 ore și nu 7", iar un răspuns aflat în alt ecran nu e căutat.
                      */}
                      {e.correctionReason && (
                        <span className="mt-1 block rounded border-l-2 border-sky-400 bg-sky-50 px-2 py-1 text-xs dark:bg-sky-950">
                          <strong>Reopened:</strong> {e.correctionReason}
                        </span>
                      )}
                      {/* ⚠️ „De cine și când" pe rândul însuși, nu într-un ecran separat:
                          întrebarea care urmează după „unde s-au dus orele Mariei?" e
                          întotdeauna „cine le-a șters", iar un răspuns aflat în alt loc e
                          un răspuns pe care nimeni nu-l caută. Motivul apare doar dacă a
                          fost scris — e opțional, deliberat. */}
                      {e.isDeleted && (
                        <span className="mt-1 block rounded border-l-2 border-slate-400 bg-slate-100 px-2 py-1 text-xs no-underline opacity-100 dark:bg-slate-800">
                          <strong>Deleted</strong> {e.deletedAt} by {e.deletedBy ?? 'unknown'}
                          {e.deletionReason && <span className="block">{e.deletionReason}</span>}
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1 justify-end">
                        {/* ⛔ Un rând șters nu mai are nicio acțiune. Serverul le refuză pe
                            toate oricum; butoanele ar promite ceva ce nu se poate. */}
                        {e.isDeleted && (
                          <span className="text-xs text-muted-foreground no-underline">no actions</span>
                        )}
                        {!e.isDeleted && e.status !== 'Approved' && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => onApprove(e.id)} title={e.notes ? 'This entry has a note — you will be asked to read it first' : undefined}>
                            <Check className="h-4 w-4 mr-1" />Approve
                          </Button>
                        )}
                        {!e.isDeleted && e.status === 'Approved' && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => onReopen(e.id)}>
                            <Undo2 className="h-4 w-4 mr-1" />Reopen
                          </Button>
                        )}
                        {!e.isDeleted && e.status !== 'Disputed' && (
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDispute(e)}>
                            <X className="h-4 w-4 mr-1" />Dispute
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" disabled={busy || e.isDeleted || e.status === 'Approved'}
                          title={e.status === 'Approved' ? 'Reopen it first — changing an agreed figure is a decision, and it gets recorded as one.' : undefined}
                          onClick={() => onEditClick(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy || e.isDeleted || e.status === 'Approved'}
                          title={e.status === 'Approved' ? 'Approved hours cannot be deleted — somebody may already have been paid on them.' : undefined}
                          onClick={() => onDelete(e)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

