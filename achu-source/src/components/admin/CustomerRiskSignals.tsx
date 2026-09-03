/**
 * ACHU-552 (Sesiunea 121, `Backlog_Client_Prioritar` Nivel 2) — marcajele de risc ale unui
 * client, pe ecran.
 *
 * ─── Un singur fișier pentru amândouă ecranele, și acela e motivul ────────
 * Lista de clienți arată o versiune scurtă; fișa arată propozițiile întregi. Amândouă citesc
 * **același** `risk` din **același** rând al rutei de listă, deci nu pot ajunge la două
 * răspunsuri despre același om — iar cuvintele vin de la backend (`customerRiskSignals.ts`),
 * nu se scriu a doua oară aici.
 *
 * ⚠️ **Nicio culoare singură nu spune nimic.** Fiecare marcaj poartă TEXT și o iconiță; culoarea
 * doar întărește. Aceeași regulă ca la ACHU-522/523: un birou care printează lista, sau un om
 * care nu distinge roșul de galben, trebuie să citească exact aceeași informație.
 */

import { AlertTriangle, Eye, ShieldCheck } from 'lucide-react';

/** Trebuie să rămână identic cu `RiskLevel` din `backend/src/lib/customerRiskSignals.ts`. */
export type RiskLevel = 'watch' | 'concern';

export type RiskSignal = {
  kind: string;
  level: RiskLevel;
  /** Text scurt, pentru un rând de tabel. */
  short: string;
  /** Propoziția completă, cu cifra în ea. */
  detail: string;
};

export type CustomerRisk = {
  signals: RiskSignal[];
  level: RiskLevel | null;
};

const LEVEL_STYLE: Record<RiskLevel, string> = {
  concern: 'bg-destructive/10 text-destructive border-destructive/30',
  watch: 'bg-amber-50 text-amber-800 border-amber-300',
};

/** Cuvântul care însoțește nivelul, ca marcajul să nu fie doar o culoare. */
const LEVEL_WORD: Record<RiskLevel, string> = {
  concern: 'Needs attention',
  watch: 'Worth watching',
};

/**
 * Câte marcaje încap într-un rând de listă.
 *
 * ⚠️ **Două.** Rândul are deja șapte coloane; al treilea marcaj ar rupe tabelul pe un ecran
 * de laptop, iar restul se citește oricum pe fișă. **Tăierea se SPUNE** („+1"), fiindcă o
 * listă tăiată tăcut arată exact ca una completă (aceeași regulă ca la firul din ACHU-541).
 */
const LIST_MAX = 2;

/**
 * Versiunea de LISTĂ — celula din tabelul de clienți.
 *
 * 🔴 Aici e valoarea rândului de backlog: „ca biroul să anticipeze probleme". Un marcaj pe
 * care îl vezi doar deschizând fișa nu anticipează nimic, fiindcă nimeni nu deschide șaizeci
 * de fișe ca să afle unde e problema.
 */
export function CustomerRiskCell({ risk }: { risk: CustomerRisk | undefined }) {
  const signals = risk?.signals ?? [];
  if (signals.length === 0) {
    // ⚠️ O celulă goală și „încă nu s-a calculat" arată identic. O liniuță spune „am verificat".
    return <span className="text-muted-foreground" aria-label="No risk signals">—</span>;
  }

  const shown = signals.slice(0, LIST_MAX);
  const hidden = signals.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map(s => (
        <span
          key={s.kind}
          title={s.detail}
          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs whitespace-nowrap ${LEVEL_STYLE[s.level]}`}
        >
          {s.level === 'concern'
            ? <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
            : <Eye className="h-3 w-3 shrink-0" aria-hidden="true" />}
          <span className="sr-only">{LEVEL_WORD[s.level]}: </span>
          {s.short}
        </span>
      ))}
      {hidden > 0 && (
        <span className="text-xs text-muted-foreground" title="Open the customer to see the rest">
          +{hidden} more
        </span>
      )}
    </div>
  );
}

/**
 * Versiunea de FIȘĂ — propozițiile întregi, cu cifrele în ele.
 *
 * ⚠️ **Spune de unde vine fiecare marcaj.** Un birou care citește „Pays late (3×)" fără să
 * afle că e măsurat din plățile lui începe să caute cine l-a bifat — iar răspunsul e că nimeni
 * nu l-a bifat, și de aceea nu poate fi șters de pe fișă.
 */
export function CustomerRiskPanel({ risk }: { risk: CustomerRisk | undefined }) {
  const signals = risk?.signals ?? [];

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">What to expect with this customer</h3>
      </div>
      {signals.length === 0 ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Nothing to flag — no money outstanding on past jobs, no complaints, no missed access.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {signals.map(s => (
            <li key={s.kind} className="flex items-start gap-2 text-sm">
              {s.level === 'concern'
                ? <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
                : <Eye className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />}
              <span>
                <span className="sr-only">{LEVEL_WORD[s.level]}: </span>
                {s.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
      {/* 🔴 Fără rândul acesta, cineva caută butonul de bifat. Nu există, deliberat. */}
      <p className="text-xs text-muted-foreground border-t border-border pt-2">
        Worked out from this customer&apos;s own jobs, payments and requests — nobody ticks these,
        and they change on their own when the facts change.
      </p>
    </div>
  );
}

