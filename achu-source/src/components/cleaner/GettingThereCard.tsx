/**
 * ACHU-578 (`Backlog_Functionalitati_Viitoare` §5, Grupul D) — DRUMUL PÂNĂ ACOLO, PE ECRANUL
 * OMULUI CARE CONDUCE.
 *
 * ─── 🔴 DE CE EXISTĂ GRUPUL ───────────────────────────────────────────────────
 * Unde se parchează la o casă nu e scris **nicăieri** azi. Curățătorul care merge prima oară dă
 * ocol, nimerește o zonă cu permis sau un parcometru, și întârzie. Vizita următoare, alt om, de
 * la capăt — fiindcă ce a aflat primul n-a avut unde sta scris.
 *
 * ─── ⛔ DE CE NU SCRIE NICIUN PREȚ AICI ───────────────────────────────────────
 * **Roberto, 14/08/2026:** *„Ulezul si parcarea sunt suportate de firma."* Deci curățătorul nu
 * are nicio conversație de purtat despre bani, nici cu clientul, nici cu biroul — și atunci o
 * sumă pe ecranul lui ar invita exact la conversația aceea. Aceeași reținere ca la
 * `serviceExtras` (ACHU-556), unde prețul extraselor e ținut deoparte din același motiv.
 *
 * ⚠️ **Întotdeauna deschis, niciodată după un buton**, ca „Getting in" și cardul de riscuri: se
 * citește înainte de plecare, nu se caută.
 *
 * ⛔ Serverul nu trimite nimic pe o vizită închisă și nimic când nu s-a consemnat nimic
 * (`propertyTravelForCleaner`), deci aici nu e niciun caz de tratat.
 */
import { Car, TicketCheck, CircleAlert } from 'lucide-react';
import { TRAVEL_TEXTS, type PropertyTravel } from '@/lib/propertyTypes';

/**
 * 🔴 **Se arată și „No", nu doar „Yes"** — aceeași alegere ca la cardul de riscuri. „Nu cere
 * permis" e răspunsul la o întrebare pe care șoferul și-o pune oricum; fără el nu poate ști dacă
 * tăcerea înseamnă „nu cere" sau „nu a verificat nimeni". ⚠️ Ce **nu** s-a consemnat nu apare
 * deloc — a afirma că o casă nu e în ULEZ când nimeni n-a verificat e chiar greșeala pe care
 * cele trei stări o evită, iar aici ar costa o amendă.
 */
const FLAGS = [
  { key: 'parkingPermitRequired', icon: TicketCheck, yes: 'Parking permit needed', no: 'No parking permit needed' },
  { key: 'inCongestionZone', icon: CircleAlert, yes: 'In the Congestion Charge zone', no: 'Outside the Congestion Charge zone' },
  { key: 'inUlezZone', icon: CircleAlert, yes: 'In the ULEZ zone', no: 'Outside the ULEZ zone' },
] as const;

export default function GettingThereCard({ travel }: { travel: PropertyTravel }) {
  const flags = FLAGS.filter(f => travel[f.key] !== null);
  const texts = TRAVEL_TEXTS.filter(t => (travel[t.key] ?? '').trim() !== '');

  return (
    <div className="rounded-lg border border-indigo-500/40 bg-indigo-500/5 p-2.5">
      <p className="text-xs font-semibold flex items-center gap-1.5">
        <Car className="h-3.5 w-3.5" aria-hidden="true" />
        Getting there and parking
      </p>

      {travel.parkingType && (
        <p className="mt-1.5 text-sm font-medium">{travel.parkingType}</p>
      )}

      {flags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          {flags.map(f => {
            const Icon = f.icon;
            const yes = travel[f.key] === true;
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
              {/* `whitespace-pre-wrap break-words`, ca la celelalte carduri: biroul scrie liste
                  pe rânduri separate, iar un text lipit se citește greșit dintr-o privire. */}
              <dd className="text-sm whitespace-pre-wrap break-words">{travel[t.key]}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* 🔴 Spus pe ecran, o dată, ca să nu se întrebe nimeni la parcometru și să nu sune biroul
          din mașină. E chiar decizia din 14/08/2026, în cuvintele omului care conduce. */}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Parking and zone charges are paid by the company — never by the customer.
      </p>
    </div>
  );
}

