/**
 * ACHU-514 (Sesiunea 110) — CE A SCRIS ȘI A FOTOGRAFIAT CLIENTUL DESPRE CASA LUI, pentru vizita
 * asta. Decis de Archana, întrebată direct dacă pozele să ajungă la curățător: *„Fa amandoua."*
 *
 * 🔴 Până atunci nu ajungea niciuna, în timp ce ecranul clientului spunea *„Add property notes and
 * photos to help your cleaner"*. Cine scrisese „vaza fragilă din hol" **credea că a spus cuiva.**
 *
 * ⚠️ **Extras din `JobCard.tsx` la ACHU-575** — nu rescris. Clichetul de mărime al lui `JobCard`
 * era atins (873) exact când a venit cardul Grupului C, iar regula e că se **extrage**, nu se
 * ridică plafonul (`CLAUDE.md` §2.1a). Comportamentul e neschimbat; testele de caracterizare ale
 * lui `JobCard` (ACHU-451) sunt cele care o dovedesc.
 *
 * ⚠️ Așezat imediat după „Getting in" și înaintea instrucțiunilor biroului, fiindcă răspunde la
 * aceeași întrebare — în ce intru — iar cine îl citește stă la o ușă. **Întotdeauna deschis**,
 * aceeași regulă ca la ACHU-239: ceva ascuns după un buton e ceva pentru care omul sună la birou.
 *
 * ⛔ Serverul nu trimite nimic pe o vizită terminată, deci nu e niciun caz de tratat aici. Limita
 * aceea **nu** se aplică în acest fișier, deliberat: un răspuns care le poartă e unul care le
 * poate scăpa.
 */
import { Home } from 'lucide-react';

type Photo = { id: string; description?: string | null; signedUrl?: string | null };

export default function PropertyFromCustomerCard({ notes, photos }: {
  notes?: string | null;
  photos: Photo[];
}) {
  /**
   * ⚠️ **Cardul se ascunde SINGUR când n-are ce arăta** (Sesiunea 148) — condiția era în
   * `JobCard.tsx`, unde ocupa trei rânduri din clichetul unui fișier care nu are voie să crească.
   * ⛔ Nimic nu s-a schimbat pentru cine se uită la ecran: aceeași absență, decisă aici.
   */
  if (!notes && photos.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5">
      <p className="text-xs font-semibold flex items-center gap-1.5">
        <Home className="h-3.5 w-3.5" aria-hidden="true" />From the customer, about this property
      </p>
      {notes && (
        <p className="mt-1 text-sm whitespace-pre-wrap break-words">{notes}</p>
      )}
      {photos.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map(photo => (
            <div key={photo.id} className="space-y-1">
              {photo.signedUrl ? (
                /*
                  Se deschide la mărime întreagă într-un tab nou: o miniatură e destul ca să
                  recunoști „poarta din lateral" și inutilă pentru „care dintre cele trei chei".
                  Link-ul e un url semnat, care expiră — nu o adresă publică.
                */
                <a href={photo.signedUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <img
                    src={photo.signedUrl}
                    alt={photo.description || 'Photo of the property'}
                    className="aspect-square w-full rounded-md object-cover"
                  />
                </a>
              ) : (
                /* Semnarea a eșuat (vezi nota fail-open din `cleanerJobs.ts`). Spus cu voce tare,
                   nu arătat ca imagine ruptă, ca nimeni să nu creadă că clientul n-a trimis nimic. */
                <div className="flex aspect-square w-full items-center justify-center rounded-md bg-muted text-center">
                  <span className="px-1 text-[10px] text-muted-foreground">Photo unavailable — ring the office</span>
                </div>
              )}
              {photo.description && (
                <p className="line-clamp-2 text-[10px] text-muted-foreground">{photo.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

