/**
 * ACHU-401, felia a unsprezecea — JURNALUL DE ERORI: formele răspunsurilor.
 *
 * ⚠️ **De ce numai TIPURI aici, iar funcțiile rămân în `endpoints.ts`**, spre deosebire de chat
 * și de notificări, care s-au mutat cu totul: `reportClientError` e chemat de `ErrorBoundary.tsx`
 * printr-un **import dinamic**, și e mockat în **douăzeci** de fișiere de test ca `@/lib/endpoints`.
 * Mutarea lui ar fi însemnat douăzeci de fișiere atinse pentru **un** avertisment de lint — iar un
 * mock parțial nu lasă funcția lipsă „nemockată", o face `undefined` (`AGENT_RULES` §10). Tipul
 * pus la locul lui închide avertismentul fără să miște nimic, și `endpoints.ts` tot iese mai mic
 * în felia asta (chatul și notificările au plecat de acolo).
 *
 * 🔴 **Citit din `backend/src/routes/errorLog.ts`** și din `model ErrorLog` (`schema.prisma`) —
 * ruta de citire întoarce rândurile Prisma **brute** (`errors: rows`), deci forma e a modelului.
 */

/** Un raport de eroare, exact cum stă în bază — ruta îl trimite neprelucrat. */
export type ErrorLogRow = {
  id: string;
  /** ⚠️ Emailul și rolul sunt COPIATE la momentul erorii, ca un cont șters să nu golească rândul. */
  userId: string | null;
  email: string | null;
  role: string | null;
  message: string;
  /** ⚠️ Producția e minificată — o urmă de stivă e adesea aproape nefolositoare. */
  stack: string | null;
  componentStack: string | null;
  path: string | null;
  userAgent: string | null;
  /** Care ErrorBoundary a prins-o (app-root / routes / admin-content / …). */
  boundary: string | null;
  createdAt: string;
  /** După acest moment rândul nu se mai afișează, și se șterge la următoarea măturare. */
  expiresAt: string | null;
};

/**
 * 🔴 Un rând al indexului. **Numărătoarea vine dintr-un `groupBy` peste TOT ce e viu**, nu peste
 * cele 100 de rânduri aduse — o cifră calculată dintr-o listă trunchiată ar fi încrezătoare și
 * greșită, ceea ce e mai rău decât să lipsească.
 */
export type ErrorLogGroup = {
  message: string;
  count: number;
  lastSeen: string;
  /** Două date, nu una: „a început acum nouă zile și încă se întâmplă" e altă problemă decât
   *  „s-a întâmplat de două ori într-un minut", iar o singură dată nu le deosebește. */
  firstSeen: string;
};

export type ErrorLogResponse = {
  errors: ErrorLogRow[];
  total: number;
  /** Adevărat când `total` e mai mare decât câte rânduri conține `errors` — spus, nu dedus. */
  truncated: boolean;
  groups: ErrorLogGroup[];
  retentionDays: number;
  /** Propoziția e a serverului, nu a ecranului: e un fapt despre rută, nu despre afișare. */
  retentionNote: string;
};

/**
 * ⚠️ `recorded: false` înseamnă că raportul a fost **aruncat de limitator**, nu că a eșuat.
 * Ruta întoarce 200 deliberat: browserul e deja pe o cale de eroare, iar un răspuns de eroare
 * aici ar produce a doua eroare de raportat.
 */
export type ErrorReportAck = { success: true; recorded: boolean };

