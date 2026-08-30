/**
 * ACHU-576 (`Backlog_Functionalitati_Viitoare` §5, Grupul B) — CUM SE INTRĂ.
 *
 * ─── 🔴 CE E DIFERIT FAȚĂ DE CELELALTE DOUĂ GRUPURI ───────────────────────────
 * Câmpurile astea au **trei** cititori, nu unul: biroul (aici), **CLIENTUL** (le scrie el, din
 * portal) și **CURĂȚĂTORUL** (le citește la ușă). Grupul A e pentru preț, Grupul C e pentru
 * curățător; ăsta e singurul pe care îl scriu amândouă părțile.
 *
 * ⚠️ **Deci ecranul spune că ȘI clientul le poate schimba.** Fără rândul acela, biroul scrie un
 * cod, clientul îl schimbă din portal peste o lună, iar cine se uită la ecranul de birou crede
 * că cifrele lui sunt cele scrise de el.
 *
 * ─── DE CE TEXT LIBER **ȘI** CÂMPURI SEPARATE ─────────────────────────────────
 * O cutie de chei se **caută** („care case au cheia la noi?"), o propoziție nu. Iar cineva care
 * vede un câmp numit „Where the key is" scrie altceva decât într-o casetă goală — eticheta e
 * jumătate din răspuns. ⛔ Textul liber rămâne fiindcă nicio listă de câmpuri nu acoperă „sună la
 * 2, nu la 1, soneria de jos nu merge".
 *
 * ⚠️ **Fișier propriu**, ca `PropertyRiskFields.tsx` — clichetul de mărime (`CLAUDE.md` §2.1a).
 */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { KeyRound } from 'lucide-react';
import { ACCESS_TEXTS, type AccessForm } from '@/lib/propertyTypes';
import YesNoUnset from './YesNoUnset';

export default function PropertyAccessFields({ form, disabled = false, onChange }: {
  form: AccessForm;
  disabled?: boolean;
  onChange: (patch: Partial<AccessForm>) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3">
      <p className="text-xs font-semibold flex items-center gap-1.5">
        <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
        Getting in
      </p>
      {/*
        ⚠️ **Formulare diferită de cea a Grupului C, deliberat.** Cele două casete sunt la câțiva
        centimetri una de alta; două propoziții identice s-ar citi ca o repetiție și ar fi sărite
        amândouă. Iar aici e ceva ce acolo nu e adevărat: **și clientul poate scrie în ele.**
      */}
      <p className="text-xs text-muted-foreground">
        <strong>The cleaner coming here reads this at the door.</strong> The customer can also
        change it themselves from their account, so what you type may be replaced by them later.
      </p>

      <div>
        <Label htmlFor="prop-access-free" className="text-xs">Anything else about getting in</Label>
        <Textarea
          id="prop-access-free"
          rows={3}
          disabled={disabled}
          value={form.accessInstructions}
          onChange={e => onChange({ accessInstructions: e.target.value })}
          placeholder="Side gate code 4417. Ring the top bell — the bottom one does not work."
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ACCESS_TEXTS.map(t => (
          <div key={t.key}>
            <Label htmlFor={`prop-access-${t.key}`} className="text-xs">{t.label}</Label>
            <Input
              id={`prop-access-${t.key}`}
              disabled={disabled}
              value={form[t.key]}
              onChange={e => onChange({ [t.key]: e.target.value } as Partial<AccessForm>)}
            />
            {/* ⚠️ Exemplul, nu doar eticheta — aceeași lecție ca la Grupul C: „Water" primește
                „nimic" de la cineva care nu s-a gândit că robinetul de afară e închis iarna. */}
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {/* ⚠️ Cele două se citesc împreună: „etajul 4" fără „nu e lift" e o informație pe
            jumătate, iar jumătatea care lipsește e chiar cea care schimbă ziua cuiva. */}
        <YesNoUnset
          label="Lift in the building"
          value={form.hasLift}
          disabled={disabled}
          onChange={next => onChange({ hasLift: next })}
        />
        <div>
          <Label htmlFor="prop-access-floor" className="text-xs">Which floor</Label>
          <Input
            id="prop-access-floor"
            type="number"
            disabled={disabled}
            value={form.floorNumber}
            onChange={e => onChange({ floorNumber: e.target.value })}
          />
          {/* 🔴 Diferit de „Floors" de mai sus, care e câte etaje are casa. Cele două se
              confundă, deci se spune. */}
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            The floor the flat is on — 0 for the ground floor, −1 for a basement. Not the same as
            how many floors the property has.
          </p>
        </div>
      </div>
    </div>
  );
}

