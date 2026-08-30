/**
 * ACHU-578 (`Backlog_Functionalitati_Viitoare` §5, Grupul D) — DRUMUL PÂNĂ ACOLO.
 *
 * ─── 🔴 GOLUL ─────────────────────────────────────────────────────────────────
 * Unde se parchează la o casă nu e scris **nicăieri**. Primul curățător care merge acolo dă ocol,
 * nimerește o zonă cu permis sau un parcometru, și întârzie. Vizita următoare, alt om, de la
 * capăt — fiindcă ce a aflat primul n-a avut unde sta scris. Aceeași clasă cu Grupul E: un fapt
 * stabil despre o casă, redescoperit la fiecare vizită.
 *
 * ─── ⛔ DE CE NU E NICIUN CÂMP DE BANI PE ECRANUL ĂSTA ────────────────────────
 * **Roberto, 14/08/2026:** *„Ulezul si parcarea sunt suportate de firma."* Backlogul întreba de
 * un an dacă se trec pe client sau se absorb; răspunsul e **se absorb**. Deci grupul consemnează
 * ca să știe șoferul, nu ca să factureze cineva — iar un câmp de sumă existent ar fi un câmp pe
 * care o sesiune viitoare l-ar lega de o factură fiindcă „era acolo".
 *
 * ⚠️ **Fișier propriu**, al cincilea grup, al cincilea fișier — `CustomerPropertiesSection.tsx`
 * ar fi trecut demult de clichetul lui de mărime dacă fiecare formular ar fi rămas în el.
 */
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Car } from 'lucide-react';
import { PARKING_OPTIONS, TRAVEL_TEXTS, type TravelForm } from '@/lib/propertyTypes';
import YesNoUnset from './YesNoUnset';

/**
 * ⚠️ Etichetele celor trei bife, într-o listă și nu scrise de trei ori: două liste s-ar despărți
 * la prima redenumire (`CLAUDE.md` §3.1b). ⛔ ULEZ și Congestion Charge sunt **separate** — ULEZ
 * acoperă toate cartierele din 2023, Congestion Charge doar centrul, iar o casă poate fi în una
 * fără cealaltă.
 */
const ZONE_FLAGS = [
  { key: 'parkingPermitRequired', label: 'Parking permit needed' },
  { key: 'inCongestionZone', label: 'In the Congestion Charge zone' },
  { key: 'inUlezZone', label: 'In the ULEZ zone' },
] as const;

export default function PropertyTravelFields({ form, disabled = false, onChange }: {
  form: TravelForm;
  disabled?: boolean;
  onChange: (patch: Partial<TravelForm>) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border border-indigo-500/40 bg-indigo-500/5 p-3">
      <p className="text-xs font-semibold flex items-center gap-1.5">
        <Car className="h-3.5 w-3.5" aria-hidden="true" />
        Getting there and parking
      </p>
      {/*
        🔴 Cele două lucruri pe care cine completează trebuie să le știe, spuse pe ecran: cine
        citește, și că firma plătește. Al doilea mai ales — fără el, cineva ar completa gândindu-se
        că pregătește o linie de factură, iar aceea e chiar varianta pe care owner-ul a exclus-o.
      */}
      <p className="text-xs text-muted-foreground">
        <strong>The cleaner assigned to a job here will see this</strong> before they set off.
        Parking and zone charges are <strong>paid by the company</strong>, never passed on to the
        customer — this is here so nobody has to find out at the meter.
      </p>

      <div>
        <Label htmlFor="prop-parking-type" className="text-xs">Parking</Label>
        <Select
          value={form.parkingType}
          disabled={disabled}
          onValueChange={v => onChange({ parkingType: v })}
        >
          <SelectTrigger id="prop-parking-type"><SelectValue placeholder="Not recorded" /></SelectTrigger>
          <SelectContent>
            {PARKING_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        {/* ⚠️ „No parking nearby" e o VALOARE, nu absența uneia — spus, fiindcă altfel cineva
            lasă câmpul gol crezând că a răspuns, iar golul înseamnă „nu s-a consemnat". */}
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          If there is genuinely nowhere to park, pick “No parking nearby” — leaving it blank means
          nobody has checked.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        {ZONE_FLAGS.map(f => (
          <YesNoUnset
            key={f.key}
            label={f.label}
            value={form[f.key]}
            disabled={disabled}
            onChange={next => onChange({ [f.key]: next } as Partial<TravelForm>)}
          />
        ))}
      </div>

      <div className="space-y-2">
        {TRAVEL_TEXTS.map(t => (
          <div key={t.key}>
            <Label htmlFor={`prop-travel-${t.key}`} className="text-xs">{t.label}</Label>
            {/* ⚠️ `Input` pentru „unde se parchează" ar fi fost prea scurt: propoziția utilă are
                două rânduri („strada din spate, după 40; gratis după 6"). */}
            <Textarea
              id={`prop-travel-${t.key}`}
              rows={2}
              disabled={disabled}
              value={form[t.key]}
              onChange={e => onChange({ [t.key]: e.target.value } as Partial<TravelForm>)}
            />
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

