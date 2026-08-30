/**
 * §33 „Document management" (Sesiunea 161) — HÂRTIILE, PE ORICE ECRAN.
 *
 * 🔴 **O SINGURĂ SECȚIUNE PENTRU TOATE PATRU** (firmă · vizită · ofertă · factură), fiindcă
 * rubricile sunt identice — fel, etichetă, fișier, cine l-a pus, când expiră. ⛔ Patru componente ar
 * fi însemnat patru locuri în care se repară aceeași greșeală, iar bugetul de pachete e la 978 din
 * 1000 kB (ACHU-808): al doilea ecran ar fi costat cât primul.
 *
 * 🔴 **ADMIN-ONLY, și e răspunsul deja dat, nu unul nou.** Roberto, 14/08/2026, întrebat cine vede
 * fișierele casei: **„doar biroul"**. ⚠️ Spus pe ecran, ca la nota biroului: cine încarcă trebuie să
 * știe cine citește. ⛔ Rândul „Access permissions" din §33 — *cine vede ce document* — e o hotărâre
 * de owner, deci până la ea poarta rămâne strâmtă.
 *
 * ⚠️ **Expirarea se CALCULEAZĂ la desenare**, nu se citește dintr-o coloană: o stare „expirat"
 * scrisă în bază e adevărată doar în ziua în care a fost scrisă (aceeași hotărâre ca la hârtiile
 * curățătorului).
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Trash2, Loader2, Upload, ShieldCheck, Download } from 'lucide-react';
import { toast } from 'sonner';
import { fmtDate } from '@/lib/format';
import { getDocuments, uploadDocument, deleteDocument, downloadDocument } from '@/lib/documentEndpoints';
import { DOCUMENT_KINDS, DOCUMENT_ACCEPT, type DocumentList, type DocumentScope, type DocumentRecord } from '@/lib/documentTypes';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { errMsg } from '@/lib/errorMessage';

/**
 * ⚠️ **Aceeași cifră ca pe server**, verificată și aici ca omul să afle **înainte** de a aștepta
 * încărcarea unui fișier care va fi refuzat. ⛔ Nu ÎNLOCUIEȘTE verificarea de pe server.
 */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * 🔴 **CÂT DE DEVREME SE ANUNȚĂ O EXPIRARE — 30 de zile, și e o alegere de ECRAN, nu o regulă.**
 * ⛔ Nu blochează nimic și nu trimite nimănui nimic: doar colorează un rând. ⚠️ „Cu cât timp înainte
 * vrei să știi" e o hotărâre de operare — când owner-ul o dă, se mută pe server, unde poate porni un
 * anunț. Până atunci, un prag care doar atrage privirea nu obligă pe nimeni la nimic.
 */
const EXPIRING_SOON_DAYS = 30;

function expiryState(iso: string | null): 'none' | 'valid' | 'soon' | 'expired' {
  if (!iso) return 'none';
  const when = new Date(iso).getTime();
  if (Number.isNaN(when)) return 'none';
  const now = Date.now();
  if (when <= now) return 'expired';
  return when - now <= EXPIRING_SOON_DAYS * 86400000 ? 'soon' : 'valid';
}

export default function DocumentsSection({ scope, ownerId, title, readOnly = false }: {
  scope: DocumentScope;
  /** ⚠️ Lipsește la `Company` — restul îl cer, iar serverul refuză perechea greșită. */
  ownerId?: string | null;
  title?: string;
  /**
   * 🔴 **„A privi nu e a edita" (ACHU-519).** ⛔ Dialogul unei vizite deschis în citire dezactivează
   * **fiecare** câmp, iar secțiunea asta n-avea voie să fie excepția: o hârtie încărcată dintr-un
   * ecran care spune „doar privești" e o schimbare făcută dintr-un loc care promitea că nu schimbă.
   *
   * ⚠️ **Descărcarea RĂMÂNE** — a citi un document e chiar ce face cineva care privește. Ce dispare
   * e adăugarea și ștergerea.
   */
  readOnly?: boolean;
}) {
  const req = useTrackedRequest<DocumentList>({ timeoutMs: 30000 });
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<string>('Other');
  const [label, setLabel] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const input = useRef<HTMLInputElement | null>(null);

  const { fire } = req;
  const load = useCallback(() => {
    if (scope !== 'Company' && !ownerId) return;
    fire(() => getDocuments({ scope, ownerId }));
  }, [fire, scope, ownerId]);

  useEffect(() => { load(); }, [load]);

  const records = req.data?.records ?? [];

  const pick = async (file: File | undefined) => {
    if (!file || busy) return;
    if (file.size > MAX_BYTES) {
      toast.error(`That file is too large (limit ${Math.round(MAX_BYTES / 1024 / 1024)} MB).`);
      return;
    }
    setBusy(true);
    try {
      // ⚠️ base64, ca la celelalte încărcări; serverul acceptă cu sau fără prefixul `data:`.
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('That file could not be read.'));
        reader.readAsDataURL(file);
      });
      await uploadDocument({
        scope, ownerId, kind, filename: file.name, fileData,
        label: label.trim() || null,
        expiryDate: expiryDate || null,
      });
      toast.success('Document added');
      setLabel(''); setExpiryDate('');
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  /**
   * 🔴 **Descărcarea trece prin server, deși lista are deja un link semnat.** ⚠️ Linkul din listă se
   * naște la deschiderea ecranului, pentru toate rândurile deodată — deci nu spune nimic despre ce a
   * luat cineva. ⛔ Rândul de „Download history" se scrie când un om apasă pe **acest** document.
   */
  const open = async (row: DocumentRecord) => {
    try {
      const res = await downloadDocument({ id: row.id });
      window.open(res.signedUrl, '_blank', 'noopener');
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const remove = async (row: DocumentRecord) => {
    if (!window.confirm(`Remove “${row.label || row.kindLabel}”? The file is deleted from storage as well.`)) return;
    try {
      await deleteDocument({ id: row.id });
      toast.success('Document removed');
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title ?? 'Documents'}</h3>
        {/* 🔴 Cine citește — spus pe ecran, ca la fișierele casei. */}
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          Office only
        </p>
      </div>

      {!readOnly && (<>
      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <Label htmlFor={`doc-kind-${scope}`} className="text-xs">Type</Label>
          <select
            id={`doc-kind-${scope}`}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={kind}
            onChange={e => setKind(e.target.value)}
          >
            {DOCUMENT_KINDS.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor={`doc-label-${scope}`} className="text-xs">Label (optional)</Label>
          <Input
            id={`doc-label-${scope}`}
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Policy 2026"
            maxLength={120}
          />
        </div>
        <div>
          {/* ⚠️ Opțional, deliberat: un contract nu expiră, o poliță da. */}
          <Label htmlFor={`doc-expiry-${scope}`} className="text-xs">Expires (optional)</Label>
          <Input
            id={`doc-expiry-${scope}`}
            type="date"
            value={expiryDate}
            onChange={e => setExpiryDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <input
          ref={input}
          type="file"
          accept={DOCUMENT_ACCEPT}
          className="sr-only"
          id={`doc-file-${scope}`}
          onChange={e => pick(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {busy ? 'Uploading…' : 'Add document'}
        </Button>
      </div>
      </>)}

      {req.loading ? (
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : req.error ? (
        <p className="text-sm text-destructive">{errMsg(req.error)}</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents yet.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {records.map(row => {
            const state = expiryState(row.expiryDate);
            return (
              <li key={row.id} className="flex items-center gap-3 p-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{row.label || row.originalName || row.kindLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.kindLabel} · {fmtDate(row.uploadedAt)}
                    {row.uploadedBy ? ` · ${row.uploadedBy}` : ''}
                    {row.expiryDate && (
                      <span className={state === 'expired' ? 'text-destructive' : state === 'soon' ? 'text-amber-600' : ''}>
                        {' · '}
                        {state === 'expired' ? 'expired ' : 'expires '}
                        {fmtDate(row.expiryDate)}
                      </span>
                    )}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => open(row)} aria-label={`Download ${row.label || row.kindLabel}`}>
                  <Download className="h-4 w-4" />
                </Button>
                {!readOnly && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(row)} aria-label={`Remove ${row.label || row.kindLabel}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

