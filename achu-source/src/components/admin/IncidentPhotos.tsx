/**
 * §32 „Incident evidence" (Sesiunea 147) — DOVADA UNUI INCIDENT, pe ecranul biroului.
 *
 * ─── 🔴 CE LIPSEA ───────────────────────────────────────────────────────────
 * Un incident avea felul lui și o descriere scrisă. ⛔ Un obiect spart sau o pată pe o canapea
 * erau **afirmații, nu dovezi** — iar incidentele sunt exact locul unde cuvântul cuiva se
 * confruntă cu cuvântul altcuiva: clientul spune că vaza era întreagă, curățătorul spune că era
 * deja crăpată. Fără poză, biroul alege pe cine crede.
 *
 * ─── ⛔ DE CE UN FIȘIER PROPRIU ─────────────────────────────────────────────
 * `IncidentsPage.tsx` are 396 de rânduri, iar plafonul e 500. ⚠️ Dovada e o responsabilitate cu
 * încărcare, ștergere și stare proprie; lipită în pagină, ar fi dus-o peste prag în aceeași felie
 * (`AGENT_RULES` §7.4).
 *
 * ─── ⚠️ SE ÎNCARCĂ LA CERERE, NU LA MONTARE ─────────────────────────────────
 * Lista de incidente poate avea zeci de rânduri. ⛔ O cerere de poze pe fiecare ar fi zeci de
 * cereri la deschiderea ecranului, din care majoritatea pentru dosare pe care nimeni nu le
 * deschide. Aceeași alegere ca la poza de checklist a curățătorului.
 */
import { useState } from 'react';
import { Camera, Loader2, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  getIncidentPhotos, addIncidentPhoto, deleteIncidentPhoto, type IncidentPhoto,
} from '@/lib/endpoints';
import { errMsg } from '@/lib/errorMessage';
import { prepareImageForUpload } from '@/lib/imageCompression';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function IncidentPhotos({ incidentId, incidentNumber }: {
  incidentId: string;
  /** Numărul citit de om, pentru etichetele cititoarelor de ecran. */
  incidentNumber: number;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<IncidentPhoto[] | null>(null);
  const [canAdd, setCanAdd] = useState(false);
  const [caption, setCaption] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const res = await getIncidentPhotos(incidentId);
      setPhotos(res.records);
      setCanAdd(res.canAdd);
    } catch (e) {
      toast.error(errMsg(e) || 'Could not load the photographs for this incident.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (photos === null) await load();
  };

  const add = async (file: File) => {
    setBusy(true);
    try {
      /**
       * 🔴 **MICȘORATĂ ÎNTÂI** (§32, aceeași sesiune). Biroul atașează des o poză trimisă de
       * client pe WhatsApp sau făcută de curățător — adică o poză de telefon, care trece de 10 MB.
       * ⚠️ O poză deja mică se citește neatinsă: vezi `lib/imageCompression.ts`.
       */
      const { dataUrl, bytes } = await prepareImageForUpload(file);
      if (bytes > 10 * 1024 * 1024) {
        toast.error('That photograph is too large to attach, even after shrinking it. Please choose another.');
        return;
      }
      await addIncidentPhoto(incidentId, { imageData: dataUrl, description: caption.trim() || undefined });
      setCaption('');
      // ⚠️ Reîncărcat de la server, nu împins local: `canAdd` e al lui, iar plafonul se poate fi atins.
      await load();
    } catch (e) {
      // Mesajul serverului AȘA CUM E: el spune plafonul, tipul acceptat, sau că depozitul tace.
      toast.error(errMsg(e) || 'Could not attach that photograph.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (photoId: string) => {
    setBusy(true);
    try {
      await deleteIncidentPhoto(incidentId, photoId);
      await load();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not remove that photograph.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-2">
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground underline"
        aria-expanded={open}
        onClick={toggle}
      >
        {open ? 'Hide evidence' : `Evidence${photos ? ` (${photos.length})` : ''}`}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {busy && photos === null && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Loading…
            </p>
          )}

          {photos?.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              No photographs attached. A broken item or a stain is easier to settle with one.
            </p>
          )}

          {!!photos?.length && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map(p => (
                <div key={p.id} className="space-y-1">
                  {p.signedUrl ? (
                    /*
                      ⚠️ Mărimea întreagă într-un tab nou, ca la celelalte galerii: miniatura e
                      tăiată de `object-cover`, iar o zgârietură pe marginea unui obiect stă exact
                      acolo unde se taie. Linkul e semnat și expiră.
                    */
                    <a
                      href={p.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                      aria-label={p.description
                        ? `Open the full-size photograph: ${p.description}`
                        : `Open a full-size photograph from incident #${incidentNumber}`}
                    >
                      <img
                        src={p.signedUrl}
                        alt={p.description || `Evidence from incident #${incidentNumber}`}
                        className="aspect-square w-full rounded-md object-cover"
                      />
                    </a>
                  ) : (
                    /* ⛔ Semnarea a eșuat. Spus cu voce tare, nu arătat ca imagine ruptă. */
                    <div className="flex aspect-square w-full items-center justify-center rounded-md bg-muted text-center">
                      <AlertCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <span className="sr-only">Photograph unavailable right now</span>
                    </div>
                  )}
                  {p.description && (
                    <p className="line-clamp-2 text-[10px] text-muted-foreground">{p.description}</p>
                  )}
                  {/* ⚠️ Cine a atașat dovada e parte din dovadă. */}
                  {p.uploadedBy && (
                    <p className="line-clamp-1 text-[10px] text-muted-foreground/70">{p.uploadedBy}</p>
                  )}
                  <button
                    type="button"
                    className="text-[10px] text-destructive hover:underline disabled:opacity-60"
                    aria-label={`Remove this photograph from incident #${incidentNumber}`}
                    onClick={() => void remove(p.id)}
                    disabled={busy}
                  >
                    <Trash2 className="mr-0.5 inline h-3 w-3" aria-hidden="true" />Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {photos !== null && canAdd && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Input
                className="h-8 max-w-xs text-xs"
                placeholder="What the photo shows (optional)"
                aria-label="What the photograph shows"
                value={caption}
                onChange={e => setCaption(e.target.value.slice(0, 500))}
                disabled={busy}
                maxLength={500}
              />
              <Button asChild size="sm" variant="outline" className="h-8 text-xs" disabled={busy}>
                <label className="cursor-pointer">
                  {busy
                    ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    : <Camera className="mr-1 h-3.5 w-3.5" aria-hidden="true" />}
                  Attach photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    aria-label={`Attach a photograph to incident #${incidentNumber}`}
                    disabled={busy}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void add(f);
                    }}
                  />
                </label>
              </Button>
            </div>
          )}

          {photos !== null && !canAdd && photos.length > 0 && (
            /* ⚠️ Absența butonului se EXPLICĂ: altfel arată ca un defect. */
            <p className="text-[10px] text-muted-foreground">
              This incident holds the maximum number of photographs. Remove one to attach another.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

