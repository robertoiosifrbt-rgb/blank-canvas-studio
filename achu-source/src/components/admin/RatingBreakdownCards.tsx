/**
 * §36 — „Cleaner rating trends" și „Service rating trends" pe ecranul biroului.
 *
 * ─── ⛔ CE SPUNE ECRANUL DESPRE SINE, ȘI DE CE E SCRIS PE EL ─────────────────
 * Clientul notează **o vizită**, nu o persoană. Deci o vizită cu doi curățători intră la
 * amândoi, iar o notă mică poate fi despre timpul prea scurt alocat sau despre o factură —
 * lucruri pe care omul care a curățat nu le hotărăște. 🔴 **Propoziția asta e pe ecran, nu
 * doar în cod:** o listă de oameni ordonată după o medie *arată* ca un clasament de
 * performanță, și cine o citește fără avertisment o va folosi ca atare.
 *
 * ─── De ce un fișier propriu ─────────────────────────────────────────────────
 * `CLAUDE.md` §3.2 / `AGENT_RULES` §9: o capabilitate nouă intră în fișierul ei.
 * `CustomerFeedbackPage.tsx` doar o importă și o așează.
 *
 * ⚠️ **Nimic de aici nu ajunge la curățător.** Notele proprii arătate angajatului sunt o
 * decizie de management al oamenilor (vezi antetul din `jobRatingPolicy.ts`), nu o alegere de
 * ecran — deci componenta trăiește sub `admin/`, iar portalul curățătorului nu o importă.
 */
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Sparkles } from 'lucide-react';

/** Forma exactă întoarsă de server (`jobRatingBreakdown.ts`). */
export type RatingSeries = {
  key: string;
  label: string;
  count: number;
  average: number | null;
  tooFewToJudge: boolean;
  months: { month: string; count: number; average: number | null }[];
};

/**
 * Culoarea mediei. ⚠️ Pragurile sunt cele pe care biroul le cunoaște deja din notificări
 * (`LOW_SCORE_THRESHOLD = 2` pe server): ≤2 e „sună clientul", 3 e „a fost ok".
 */
function toneOf(average: number | null): string {
  if (average === null) return 'text-muted-foreground';
  if (average <= 2) return 'text-red-600';
  if (average < 4) return 'text-amber-600';
  return 'text-emerald-600';
}

/**
 * O linie de sparkline pe 12 luni, cu lunile goale păstrate.
 *
 * ⚠️ Aceeași alegere ca la graficul firmei: **înălțimea e media**, iar o lună fără note e o
 * bară plată gri — nu o lipsă în șir. O serie care ar sări peste tăceri ar sugera o schimbare
 * între două luni alăturate care nu s-a întâmplat.
 */
function Sparkline({ months }: { months: RatingSeries['months'] }) {
  return (
    <div className="flex items-end gap-px h-8 w-28 shrink-0" aria-hidden="true">
      {months.map(m => (
        <div
          key={m.month}
          className={`flex-1 rounded-t ${m.count ? 'bg-amber-400' : 'bg-muted'}`}
          style={{ height: `${m.average ? (m.average / 5) * 100 : 6}%` }}
          title={`${m.month}: ${m.average ?? 'no ratings'}${m.count ? ` (${m.count})` : ''}`}
        />
      ))}
    </div>
  );
}

function BreakdownCard({
  title, icon, series, minRatingsToJudge, emptyText, caveat,
}: {
  title: string;
  icon: React.ReactNode;
  series: RatingSeries[];
  minRatingsToJudge: number;
  emptyText: string;
  caveat?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-sm font-medium">{icon}{title}</div>

        {/**
          * ⚠️ Avertismentul apare doar când există rânduri pe care să le poți citi greșit. Pe un
          * card gol ar fi o propoziție lungă despre nimic, iar propozițiile care apar când nu au
          * subiect sunt cele pe care oamenii învață să le sară — inclusiv când au subiect.
          */}
        {caveat && series.length > 0 && <p className="text-xs text-muted-foreground">{caveat}</p>}

        {series.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="space-y-2">
            {series.map(s => (
              <li key={s.key} className="flex items-center gap-3">
                <span className="flex-1 min-w-0 truncate text-sm">{s.label}</span>

                {/**
                  * ⚠️ „Prea puține note" e AFIȘAT, nu ascuns: un rând dispărut nu se poate
                  * deosebi de cineva care nu a primit nicio notă, iar media dintr-o singură
                  * notă e o coincidență pe care biroul ar trata-o ca pe un tipar.
                  */}
                {s.tooFewToJudge ? (
                  <Badge variant="outline" className="text-xs font-normal">
                    {s.count} {s.count === 1 ? 'rating' : 'ratings'} — too few to judge (needs {minRatingsToJudge})
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">{s.count} ratings</span>
                )}

                <Sparkline months={s.months} />

                <span className={`text-sm font-semibold tabular-nums w-8 text-right ${toneOf(s.average)}`}>
                  {s.average ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function RatingBreakdownCards({ byCleaner, byService, minRatingsToJudge }: {
  byCleaner: RatingSeries[];
  byService: RatingSeries[];
  minRatingsToJudge: number;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <BreakdownCard
        title="By cleaner — last 12 months"
        icon={<Users className="h-4 w-4 text-muted-foreground" />}
        series={byCleaner}
        minRatingsToJudge={minRatingsToJudge}
        emptyText="No ratings in the last 12 months."
        /**
         * 🔴 Propoziția care ține cifra onestă. Fără ea, lista ordonată după medie se citește
         * ca un clasament al oamenilor — iar ea nu este unul, și nu poate fi făcută unul din
         * datele astea.
         */
        caveat="The customer rates the JOB, so a job with two cleaners counts for both, and a low score can be about the time allowed or an invoice. Read this as where to look first, not as a verdict on somebody."
      />
      <BreakdownCard
        title="By service — last 12 months"
        icon={<Sparkles className="h-4 w-4 text-muted-foreground" />}
        series={byService}
        minRatingsToJudge={minRatingsToJudge}
        emptyText="No ratings in the last 12 months."
      />
    </div>
  );
}

