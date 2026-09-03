/**
 * COMUTATORUL CU TREI STĂRI — *da · nu · nu s-a consemnat*.
 *
 * 🔴 **De ce trei și nu o bifă**, fiindcă e aceeași decizie la Grupul A și la Grupul C: o bifă are
 * două stări, iar realitatea are trei. O casetă nebifată ar afirma „nu are grădină" — sau, mai
 * rău, „nu are câine" — despre fiecare casă introdusă în grabă. **Nimeni n-a spus asta.**
 *
 * ⚠️ **Apăsarea din nou pe starea deja aleasă o GOLEȘTE**, înapoi la „not recorded". Fără asta, o
 * apăsare greșită ar fi ireversibilă din ecran, iar cineva ar lăsa „No" pe o casă cu câine doar
 * fiindcă nu a găsit cum să se întoarcă — exact cazul în care câmpul face rău, nu bine.
 *
 * ⚠️ **Fișier propriu, extras din `PropertyFeatureFields.tsx` la ACHU-575**: al doilea grup de
 * câmpuri avea nevoie de exact același comutator, iar a doua copie a lui ar fi fost prima care se
 * desparte de prima la orice corectură (`CLAUDE.md` §3.1b, tiparul aplicat la cod).
 */
import { Button } from '@/components/ui/button';

export default function YesNoUnset({ label, value, disabled, onChange }: {
  label: string;
  value: boolean | null;
  disabled?: boolean;
  onChange: (next: boolean | null) => void;
}) {
  const pick = (next: boolean) => onChange(value === next ? null : next);
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs">{label}</span>
      <div className="flex gap-1 shrink-0" role="group" aria-label={label}>
        <Button
          type="button" size="sm" disabled={disabled}
          variant={value === true ? 'default' : 'outline'}
          aria-pressed={value === true}
          aria-label={`${label}: yes`}
          className="h-7 px-2 text-xs"
          onClick={() => pick(true)}
        >Yes</Button>
        <Button
          type="button" size="sm" disabled={disabled}
          variant={value === false ? 'default' : 'outline'}
          aria-pressed={value === false}
          aria-label={`${label}: no`}
          className="h-7 px-2 text-xs"
          onClick={() => pick(false)}
        >No</Button>
      </div>
    </div>
  );
}

