import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, AlertCircle, Image, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface Photo {
  id: string;
  photoId: number;
  storagePath: string;
  description?: string | null;
  uploadedAt: string;
  signedUrl?: string | null;
  /**
   * §32 „Uploaded by" (Sesiunea 148) — emailul contului care a trimis poza. ⚠️ Vine **doar pe
   * drumul biroului** (`loadJobPropertyInfo`); în portal lipsește, fiindcă acolo ar fi propriul
   * email al clientului. ⛔ `null` pe pozele de dinaintea coloanei.
   */
  uploadedBy?: string | null;
  /**
   * §32 „Photo category" (Sesiunea 148) — `property` (a clientului), `before` sau `after` (ale
   * curățătorului). ⚠️ Numai drumul biroului aduce alte valori decât `property`: portalul filtrează
   * pe categoria clientului, fiindcă pozele făcute de un angajat nu ajung la el (decizie de owner).
   */
  category?: string | null;
}

interface PropertyInfoPanelProps {
  propertyNotes: string;
  photos: Photo[];
  editable?: boolean;
  /**
   * 🔴 ACHU-517 (Sesiunea 111) — whether the server can accept a photograph, as told by the
   * property-info response. It replaced a `PHOTOS_DISABLED` constant imported here.
   *
   * ⚠️ Defaults to `false`, and that direction is the point: a caller that forgets to pass it
   * invites nothing, rather than inviting a photograph the server will refuse. The old
   * constant defaulted the other way round by being absent — which is how the invitation
   * outlived the capability in the first place.
   */
  photosAvailable?: boolean;
  /**
   * §32 „Uploaded by" (Sesiunea 148) — arată sub fiecare poză CINE a trimis-o.
   *
   * ⚠️ **Stins implicit, și direcția e aleasă**, ca la `photosAvailable`: panoul e folosit de
   * client ȘI de birou (`JobPropertyInfoSection`), iar un apelant care uită steagul nu arată
   * nimic în plus. 🔴 Pentru client ar fi propriul lui email pe fiecare miniatură — zgomot; pentru
   * birou e răspunsul la „care dintre cele două persoane din casă a trimis-o".
   */
  showUploadedBy?: boolean;
  /**
   * 🔴 ACHU-520 — whether photographs can be REMOVED, asked separately from whether the notes
   * can be edited, because the server has always answered the two differently.
   *
   * `PATCH property-notes` refuses once the visit is closed; `DELETE photos/:id` never did. The
   * screen collapsed both into `editable`, so the customer's delete button disappeared the
   * moment a visit completed — which is precisely the period in which the photograph then sits
   * in storage indefinitely. Archana's retention decision is *„pozele se șterg când clientul le
   * șterge sau la cererea de ștergere a datelor"*, and that policy needs the button to exist.
   *
   * ⚠️ Defaults to `editable` so nothing else changes: the admin panel passes neither and stays
   * read-only.
   */
  canDeletePhotos?: boolean;
  onEdit?: () => void;
  onPhotoDelete?: (photoId: string) => Promise<void>;
}

export default function PropertyInfoPanel({
  propertyNotes, photos, editable = false, photosAvailable = false, canDeletePhotos, showUploadedBy = false,
  onEdit, onPhotoDelete,
}: PropertyInfoPanelProps) {
  const mayDelete = canDeletePhotos ?? editable;
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  const handleDeletePhoto = async (photoId: string) => {
    if (!onPhotoDelete) return;
    setDeletingPhotoId(photoId);
    try {
      await onPhotoDelete(photoId);
      toast.success('Photo deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete photo');
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const hasContent = propertyNotes || photos.length > 0;

  if (!hasContent && !editable) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Property Notes Section */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-sm font-medium">Property Information</h3>
            {editable && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={onEdit}
              >
                <Edit className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            )}
          </div>

          {propertyNotes ? (
            <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2 whitespace-pre-wrap">
              {propertyNotes}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              {editable ? 'No property notes added yet.' : 'No property notes provided.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Photos Section */}
      {photos.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium mb-3">Property Photos</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group">
                  <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                    {photo.signedUrl ? (
                      /*
                        🔴 §32 „Full-size preview" (Sesiunea 147) — MĂRIMEA ÎNTREAGĂ ÎNTR-UN TAB NOU.
                        Miniatura e pătrată cu `object-cover`, adică **tăiată** — iar pozele astea nu
                        sunt decorative: o pată pe un colț sau o crăpătură pe marginea unei ferestre
                        stă exact acolo unde `object-cover` taie. ⛔ Clientul nu avea nicio cale să se
                        uite la ce a trimis el însuși.

                        ⚠️ Același tipar ca la curățător (`PropertyFromCustomerCard`) și la birou
                        (`QuoteRequestSection`), care îl aveau deja. Nu o lupă nouă: un al doilea fel
                        de a deschide o poză ar fi fost inconsecvență de dragul ei, iar tabul nou dă
                        pe telefon mărirea cu două degete, gratis. Linkul e semnat și expiră.
                      */
                      <a
                        href={photo.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full h-full"
                        aria-label={photo.description
                          ? `Open the full-size photo: ${photo.description}`
                          : 'Open the full-size photo'}
                      >
                        <img
                          src={photo.signedUrl}
                          alt={photo.description || 'Property photo'}
                          className="w-full h-full object-cover"
                          onError={() => {
                            toast.error('Could not load photo');
                          }}
                        />
                      </a>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <AlertCircle className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  {photo.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {photo.description}
                    </p>
                  )}
                  {/*
                    §32 „Uploaded by" (Sesiunea 148) — doar pe ecranul biroului (`showUploadedBy`).
                    ⚠️ Propoziția spune „Sent by", nu doar emailul: pe același ecran stau și poze
                    făcute de un ANGAJAT (checklist), iar cine se uită trebuie să știe a cui e.
                    ⛔ Pozele de dinaintea coloanei nu scriu nimic — un „necunoscut" ar arăta ca o
                    date lipsă, când adevărul e că nu se consemna.
                  */}
                  {/*
                    §32 „Photo category" (Sesiunea 148) — CE fel de poză e, pe ecranul biroului.
                    ⛔ Fără eticheta asta, „before", „after" și poza clientului ar sta amestecate
                    într-o singură grilă, iar cine hotărăște o reclamație n-ar ști la ce se uită.
                    ⚠️ `property` nu se etichetează: pe ecranul clientului ar fi „de la tine".
                  */}
                  {showUploadedBy && photo.category && photo.category !== 'property' && (
                    <p className="text-xs font-medium capitalize">{photo.category}</p>
                  )}
                  {showUploadedBy && photo.uploadedBy && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      Sent by {photo.uploadedBy}
                    </p>
                  )}
                  {mayDelete && onPhotoDelete && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-1 right-1 h-7 w-7 p-0 reveal-on-hover"
                      aria-label="Remove this photo" title="Remove this photo"
                      onClick={() => handleDeletePhoto(photo.id)}
                      disabled={deletingPhotoId === photo.id}
                    >
                      {deletingPhotoId === photo.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {editable && photos.length === 0 && !propertyNotes && (
        <Card>
          <CardContent className="p-4 text-center">
            <Image className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            {/* ACHU-517: the invitation matches what the server will actually accept. Asking
                for photographs it cannot take is what made the failure feel like a broken
                promise rather than a missing feature — and the answer now comes from the
                server, so the two cannot drift apart again. */}
            <p className="text-xs text-muted-foreground mb-3">
              {photosAvailable
                ? 'Add property notes and photos to help your cleaner'
                : 'Add a note about your property to help your cleaner'}
            </p>
            <Button
              size="sm"
              onClick={onEdit}
              className="text-xs"
            >
              <Edit className="h-3.5 w-3.5 mr-1.5" />
              Add Information
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

