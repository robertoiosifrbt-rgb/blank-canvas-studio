/**
 * §32 „Complaint evidence" (Sesiunea 148) — DOVADA CLIENTULUI, PE ECRANUL BIROULUI.
 *
 * 🔴 **Fără ecranul ăsta felia n-ar exista.** Clientul ar fi trimis poze pe care nimeni nu le vede
 * — chiar lecția din capul lui `backend/src/routes/customerRequests.ts`: *„un rând la care nu
 * ajunge nimeni e mai rău decât o funcționalitate lipsă"*. ⚠️ Și se arată exact în dialogul în care
 * se HOTĂRĂȘTE: cine scrie „Declined" trebuie să se uite la ce a trimis omul înainte, nu după.
 *
 * ⛔ **DOAR CITIRE.** Biroul nu încarcă și nu șterge: încărcarea e a clientului, iar o poză pusă de
 * firmă pe reclamația lui ar fi o afirmație a firmei prezentată ca dovada lui. Motivul întreg:
 * `backend/src/lib/complaintPhotoPolicy.ts`. 🔴 Nici ștergere: dovada altcuiva nu se scoate de aici
 * — ce se poate șterge de birou e o poză de incident, din dosarul firmei.
 *
 * ⚠️ **Fișier propriu:** dialogul de răspuns are deja patru selectoare și un text; o galerie cu
 * starea ei de încărcare l-ar fi îngroșat fără nicio legătură cu ce face el.
 */
import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { getCustomerRequestPhotos, type ComplaintPhoto } from '@/lib/customerRequestEndpoints';

export default function CustomerRequestPhotos({ requestId }: { requestId: string }) {
  /**
   * ⚠️ **O singură stare, purtând CERERII căreia îi aparține** — nu două plus o golire la începutul
   * efectului. ⛔ Golirea aceea era un `setState` sincron în efect (`react-hooks/set-state-in-effect`),
   * iar clichetul de lint e EXACT: un avertisment nou oprește push-ul. ✅ Purtat pe stare, „încă nu
   * s-a citit pentru cererea ASTA" se **derivă** la randare, deci un dialog redeschis pe altă cerere
   * nu poate arăta o clipă pozele celei dinainte.
   */
  const [loaded, setLoaded] = useState<{ forId: string; photos: ComplaintPhoto[]; failed: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    getCustomerRequestPhotos({ id: requestId })
      .then(res => { if (live) setLoaded({ forId: requestId, photos: res.records ?? [], failed: false }); })
      /**
       * 🔴 **Eșecul se SPUNE, aici, spre deosebire de ecranul clientului.** ⚠️ Acolo o galerie care
       * nu se încarcă e o neplăcere; aici omul e pe punctul de a hotărî o reclamație, iar „nu are
       * poze" și „n-am putut citi pozele" duc la decizii diferite. ⛔ O listă goală afișată în locul
       * unei erori ar fi chiar minciuna care contează.
       */
      .catch(() => { if (live) setLoaded({ forId: requestId, photos: [], failed: true }); });
    return () => { live = false; };
  }, [requestId]);

  const ready = loaded?.forId === requestId ? loaded : null;
  const photos = ready?.photos ?? null;
  const failed = ready?.failed ?? false;

  if (photos === null) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />Looking for photos the customer sent…
      </p>
    );
  }

  if (failed) {
    return (
      <p className="text-xs text-destructive">
        We could not check whether the customer sent photos. Reload before deciding — do not read
        this as “none were sent”.
      </p>
    );
  }

  if (photos.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-medium mb-1.5">
        {/* ⚠️ „Sent by the customer" e spus explicit: pe ecranul biroului stau și poze făcute de
            firmă (incidente, checklist), iar cine hotărăște trebuie să știe a cui e dovada. */}
        {photos.length === 1 ? 'Photo sent by the customer' : `${photos.length} photos sent by the customer`}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {photos.map(photo => (
          <div key={photo.id} className="aspect-square bg-muted rounded-md overflow-hidden">
            {photo.signedUrl ? (
              /* ⚠️ Tab nou, ca la celelalte galerii: miniatura e tăiată de `object-cover`, iar
                 detaliul contestat stă des exact acolo unde se taie. Linkul e semnat și expiră. */
              <a
                href={photo.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full h-full"
                aria-label={photo.description
                  ? `Open the full-size photo: ${photo.description}`
                  : 'Open the full-size photo the customer sent'}
              >
                <img
                  src={photo.signedUrl}
                  alt={photo.description || 'Photo sent by the customer'}
                  className="w-full h-full object-cover"
                />
              </a>
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                title="This photo cannot be opened right now. It is still attached."
              >
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

