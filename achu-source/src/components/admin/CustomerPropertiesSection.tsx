/**
 * ACHU-570 (Sesiunea 125, `Backlog_Functionalitati_Viitoare` §5) — CASELE UNUI CLIENT.
 *
 * Cerut de Archana pe 13/08/2026: *„Porneste properties"*.
 *
 * ─── Golul, în cuvintele problemei ────────────────────────────────────────
 * 🔴 Până acum, un client cu două case era **două fișe de client** — două istorii de facturare,
 * două abonamente, același om numărat de două ori. Iar adresa vizitei se **retasta la mână** în
 * dialogul de programare, deci nu exista niciun loc în care să se corecteze o dată pentru toate.
 *
 * ─── Ce arată ecranul, și de ce fiecare bucată e acolo ────────────────────
 * ⚠️ **Numărul de vizite pe fiecare casă** decide dacă butonul spune „Delete" sau „Switch off".
 * Un buton care spune „Delete" și apoi refuză e mai rău decât unul care spune de la început ce
 * se poate face — iar serverul refuză ștergerea unei case cu vizite, ca acelea să nu rămână
 * fără să spună unde au fost.
 *
 * 🔴 **Rândul care spune că principala e adresa de facturare.** Fără el, cineva ar muta
 * principala ca să „aranjeze lista" și ar schimba, fără să știe, unde pleacă facturile.
 */

import { useEffect, useState, useCallback } from 'react';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Home, Star, Power, Trash2, Plus, Pencil, Loader2, Info, AlertTriangle, KeyRound, ListChecks, History, Image } from 'lucide-react';
import { fmtDate } from '@/lib/format';
import { toast } from 'sonner';
import {
  getCustomerProperties, addCustomerProperty, updateCustomerProperty,
  makeCustomerPropertyPrimary, deleteCustomerProperty,
  type PropertyRecord,
} from '@/lib/endpoints';
import { errMsg } from '@/lib/errorMessage';
// ACHU-574 — cele 11 câmpuri din Grupul A, în fișierul lor (clichetul de mărime, §2.1a).
import PropertyFeatureFields from './PropertyFeatureFields';
// ACHU-575 — Grupul C, tot în fișier propriu, din același motiv.
import PropertyRiskFields from './PropertyRiskFields';
// ACHU-576 — Grupul B. ⚠️ Al treilea grup, al treilea fișier: `CustomerPropertiesSection` ar fi
// trecut de 600 de rânduri dacă fiecare formular ar fi rămas în el.
import PropertyAccessFields from './PropertyAccessFields';
// ACHU-577 — Grupul E: munca repetată la aceeași casă. Al patrulea grup, al patrulea fișier.
import PropertyRecurringWork from './PropertyRecurringWork';
// ACHU-578 — Grupul D: drumul până acolo. Al cincilea grup, al cincilea fișier.
import PropertyTravelFields from './PropertyTravelFields';
// ACHU-579 — istoricul unei case, în dialogul lui. ⚠️ Nu inline: secțiunea e la clichet.
import PropertyHistoryDialog from './PropertyHistoryDialog';
// ACHU-581 — pozele și documentele casei. ⛔ Admin-only: decizia lui Roberto din 14/08.
import PropertyFilesDialog from './PropertyFilesDialog';
import {
  EMPTY_FEATURES, FEATURES, EMPTY_RISK, RISK_FLAGS, RISK_TEXTS, EMPTY_ACCESS, ACCESS_TEXTS,
  EMPTY_TRAVEL, TRAVEL_TEXTS,
} from '@/lib/propertyTypes';

/** Aceeași listă ca pe server (`VALID_PROPERTY_TYPES`), care e aceeași ca la cererile de ofertă. */
const PROPERTY_TYPES = ['House', 'Flat', 'Studio', 'Office', 'Commercial Unit', 'Other'];

const EMPTY = { label: '', address: '', postcode: '', propertyType: '', bedrooms: '', bathrooms: '', floors: '', notes: '', standardInstructions: '', pricePerVisit: '', ...EMPTY_FEATURES, ...EMPTY_RISK, ...EMPTY_ACCESS, ...EMPTY_TRAVEL };

/** `''` → `null`, iar un număr gol rămâne gol: 0 dormitoare e un fapt, „nu știu" nu e 0. */
const num = (v: string): number | null => (v.trim() === '' ? null : Number(v));

export default function CustomerPropertiesSection({ customerId }: { customerId: string }) {
  /**
   * ⚠️ `useTrackedRequest`, nu `useState` + `setLoading` într-un efect — acela ridică
   * `react-hooks/set-state-in-effect`, iar clichetul de lint e EXACT (`CLAUDE.md` §2.1a).
   */
  const req = useTrackedRequest<{ records: PropertyRecord[] }>({ timeoutMs: 20000 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  // ACHU-579 — care casă are istoricul deschis. `null` = niciunul.
  const [historyFor, setHistoryFor] = useState<{ id: string; label: string } | null>(null);
  // ACHU-581 — care casă are dialogul de fișiere deschis. `null` = niciunul.
  const [filesFor, setFilesFor] = useState<{ id: string; label: string } | null>(null);

  const { fire } = req;
  const load = useCallback(() => {
    fire(() => getCustomerProperties({ customerId }));
  }, [fire, customerId]);

  useEffect(() => { load(); }, [load]);

  const records = req.data?.records ?? [];
  const loading = !req.data && !req.error;

  const openAdd = () => { setForm(EMPTY); setEditingId(null); setShowAdd(true); };
  const openEdit = (p: PropertyRecord) => {
    setForm({
      label: p.label,
      address: p.address ?? '',
      postcode: p.postcode ?? '',
      propertyType: p.propertyType ?? '',
      bedrooms: p.bedrooms === null ? '' : String(p.bedrooms),
      bathrooms: p.bathrooms === null ? '' : String(p.bathrooms),
      floors: p.floors === null ? '' : String(p.floors),
      notes: p.notes ?? '',
      // ACHU-574. ⚠️ `null` → câmp gol, NU „0" și NU „No": e „nu s-a consemnat".
      floorAreaSqm: p.floorAreaSqm === null ? '' : String(p.floorAreaSqm),
      rooms: p.rooms === null ? '' : String(p.rooms),
      kitchens: p.kitchens === null ? '' : String(p.kitchens),
      furnishing: p.furnishing ?? '',
      occupancy: p.occupancy ?? '',
      hasGarden: p.hasGarden, hasGarage: p.hasGarage, hasConservatory: p.hasConservatory,
      hasBalcony: p.hasBalcony, hasLoft: p.hasLoft, hasBasement: p.hasBasement,
      /**
       * ACHU-575 — Grupul C. ⚠️ `?? ''` pe texte și `?? null` pe bife, NU `=== null`: un răspuns
       * dinaintea acestei felii (sau o fixtură de test) **nu are cheia deloc**, iar `undefined`
       * într-un `<Textarea value>` face câmpul necontrolat și React se plânge. Exact defectul
       * „undefined m²" din ACHU-574, prins atunci de un test vechi.
       */
      hasPets: p.hasPets ?? null, hasChildren: p.hasChildren ?? null, hasSmokers: p.hasSmokers ?? null,
      fragileItems: p.fragileItems ?? '', restrictedRooms: p.restrictedRooms ?? '',
      hazardNotes: p.hazardNotes ?? '', previousDamage: p.previousDamage ?? '',
      // ACHU-576 — Grupul B. Aceeași regulă `?? ''` / `?? null` ca la Grupul C, din același
      // motiv: un răspuns dinaintea acestei felii nu are cheia deloc, iar `undefined` într-un
      // `value` face câmpul necontrolat.
      accessInstructions: p.accessInstructions ?? '',
      hasLift: p.hasLift ?? null,
      floorNumber: (p.floorNumber ?? null) === null ? '' : String(p.floorNumber),
      keyLocation: p.keyLocation ?? '',
      alarmInstructions: p.alarmInstructions ?? '',
      entryCode: p.entryCode ?? '',
      waterAccess: p.waterAccess ?? '',
      electricityAccess: p.electricityAccess ?? '',
      wasteDisposalLocation: p.wasteDisposalLocation ?? '',
      // ACHU-577 — aceeași regulă `?? ''`: un răspuns dinaintea feliei nu are cheia deloc.
      standardInstructions: p.standardInstructions ?? '',
      // ACHU-578 — Grupul D. Aceeași regulă `?? ''` / `?? null`, din același motiv.
      parkingType: p.parkingType ?? '',
      parkingPermitRequired: p.parkingPermitRequired ?? null,
      inCongestionZone: p.inCongestionZone ?? null,
      inUlezZone: p.inUlezZone ?? null,
      parkingNotes: p.parkingNotes ?? '',
      drivingZoneNotes: p.drivingZoneNotes ?? '',
      // ACHU-580 — ca număr-text: un câmp gol NU e „0", e „nu s-a consemnat".
      pricePerVisit: p.pricePerVisit ?? '',
    });
    setEditingId(p.id);
    setShowAdd(true);
  };

  const handleSave = async () => {
    if (!form.label.trim() || saving) return;
    setSaving(true);
    const body = {
      label: form.label.trim(),
      address: form.address.trim() || null,
      postcode: form.postcode.trim() || null,
      propertyType: form.propertyType || null,
      bedrooms: num(form.bedrooms),
      bathrooms: num(form.bathrooms),
      floors: num(form.floors),
      notes: form.notes.trim() || null,
      // ACHU-574 — trimise ÎNTOTDEAUNA de aici, fiindcă formularul le cunoaște pe toate.
      // ⚠️ Butonul de stingere, mai jos, e cel care NU le trimite — și tocmai de aceea
      // serverul tratează cheia absentă ca „nu atinge".
      floorAreaSqm: num(form.floorAreaSqm),
      rooms: num(form.rooms),
      kitchens: num(form.kitchens),
      furnishing: form.furnishing || null,
      occupancy: form.occupancy || null,
      ...Object.fromEntries(FEATURES.map(f => [f.key, form[f.key]])),
      // ACHU-575 — Grupul C. ⚠️ Un text gol pleacă drept `null` („nu s-a consemnat"), nu ca `''`:
      // altfel căutarea după „ce case au consemnat pericole" ar întoarce și casele necompletate.
      ...Object.fromEntries(RISK_FLAGS.map(f => [f.key, form[f.key]])),
      ...Object.fromEntries(RISK_TEXTS.map(t => [t.key, form[t.key].trim() || null])),
      // ACHU-576 — Grupul B. ⚠️ Etajul e un NUMĂR care poate fi 0 („parter") — deci `num`, care
      // deosebește golul de zero, nu `Number(...) || null`.
      accessInstructions: form.accessInstructions.trim() || null,
      hasLift: form.hasLift,
      floorNumber: num(form.floorNumber),
      ...Object.fromEntries(ACCESS_TEXTS.map(t => [t.key, form[t.key].trim() || null])),
      // ACHU-577 — Grupul E. Punctele de checklist au ruta lor, deci nu trec pe aici.
      standardInstructions: form.standardInstructions.trim() || null,
      // ACHU-578 — Grupul D. ⚠️ Un text gol pleacă drept `null` („nu s-a consemnat"), ca la C.
      parkingType: form.parkingType || null,
      parkingPermitRequired: form.parkingPermitRequired,
      inCongestionZone: form.inCongestionZone,
      inUlezZone: form.inUlezZone,
      ...Object.fromEntries(TRAVEL_TEXTS.map(t => [t.key, form[t.key].trim() || null])),
      /**
       * 🔴 ACHU-580 — `num`, care deosebește GOLUL de ZERO. ⛔ Un `Number(x) || null` ar fi
       * trimis `null` pentru o casă la care s-a scris deliberat `0` (curățenie oferită), iar
       * prețul ei ar fi devenit „nu s-a consemnat" la prima re-salvare.
       */
      pricePerVisit: num(form.pricePerVisit),
    };
    try {
      if (editingId) {
        const res = await updateCustomerProperty({ id: editingId, ...body });
        /**
         * ⚠️ Serverul spune dacă principala s-a mutat. Se **arată**, fiindcă mutarea schimbă
         * adresa de facturare — o schimbare tăcută în urma unei bifări ar fi exact felul de
         * efect secundar pe care nimeni nu-l caută până când o factură pleacă greșit.
         */
        toast.success(res.primaryMovedTo ? 'Saved — the main address moved to another property' : 'Saved');
      } else {
        const res = await addCustomerProperty({ customerId, ...body });
        toast.success(res.isPrimary ? 'Added — this is now the main address' : 'Added');
      }
      setShowAdd(false);
      setEditingId(null);
      setForm(EMPTY);
      load();
    } catch (e) {
      // Mesajul serverului AȘA CUM E: el spune ce se poate face în loc („Switch it off instead").
      toast.error(errMsg(e) || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    try { await fn(); toast.success(okMsg); load(); }
    catch (e) { toast.error(errMsg(e) || 'Could not do that.'); }
  };

  /**
   * 🔴 ACHU-574 — trimite DOAR ce schimbă, plus ce e obligatoriu (`label`).
   *
   * ⚠️ Înainte enumera fiecare câmp, ceea ce a devenit periculos odată cu cele 11 noi: orice
   * câmp uitat din listă ar fi fost **golit tăcut** la o simplă stingere (clasa ACHU-559).
   * Serverul tratează acum cheia **absentă** ca „nu atinge" — deci lista scurtă e cea sigură,
   * iar una lungă ar fi din nou o listă de ținut la zi.
   */
  const toggleActive = (p: PropertyRecord) => act(
    () => updateCustomerProperty({
      id: p.id, label: p.label, address: p.address, postcode: p.postcode, notes: p.notes,
      isActive: !p.isActive,
    }),
    p.isActive ? 'Switched off' : 'Switched back on',
  );

  const rooms = (p: PropertyRecord) => [
    p.bedrooms === null ? null : `${p.bedrooms} bed`,
    p.bathrooms === null ? null : `${p.bathrooms} bath`,
    p.floors === null ? null : `${p.floors} floor${p.floors === 1 ? '' : 's'}`,
    /**
     * ACHU-574 — suprafața și camerele intră în același rând: sunt tot „cât e de mare".
     * ⚠️ **`?? null`, nu `=== null`**, și nu e stil: un răspuns dinaintea acestei felii (sau o
     * fixtură de test) **nu are cheia deloc**, iar `undefined` ar fi trecut de o verificare de
     * `null` și ar fi tipărit „undefined m²" pe ecranul biroului. Prins de un test vechi.
     */
    (p.floorAreaSqm ?? null) === null ? null : `${p.floorAreaSqm} m²`,
    (p.rooms ?? null) === null ? null : `${p.rooms} room${p.rooms === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' · ');

  /**
   * ⚠️ **Se listează DOAR ce are casa** (`=== true`), nu și ce nu are. Un rând care înșiră
   * „no garden · no garage" ar fi zgomot — iar ce nu s-a consemnat nu apare deloc, fiindcă a
   * afirma absența unui lucru pe care nu l-a întrebat nimeni e chiar greșeala pe care cele
   * trei stări o evită.
   */
  const featureList = (p: PropertyRecord) => [
    ...FEATURES.filter(f => p[f.key] === true).map(f => f.label),
    p.furnishing, p.occupancy,
  ].filter(Boolean).join(' · ');

  /**
   * ACHU-575 — câte lucruri s-au consemnat despre ce poate merge prost.
   *
   * ⚠️ **`!= null` pe bife, nu `=== true`** — spre deosebire de `featureList` de mai sus, unde se
   * listează doar ce ARE casa. Aici „nu are animale" e tot un răspuns dat de cineva, iar
   * curățătorul îl va vedea; deci se numără.
   */
  const riskCount = (p: PropertyRecord) =>
    RISK_FLAGS.filter(f => p[f.key] != null).length
    + RISK_TEXTS.filter(t => (p[t.key] ?? '').trim() !== '').length;

  /** ACHU-576 — câte lucruri s-au consemnat despre cum se intră. Aceeași numărătoare ca la risc. */
  const accessCount = (p: PropertyRecord) =>
    ACCESS_TEXTS.filter(t => (p[t.key] ?? '').trim() !== '').length
    + ((p.accessInstructions ?? '').trim() === '' ? 0 : 1)
    + ((p.hasLift ?? null) === null ? 0 : 1)
    + ((p.floorNumber ?? null) === null ? 0 : 1);

  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <Home className="h-4 w-4" aria-hidden="true" />
          Properties
          {records.length > 0 && <Badge variant="secondary">{records.length}</Badge>}
        </h4>
        <Button type="button" variant="outline" size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" aria-hidden="true" />Add a property
        </Button>
      </div>

      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          The <strong>main</strong> property is the address on this customer’s record — it is what
          invoices use. Changing its address changes theirs.
        </span>
      </p>

      {loading && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading…</div>}
      {req.error && <div className="text-sm text-destructive">Could not load the properties.</div>}

      {!loading && !req.error && records.length === 0 && (
        <div className="text-sm text-muted-foreground">No properties yet.</div>
      )}

      <div className="space-y-1.5">
        {records.map(p => (
          <div key={p.id} className={`rounded-md px-2 py-1.5 ${p.isActive ? 'bg-muted/40' : 'bg-muted/20 opacity-70'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-sm">{p.label}</span>
                  {p.isPrimary && <Badge className="gap-1"><Star className="h-3 w-3" aria-hidden="true" />Main address</Badge>}
                  {!p.isActive && <Badge variant="outline">Switched off</Badge>}
                  {p.propertyType && <Badge variant="secondary">{p.propertyType}</Badge>}
                </div>
                {(p.address || p.postcode) && (
                  <div className="text-xs text-muted-foreground">{[p.address, p.postcode].filter(Boolean).join(', ')}</div>
                )}
                {rooms(p) && <div className="text-xs text-muted-foreground">{rooms(p)}</div>}
                {featureList(p) && <div className="text-xs text-muted-foreground">{featureList(p)}</div>}
                {/*
                  🔴 ACHU-575 — pe rândul din listă se arată DOAR că există ceva de citit, nu ce
                  anume. Textul întreg („câinele mușcă", „vaza din hol") se vede în formular și pe
                  cardul curățătorului; înșirat aici, ar face lista de case nefolosibilă exact
                  pentru biroul care caută altceva. ⚠️ `riskCount` numără și `false` — „nu are
                  animale" e un fapt consemnat de cineva, nu o absență.
                */}
                {/* ACHU-577 — câte puncte proprii are casa. ⚠️ Doar numărul, ca la risc: lista
                    întreagă într-o listă de case ar face-o nefolosibilă. */}
                {p.checklistPointCount > 0 && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <ListChecks className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {p.checklistPointCount} extra checklist point{p.checklistPointCount === 1 ? '' : 's'}
                  </div>
                )}
                {riskCount(p) > 0 && (
                  <div className="text-xs text-amber-700 dark:text-amber-500 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {riskCount(p)} thing{riskCount(p) === 1 ? '' : 's'} the cleaner will see
                  </div>
                )}
                {/*
                  ACHU-576 — pe rândul din listă se arată DOAR că există instrucțiuni, nu care
                  sunt: un cod de poartă înșirat într-o listă de case e un cod de poartă pe un
                  ecran deschis într-un birou. ⚠️ Data e cea care contează aici — un cod de anul
                  trecut e chiar lucrul pe care biroul trebuie să-l reverifice.
                */}
                {accessCount(p) > 0 && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <KeyRound className="h-3 w-3 shrink-0" aria-hidden="true" />
                    How to get in recorded
                    {p.accessInstructionsUpdatedAt ? ` · updated ${fmtDate(p.accessInstructionsUpdatedAt)}` : ''}
                  </div>
                )}
                {p.notes && <div className="text-xs text-muted-foreground italic">{p.notes}</div>}
                <div className="text-xs text-muted-foreground">
                  {p.jobCount === 0 ? 'No jobs yet' : `${p.jobCount} job${p.jobCount === 1 ? '' : 's'}`}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/*
                  🔴 ACHU-579 — istoricul casei. ⚠️ Butonul apare **întotdeauna**, chiar și pe o
                  casă cu zero vizite legate: acolo e chiar ecranul care explică de ce cifra e
                  zero (vizitele vechi nu sunt legate de nicio casă). Ascuns pe `jobCount === 0`,
                  ar fi lipsit exact în cazul care are nevoie de el.
                */}
                <Button
                  type="button" variant="ghost" size="sm"
                  aria-label={`History for ${p.label}`} title={`History for ${p.label}`}
                  onClick={() => setHistoryFor({ id: p.id, label: p.label })}
                >
                  <History className="h-4 w-4" aria-hidden="true" />
                </Button>
                {/* ACHU-581 — poze și documente. ⛔ Nu ajung nicăieri în afara biroului. */}
                <Button
                  type="button" variant="ghost" size="sm"
                  aria-label={`Files for ${p.label}`} title={`Files for ${p.label}`}
                  onClick={() => setFilesFor({ id: p.id, label: p.label })}
                >
                  <Image className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button type="button" variant="ghost" size="sm" aria-label={`Edit ${p.label}`} title={`Edit ${p.label}`} onClick={() => openEdit(p)}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
                {!p.isPrimary && p.isActive && (
                  <Button
                    type="button" variant="ghost" size="sm"
                    aria-label={`Make ${p.label} the main address`} title={`Make ${p.label} the main address`}
                    onClick={() => act(() => makeCustomerPropertyPrimary({ id: p.id }), 'This is now the main address')}
                  >
                    <Star className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
                <Button
                  type="button" variant="ghost" size="sm"
                  aria-label={p.isActive ? `Switch off ${p.label}` : `Switch on ${p.label}`} title={p.isActive ? `Switch off ${p.label}` : `Switch on ${p.label}`}
                  onClick={() => toggleActive(p)}
                >
                  <Power className="h-4 w-4" aria-hidden="true" />
                </Button>
                {/*
                  ⚠️ Butonul de ștergere apare DOAR pentru o casă fără vizite. Serverul refuză
                  oricum, dar un buton care există și apoi refuză învață pe cineva să nu se uite
                  la mesaje.
                */}
                {p.jobCount === 0 && (
                  <Button
                    type="button" variant="ghost" size="sm"
                    aria-label={`Delete ${p.label}`} title={`Delete ${p.label}`}
                    onClick={() => act(() => deleteCustomerProperty({ id: p.id }), 'Deleted')}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="rounded-md border p-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label htmlFor="prop-label">Name</Label>
              <Input
                id="prop-label" value={form.label}
                placeholder="Home, Flat 2, mum’s house…"
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="prop-address">Address</Label>
              <Textarea id="prop-address" rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="prop-postcode">Postcode</Label>
              <Input id="prop-postcode" value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="prop-type">Property type</Label>
              <Select value={form.propertyType} onValueChange={v => setForm(f => ({ ...f, propertyType: v }))}>
                <SelectTrigger id="prop-type"><SelectValue placeholder="Not set" /></SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="prop-bedrooms">Bedrooms</Label>
              <Input id="prop-bedrooms" type="number" min={0} value={form.bedrooms} onChange={e => setForm(f => ({ ...f, bedrooms: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="prop-bathrooms">Bathrooms</Label>
              <Input id="prop-bathrooms" type="number" min={0} value={form.bathrooms} onChange={e => setForm(f => ({ ...f, bathrooms: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="prop-floors">Floors</Label>
              <Input id="prop-floors" type="number" min={0} value={form.floors} onChange={e => setForm(f => ({ ...f, floors: e.target.value }))} />
            </div>
            {/* ACHU-574 — ce are casa. Sub camere, fiindcă acolo se termină „cât e de mare"
                și începe „ce are"; deasupra notei, fiindcă nota e ultimul lucru scris. */}
            <div className="col-span-2">
              <PropertyFeatureFields
                form={form}
                onChange={patch => setForm(f => ({ ...f, ...patch }))}
              />
            </div>
            {/* ACHU-575 — imediat sub „ce are casa", fiindcă răspunde la întrebarea următoare a
                aceleiași conversații: am aflat ce e în casă, acum aflu la ce să am grijă.
                ⚠️ DEASUPRA notei de birou, deliberat: cele două sunt câmpuri de text la câțiva
                centimetri distanță, cu reguli OPUSE despre cine le citește, iar ordinea asta pune
                cardul curățătorului înaintea celui care nu se vede nicăieri. */}
            <div className="col-span-2">
              <PropertyRiskFields
                form={form}
                onChange={patch => setForm(f => ({ ...f, ...patch }))}
              />
            </div>
            {/* 🔴 ACHU-578 — DEASUPRA lui „cum se intră", fiindcă asta e ordinea zilei: întâi
                conduci și parchezi, apoi descui. ⚠️ Tot deasupra notei de birou, ca toate
                grupurile care ajung la curățător. */}
            <div className="col-span-2">
              <PropertyTravelFields
                form={form}
                onChange={patch => setForm(f => ({ ...f, ...patch }))}
              />
            </div>
            {/* ACHU-576 — sub „ce poate merge prost", fiindcă amândouă se citesc de curățător și
                se completează în aceeași conversație: cum intri, apoi la ce ai grijă înăuntru.
                ⚠️ Tot DEASUPRA notei de birou, din același motiv ca Grupul C. */}
            <div className="col-span-2">
              <PropertyAccessFields
                form={form}
                onChange={patch => setForm(f => ({ ...f, ...patch }))}
              />
            </div>
            {/* ACHU-577 — după „cum se intră", fiindcă asta e ordinea zilei: ajungi înăuntru,
                apoi faci treaba. ⚠️ Tot deasupra notei de birou, ca celelalte două grupuri care
                ajung la curățător. */}
            <div className="col-span-2">
              <PropertyRecurringWork
                propertyId={editingId}
                standardInstructions={form.standardInstructions}
                onChange={patch => setForm(f => ({ ...f, ...patch }))}
              />
            </div>
            {/*
              🔴 ACHU-580 — prețul, LÂNGĂ camere și nu în secțiunea curățătorului: e un număr de
              birou. ⛔ Nu ajunge nici la client, nici la curățător — spus pe ecran, ca la notă.
            */}
            <div>
              <Label htmlFor="prop-price">Usual price per job (£)</Label>
              <Input
                id="prop-price" type="number" min={0} step="0.01" inputMode="decimal"
                value={form.pricePerVisit}
                onChange={e => setForm(f => ({ ...f, pricePerVisit: e.target.value }))}
              />
              {/* ⚠️ Spus, fiindcă e chiar regula care evită o factură de zero lire. */}
              <p className="text-xs text-muted-foreground mt-0.5">
                Fills in the amount on a new job here, if it is left blank. Leave empty for “not
                recorded” — that is not the same as £0.
              </p>
            </div>
            <div />
            <div className="col-span-2">
              <Label htmlFor="prop-notes">Office note about this property</Label>
              <Textarea id="prop-notes" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              {/* ⚠️ Spus pe ecran, ca la `Customer.notes`: cine scrie trebuie să știe cine citește. */}
              <p className="text-xs text-muted-foreground mt-0.5">Not shown to the customer or to cleaners.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleSave} disabled={!form.label.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" />}
              {editingId ? 'Save' : 'Add'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setShowAdd(false); setEditingId(null); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ACHU-579 — montat doar când e deschis, ca dialogul să CEARĂ istoricul la deschidere și
          nu la fiecare randare a listei de case. */}
      {historyFor && (
        <PropertyHistoryDialog
          open
          propertyId={historyFor.id}
          label={historyFor.label}
          onClose={() => setHistoryFor(null)}
        />
      )}

      {/* ACHU-581 — montat doar când e deschis, ca lista de fișiere să se ceară la deschidere. */}
      {filesFor && (
        <PropertyFilesDialog
          open
          propertyId={filesFor.id}
          label={filesFor.label}
          onClose={() => setFilesFor(null)}
        />
      )}
    </div>
  );
}

