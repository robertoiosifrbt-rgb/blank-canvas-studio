import { useState, useEffect, useRef } from 'react';
import { prepareImageForUpload } from '@/lib/imageCompression';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DateField from '@/components/shared/DateField';
import TimeField from '@/components/shared/TimeField';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { CheckCircle, Loader2, X } from 'lucide-react';
import { submitQuoteRequest, uploadQuoteRequestPhoto } from '@/lib/endpoints';
import { ApiError } from '@/lib/apiClient';
import { VALID_CUSTOMER_TYPES, VALID_PROPERTY_TYPES } from '@/lib/validation';
// §6 (Sesiunea 159) — aceleași două întrebări ca pe formularul public, din același fișier.
import QuoteTimingFields from '@/components/shared/QuoteTimingFields';
import { INITIAL_QUOTE_TIMING, QuoteTimingState, quoteTimingPayload } from '@/lib/quoteTiming';
// §8 felia a doua — lista vine din catalog (`services` + `service_items`), nu dintr-un fișier.
import { useServiceCatalogue } from '@/lib/useServiceCatalogue';

interface PrefillData {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  postcode?: string;
}

interface QuoteFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  prefill: PrefillData;
}

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  postcode: string;
  customerType: string;
  propertyType: string;
  totalBedrooms: string;
  totalBathrooms: string;
  services: string[];
  quantities: Record<string, string>;
  preferredDate: string;
  preferredTime: string;
  timing: QuoteTimingState;
  propertyDetails: string;
  additionalNotes: string;
}

function buildInitialState(prefill: PrefillData): FormState {
  return {
    fullName: prefill.name ?? '',
    email: prefill.email ?? '',
    phone: prefill.phone ?? '',
    address: prefill.address ?? '',
    postcode: prefill.postcode ?? '',
    customerType: '',
    propertyType: '',
    totalBedrooms: '',
    totalBathrooms: '',
    services: [],
    quantities: {},
    preferredDate: '',
    preferredTime: '',
    timing: INITIAL_QUOTE_TIMING,
    propertyDetails: '',
    additionalNotes: '',
  };
}

const MAX_QUOTE_PHOTOS = 8;
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

export default function QuoteFormDialog({ open, onClose, onSubmitted, prefill }: QuoteFormDialogProps) {
  // §8 felia a doua — serviciile și pozițiile lor, din catalog.
  const { serviceNames, fieldsByService } = useServiceCatalogue();
  /**
   * ACHU-561 — pozele trimise ODATA cu cererea.
   *
   * 🔴 Tinute ca `data:` URI, nu ca `File`: exact ce trimite ruta, si ce se poate arata ca
   * previzualizare fara un al doilea `FileReader`. ⚠️ Se incarca **dupa** ce cererea a fost
   * creata — au nevoie de id-ul ei, iar id-ul exista abia atunci.
   */
  const [photos, setPhotos] = useState<{ dataUrl: string; name: string }[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  /**
   * ⚠️ Verifica marimea si numarul AICI, nu doar pe server: un refuz dupa ce omul a completat
   * tot formularul si a apasat trimite e cea mai proasta clipa in care sa afli ca o poza e
   * prea mare. Serverul re-verifica oricum — ecranul doar nu-l mai pune sa afle de la el.
   */
  const handlePhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;

    const room = MAX_QUOTE_PHOTOS - photos.length;
    if (picked.length > room) {
      setPhotoError(`You can send up to ${MAX_QUOTE_PHOTOS} photos. Only the first ${room} were added.`);
    }
    for (const file of picked.slice(0, Math.max(0, room))) {
      /**
       * 🔴 **MICȘORATĂ ÎNTÂI (§32, Sesiunea 147).** Aici stătea cel mai prost mesaj din aplicație:
       * *„take it again at a lower resolution"* — o instrucțiune pe care un om cu un telefon nu o
       * poate executa, fiindcă rezoluția camerei nu se schimbă din ecranul de trimitere. ⛔ Iar o
       * cerere de ofertă abandonată din motivul ăsta e un client pierdut.
       */
      const { dataUrl, bytes } = await prepareImageForUpload(file);
      if (bytes > PHOTO_MAX_BYTES) {
        // ⚠️ Rămâne un refuz — dar numai după ce s-a încercat micșorarea pe toată scara.
        setPhotoError(`"${file.name}" is too large to send, even after shrinking it. Please choose a different photo.`);
        continue;
      }
      setPhotos(list => [...list, { dataUrl, name: file.name }]);
    }
    if (photoInputRef.current) photoInputRef.current.value = '';
  };
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormState>(() => buildInitialState(prefill));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSubmitted(false);
      setError(null);
      setForm(buildInitialState(prefill));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleDone = () => {
    onSubmitted();
  };

  const toggleService = (service: string, checked: boolean) => {
    setForm(f => ({
      ...f,
      services: checked ? [...f.services, service] : f.services.filter(s => s !== service),
    }));
  };

  const setQuantity = (key: string, value: string) => {
    setForm(f => ({ ...f, quantities: { ...f.quantities, [key]: value } }));
  };

  const toIntOrUndefined = (v: string): number | undefined => {
    if (!v.trim()) return undefined;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  const handleSubmit = async () => {
    setError(null);

    if (!form.fullName.trim()) { setError('Please enter your full name.'); return; }
    if (!form.email.trim()) { setError('Please enter your email address.'); return; }
    if (!form.address.trim()) { setError('Please enter the property address.'); return; }
    if (form.services.length === 0) { setError('Please select at least one service.'); return; }

    setSubmitting(true);
    try {
      const quantities: Record<string, number> = {};
      for (const service of form.services) {
        for (const field of (fieldsByService[service] ?? [])) {
          const n = toIntOrUndefined(form.quantities[field.key] ?? '');
          if (n !== undefined) quantities[field.key] = n;
        }
      }

      const created = await submitQuoteRequest({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim(),
        postcode: form.postcode.trim() || undefined,
        customerType: form.customerType || undefined,
        propertyType: form.propertyType || undefined,
        totalBedrooms: toIntOrUndefined(form.totalBedrooms),
        totalBathrooms: toIntOrUndefined(form.totalBathrooms),
        services: form.services,
        preferredDate: form.preferredDate || undefined,
        preferredTime: form.preferredTime || undefined,
        ...quoteTimingPayload(form.timing, form.preferredDate),
        propertyDetails: form.propertyDetails.trim() || undefined,
        additionalNotes: form.additionalNotes.trim() || undefined,
        ...quantities,
      });
      /**
       * 🔴 Pozele DUPA cerere, si esecul lor NU anuleaza cererea.
       *
       * ⚠️ Textul spune exact ce s-a intamplat: cererea a ajuns, pozele nu. Un mesaj generic
       * de eroare aici ar fi cea mai proasta varianta — clientul ar retrimite tot formularul
       * si biroul ar primi doua cereri pentru aceeasi casa.
       */
      if (photos.length > 0 && created?.id) {
        const failed: string[] = [];
        for (const photo of photos) {
          try {
            await uploadQuoteRequestPhoto({ quoteRequestId: created.id, imageData: photo.dataUrl });
          } catch {
            failed.push(photo.name);
          }
        }
        if (failed.length > 0) {
          setPhotoError(`Your request was sent, but ${failed.length} photo${failed.length === 1 ? '' : 's'} could not be uploaded. We have everything else — mention the photos in a reply if they matter.`);
        }
      }
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={v => { if (!v) handleDone(); }}>
        <DialogContent className="max-w-md">
          <div className="text-center py-6 space-y-3">
            <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
            <h3 className="text-lg font-semibold">Quote Request Submitted</h3>
            <p className="text-sm text-muted-foreground">
              Your quote request has been received. It will appear in your Upcoming Jobs as an <span className="font-medium">Enquiry</span> once processed.
            </p>
            <p className="text-xs text-muted-foreground">ACHU will review your request and get back to you shortly.</p>
            {/*
              🔴 ACHU-561 — AICI, pe ecranul de confirmare, nu pe formular.
              Descoperit de test: mesajul se seta corect si nu-l vedea NIMENI, fiindca ecranul
              acesta inlocuieste formularul in aceeasi clipa. Exact tiparul ACHU-536 — ceva
              calculat pe care niciun ecran nu-l afiseaza — de data asta prins inainte sa plece.
            */}
            {photoError && (
              <p className="text-sm text-amber-600 dark:text-amber-500">{photoError}</p>
            )}
            <Button onClick={handleDone} className="w-full">Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold">Request a Quote</h3>
            <p className="text-sm text-muted-foreground">Tell us about your property and the services you need.</p>
          </div>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contact Details</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label htmlFor="quoteformd-full-name">Full Name</Label><Input id="quoteformd-full-name" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} /></div>
              <div><Label htmlFor="quoteformd-email">Email</Label><Input id="quoteformd-email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label htmlFor="quoteformd-phone">Phone</Label><Input id="quoteformd-phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div className="col-span-2"><Label htmlFor="quoteformd-address">Address</Label><Input id="quoteformd-address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div><Label htmlFor="quoteformd-postcode">Postcode</Label><Input id="quoteformd-postcode" value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))} /></div>
              <div>
                <Label htmlFor="quoteformd-customer-type">Customer Type</Label>
                <Select value={form.customerType} onValueChange={v => setForm(f => ({ ...f, customerType: v }))}>
                  <SelectTrigger id="quoteformd-customer-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{VALID_CUSTOMER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Property Details</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3 sm:col-span-1">
                <Label htmlFor="quoteformd-property-type">Property Type</Label>
                <Select value={form.propertyType} onValueChange={v => setForm(f => ({ ...f, propertyType: v }))}>
                  <SelectTrigger id="quoteformd-property-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{VALID_PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="quoteformd-total-bedrooms">Total Bedrooms</Label><Input id="quoteformd-total-bedrooms" type="number" min="0" value={form.totalBedrooms} onChange={e => setForm(f => ({ ...f, totalBedrooms: e.target.value }))} /></div>
              <div><Label htmlFor="quoteformd-total-bathrooms">Total Bathrooms</Label><Input id="quoteformd-total-bathrooms" type="number" min="0" value={form.totalBathrooms} onChange={e => setForm(f => ({ ...f, totalBathrooms: e.target.value }))} /></div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Select Services</h4>
            <div className="grid grid-cols-2 gap-2">
              {serviceNames.map(service => (
                <label key={service} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.services.includes(service)} onCheckedChange={c => toggleService(service, c === true)} />
                  {service}
                </label>
              ))}
            </div>

            {form.services.map(service => (
              <div key={service} className="border rounded-md p-3 space-y-2">
                <p className="text-sm font-medium">{service} — quantities</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(fieldsByService[service] ?? []).map(field => (
                    <div key={field.key}>
                      <Label htmlFor={`qfd-${service}-${field.key}`} className="text-xs">{field.label}</Label>
                      <Input
                        id={`qfd-${service}-${field.key}`}
                        type="number"
                        min="0"
                        value={form.quantities[field.key] ?? ''}
                        onChange={e => setQuantity(field.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Additional Information</h4>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="quoteformd-preferred-date">Preferred Date</Label><DateField id="quoteformd-preferred-date" value={form.preferredDate} onChange={e => setForm(f => ({ ...f, preferredDate: e.target.value }))} /></div>
              <div><Label htmlFor="quoteformd-preferred-time">Preferred Time</Label><TimeField id="quoteformd-preferred-time" value={form.preferredTime} onChange={e => setForm(f => ({ ...f, preferredTime: e.target.value }))} /></div>
              <QuoteTimingFields
                idPrefix="quoteformd"
                value={form.timing}
                onChange={t => setForm(f => ({ ...f, timing: t }))}
                hasPreferredDate={!!form.preferredDate}
              />
            </div>
            <div><Label htmlFor="quoteformd-property-details">Property Details</Label><Textarea id="quoteformd-property-details" value={form.propertyDetails} onChange={e => setForm(f => ({ ...f, propertyDetails: e.target.value }))} placeholder="Any extra detail about the property that helps us quote accurately" /></div>
            <div><Label htmlFor="quoteformd-additional-notes">Additional Notes</Label><Textarea id="quoteformd-additional-notes" value={form.additionalNotes} onChange={e => setForm(f => ({ ...f, additionalNotes: e.target.value }))} placeholder="Anything else we should know?" /></div>

            {/*
              ACHU-561 — pozele, langa notele despre proprietate, fiindca raspund la aceeasi
              intrebare: ce e de curatat. 🔴 Textul spune CE ajuta, nu doar „adauga poze" —
              o poza a bucatariei intregi spune mai mult decat trei ale aceluiasi blat, iar
              biroul stabileste pretul din ele.

              ⚠️ Si spune cine le vede. Sunt fotografii din casa unui om: cine incarca trebuie
              sa stie unde ajung INAINTE sa aleaga fisierul, nu dupa (aceeasi regula ca la
              `PropertyInfoEditDialog`, ACHU-514).
            */}
            <div className="space-y-2">
              <Label htmlFor="quoteformd-photos">Photos (optional)</Label>
              <p className="text-xs text-muted-foreground">
                A photo of each area you want cleaned helps us quote accurately without visiting.
                Only ACHU sees these. Up to {MAX_QUOTE_PHOTOS}, 10MB each.
              </p>
              <input
                id="quoteformd-photos"
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
                onChange={handlePhotoPick}
              />
              {photoError && <p className="text-xs text-destructive">{photoError}</p>}
              {photos.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {photos.map((p, i) => (
                    <div key={`${p.name}-${i}`} className="relative">
                      <img src={p.dataUrl} alt={p.name} className="aspect-square w-full rounded-md object-cover" />
                      <button
                        type="button"
                        aria-label={`Remove ${p.name}`} title={`Remove ${p.name}`}
                        className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                        onClick={() => setPhotos(list => list.filter((_, j) => j !== i))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Quote Request
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

