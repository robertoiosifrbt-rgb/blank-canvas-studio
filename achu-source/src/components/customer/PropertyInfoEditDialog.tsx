import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Upload, Info } from 'lucide-react';
import { toast } from 'sonner';
import { prepareImageForUpload } from '@/lib/imageCompression';

interface PropertyInfoEditDialogProps {
  open: boolean;
  onClose: () => void;
  initialNotes: string;
  /**
   * 🔴 ACHU-517 (Sesiunea 111) — whether the server can accept a photograph, from the
   * property-info response rather than a constant compiled into this bundle.
   *
   * ⚠️ Defaults to `false` on purpose. The file picker is the one control here that can put a
   * customer in front of a server refusal, so the safe default is to not offer it. The
   * matching gate is `photoUploadGate` in `backend/src/routes/customerPortal.ts`: both ends
   * guard, because hiding the picker alone is the ACHU-498 shape — a rule live in two of its
   * three parts, defeated by a browser tab left open since this morning.
   */
  photosAvailable?: boolean;
  /**
   * 🔴 §32 „Multiple-file upload" + ACHU-760 (Sesiunea 148) — câte poze încap pe o vizită, spus de
   * SERVER (`GET /jobs/:jobId/property-info`), și câte are deja.
   *
   * ⚠️ Cifra NU e scrisă aici, deliberat: ruta o impune oricum (`visitPhotoPolicy.ts`), iar aceeași
   * limită ținută și în bundle e forma §3.1b — cea din bundle rămâne în urmă. ⛔ `0` implicit,
   * adică un apelant care uită să le trimită nu invită la nicio poză, în loc să invite la una pe
   * care serverul o refuză (aceeași direcție ca `photosAvailable`).
   */
  maxPhotos?: number;
  existingPhotoCount?: number;
  /**
   * ⚠️ **O LISTĂ, de la §32 „Multiple-file upload"** — până azi era o singură poză pe salvare, deci
   * un client cu trei lucruri de arătat trebuia să deschidă dialogul de trei ori. ⛔ `undefined`
   * (nu `[]`) când nu s-a ales nimic: apelantul deosebește „nicio poză" de „o listă goală", iar
   * testele de dinainte de felie asertează exact `undefined`.
   */
  onSave: (notes: string, photos?: { imageData: string; description?: string }[]) => Promise<void>;
}

/** O poză aleasă, micșorată, cu descrierea ei. ⚠️ `dataUrl` e ȘI previzualizarea ȘI ce se trimite. */
type PickedPhoto = { dataUrl: string; name: string; caption: string };

export default function PropertyInfoEditDialog({
  open, onClose, initialNotes, photosAvailable = false, maxPhotos = 0, existingPhotoCount = 0, onSave,
}: PropertyInfoEditDialogProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  /**
   * §32 „Multiple-file upload" (Sesiunea 148) — o LISTĂ, nu un fișier plus o descriere.
   *
   * ⚠️ Fiecare poză își poartă propria descriere. ⛔ Un singur câmp de descriere peste mai multe
   * poze ar fi lipit aceeași propoziție pe toate — o etichetă care descrie o singură poză, pusă pe
   * trei, e mai rea decât niciuna.
   */
  const [picked, setPicked] = useState<PickedPhoto[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  /** Câte mai încap. ⚠️ Calculat din cifrele SERVERULUI, nu din una scrisă în ecran. */
  const room = Math.max(0, maxPhotos - existingPhotoCount - picked.length);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Reset the form on the closed→open transition. Done DURING RENDER, not in an
  // effect: React's documented "adjusting state when a prop changes" pattern
  // (https://react.dev/learn/you-might-not-need-an-effect). Identical result, one
  // fewer render pass, and no `set-state-in-effect` warning — which is what this
  // was before ACHU-493 measured the lint ratchet back to its baseline.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setNotes(initialNotes);
      setPicked([]);
    }
  }

  /**
   * §32 „Multiple-file upload" (Sesiunea 148) — se pot alege MAI MULTE deodată.
   *
   * ⚠️ Plafonul se respectă aici, pe cele alese într-o singură apăsare: un „ai depășit" primit
   * după ce telefonul a urcat cinci poze e cel mai prost moment în care poți afla. ⛔ Serverul îl
   * reverifică oricum (ACHU-760) — ecranul doar nu-l mai pune pe om să afle de la el.
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (chosen.length === 0) return;

    if (chosen.length > room) {
      toast.error(room === 0
        ? `This job already holds ${maxPhotos} photos. Please delete one you no longer need first.`
        : `You can add ${room} more photo${room === 1 ? '' : 's'} to this job — only the first ${room} were added.`);
    }

    for (const file of chosen.slice(0, room)) {
      // Validate file is an image
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        continue;
      }

      /**
       * 🔴 **MICȘORATĂ ÎNTÂI (§32, Sesiunea 147).** Refuzul de dinainte — *„Image must be under
       * 10MB"* — nu spunea nimic ce omul ar putea face: rezoluția camerei nu se schimbă din ecranul
       * ăsta. ⛔ Refuzul rămâne, dar numai după toată scara de micșorare.
       *
       * ⚠️ **`dataUrl` e și data trimisă**, nu doar previzualizarea (vezi `handleSave`) — deci
       * ce vede clientul înainte de trimitere e exact ce pleacă la server, inclusiv micșorarea.
       * Altfel ar fi aprobat o poză și ar fi trimis alta.
       */
      const { dataUrl, bytes } = await prepareImageForUpload(file);
      if (bytes > 10 * 1024 * 1024) {
        toast.error('That photo is too large to send, even after shrinking it. Please choose another.');
        continue;
      }
      if (!mountedRef.current) return;
      setPicked(list => [...list, { dataUrl, name: file.name, caption: '' }]);
    }
  };

  const removePicked = (index: number) => {
    setPicked(list => list.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const captionPicked = (index: number, caption: string) => {
    setPicked(list => list.map((p, i) => (i === index ? { ...p, caption: caption.slice(0, 500) } : p)));
  };

  const handleSave = async () => {
    if (!notes && picked.length === 0) {
      toast.error('Please add notes or a photo');
      return;
    }

    setSaving(true);
    try {
      /**
       * ⚠️ `undefined`, nu `[]`, când nu s-a ales nimic: apelantul deosebește „nicio poză" de „o
       * listă goală", iar testele de dinainte de felie asertează exact `undefined`.
       */
      const photos = picked.length
        ? picked.map(p => ({ imageData: p.dataUrl, description: p.caption || undefined }))
        : undefined;

      await onSave(notes, photos);
      if (mountedRef.current) {
        toast.success('Property information updated');
        onClose();
      }
    } catch (e) {
      if (mountedRef.current) {
        toast.error(e instanceof Error ? e.message : 'Failed to update property information');
      }
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Property Information</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Property Notes */}
          <div className="space-y-2">
            <Label htmlFor="property-notes">Property Notes (5000 chars max)</Label>
            <Textarea
              id="property-notes"
              placeholder="Add access instructions, fragile items, special handling instructions, or any other helpful information for your cleaner..."
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 5000))}
              rows={5}
              disabled={saving}
              className="resize-none"
            />
            {/* ACHU-514: the note reaches the cleaner too, from today — so it says who sees
                it, in the same words as the photographs below and as the "Getting in" card.
                The placeholder above already implied a reader ("for your cleaner"); implying
                is not telling. */}
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Only ACHU and the cleaner coming to you can see this. {notes.length} / 5000 characters.</span>
            </p>
          </div>

          {/* Photo Upload Section — ACHU-517: offered only when the server says it can take
              one, see `photosAvailable` above. */}
          {!photosAvailable ? (
            <div className="space-y-2 border-t pt-5">
              {/* ACHU-523: aici nu există nicio comandă de etichetat — e doar o explicație de ce
                  lipsește secțiunea. Un `<label>` fără control e o promisiune goală pentru un
                  cititor de ecran: îl anunță ca etichetă și nu duce nicăieri. */}
              <p className="text-sm font-medium leading-none">Property Photos</p>
              <p className="text-sm text-muted-foreground flex items-start gap-1.5">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Photos are not available just yet — we are still setting this up. Your note above
                  does reach your cleaner, so please describe anything important in words for now.
                </span>
              </p>
            </div>
          ) : (
          /* ACHU-523: titlu peste un GRUP (încărcare, descriere, ștergere), nu eticheta unei
             comenzi — deci `role="group"` + `aria-labelledby`, ca la restul grupurilor. */
          <div className="space-y-2 border-t pt-5" role="group" aria-labelledby="property-photos-label">
            <Label id="property-photos-label">Property Photos</Label>
            <div className="text-sm text-muted-foreground mb-3">
              {/* §32 + ACHU-760 (Sesiunea 148) — plafonul se SPUNE, cu cifra serverului, și se
                  spune câte mai încap. ⛔ Un refuz la trimitere pentru o limită nescrisă nicăieri
                  e chiar felul în care o regulă corectă arată ca un defect. */}
              Upload photos to help your cleaner prepare (max 10MB per image).
              {maxPhotos > 0 && ` Up to ${maxPhotos} per job — ${room} more can be added.`}
            </div>

            {/*
              🔴 ACHU-514 (Sesiunea 110) — THE SENTENCE THAT HAS TO BE HERE, and it has to be
              here rather than in terms and conditions: from today these photographs reach the
              cleaner coming to the visit, and somebody deciding whether to attach a picture of
              their hallway is owed that fact BEFORE they pick the file, not after.

              ⚠️ The wording is deliberately the same as the "Getting in" card has carried since
              Sesiunea 43 (`AccessInstructions.tsx`) — the customer has already accepted that
              bargain for their gate code, so saying it differently here would suggest a
              different bargain.

              ⚠️ The second sentence is the only real mitigation available. A note is chosen
              word by word; a photograph captures whatever is in frame — a face, medication on a
              counter, a whole room. Nothing in this application can inspect an image, so the
              guard is asking for the access point rather than the room.

              ✅ It lands before anyone has uploaded anything: attaching a photo was impossible
              until ACHU-512 was fixed earlier today, so no photograph exists that was sent
              under a different impression.
            */}
            <p className="text-xs text-muted-foreground flex items-start gap-1.5 mb-3">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Only ACHU and the cleaner coming to you can see these. Please photograph the way
                in or the item itself — a gate, a key box, a fragile shelf — rather than a whole
                room. You can delete any photo later.
              </span>
            </p>

            {/*
              §32 „Multiple-file upload" (Sesiunea 148) — fiecare poză aleasă, cu descrierea EI.
              ⛔ Un singur câmp de descriere peste mai multe poze ar fi lipit aceeași propoziție pe
              toate, iar o etichetă care descrie o poză, pusă pe trei, e mai rea decât niciuna.
            */}
            {picked.length > 0 && (
              <div className="space-y-3">
                {picked.map((photo, i) => (
                  <div key={`${photo.name}-${i}`} className="flex gap-3 items-start">
                    <div className="w-24 h-24 shrink-0 bg-muted rounded-lg overflow-hidden">
                      <img
                        src={photo.dataUrl}
                        alt={`Photo preview: ${photo.name}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <Label htmlFor={`photo-description-${i}`} className="text-xs">
                        Photo Caption (optional)
                      </Label>
                      <Input
                        id={`photo-description-${i}`}
                        type="text"
                        placeholder="e.g., 'Fragile vase on shelf'"
                        value={photo.caption}
                        onChange={(e) => captionPicked(i, e.target.value)}
                        disabled={saving}
                        maxLength={500}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removePicked(i)}
                        disabled={saving}
                        className="text-xs"
                      >
                        Remove Photo
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ⚠️ Zona de alegere rămâne cât timp mai încape ceva: asta E „mai multe deodată" —
                se pot adăuga și una câte una, și cinci într-o apăsare. */}
            {room > 0 && (
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium mb-1">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, GIF up to 10MB — you can choose several at once
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              disabled={saving}
              className="hidden"
            />
          </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end border-t pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || (!notes && picked.length === 0)}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

