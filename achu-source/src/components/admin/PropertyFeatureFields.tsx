/**
 * ACHU-574 (Sesiunea 126, `Backlog_Functionalitati_Viitoare` §5, Grupul A) — CE ARE CASA.
 *
 * Cerut de Archana pe 13/08/2026: *„Am zis continui cu customer"*.
 *
 * ─── 🔴 DE CE TREI STĂRI ȘI NU O BIFĂ ────────────────────────────────────────
 * O bifă are două stări, iar realitatea are trei: **are · nu are · nu am întrebat încă.** O
 * casetă nebifată ar afirma „nu are grădină" despre fiecare casă introdusă în grabă — iar §7
 * (Pricing engine) va citi exact câmpurile astea ca să estimeze cât durează o curățenie.
 * **Diferența dintre „nu are" și „nu știm" ajunge într-un preț.**
 *
 * ⚠️ Aceeași regulă ca la dormitoare, în felia 1: gol ≠ 0, fiindcă 0 e un fapt.
 *
 * ⚠️ **Fișier propriu**, nu 90 de rânduri în plus în `CustomerPropertiesSection.tsx` —
 * `CLAUDE.md` §2.1a, clichetul de mărime.
 */
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * ⚠️ Vocabularul și forma formularului stau în `src/lib/propertyTypes.ts` — un fișier de
 * componentă care exportă și constante pierde fast refresh, iar `CustomerPropertiesSection`
 * are nevoie de aceleași liste.
 */
import { FEATURES, FURNISHING_OPTIONS, OCCUPANCY_OPTIONS, type FeatureForm } from '@/lib/propertyTypes';
/**
 * ⚠️ Comutatorul cu trei stări e ACUM într-un fișier propriu — Grupul C (ACHU-575) folosește exact
 * același, iar o a doua copie a lui s-ar fi despărțit de prima la prima corectură.
 */
import YesNoUnset from './YesNoUnset';

/** Radix nu acceptă `value=""` pe un item — șirul gol e felul lui de a spune „nimic ales". */
const NONE = '__none__';

export default function PropertyFeatureFields({ form, disabled = false, onChange }: {
  form: FeatureForm;
  disabled?: boolean;
  onChange: (patch: Partial<FeatureForm>) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-xs text-muted-foreground">
        What the property has. Anything you leave blank stays <strong>not recorded</strong> — it is
        not read as “no”.
      </p>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label htmlFor="prop-area" className="text-xs">Floor area (m²)</Label>
          <Input id="prop-area" type="number" min="0" disabled={disabled} value={form.floorAreaSqm}
            onChange={e => onChange({ floorAreaSqm: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="prop-rooms" className="text-xs">Rooms in total</Label>
          <Input id="prop-rooms" type="number" min="0" disabled={disabled} value={form.rooms}
            onChange={e => onChange({ rooms: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="prop-kitchens" className="text-xs">Kitchens</Label>
          <Input id="prop-kitchens" type="number" min="0" disabled={disabled} value={form.kitchens}
            onChange={e => onChange({ kitchens: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {FEATURES.map(f => (
          <YesNoUnset
            key={f.key}
            label={f.label}
            value={form[f.key]}
            disabled={disabled}
            onChange={next => onChange({ [f.key]: next } as Partial<FeatureForm>)}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label id="prop-furnishing-label" className="text-xs">Furnishing</Label>
          <Select disabled={disabled} value={form.furnishing || NONE}
            onValueChange={v => onChange({ furnishing: v === NONE ? '' : v })}>
            <SelectTrigger id="prop-furnishing" aria-labelledby="prop-furnishing-label">
              <SelectValue placeholder="Not recorded" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not recorded</SelectItem>
              {FURNISHING_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label id="prop-occupancy-label" className="text-xs">Occupancy</Label>
          <Select disabled={disabled} value={form.occupancy || NONE}
            onValueChange={v => onChange({ occupancy: v === NONE ? '' : v })}>
            <SelectTrigger id="prop-occupancy" aria-labelledby="prop-occupancy-label">
              <SelectValue placeholder="Not recorded" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not recorded</SelectItem>
              {OCCUPANCY_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

