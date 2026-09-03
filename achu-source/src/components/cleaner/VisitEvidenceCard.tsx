/**
 * §32 „Before photos" / „After photos" (Sesiunea 148) — CE FOTOGRAFIAZĂ CURĂȚĂTORUL LA O VIZITĂ.
 *
 * 🔴 **Ce lipsea:** el putea fotografia un **punct de checklist** („am făcut baia") și nimic
 * altceva. ⛔ Deci „cum arăta camera când am intrat" și „cum arăta când am plecat" nu existau
 * nicăieri — iar acelea sunt exact cele două întrebări pe care le pune o reclamație.
 *
 * ─── ⚠️ DE CE NU CERE O REÎNCĂRCARE A ECRANULUI ─────────────────────────────
 * Poza urcată se arată **din browser**, din chiar octeții micșorați care au plecat la server. ⛔ O
 * reîncărcare a zilei întregi după fiecare poză ar fi fost secunde de așteptare pe o conexiune de
 * telefon, la ușa cuiva — iar linkul semnat pe care l-ar aduce arată exact aceeași imagine.
 * ⚠️ Aceeași alegere ca la „Failed-upload retry" (§32, Sesiunea 147): ce e deja în mână nu se cere
 * din nou.
 *
 * ─── ⛔ CE NU FACE ──────────────────────────────────────────────────────────
 * Nu bifează nimic și nu închide vizita: o poză e o consemnare, nu un raport de muncă terminată.
 * ⚠️ Și nu atinge pozele CLIENTULUI — acelea au cardul lor deasupra („From the customer"), iar
 * granița e impusă pe server (`visitPhotoPolicy.ts`).
 */
import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { prepareImageForUpload } from '@/lib/imageCompression';
import { addVisitPhoto, deleteVisitPhoto, type VisitPhotoCategory } from '@/lib/visitPhotoEndpoints';

/** Ce trimite serverul pe fiecare poză a curățătorului. */
export type VisitPhoto = {
  id: string;
  category: string;
  description?: string | null;
  uploadedAt?: string;
  signedUrl?: string | null;
};

/**
 * ⚠️ Plafonul pe fișier, DUPĂ micșorare — aceeași cifră ca pe celelalte ecrane și ca pe server.
 * ⛔ Plafonul de NUMĂR (8 pe categorie) e impus de rută; ecranul nu-l repetă, ca să nu existe două
 * surse de adevăr pentru aceeași regulă.
 */
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

const GROUPS: { category: VisitPhotoCategory; title: string; hint: string }[] = [
  { category: 'before', title: 'Before', hint: 'How the room looked when you arrived.' },
  { category: 'after', title: 'After', hint: 'How you left it.' },
];

export default function VisitEvidenceCard({ jobId, photos, cancelled = false }: {
  jobId: string;
  photos: VisitPhoto[];
  /** ⛔ O vizită anulată nu s-a lucrat, deci nu are „înainte" și „după". Serverul refuză oricum. */
  cancelled?: boolean;
}) {
  /** Pozele urcate în sesiunea asta, cu imaginea din browser. ⚠️ Vezi antetul: fără reîncărcare. */
  const [added, setAdded] = useState<{ id: string; category: string; dataUrl: string }[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState<VisitPhotoCategory | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  /** ⚠️ Un singur input, cu categoria ținută lângă el: două inputuri ar fi două stări de golit. */
  const pendingCategory = useRef<VisitPhotoCategory>('before');
  const inputRef = useRef<HTMLInputElement>(null);

  if (cancelled) return null;

  const shown = (category: string) => [
    ...photos.filter(p => p.category === category && !removed.includes(p.id))
      .map(p => ({ id: p.id, url: p.signedUrl ?? null, description: p.description })),
    ...added.filter(p => p.category === category).map(p => ({ id: p.id, url: p.dataUrl, description: null })),
  ];

  const choose = (category: VisitPhotoCategory) => {
    pendingCategory.current = category;
    inputRef.current?.click();
  };

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    if (inputRef.current) inputRef.current.value = '';
    if (chosen.length === 0) return;
    const category = pendingCategory.current;

    setBusy(category);
    for (const file of chosen) {
      try {
        /**
         * 🔴 **MICȘORATĂ ÎNTÂI** (§32, Sesiunea 147): o poză de telefon are 4–6 MB. ⛔ Aici ar fi
         * cel mai scump refuz din aplicație — omul e în casa clientului, cu treaba terminată, și
         * „take it again at a lower resolution" nu e o instrucțiune executabilă.
         */
        const { dataUrl, bytes } = await prepareImageForUpload(file);
        if (bytes > PHOTO_MAX_BYTES) {
          toast.error('That photo is too large to send, even after shrinking it. Try another.');
          continue;
        }
        const res = await addVisitPhoto({ jobId, category, imageData: dataUrl });
        setAdded(list => [...list, { id: res.photo.id, category, dataUrl }]);
      } catch (err) {
        // ⚠️ Mesajul SERVERULUI: el știe dacă e plafonul, vizita anulată sau asignarea.
        toast.error(err instanceof Error ? err.message : 'That photo could not be sent. Please try again.');
      }
    }
    setBusy(null);
  };

  const remove = async (photoId: string) => {
    setRemoving(photoId);
    try {
      await deleteVisitPhoto({ jobId, photoId });
      setRemoved(list => [...list, photoId]);
      setAdded(list => list.filter(p => p.id !== photoId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove that photo');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="rounded-lg border border-border p-2.5">
      <p className="text-xs font-semibold flex items-center gap-1.5">
        <Camera className="h-3.5 w-3.5" aria-hidden="true" />Your photos of this job
      </p>
      {/*
        ⚠️ Propoziția spune CINE le vede, ca pe ecranul clientului: omul care fotografiază casa
        altcuiva trebuie să știe unde ajunge poza înainte să apese. ⛔ Azi nu ajunge la client —
        iar dacă vreodată se deschide, propoziția asta se schimbă în aceeași felie.
      */}
      <p className="mt-1 text-xs text-muted-foreground">
        Only the office sees these. They are what proves what you found and what you left.
      </p>

      {GROUPS.map(group => {
        const list = shown(group.category);
        return (
          <div key={group.category} className="mt-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium">{group.title}</p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={busy !== null}
                onClick={() => choose(group.category)}
              >
                {busy === group.category
                  ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Sending…</>
                  : <><Camera className="h-3 w-3 mr-1" />Add {group.title.toLowerCase()}</>}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{group.hint}</p>

            {list.length > 0 && (
              <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {list.map(photo => (
                  <div key={photo.id} className="relative group">
                    <div className="aspect-square bg-muted rounded-md overflow-hidden">
                      {photo.url ? (
                        <a
                          href={photo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full h-full"
                          aria-label={`Open the full-size ${group.title.toLowerCase()} photo`}
                        >
                          <img
                            src={photo.url}
                            alt={photo.description || `${group.title} photo of this job`}
                            className="w-full h-full object-cover"
                          />
                        </a>
                      ) : (
                        /* ⚠️ Rândul EXISTĂ: linkul nu s-a putut semna. Ascunsă, poza ar părea pierdută. */
                        <div
                          className="w-full h-full flex items-center justify-center"
                          title="This photo cannot be opened right now. It is still attached."
                        >
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-1 right-1 h-6 w-6 p-0 reveal-on-hover"
                      onClick={() => remove(photo.id)}
                      disabled={removing === photo.id}
                      aria-label={`Remove this ${group.title.toLowerCase()} photo`} title={`Remove this ${group.title.toLowerCase()} photo`}
                    >
                      {removing === photo.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={pick}
      />
    </div>
  );
}

