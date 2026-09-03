/**
 * §16 „Photo required per item" (Sesiunea 144) — POZA DE DOVADĂ, PE TELEFONUL CURĂȚĂTORULUI.
 *
 * ─── 🔴 APARE DOAR UNDE BIROUL A CERUT-O, ȘI ASTA E O ALEGERE DE PROTECȚIE A DATELOR ────
 * Un buton de cameră pe **fiecare** rând ar fi deschis un canal prin care se pot aduna poze din
 * interiorul caselor oamenilor, oricând, fără ca nimeni să fi cerut vreuna. ⛔ Aici apare exact
 * pe punctele pe care biroul le-a marcat „cere poză" — deci firma decide ce se fotografiază, la
 * ce punct, iar în lipsa deciziei nu se colectează nimic.
 *
 * ─── ⛔ POZA NU BIFEAZĂ, ȘI BIFA NU SE POATE PUNE FĂRĂ POZĂ ─────────────────
 * Două apăsări, deliberat. O poză care ar bifa singură ar raporta munca drept făcută pentru
 * cineva care voia doar să documenteze o problemă — aceeași greșeală evitată la nota
 * curățătorului. ⚠️ Iar serverul refuză bifa fără poză, cu o propoziție care trimite exact la
 * butonul de aici.
 *
 * ⚠️ **Camera din spate, direct** (`capture="environment"`): omul fotografiază o cameră, nu
 * pe sine, iar un selector de galerie l-ar pune să caute printre pozele lui personale.
 */
import { useState, useRef } from 'react';
import { Camera, Check, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { uploadChecklistItemPhoto, getChecklistItemPhoto, deleteChecklistItemPhoto } from '@/lib/endpoints';
import { errMsg } from '@/lib/errorMessage';
import { prepareImageForUpload } from '@/lib/imageCompression';

export default function ChecklistItemPhoto({ itemId, itemLabel, hasPhoto, onSaved }: {
  itemId: string;
  /** Numele punctului, ca eticheta butonului să spună despre CE e vorba (cititor de ecran). */
  itemLabel: string;
  hasPhoto: boolean;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /**
   * 🔴 POZA CARE N-A PLECAT SE PĂSTREAZĂ (§32 „Failed-upload retry", Sesiunea 147).
   *
   * ⛔ Până azi, o încărcare căzută golea selecția (`fileRef.value = ''`) și poza dispărea. Omul
   * era în casa clientului, pe date mobile, și trebuia să **refacă fotografia** — după ce
   * așteptase deja urcarea. ⚠️ Iar §16 spune că punctul nu se bifează fără poză, deci fiecare
   * cădere de rețea îi mai lua încă un tur.
   *
   * ✅ Ținem data URL-ul **deja micșorat**: reîncercarea nu mai comprimă nimic și nu mai atinge
   * camera. ⚠️ Se șterge doar la reușită sau când omul face altă poză — nu la eroare.
   */
  const [failed, setFailed] = useState<string | null>(null);

  /** Urcarea propriu-zisă, pe date deja pregătite. ⚠️ Aceeași cale pentru prima trimitere și pentru reîncercare — două ar fi însemnat două comportamente la eroare. */
  const put = async (imageData: string) => {
    setBusy(true);
    try {
      await uploadChecklistItemPhoto({ checklistItemId: itemId, imageData });
      setFailed(null);
      setUrl(null); // linkul vechi nu mai arată poza nouă
      onSaved();
    } catch (e) {
      // Mesajul serverului AȘA CUM E: el spune limita, tipul acceptat, sau că depozitul tace.
      toast.error(errMsg(e) || 'Could not send that photo. It is kept — press Try again.');
      setFailed(imageData);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const send = async (file: File) => {
    if (busy) return;
    setBusy(true);
    try {
      /**
       * ⚠️ base64, ca la toate celelalte poze din aplicație. ⛔ Nu e cea mai eficientă formă, dar
       * e singura care merge la fel din camera unui telefon și dintr-un test — iar o a doua cale
       * de urcare ar fi însemnat o a doua verificare de tip și de mărime.
       *
       * 🔴 **MICȘORATĂ ÎNTÂI (§32 „Image compression", Sesiunea 147).** Ecranul ăsta nu avea NICIO
       * verificare de mărime: poza pleca întreagă spre server și era refuzată **acolo**, după ce
       * omul aștepta încărcarea pe date mobile, în casa clientului. ⛔ Iar refuzul nu era un
       * neajuns de interfață — §16 spune că punctul nu se bifează fără poză, deci încărcarea
       * refuzată îi oprea lucrul, fără nimic ce ar fi putut face ca să treacă. ⚠️ O poză deja
       * mică se citește neatinsă: vezi `lib/imageCompression.ts`.
       */
      const { dataUrl: imageData } = await prepareImageForUpload(file);
      /**
       * ⚠️ Micșorarea se face O DATĂ, aici. Urcarea (și reîncercarea) primesc datele gata — altfel
       * fiecare apăsare pe „Try again" ar fi recomprimat aceeași poză, pe telefonul omului.
       */
      setBusy(false);
      await put(imageData);
      return;
    } catch (e) {
      // ⛔ Aici cade numai pregătirea pozei — citirea sau desenarea. Urcarea are ramura ei, în `put`.
      toast.error(errMsg(e) || 'Could not read that photo. Please take it again.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  /** ⚠️ Linkul se cere la CERERE, nu la montare: pe un ecran cu douăzeci de rânduri ar fi douăzeci de cereri. */
  const look = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await getChecklistItemPhoto({ checklistItemId: itemId });
      if (!res.signedUrl) {
        toast.error('That photo cannot be opened right now. It is saved — try again in a minute.');
        return;
      }
      setUrl(res.signedUrl);
    } catch (e) {
      toast.error(errMsg(e) || 'Could not open that photo.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteChecklistItemPhoto({ checklistItemId: itemId });
      setUrl(null);
      onSaved();
    } catch (e) {
      /**
       * ⚠️ Aici mesajul serverului contează cel mai mult: pe un punct bifat care cere poză, el
       * spune „retrage întâi bifa" — o instrucțiune, nu un refuz.
       */
      toast.error(errMsg(e) || 'Could not remove that photo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label={`Take a photo for ${itemLabel}`}
        onChange={e => { const f = e.target.files?.[0]; if (f) void send(f); }}
      />
      <button
        type="button"
        // ⚠️ 44px, ca restul suprafețelor de atins din ecranul curățătorului: se apasă cu mănuși.
        className="shrink-0 min-h-[44px] px-2 text-muted-foreground hover:text-foreground disabled:opacity-60"
        aria-label={hasPhoto ? `Photo taken for ${itemLabel} — take another` : `Take a photo for ${itemLabel}`}
        onClick={() => fileRef.current?.click()}
        disabled={busy}
      >
        {busy
          ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          : hasPhoto
            ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            : <Camera className="h-4 w-4" aria-hidden="true" />}
      </button>
      {failed && (
        /**
         * 🔴 **BUTONUL CARE SALVEAZĂ UN DRUM ÎNAPOI (§32 „Failed-upload retry").** ⛔ Un `toast` nu
         * era destul: dispare în câteva secunde, iar omul rămânea fără nicio urmă că poza mai
         * există. ⚠️ Butonul stă pe rând, lângă punct, până pleacă poza sau până face alta.
         *
         * ⚠️ Scris **înaintea** butonului „Look": pe telefon, ce cere o acțiune stă primul.
         */
        <button
          type="button"
          className="shrink-0 min-h-[44px] px-1.5 text-[11px] font-medium text-amber-600 hover:text-amber-700 disabled:opacity-60"
          aria-label={`That photo for ${itemLabel} did not send — try again`}
          onClick={() => void put(failed)}
          disabled={busy}
        >
          Try again
        </button>
      )}
      {hasPhoto && (
        <button
          type="button"
          className="shrink-0 min-h-[44px] px-1.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-60"
          aria-label={`Look at the photo for ${itemLabel}`}
          onClick={look}
          disabled={busy}
        >
          Look
        </button>
      )}
      {url && (
        <div className="w-full px-2 pb-2">
          {/* ⚠️ Poza se arată MICĂ, în rând: e o confirmare că s-a prins ce trebuia, nu o galerie. */}
          <img src={url} alt={`Photo for ${itemLabel}`} className="max-h-48 rounded-md" />
          <div className="flex gap-2 pt-1">
            <button type="button" className="min-h-[36px] px-2 text-[11px] text-muted-foreground" onClick={() => setUrl(null)}>
              Close
            </button>
            <button
              type="button"
              className="min-h-[36px] px-2 text-[11px] text-destructive disabled:opacity-60"
              aria-label={`Remove the photo for ${itemLabel}`}
              onClick={remove}
              disabled={busy}
            >
              <Trash2 className="h-3.5 w-3.5 inline mr-1" aria-hidden="true" />Remove
            </button>
          </div>
        </div>
      )}
    </>
  );
}

