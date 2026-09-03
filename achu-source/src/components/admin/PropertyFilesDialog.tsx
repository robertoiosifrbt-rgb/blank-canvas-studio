/**
 * ACHU-581 (`Backlog_Functionalitati_Viitoare` §5, Grupul F) — POZE ȘI DOCUMENTE PE CASĂ.
 *
 * ─── 🔴 DECIZIILE LUI ROBERTO, 14/08/2026 ─────────────────────────────────────
 * *„Da"* — se construiește · **„doar biroul"** le vede · *„aceeași regulă"* pentru documente.
 *
 * ⛔ **Deci ecranul ăsta e singurul loc din aplicație unde apar.** Nu pe cardul curățătorului,
 * nu în portalul clientului — și e contrariul grupurilor B–E, construite tocmai ca să ajungă la
 * omul de la ușă. Pozele sunt din **interiorul casei cuiva**: un telefon pierdut ar fi un
 * incident de date, nu o neplăcere.
 *
 * 🔴 **Spus pe ecran**, ca la nota biroului: cine încarcă trebuie să știe cine citește.
 *
 * ⚠️ **Dialog separat, nu încă 150 de rânduri în `CustomerPropertiesSection.tsx`** — acela e
 * aproape de clichetul lui de mărime, iar felia asta are propriile stări (încărcare, eroare).
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Image, FileText, Trash2, Loader2, Upload, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { fmtDate } from '@/lib/format';
import { getPropertyFiles, uploadPropertyFile, deletePropertyFile } from '@/lib/endpoints';
import type { PropertyFileList, PropertyFileKind } from '@/lib/propertyTypes';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { errMsg } from '@/lib/errorMessage';
import { prepareImageForUpload } from '@/lib/imageCompression';

/**
 * ⚠️ **Aceeași cifră ca pe server** (`PROPERTY_FILE_MAX_BYTES`) — verificată și aici ca omul să
 * afle **înainte** de a aștepta încărcarea unui fișier de 40 MB care va fi refuzat.
 * ⛔ Nu ÎNLOCUIEȘTE verificarea de pe server; o dublează, ca ecranul să fie politicos.
 */
const MAX_BYTES = 10 * 1024 * 1024;

const KINDS: { key: PropertyFileKind; label: string; accept: string; icon: typeof Image }[] = [
  { key: 'Photo', label: 'Photos', accept: '.jpg,.jpeg,.png,.webp,.heic', icon: Image },
  { key: 'Document', label: 'Documents', accept: '.pdf,.jpg,.jpeg,.png,.doc,.docx', icon: FileText },
];

export default function PropertyFilesDialog({ propertyId, label, open, onClose }: {
  propertyId: string;
  label: string;
  open: boolean;
  onClose: () => void;
}) {
  const req = useTrackedRequest<PropertyFileList>({ timeoutMs: 30000 });
  const [busyKind, setBusyKind] = useState<PropertyFileKind | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const { fire } = req;
  const load = useCallback(() => {
    if (open && propertyId) fire(() => getPropertyFiles({ propertyId }));
  }, [fire, open, propertyId]);

  useEffect(() => { load(); }, [load]);

  const files = req.data?.records ?? [];

  const pick = async (kind: PropertyFileKind, file: File | undefined) => {
    if (!file || busyKind) return;
    setBusyKind(kind);
    try {
      /**
       * ⚠️ base64, ca la celelalte încărcări din aplicație — `readAsDataURL` întoarce prefixul
       * `data:...;base64,`, iar serverul îl acceptă cu sau fără el.
       *
       * 🔴 **MICȘORATĂ ÎNTÂI, dar numai dacă e poză (§32, Sesiunea 147).** ⛔ Aici ajung și PDF-uri
       * (contracte, planuri), iar acelea trec neatinse: decizia stă în `prepareImageForUpload`.
       */
      const { dataUrl: fileData, bytes } = await prepareImageForUpload(file);
      if (bytes > MAX_BYTES) {
        toast.error('That file is larger than 10MB, even after shrinking it. Send the PDF instead, or photograph it at a smaller size.');
        return;
      }
      await uploadPropertyFile({ propertyId, kind, filename: file.name, fileData });
      load();
    } catch (e) {
      // Mesajul serverului AȘA CUM E: el spune ce se poate face în loc.
      toast.error(errMsg(e) || 'Could not add that file.');
    } finally {
      setBusyKind(null);
      // ⚠️ Golit, ca alegerea aceluiași fișier a doua oară să declanșeze din nou `onChange`.
      const el = inputs.current[kind];
      if (el) el.value = '';
    }
  };

  const remove = async (id: string) => {
    try {
      await deletePropertyFile({ id });
      load();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not remove that file.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-4 w-4" aria-hidden="true" />
            Photos and documents for {label}
          </DialogTitle>
          <DialogDescription>
            “Before” photos, contracts, certificates, appliance manuals.
          </DialogDescription>
        </DialogHeader>

        {/*
          🔴 Promisiunea, scrisă pe ecran. Cine încarcă o poză din dormitorul cuiva trebuie să
          știe unde ajunge — iar răspunsul, decis pe 14/08/2026, e „nicăieri".
        */}
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2 text-xs flex items-start gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <strong>Office only.</strong> These are never shown to the customer and never sent to
            a cleaner’s phone — they are photos of the inside of someone’s home.
          </span>
        </p>

        {!req.data && !req.error && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading…
          </div>
        )}

        {req.error && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">Could not load the files for this property.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => req.retry()}>Try again</Button>
          </div>
        )}

        {req.data && (
          <div className="space-y-4">
            {KINDS.map(({ key, label: groupLabel, accept, icon: Icon }) => {
              const mine = files.filter(f => f.kind === key);
              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />{groupLabel}
                    </Label>
                    <Button
                      type="button" size="sm" variant="outline"
                      disabled={busyKind !== null}
                      onClick={() => inputs.current[key]?.click()}
                    >
                      {busyKind === key
                        ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        : <Upload className="h-4 w-4" aria-hidden="true" />}
                      <span className="ml-1">Add</span>
                    </Button>
                    <Input
                      ref={el => { inputs.current[key] = el; }}
                      type="file"
                      accept={accept}
                      aria-label={`Add ${groupLabel.toLowerCase()}`}
                      className="hidden"
                      onChange={e => pick(key, e.target.files?.[0])}
                    />
                  </div>

                  {mine.length === 0 && <p className="text-xs text-muted-foreground">None yet.</p>}

                  {mine.map(f => (
                    <div key={f.id} className="flex items-center gap-2 rounded border px-2 py-1">
                      <div className="min-w-0 flex-1">
                        {/*
                          ⚠️ Link doar când serverul a putut semna. O semnare eșuată desenează
                          numele fără link, în loc să albească ecranul — aceeași alegere ca la
                          pozele de vizită.
                        */}
                        {f.signedUrl ? (
                          <a
                            href={f.signedUrl} target="_blank" rel="noreferrer"
                            className="text-sm underline break-words"
                          >
                            {f.label || f.originalName || `File #${f.reference}`}
                          </a>
                        ) : (
                          <span className="text-sm break-words">{f.label || f.originalName || `File #${f.reference}`}</span>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {fmtDate(f.uploadedAt)}{f.uploadedBy ? ` · ${f.uploadedBy}` : ''}
                        </p>
                      </div>
                      <Button
                        type="button" variant="ghost" size="sm"
                        aria-label={`Remove ${f.label || f.originalName || `file ${f.reference}`}`} title={`Remove ${f.label || f.originalName || `file ${f.reference}`}`}
                        onClick={() => remove(f.id)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* ⚠️ Limita spusă, nu descoperită la al patruzeci-și-unulea fișier. */}
            <p className="text-[11px] text-muted-foreground">
              {files.length} of {req.data.limit} files · up to 10MB each.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

