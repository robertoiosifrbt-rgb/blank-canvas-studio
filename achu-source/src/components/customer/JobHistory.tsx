import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { History, AlertCircle, Loader2, RefreshCw, ChevronDown } from 'lucide-react';
import JobCard from './CustomerJobCard';
import type { ReviewInviteState } from './JobRatingPanel';
import type { RequestKind } from './CustomerRequests';
import type { PortalJob } from './portalTypes';

/**
 * 🆕 ACHU-532 (Sesiunea 118) — `onRequest` e NOU aici, și absența lui era chiar golul.
 *
 * Cardurile de istoric se randau fără el, deci pentru o vizită **terminată** clientul nu
 * putea cere nimic din listă: singura ieșire era „Report a problem" pe o vizită viitoare,
 * care e alt lucru. Acum poate cere o **re-curățare** pe vizita care nu a fost bună.
 */
/** Ce are nevoie o cerere de la o vizită — citit din `CustomerApp.tsx`, unde
 *  `requestDialog` primește exact forma asta, nu ghicit din numele câmpurilor. */
type RequestableJob = { id: string; service?: string | null; jobDate: string };

export default function JobHistory({ jobs, hasMore, loadMore, loadingMore, error, onRequest, reviewInvite, onRated }: { jobs: PortalJob[]; hasMore: boolean; loadMore: () => void; loadingMore: boolean; error?: string; onRequest?: (kind: RequestKind, job: RequestableJob) => void;
  /** ACHU-553 — invitatia la o recenzie publica, decisa pe server. Trecuta pana la nota. */
  reviewInvite?: ReviewInviteState;
  /** ACHU-566 — reincarca portalul dupa notare, ca payload-ul sa nu ramana cu `rating: null`. */
  onRated?: () => void }) {
  return (
    <div className="space-y-3">
      {jobs.length === 0 && !error ? (
        <Card>
          <CardContent className="p-8 text-center">
            <History className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No previous jobs found.</p>
            <p className="text-xs text-muted-foreground mt-1">Your completed and cancelled jobs will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/*
            ACHU-566 — cheia e ID-UL VIZITEI, nu indexul din tablou.

            🔴 Cardul tine stare LOCALA (nota, confirmarea de acces). Cu `key={i}`, React
            leaga starea de o POZITIE: la „Show more", la o resortare, sau cand o vizita trece
            din „upcoming" in istoric, cardul de pe pozitia i primeste alta vizita si pastreaza
            starea celei dinainte — deci nota unei vizite poate aparea pe alta.
          */}
          {jobs.map(j => <JobCard key={j.id} job={j} onRequest={onRequest} reviewInvite={reviewInvite} onRated={onRated} />)}
          {/* ACHU-082/120: Inline error with retry — preserves loaded history */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive flex-1">{error}</p>
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><RefreshCw className="h-3.5 w-3.5 mr-1" />Retry</>}
              </Button>
            </div>
          )}
          {hasMore && !error && (
            <Button variant="outline" className="w-full" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : <><ChevronDown className="h-4 w-4 mr-1" />Load More</>}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

