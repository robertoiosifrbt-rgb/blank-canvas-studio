/**
 * ACHU-541 (Sesiunea 119) — firul de interacțiuni, pe fișa clientului.
 *
 * 🔴 **Înlocuiește nimic și adaugă contextul care lipsea.** Fișa avea deja „Audit history",
 * care arată **doar** editările fișei — cine a schimbat un telefon. Firul arată ce a făcut
 * OMUL: ce a cerut, ce i s-a răspuns, ce a notat, ce a semnat, ce consimțământ a retras, când
 * a fost cineva la el acasă, când a plătit.
 *
 * ⚠️ **Se încarcă la CERERE, nu la deschiderea fișei.** Sunt opt interogări; fișa se deschide
 * de zeci de ori pe zi ca să se corecteze un telefon, iar firul e citit rar și deliberat.
 * Aceeași alegere ca la panoul de proprietate din portal (`CustomerJobCard`).
 */
import { useState } from 'react';
import { getCustomerTimeline } from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  History, AlertCircle, Inbox, Star, FileSignature, ShieldCheck, Sparkles, Banknote, Pencil,
  Phone, Calculator,
} from 'lucide-react';
import { useTrackedRequest } from '@/lib/useTrackedRequest';

type Timeline = Awaited<ReturnType<typeof getCustomerTimeline>>;
type Item = Timeline['items'][number];

/** Iconița spune din ce zonă vine faptul, ca firul să se poată parcurge fără a fi citit tot. */
const ICONS: Record<Item['source'], typeof History> = {
  request: Inbox,
  rating: Star,
  document: FileSignature,
  consent: ShieldCheck,
  visit: Sparkles,
  money: Banknote,
  record: Pencil,
  /**
   * ⚠️ **`communication` lipsea de aici** (§20, Sesiunea 152) și cădea pe iconița implicită: firul
   * desena un telefon cu semnul de „istoric". ⛔ Nu se vedea ca defect, fiindcă fallback-ul e tăcut.
   */
  communication: Phone,
  /**
   * 🆕 §4 „Quote requested / sent / accepted" (Sesiunea 158) — cererea de ofertă, oferta dată și
   * răspunsul omului la ea. ⚠️ Calculatorul, nu un plic: oferta e o **cifră** dată clientului.
   */
  quote: Calculator,
};

/** Ziua și ora, în formatul pe care îl citește un om din Marea Britanie. */
function whenLabel(iso: string): string {
  const d = new Date(iso);
  const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  // ⚠️ Ora 12:00 e marcajul pus deliberat pe vizite și plăți (au doar o zi, nu un moment) —
  // afișată, ar fi o precizie inventată.
  return time === '12:00' ? date : `${date}, ${time}`;
}

export default function CustomerTimelineSection({ customerId }: { customerId: string }) {
  const req = useTrackedRequest<Timeline>({ timeoutMs: 30000 });
  const [opened, setOpened] = useState(false);

  const { fire } = req;
  const load = () => {
    setOpened(true);
    fire(() => getCustomerTimeline({ customerId }));
  };

  if (!opened) {
    return (
      <div className="border-t pt-2">
        <Button variant="outline" size="sm" onClick={load}>
          <History className="h-3.5 w-3.5 mr-1.5" />Show everything that happened
        </Button>
        <p className="text-xs text-muted-foreground mt-1">
          Requests, ratings, signatures, consents, visits and payments — in one thread.
        </p>
      </div>
    );
  }

  const items = req.data?.items ?? [];

  return (
    <div className="border-t pt-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <History className="h-4 w-4 text-muted-foreground" />Everything that happened
        </p>
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={load} disabled={req.loading}>Refresh</Button>
      </div>

      {req.error && (
        <div className="rounded-lg p-2 flex items-center gap-2 bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
          <p className="text-xs flex-1 text-destructive">{req.error}</p>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={load}>Retry</Button>
        </div>
      )}

      {!req.data && !req.error && <Skeleton className="h-20 w-full rounded-lg" />}

      {req.data && items.length === 0 && (
        <p className="text-xs text-muted-foreground">Nothing has happened with this customer yet.</p>
      )}

      {items.length > 0 && (
        <ol className="space-y-1.5">
          {items.map((item, i) => {
            const Icon = ICONS[item.source] ?? History;
            return (
              <li key={`${item.at}-${i}`} className="flex gap-2 text-xs">
                <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p>
                    <span className="text-muted-foreground">{whenLabel(item.at)}</span>
                    {' — '}
                    <span className="font-medium">{item.title}</span>
                    {item.by && <span className="text-muted-foreground"> · {item.by}</span>}
                  </p>
                  {item.detail && <p className="text-muted-foreground whitespace-pre-wrap">{item.detail}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* ⛔ Tăierea se SPUNE. Un fir tăiat tăcut arată exact ca unul complet, iar cine îl
          citește ar trage o concluzie despre un client din jumătate de istoric. */}
      {req.data?.truncated && (
        <p className="text-xs text-amber-700 dark:text-amber-500">
          Showing the most recent {req.data.perSourceLimit} of each kind — this customer has more history than is shown.
        </p>
      )}
    </div>
  );
}

