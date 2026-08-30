/**
 * ACHU-576 (`Backlog_Functionalitati_Viitoare` §5, Grupul B) — CUM SE INTRĂ, PE ECRANUL OMULUI
 * CARE STĂ LA UȘĂ.
 *
 * ─── 🔴 CE S-A SCHIMBAT, ȘI DE CE E CHIAR FELIA ───────────────────────────────
 * Cardul „Getting in" există din Sesiunea 43 (ACHU-239), dar textul lui venea de pe **client**:
 * un singur set de instrucțiuni pentru toate casele lui, deci greșit pentru cel puțin una la
 * oricine are două. Acum vine de pe **casa vizitei**.
 *
 * ⚠️ **Întotdeauna deschis, niciodată după un buton.** Aceeași regulă ca la nota de
 * accesibilitate (ACHU-549) și la „ce poate merge prost" (ACHU-575): cine citește asta stă la o
 * ușă, iar ceva ascuns după un „arată mai mult" e ceva pentru care sună biroul.
 *
 * ⛔ **Serverul nu trimite nimic pe o vizită închisă și nimic când nu s-a consemnat nimic**
 * (`propertyAccessForCleaner`), deci aici nu e niciun caz de tratat. Limita e ce se trimite.
 */
import { KeyRound, Building2, ArrowUpDown, Info } from 'lucide-react';
import { ACCESS_TEXTS, type PropertyAccess } from '@/lib/propertyTypes';

export default function PropertyAccessCard({ access }: { access: PropertyAccess }) {
  const texts = ACCESS_TEXTS.filter(t => (access[t.key] ?? '').trim() !== '');
  const floor = access.floorNumber;
  /**
   * ⚠️ **`!== null`, nu un „truthy"**: parterul e `0`, iar un `if (floor)` l-ar fi ascuns exact
   * pe cel mai obișnuit etaj. Aceeași greșeală de clasă cu „gol ≠ 0" din felia 1.
   */
  const floorLine = [
    floor === null ? null : floor === 0 ? 'Ground floor' : floor < 0 ? `Basement (${floor})` : `Floor ${floor}`,
    // 🔴 „Nu e lift" e un fapt consemnat de cineva, nu o absență — și e chiar ce vrea să știe
    // omul care urcă cu aspiratorul. Ce NU s-a consemnat nu apare deloc.
    access.hasLift === null ? null : access.hasLift ? 'Lift in the building' : 'No lift',
  ].filter(Boolean).join(' · ');

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
      <p className="text-xs font-semibold flex items-center gap-1.5">
        <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />Getting in
      </p>

      {/*
        🔴 **DE PE CE CASĂ**, și e jumătatea onestă a feliei. Când vizita nu e legată de o casă
        (toate cele de dinainte de ACHU-570), instrucțiunile vin de pe casa PRINCIPALĂ a
        clientului — care poate să nu fie casa la care mergi. Tăcerea aici ar fi exact greșeala
        pe care grupul o repară, mutată cu un pas mai încolo.
      */}
      {access.source === 'main' ? (
        <p className="mt-1 text-[11px] text-muted-foreground flex items-start gap-1">
          <Info className="h-3 w-3 mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            This job is not linked to one of the customer’s properties, so these are the
            instructions for their main address (<strong>{access.propertyLabel}</strong>). Check
            they match where you are going.
          </span>
        </p>
      ) : (
        <p className="mt-0.5 text-[11px] text-muted-foreground flex items-center gap-1">
          <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />{access.propertyLabel}
        </p>
      )}

      {floorLine && (
        <p className="mt-1 text-sm flex items-center gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{floorLine}
        </p>
      )}

      {access.accessInstructions && (
        <p className="mt-1 text-sm whitespace-pre-wrap break-words">{access.accessInstructions}</p>
      )}

      {texts.length > 0 && (
        <dl className="mt-2 space-y-1.5">
          {texts.map(t => (
            <div key={t.key}>
              <dt className="text-[11px] font-semibold text-muted-foreground">{t.label}</dt>
              <dd className="text-sm whitespace-pre-wrap break-words">{access[t.key]}</dd>
            </div>
          ))}
        </dl>
      )}

      {access.updatedAt && (
        // Un cod fără dată e mai rău decât niciunul: omul de la ușă nu poate ști dacă mai e
        // valabil. Regula e din ACHU-239 și supraviețuiește mutării pe casă.
        <p className="mt-1 text-[11px] text-muted-foreground">
          Updated {new Date(access.updatedAt).toLocaleDateString('en-GB', { timeZone: 'Europe/London' })}
          {access.updatedBy ? ` by ${access.updatedBy}` : ''}
        </p>
      )}
    </div>
  );
}

