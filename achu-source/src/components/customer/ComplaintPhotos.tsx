/**
 * §32 „Complaint evidence" (Sesiunea 148) — DOVADA UNEI RECLAMAȚII, PE ECRANUL CLIENTULUI.
 *
 * ⛔ **Fișier propriu, nu cod adăugat în `CustomerRequests.tsx`:** acolo e lista cererilor, aici e
 * o responsabilitate cu starea ei (încărcare, micșorare, refuzuri, ștergere). ⚠️ Iar lista devine
 * cu **șase rânduri** mai lungă, nu cu o sută.
 *
 * ─── 🔴 O SINGURĂ CHEMARE PENTRU TOATĂ LISTA ────────────────────────────────
 * `useMyComplaintPhotos` cere pozele **tuturor** reclamațiilor odată, iar fiecare rând își filtrează
 * ale lui. ⛔ Un `useEffect` pe rând ar fi însemnat opt cereri HTTP și opt drumuri la depozit pentru
 * o pagină pe care omul o deschide o dată.
 *
 * ─── ⚠️ CE DECIDE SERVERUL, ȘI NU ECRANUL ───────────────────────────────────
 * `maxPhotos` (plafonul) și `uploadsAvailable` (dacă depozitul primește fișiere) vin din răspuns.
 * 🔴 Ecranul le folosește doar ca să **nu invite** ceva ce ar fi refuzat — ruta re-verifică oricum.
 * ⛔ Aceeași cifră scrisă și aici ar fi două surse de adevăr pentru aceeași regulă (`CLAUDE.md`
 * §3.1b), iar cea din bundle e cea care rămâne în urmă.
 */
import { useRef, useState } from 'react';
import { AlertCircle, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { prepareImageForUpload } from '@/lib/imageCompression';
import { uploadComplaintPhoto, deleteComplaintPhoto } from '@/lib/customerRequestEndpoints';
// ⛔ Hook-ul de citire stă în `lib/`, nu aici — vezi antetul lui: un fișier care exportă și o
// componentă și un hook rupe `react-refresh/only-export-components`, iar clichetul de lint e EXACT.
import type { ComplaintPhotoState } from '@/lib/useMyComplaintPhotos';

/**
 * ⚠️ Plafonul pe fișier, DUPĂ micșorare — aceeași cifră ca pe celelalte ecrane de poze (10 MB) și
 * ca pe server (`PHOTO_MAX_BYTES`). ⛔ Nu e plafonul de NUMĂR, care vine de la server: ăsta e o
 * proprietate a bucketului, iar ecranul îl verifică doar ca să nu trimită degeaba un fișier care
 * va fi refuzat.
 */
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Dovada de pe O reclamație: ce s-a trimis, plus butonul de adăugare cât timp se mai poate.
 *
 * ⚠️ `canAdd` e compus din trei fapte ale serverului (depozitul primește · cererea e încă
 * deschisă · plafonul nu e atins), nu ghicit. ⛔ Butonul dispare când oricare cade — ACHU-517:
 * o invitație care supraviețuiește capacității e chiar felul în care un refuz arată ca un defect.
 */
export function ComplaintEvidence({ requestRef, status, state }: {
  requestRef: number;
  status: string;
  state: ComplaintPhotoState;
}) {
  const { photos, maxPhotos, uploadsAvailable, reload } = state;
  const mine = photos.filter(p => p.requestRef === requestRef);
  const canAdd = uploadsAvailable && status === 'Open' && mine.length < maxPhotos;

  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const picked = Array.from(e.target.files ?? []);
    if (inputRef.current) inputRef.current.value = '';
    if (picked.length === 0) return;

    /**
     * ⚠️ Plafonul se respectă ȘI aici, pe cele alese deodată: un „ai depășit" primit după ce
     * telefonul a urcat cinci poze e cel mai prost moment în care poți afla.
     */
    const room = Math.max(0, maxPhotos - mine.length);
    if (picked.length > room) {
      setError(`You can send up to ${maxPhotos} photos with a problem report. Only the first ${room} were added.`);
    }

    setBusy(true);
    let failed = 0;
    for (const file of picked.slice(0, room)) {
      try {
        /**
         * 🔴 **MICȘORATĂ ÎNTÂI** (§32, Sesiunea 147, `lib/imageCompression.ts`): o poză de telefon
         * are 4–6 MB, iar mesajul *„take it again at a lower resolution"* e o instrucțiune pe care
         * omul nu o poate executa. ⛔ Aici ar fi costat mai mult decât la o cerere de ofertă: cine
         * reclamă ceva e deja nemulțumit, iar un refuz atunci arată ca o firmă care nu vrea dovada.
         */
        const { dataUrl, bytes } = await prepareImageForUpload(file);
        if (bytes > PHOTO_MAX_BYTES) {
          setError(`"${file.name}" is too large to send, even after shrinking it. Please choose a different photo.`);
          continue;
        }
        await uploadComplaintPhoto({ ref: requestRef, imageData: dataUrl });
      } catch (err) {
        failed++;
        // ⚠️ Mesajul SERVERULUI, nu unul inventat aici: el știe dacă e plafonul, felul sau starea.
        setError(err instanceof Error ? err.message : 'That photo could not be sent. Please try again.');
      }
    }
    setBusy(false);
    if (failed < picked.length) reload();
  };

  const remove = async (photoId: string) => {
    setRemoving(photoId);
    try {
      await deleteComplaintPhoto({ ref: requestRef, photoId });
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove that photo');
    } finally {
      setRemoving(null);
    }
  };

  if (mine.length === 0 && !canAdd) return null;

  return (
    <div className="mt-2">
      {mine.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {mine.map(photo => (
            <div key={photo.id} className="relative group">
              <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                {photo.signedUrl ? (
                  /*
                    ⚠️ Mărimea întreagă într-un tab nou, ca la pozele casei (§32, Sesiunea 147):
                    miniatura e tăiată de `object-cover`, iar o pată pe un colț stă exact acolo
                    unde se taie. Linkul e semnat și expiră.
                  */
                  <a
                    href={photo.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full h-full"
                    aria-label={photo.description
                      ? `Open the full-size photo: ${photo.description}`
                      : 'Open the full-size photo you sent with this problem report'}
                  >
                    <img
                      src={photo.signedUrl}
                      alt={photo.description || 'Photo sent with this problem report'}
                      className="w-full h-full object-cover"
                    />
                  </a>
                ) : (
                  /* ⚠️ Depozitul n-a semnat linkul. Rândul EXISTĂ, deci se spune, nu se ascunde. */
                  <div
                    className="w-full h-full flex items-center justify-center"
                    title="This photo cannot be opened right now. It is still attached — please try again later."
                  >
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>
              {/*
                🔴 Ștergerea rămâne DISPONIBILĂ și după ce biroul a răspuns, deși adăugarea nu —
                asimetria e deliberată (`backend/src/lib/complaintPhotoPolicy.ts`): „nu se mai pot
                trimite dovezi" nu are voie să devină „și nu-ți mai poți retrage poza din casa ta".
              */}
              <Button
                size="sm"
                variant="destructive"
                className="absolute top-1 right-1 h-6 w-6 p-0 reveal-on-hover"
                onClick={() => remove(photo.id)}
                disabled={removing === photo.id}
                aria-label="Remove this photo" title="Remove this photo"
              >
                {removing === photo.id
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Trash2 className="h-3 w-3" />}
              </Button>
            </div>
          ))}
        </div>
      )}

      {canAdd && (
        <div className="mt-2">
          <input
            ref={inputRef}
            id={`complaint-photos-${requestRef}`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={pick}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Sending…</>
              : <><ImagePlus className="h-3.5 w-3.5 mr-1.5" />Add a photo</>}
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">
            {/* ⚠️ Propoziția spune la ce SERVEȘTE poza, nu doar că se poate trimite. */}
            A photo of what is wrong helps us sort it out without coming back to look.
            {' '}Up to {maxPhotos}.
          </p>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

