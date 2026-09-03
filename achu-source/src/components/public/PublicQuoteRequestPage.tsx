import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DateField from '@/components/shared/DateField';
import TimeField from '@/components/shared/TimeField';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { CheckCircle, Loader2 } from 'lucide-react';
import { submitPublicQuoteRequest } from '@/lib/endpoints';
import { ApiError } from '@/lib/apiClient';
// §6 (Sesiunea 159) — cele două întrebări despre timp, aceleași pe amândouă formularele.
import QuoteTimingFields from '@/components/shared/QuoteTimingFields';
import { INITIAL_QUOTE_TIMING, QuoteTimingState, quoteTimingPayload } from '@/lib/quoteTiming';
/**
 * §48 „Consistent page titles" (Sesiunea 148) — ⚠️ **titlul se pune AICI**, nu prin `DocumentTitle`:
 * pagina asta e întoarsă înaintea routerului (`App.tsx`), deci nu are `useLocation`. Cuvântul vine
 * din aceeași hartă, ca să nu existe o a doua propoziție care să se despartă de ea.
 */
import { documentTitleFor } from '@/lib/pageTitle';
// ⚠️ `VALID_PROPERTY_TYPES` a plecat odată cu secțiunea Property Details (17/08/2026) — clichetul
// de lint e EXACT, deci un import rămas nefolosit sparge poarta.
import { VALID_CUSTOMER_TYPES } from '@/lib/validation';
// §8 felia a doua — lista vine din catalog (`services` + `service_items`), nu dintr-un fișier.
import { useServiceCatalogue } from '@/lib/useServiceCatalogue';
import { BrandLogo } from '@/components/shared/BrandLogo';
import PublicStorageNotice from './PublicStorageNotice';

/**
 * Sesiunea 26 (ACHU-186) — public, no-login quote request form, matching how
 * the old Zite public form worked: reachable by anyone, at /request-quote
 * (see App.tsx — this path is checked before the login gate). Submits to
 * publicQuoteRequest.ts (backend), which keeps the request in "New" for
 * manual Admin review rather than auto-converting (owner decision — public
 * submissions carry real spam risk, unlike the Customer-authenticated form).
 */
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
  website: string; // honeypot — must stay empty, hidden from real visitors
}

const INITIAL_STATE: FormState = {
  fullName: '', email: '', phone: '', address: '', postcode: '',
  customerType: '', propertyType: '', totalBedrooms: '', totalBathrooms: '',
  services: [], quantities: {}, preferredDate: '', preferredTime: '',
  timing: INITIAL_QUOTE_TIMING,
  propertyDetails: '', additionalNotes: '', website: '',
};

export default function PublicQuoteRequestPage() {
  /**
   * §8 felia a doua — serviciile și pozițiile lor, din catalog.
   *
   * 🔴 **`loading` și `error` SE CITESC, și e chiar reparația din 29/08/2026.** ⛔ Până azi pagina
   * lua doar cele două liste, iar hook-ul avertiza în capul lui exact ce s-a întâmplat: *„un ecran
   * care desenează înainte de răspuns arată «niciun serviciu» — adică exact ca un catalog gol, care
   * e o defecțiune"*.
   *
   * ⚠️ **Trei stări diferite arătau identic** — o secțiune goală, fără o vorbă: se încarcă · cererea
   * a picat · catalogul chiar e gol. 🔴 Un vizitator vedea „SELECT SERVICES" și nimic sub el, deci
   * pleca; iar biroul n-avea de unde ști că a pierdut o cerere, fiindcă nimeni nu raportează un
   * formular pe care nu l-a putut completa.
   *
   * ⛔ **Numele sunt `catalogue*`** fiindcă pagina are deja un `error` al ei, pentru trimitere. Două
   * lucruri diferite cu același nume ar fi fost următoarea greșeală.
   */
  const { serviceNames, fieldsByService, loading: catalogueLoading, errorDetail: catalogueErrorDetail, usingFallback } = useServiceCatalogue();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * §48 (Sesiunea 148) — ⚠️ **o singură dată**, nu la fiecare randare: pagina nu navighează. ⛔ Și
   * cu garda de `null`, ca peste tot: dacă harta n-are cuvântul, titlul din `index.html` rămâne —
   * niciodată un tab gol pe pagina pe care o vede un client.
   */
  useEffect(() => {
    const title = documentTitleFor('/request-quote');
    if (title) document.title = title;
  }, []);

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

      await submitPublicQuoteRequest({
        website: form.website || undefined,
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
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <div className="max-w-md w-full bg-background rounded-xl shadow-sm border p-8 text-center space-y-3">
          <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
          <h1 className="text-lg font-semibold">Quote Request Submitted</h1>
          <p className="text-sm text-muted-foreground">
            Thank you — we've received your request. ACHU will review it and get back to you shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="max-w-2xl mx-auto bg-background rounded-xl shadow-sm border p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <BrandLogo />
          <h1 className="text-lg font-semibold">Request a Quote</h1>
          <p className="text-sm text-muted-foreground">Tell us about your property and the services you need — no account required.</p>
        </div>

        {/* Honeypot: hidden from real visitors, some bots fill every field blindly. */}
        <input
          type="text"
          name="website"
          value={form.website}
          onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] w-px h-px overflow-hidden"
        />

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contact Details</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label htmlFor="publicquot-full-name">Full Name</Label><Input id="publicquot-full-name" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} /></div>
            <div><Label htmlFor="publicquot-email">Email</Label><Input id="publicquot-email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><Label htmlFor="publicquot-phone">Phone</Label><Input id="publicquot-phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className="col-span-2"><Label htmlFor="publicquot-address">Address</Label><Input id="publicquot-address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div><Label htmlFor="publicquot-postcode">Postcode</Label><Input id="publicquot-postcode" value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))} /></div>
            <div>
              <Label htmlFor="publicquot-customer-type">Customer Type</Label>
              <Select value={form.customerType} onValueChange={v => setForm(f => ({ ...f, customerType: v }))}>
                <SelectTrigger id="publicquot-customer-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{VALID_CUSTOMER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/*
          🔴 Secțiunea PROPERTY DETAILS — tipul locuinței, total dormitoare, total băi — SCOASĂ
          la cererea lui Roberto, 17/08/2026: *„Poi sa scoti properti details cu fieldurile alea
          doua?"*.

          ⚠️ Doar de pe ECRANUL PUBLIC. Câmpurile există în continuare pe `QuoteRequest`, pe ruta
          publică (opționale) și pe ecranul biroului — cererile vechi își păstrează valorile, iar
          biroul le poate completa. Scoase din formular fiindcă un vizitator alege oricum
          serviciile cu cantitățile lor mai jos, iar totalurile de aici nu intrau în niciun preț
          (`PRICE_FIELDS` numără camerele PE SERVICIU, nu pe casă).

          ⛔ `form.propertyType` / `totalBedrooms` / `totalBathrooms` rămân în starea formularului,
          goale: trimiterea le omite deja prin `|| undefined`, exact ca la un vizitator care nu
          le completa — deci nimic nu s-a schimbat pe server.
        */}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Select Services</h2>

          {/*
            ⚠️ **Trei stări, trei propoziții** — niciuna nu mai e o secțiune goală.
            🔴 Mesajul de eroare spune ce poate face omul (reîncarcă, sună biroul), nu doar că e
            greșit: lecția ACHU-576 — cine primește un refuz fără alternativă încearcă din nou
            același lucru.
            ⛔ Catalogul gol NU e „niciun serviciu disponibil": e o defecțiune de configurare, și o
            spune ca atare, ca la `assertKnownServices` pe server.
          */}
          {catalogueLoading ? (
            <p className="text-sm text-muted-foreground">Loading the list of services…</p>
          ) : (
            <>
              {/*
                🔴 **BIFELE SE DESENEAZĂ MEREU — reparația din 29/08/2026 (ACHU-810).**
                ⛔ Până azi, o cerere picată lăsa secțiunea GOALĂ, iar vizitatorul pleca. Măsurat:
                opt zile, din 21/08, pe singura pagină publică a aplicației.
                ⚠️ Când lista vine din catalog, ea e sursa. Când nu vine, `usingFallback` pune cele
                11 servicii din cod — formularul rămâne trimisibil, iar biroul primește cererea.
              */}
              <div className="grid grid-cols-2 gap-2">
                {serviceNames.map(service => (
                  <label key={service} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.services.includes(service)} onCheckedChange={c => toggleService(service, c === true)} />
                    {service}
                  </label>
                ))}
              </div>

              {/*
                ⚠️ **Nota o citește CLIENTUL**, deci spune ce înseamnă pentru el — că lista poate fi
                incompletă și că poate scrie în „Additional Notes" — nu că serverul a dat eroare.
                ⛔ Motivul tehnic rămâne dedesubt, mic, pentru cine repară.
              */}
              {usingFallback && (
                <div className="space-y-1 rounded-md border border-muted p-3">
                  <p className="text-sm text-muted-foreground">
                    We could not load our latest service list, so this is our standard one. If what you need is not
                    here, describe it in “Additional Notes” below and we will come back to you.
                  </p>
                  {catalogueErrorDetail && (
                    <p className="text-xs text-muted-foreground font-mono">{catalogueErrorDetail}</p>
                  )}
                </div>
              )}
            </>
          )}

          {form.services.map(service => (
            <div key={service} className="border rounded-md p-3 space-y-2">
              <p className="text-sm font-medium">{service} — quantities</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(fieldsByService[service] ?? []).map(field => (
                  <div key={field.key}>
                    <Label htmlFor={`pqr-${service}-${field.key}`} className="text-xs">{field.label}</Label>
                    <Input
                      id={`pqr-${service}-${field.key}`}
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
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Additional Information</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="publicquot-preferred-date">Preferred Date</Label><DateField id="publicquot-preferred-date" value={form.preferredDate} onChange={e => setForm(f => ({ ...f, preferredDate: e.target.value }))} /></div>
            <div><Label htmlFor="publicquot-preferred-time">Preferred Time</Label><TimeField id="publicquot-preferred-time" value={form.preferredTime} onChange={e => setForm(f => ({ ...f, preferredTime: e.target.value }))} /></div>
            <QuoteTimingFields
              idPrefix="publicquot"
              value={form.timing}
              onChange={t => setForm(f => ({ ...f, timing: t }))}
              hasPreferredDate={!!form.preferredDate}
            />
          </div>
          <div><Label htmlFor="publicquot-property-details">Property Details</Label><Textarea id="publicquot-property-details" value={form.propertyDetails} onChange={e => setForm(f => ({ ...f, propertyDetails: e.target.value }))} placeholder="Any extra detail about the property that helps us quote accurately" /></div>
          <div><Label htmlFor="publicquot-additional-notes">Additional Notes</Label><Textarea id="publicquot-additional-notes" value={form.additionalNotes} onChange={e => setForm(f => ({ ...f, additionalNotes: e.target.value }))} placeholder="Anything else we should know?" /></div>
        </section>

        {/**
          * 🔴 ACHU-410 — WHAT WE DO WITH THE DETAILS, SAID WHERE THEY ARE HANDED OVER.
          *
          * This form asks a stranger for their name, phone, email, home address and details
          * about their property, and said nothing at all about any of it. UK GDPR Article 13
          * requires the person to be told AT THE POINT OF COLLECTION who is collecting, what
          * for, on what lawful basis, how long it is kept and what rights they have.
          *
          * ⚠️ Deliberately NOT a consent tick-box. The lawful basis for answering a quote
          * request is legitimate interests / steps towards a contract — the person asked us
          * for a price. A consent box here would be worse than nothing: consent can be
          * withdrawn, so it would imply we must erase details we are in fact required to keep
          * once the enquiry turns into an invoice (HMRC retention — see lib/gdprAnonymisePolicy.ts).
          *
          * ⚠️ The sentence below says "after 12 months" rather than "once it is clearly no longer
          * live", and that changed in ACHU-218 (14/08/2026) because the mechanism arrived: the
          * retention sweep deletes them. A promise on this page should name the number the code
          * enforces — a vaguer wording was honest only while nothing enforced anything.
          *
          * ⚠️ It is placed ABOVE the button, not in a footer: it has to be visible in the same
          * glance as the act of submitting to count as being told.
          */}
        <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground">How we use your details</p>
          <p>
            ACHU uses the details above only to prepare and discuss your quote, and to arrange the
            work if you go ahead. We do not sell them, and we do not share them with anyone outside
            ACHU except where the law requires it.
          </p>
          <p>
            If you become a customer we keep the records tied to your invoices for as long as HMRC
            requires. If you do not, we delete your enquiry automatically after 12 months.
          </p>
          <p>
            You can ask us at any time what we hold about you, ask us to correct it, or ask us to
            erase it — write to{' '}
            <a href="mailto:info@achu.uk" className="underline">info@achu.uk</a>. Where we have to
            keep an invoice for tax purposes we will tell you, and remove everything we are not
            required to keep.
          </p>
        </div>

        {/* ACHU-218 — ce se salvează în browser. Măsurat, nu presupus: vezi fișierul. */}
        <PublicStorageNotice />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Quote Request
          </Button>
        </div>
      </div>
    </div>
  );
}

