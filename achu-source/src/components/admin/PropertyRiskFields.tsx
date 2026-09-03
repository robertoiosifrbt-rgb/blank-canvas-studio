/**
 * ACHU-575 (`Backlog_Functionalitati_Viitoare` §5, Grupul C) — CE POATE MERGE PROST.
 *
 * ─── 🔴 CE E DIFERIT FAȚĂ DE GRUPUL A, ȘI E TOT ────────────────────────────────
 * Câmpurile de aici sunt **singurele ale casei care ajung la CURĂȚĂTOR**. Suprafața și dotările
 * sunt pentru birou și pentru preț; astea sunt pentru omul care descuie ușa. Dacă informația nu
 * ajunge la el, câmpul **nu previne nimic** — iar biroul crede că a spus.
 *
 * ⚠️ Sunt chiar lista de cauze din registrul de incidente (ACHU-569): obiect fragil spart, cameră
 * în care nu trebuia intrat, un câine. **Valoarea se măsoară într-un incident care nu se
 * întâmplă.**
 *
 * ─── DE CE TEXT ȘI NU LISTE DE BIFAT ──────────────────────────────────────────
 * „Vaza din hol, de la bunica" nu se poate exprima cu o bifă. O listă de categorii ar invita la a
 * bifa ceva aproximativ **în locul propoziției exacte**, iar propoziția e chiar lucrul care
 * previne incidentul. Cele trei da/nu rămân da/nu fiindcă acolo faptul chiar e binar.
 *
 * ⚠️ **Fișier propriu**, nu încă 90 de rânduri în `CustomerPropertiesSection.tsx` — `CLAUDE.md`
 * §2.1a, clichetul de mărime.
 */
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';
import { RISK_FLAGS, RISK_TEXTS, type RiskForm } from '@/lib/propertyTypes';
import YesNoUnset from './YesNoUnset';

export default function PropertyRiskFields({ form, disabled = false, onChange }: {
  form: RiskForm;
  disabled?: boolean;
  onChange: (patch: Partial<RiskForm>) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
      <p className="text-xs font-semibold flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        What could go wrong here
      </p>
      {/*
        🔴 Spus pe ecran, și nu ca politețe: e singura diferență de care cine completează trebuie
        să știe. Nota de mai jos, „Office note about this property", promite explicit că NU ajunge
        la curățător — două câmpuri de text la câțiva centimetri distanță, cu reguli opuse. Fără
        rândul ăsta, cineva ar scrie aici ce voia să scrie acolo.
      */}
      <p className="text-xs text-muted-foreground">
        <strong>The cleaner assigned to a job here will see all of this</strong> on their job
        card, before they start. Anything left blank stays <strong>not recorded</strong> — it is
        not read as “no”.
      </p>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        {RISK_FLAGS.map(f => (
          <YesNoUnset
            key={f.key}
            label={f.label}
            value={form[f.key]}
            disabled={disabled}
            onChange={next => onChange({ [f.key]: next } as Partial<RiskForm>)}
          />
        ))}
      </div>

      <div className="space-y-2">
        {RISK_TEXTS.map(t => (
          <div key={t.key}>
            <Label htmlFor={`prop-risk-${t.key}`} className="text-xs">{t.label}</Label>
            <Textarea
              id={`prop-risk-${t.key}`}
              rows={2}
              disabled={disabled}
              value={form[t.key]}
              onChange={e => onChange({ [t.key]: e.target.value } as Partial<RiskForm>)}
            />
            {/* ⚠️ Exemplul, nu doar eticheta: fără el „Hazards" primește „nimic" de la cineva
                care nu s-a gândit că treapta ruptă de la intrare se pune acolo. */}
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

