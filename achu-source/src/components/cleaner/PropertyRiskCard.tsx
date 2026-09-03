/**
 * ACHU-575 (`Backlog_Functionalitati_Viitoare` §5, Grupul C) — CE POATE MERGE PROST, PE ECRANUL
 * OMULUI CARE INTRĂ ÎN CASĂ.
 *
 * ─── 🔴 DE CE EXISTĂ ÎNTREGUL GRUP ────────────────────────────────────────────
 * Biroul consemnează pe fișa casei că e un câine, o vază în hol și o cameră în care nu se intră.
 * **Dacă asta nu ajunge aici, nu previne nimic** — biroul doar crede că a spus. Cele șapte câmpuri
 * sunt chiar lista de cauze din registrul de incidente (ACHU-569): obiect fragil spart, cameră în
 * care nu trebuia intrat, un câine.
 *
 * ⚠️ **Întotdeauna deschis, niciodată după un buton.** Aceeași regulă ca la „Getting in"
 * (ACHU-239) și la nota de accesibilitate (ACHU-549): cine citește asta stă la o ușă. Un pericol
 * ascuns după un „arată mai mult" e un pericol pe care nu-l citește nimeni.
 *
 * ⛔ **Serverul nu trimite nimic pe o vizită închisă și nimic când nu s-a consemnat nimic**
 * (`propertyRiskForCleaner`), deci aici nu e niciun caz de tratat. Limita e ce se trimite, nu ce
 * se desenează — un răspuns care le poartă e un răspuns care le poate scăpa.
 *
 * ⚠️ **Nota BIROULUI despre casă nu ajunge aici**, și nici nu poate: ruta o exclude prin `select`.
 * Ecranul de birou promite lângă acel câmp *„Not shown to the customer or to cleaners"*.
 */
import { AlertTriangle, PawPrint, Baby, Cigarette } from 'lucide-react';
import { RISK_TEXTS, type PropertyRisk } from '@/lib/propertyTypes';

/**
 * 🔴 **Se arată și „No", nu doar „Yes"** — și e diferența față de lista de dotări din fișa de
 * birou, care înșiră doar ce ARE casa. „No pets" e răspunsul la o întrebare pe care curățătorul
 * și-o pune oricum la ușă, iar dacă lipsește, el nu poate ști dacă înseamnă „nu are" sau „nu a
 * întrebat nimeni". ⚠️ Ce **nu** s-a consemnat nu apare deloc: a afirma absența unui lucru pe
 * care nu l-a întrebat nimeni e chiar greșeala pe care cele trei stări o evită.
 */
const FLAGS = [
  { key: 'hasPets', icon: PawPrint, yes: 'Pets in the home', no: 'No pets' },
  { key: 'hasChildren', icon: Baby, yes: 'Children in the home', no: 'No children' },
  { key: 'hasSmokers', icon: Cigarette, yes: 'Someone smokes indoors', no: 'Nobody smokes indoors' },
] as const;

export default function PropertyRiskCard({ risk }: { risk: PropertyRisk }) {
  const flags = FLAGS.filter(f => risk[f.key] !== null);
  const texts = RISK_TEXTS.filter(t => (risk[t.key] ?? '').trim() !== '');

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5">
      <p className="text-xs font-semibold flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        About this property — read before you start
      </p>

      {flags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          {flags.map(f => {
            const Icon = f.icon;
            const yes = risk[f.key] === true;
            return (
              <span
                key={f.key}
                className={`flex items-center gap-1 text-sm ${yes ? 'font-medium' : 'text-muted-foreground'}`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {yes ? f.yes : f.no}
              </span>
            );
          })}
        </div>
      )}

      {texts.length > 0 && (
        <dl className="mt-2 space-y-1.5">
          {texts.map(t => (
            <div key={t.key}>
              <dt className="text-[11px] font-semibold text-muted-foreground">{t.label}</dt>
              {/* `whitespace-pre-wrap break-words`, ca la nota clientului: biroul scrie liste pe
                  rânduri separate, iar un text lipit într-un paragraf se citește greșit la ușă. */}
              <dd className="text-sm whitespace-pre-wrap break-words">{risk[t.key]}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

