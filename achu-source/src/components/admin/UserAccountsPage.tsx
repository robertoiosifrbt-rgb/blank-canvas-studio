import { useEffect, useState, useCallback } from 'react';
import { roleLabel } from '@/lib/roleLabels';
import { getUserAccounts } from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, AlertTriangle, RefreshCw, AlertCircle, Mail, Search, Info, History, Users, StickyNote } from 'lucide-react';
import { StatusBadge, fmtDate } from '@/lib/format';
import { useSearchParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import UserAccountDialog from './UserAccountDialog';
import AccountAccessHistoryDialog from './AccountAccessHistoryDialog';
import SortControl from './SortControl';
import { sortRecords, readSortParams, writeSortParams, type SortDir, type SortField } from '@/lib/sorting';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import RefreshButton from '../shared/RefreshButton';
import PageHeader from '../shared/PageHeader';

/**
 * ACHU-401 (Sesiunea 115, mutat în felia 13). The rows this page renders.
 *
 * 🔴 **Nu se mai declară aici** — vin de la funcția care le produce (`accountEndpoints.ts`),
 * ca o redenumire de câmp pe server să pice la compilare, nu pe ecran. ⚠️ Lecția e ACHU-741:
 * un tip scris de mână lângă ecran a numit un câmp inexistent și nimic nu l-a putut contrazice.
 */
import type { UserAccountRow, LinkOption } from '@/lib/accountEndpoints';

const SORT_FIELDS: SortField<UserAccountRow>[] = [
  { key: 'userAccountId', label: 'User Account ID', accessor: r => r.userAccountId, kind: 'number' },
  { key: 'name', label: 'Name', accessor: r => [r.firstName, r.lastName].filter(Boolean).join(' '), kind: 'text' },
  { key: 'email', label: 'Email', accessor: r => r.email, kind: 'text' },
  { key: 'role', label: 'Role', accessor: r => r.role, kind: 'text' },
  { key: 'active', label: 'Active Status', accessor: r => r.active ? 'Active' : 'Inactive', kind: 'text' },
  /**
   * 🔴 ACHU-524, the same defect as on Customers and found the same way. The
   * accessor read `r.createdDate`, which no Postgres row carries, so every
   * comparison was null-vs-null and `compare()` returned 0
   * (`src/lib/sorting.ts:30`) — and the `userAccountId`-descending tiebreaker
   * below then decided the order. "Created Date" quietly sorted by account
   * number instead.
   */
  { key: 'createdDate', label: 'Created Date', accessor: r => r.createdAt ?? r.createdDate, kind: 'date' },
  /**
   * 🆕 §3 „Last active" (Sesiunea 155). ⚠️ Se sortează pe **momentul** din jurnal, nu pe eticheta
   * afișată: „No sign-in recorded" ar fi ordonat alfabetic, adică deloc.
   */
  { key: 'lastSignInAt', label: 'Last Sign-in', accessor: r => r.lastSignInAt, kind: 'date' },
];

/** 🆕 §3 „Filtrare după ultima autentificare" — ⛔ fără niciun prag de vechime inventat: ori e o urmă, ori nu. */
const SIGN_IN_FILTERS = [
  { value: 'any', label: 'Any sign-in' },
  { value: 'recorded', label: 'Has signed in' },
  { value: 'never', label: 'No sign-in recorded' },
] as const;

export default function UserAccountsPage() {
  const req = useTrackedRequest<{
    records: UserAccountRow[]; customers: LinkOption[]; cleaners: LinkOption[];
    signInNote: string; sharedProfileNote: string;
  }>({ timeoutMs: 30000 });
  const records = req.data?.records ?? [];
  const customers = req.data?.customers ?? [];
  const cleaners = req.data?.cleaners ?? [];
  const [editItem, setEditItem] = useState<UserAccountRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  /**
   * 🆕 §3 „Istoric al accesului" (Sesiunea 157) — contul al cărui istoric se citește.
   *
   * ⚠️ Doar `id` și `email`: dialogul cere rândurile de la server pe **id**, iar emailul e pentru
   * titlu. ⛔ Nu se trece rândul întreg — istoricul nu depinde de nimic altceva din el.
   */
  const [historyFor, setHistoryFor] = useState<{ id: string; email: string } | null>(null);
  const [sp, setSp] = useSearchParams();

  const { sortBy, sortDir } = readSortParams(sp, 'userAccountId', 'desc');

  const load = useCallback(() => {
    req.fire(() => getUserAccounts({}));
  }, [req.fire]);

  useEffect(() => { load(); }, [load]);

  // ACHU-112: Auto-open record from URL ?id=
  const hasData = !!req.data;
  useEffect(() => {
    const targetId = sp.get('id');
    if (!targetId || !hasData) return;
    const next = new URLSearchParams(sp);
    next.delete('id');
    setSp(next, { replace: true });
    const found = records.find(r => r.id === targetId);
    if (found) { setEditItem(found); setDialogOpen(true); }
    else { toast.error('User account not found or no longer exists'); }
  }, [sp, hasData]);

  /**
   * 🆕 §3 „Căutare utilizatori" / „Filtrare după rol" / „Filtrare după status" (Sesiunea 155).
   *
   * ⚠️ **Filtrarea se face pe ecran, nu pe server**, și e o alegere măsurată: ruta întoarce
   * **toate** conturile într-un răspuns (sunt câteva, nu mii), deci un filtru pe server ar fi
   * adăugat o cerere la fiecare literă fără să scoată niciun rând din memorie. ⛔ Invers față de
   * liste paginate (vizite, cheltuieli), unde §47 a scos tocmai filtrarea în browser — acolo
   * ecranul are o **pagină**, aici are tot.
   */
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [signInFilter, setSignInFilter] = useState<string>('any');

  const handleSort = (by: string, dir: SortDir) => writeSortParams(sp, by, dir, setSp);
  const handleRetry = () => load();

  const showSkeleton = !req.data && !req.error;
  const showFullError = !!req.error && !req.data;
  const showEmpty = !!req.data && records.length === 0;

  const field = SORT_FIELDS.find(f => f.key === sortBy) ?? SORT_FIELDS[0];
  const tiebreaker = SORT_FIELDS[0];

  /** ⚠️ Căutarea trece prin email și prin nume — cele două lucruri după care e căutat un om. */
  const needle = search.trim().toLowerCase();
  const filtered = records.filter(r => {
    if (needle) {
      const hay = `${r.email} ${r.firstName ?? ''} ${r.lastName ?? ''} ${r.customerName} ${r.cleanerName}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    if (roleFilter !== 'all' && r.role !== roleFilter) return false;
    if (activeFilter !== 'all' && String(r.active) !== activeFilter) return false;
    if (signInFilter === 'recorded' && !r.everRecorded) return false;
    if (signInFilter === 'never' && r.everRecorded) return false;
    return true;
  });

  const sorted = sortRecords(filtered, field, sortDir, field.key !== 'userAccountId' ? tiebreaker : undefined, 'desc');
  /** ⚠️ Rolurile din filtru sunt cele care EXISTĂ pe conturi, nu o listă scrisă de mână care se învechește. */
  const rolesPresent = [...new Set(records.map(r => r.role))].sort();

  /**
   * 🆕 §3 „Vizualizare profiluri fără user account" (Sesiunea 155) — CINE NU POATE INTRA ÎN APLICAȚIE.
   *
   * ⚠️ **Zero interogări în plus:** ruta trimite deja toți clienții și toți curățătorii (formularul
   * de cont are nevoie de ei ca să lege o fișă), iar conturile poartă legătura. Deci lista se scade,
   * nu se cere.
   *
   * 🔴 **Cele două nu înseamnă același lucru, și de asta sunt DOUĂ liste:** un curățător fără cont
   * **nu poate folosi aplicația de pe telefon** — e o lipsă de reparat; un client fără cont e
   * **normal**, portalul se dă doar cui îl cere. ⛔ Într-o singură listă, cea de-a doua ar fi
   * îngropat-o pe prima sub zeci de rânduri despre care nu e nimic de făcut.
   */
  const linkedCustomerIds = new Set(records.map(r => r.customerId).filter(Boolean));
  const linkedCleanerIds = new Set(records.map(r => r.cleanerId).filter(Boolean));
  const cleanersWithoutAccount = cleaners.filter(c => !linkedCleanerIds.has(c.id));
  const customersWithoutAccount = customers.filter(c => !linkedCustomerIds.has(c.id));

  return (
    <div className="space-y-4">
      <PageHeader
        as="h2"
        titleClassName="text-2xl font-bold"
        title="User Accounts"
        actions={
          <>
            <RefreshButton onRefresh={handleRetry} />
            <Button variant="outline" asChild><Link to="/admin/invitations"><Mail className="h-4 w-4 mr-1" />Invitations</Link></Button>
            <Button onClick={() => { setEditItem(null); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" />Create Customer</Button>
          </>
        }
      />
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1 w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search user accounts"
            placeholder="Search by email or name..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter by role"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
        >
          <option value="all">All roles</option>
          {rolesPresent.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}
        </select>
        <select
          aria-label="Filter by status"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={activeFilter}
          onChange={e => setActiveFilter(e.target.value)}
        >
          <option value="all">Active and inactive</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
        <select
          aria-label="Filter by last sign-in"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={signInFilter}
          onChange={e => setSignInFilter(e.target.value)}
        >
          {SIGN_IN_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <SortControl options={SORT_FIELDS} sortBy={sortBy} sortDir={sortDir} onChange={handleSort} />
      </div>

      {req.error && records.length > 0 && (
        <div className={`rounded-lg p-3 flex items-center gap-2 ${req.stale ? 'bg-amber-50 border border-amber-200' : 'bg-destructive/10 border border-destructive/20'}`}>
          <AlertCircle className={`h-4 w-4 shrink-0 ${req.stale ? 'text-amber-600' : 'text-destructive'}`} />
          <p className={`text-sm flex-1 ${req.stale ? 'text-amber-800' : 'text-destructive'}`}>{req.error}{req.stale ? ' — showing cached data' : ''}</p>
          <Button variant="ghost" size="sm" onClick={handleRetry} disabled={req.loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${req.loading ? 'animate-spin' : ''}`} />{req.loading ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      )}

      {/* ⚠️ Când filtrul ascunde rânduri, se SPUNE din câte — altfel „2 accounts" se citește ca „firma are două conturi". */}
      <p className="text-xs text-muted-foreground">
        {sorted.length} account{sorted.length !== 1 ? 's' : ''}
        {sorted.length !== records.length && ` of ${records.length}`}
      </p>
      <div tabIndex={0} className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/50">
            <th scope="col" className="text-left p-3 font-medium">ID</th>
            <th scope="col" className="text-left p-3 font-medium">Email</th>
            <th scope="col" className="text-left p-3 font-medium hidden md:table-cell">Name</th>
            <th scope="col" className="text-left p-3 font-medium">Role</th>
            <th scope="col" className="text-left p-3 font-medium hidden md:table-cell">Linked Record</th>
            <th scope="col" className="text-left p-3 font-medium">Active</th>
            {/* 🆕 §1/§3 (Sesiunea 155) — ultima intrare, din jurnal. */}
            <th scope="col" className="text-left p-3 font-medium hidden lg:table-cell">Last Sign-in</th>
            <th scope="col" className="p-3 w-16"></th>
          </tr></thead>
          <tbody>
            {showSkeleton ? Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}><td colSpan={8} className="p-3"><div className="h-5 bg-muted animate-pulse rounded" /></td></tr>
            )) : showFullError ? (
              <tr><td colSpan={8} className="p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <AlertCircle className="h-8 w-8 text-destructive/60" />
                  <p className="text-muted-foreground">Unable to load user accounts. Please try again.</p>
                  <Button variant="outline" size="sm" onClick={handleRetry} disabled={req.loading}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${req.loading ? 'animate-spin' : ''}`} />{req.loading ? 'Retrying…' : 'Retry'}
                  </Button>
                </div>
              </td></tr>
            ) : showEmpty ? (
              <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No user accounts</td></tr>
            ) : sorted.map(r => (
              <tr key={r.id} className={`border-t border-border hover:bg-muted/30 ${r.duplicateEmail ? 'bg-amber-50' : ''}`}>
                <td className="p-3 font-mono text-xs">#{r.userAccountId}</td>
                <td className="p-3">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="break-all">{r.email}</span>
                    {r.duplicateEmail && (
                      <span title="Duplicate email — multiple accounts share this address" className="inline-flex items-center gap-0.5 text-amber-600">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Duplicate</span>
                      </span>
                    )}
                    {/*
                      🆕 §3 „Note administrative despre cont" (Sesiunea 158) — SEMNUL, nu textul.
                      🔴 O notă pe care nu o vezi din listă e o notă pe care nimeni nu o citește: ar
                      fi cerut deschiderea fiecărui cont pe rând, adică exact munca pe care nota o
                      înlocuiește.
                      ⛔ **Textul NU se scrie în tabel**, deliberat: o notă are până la 2000 de
                      caractere, iar ecranul ăsta se citește și de pe telefon. Se dă la `title`, deci
                      apare la trecerea mouse-ului, și întreg la Edit.
                      ⚠️ Gri, nu colorat: o notă e o informație, nu un avertisment — un semn roșu ar
                      fi spus „e o problemă cu contul ăsta", ceea ce de obicei nu e adevărat.
                    */}
                    {r.notes && (
                      <span title={r.notes} className="inline-flex items-center gap-0.5 text-muted-foreground shrink-0">
                        <StickyNote className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Note</span>
                      </span>
                    )}
                  </span>
                </td>
                <td className="p-3 hidden md:table-cell">{[r.firstName, r.lastName].filter(Boolean).join(' ') || '—'}</td>
                {/* ⚠️ Numele citit de om, dintr-un singur loc — nu valoarea din bază. */}
                <td className="p-3"><StatusBadge status={roleLabel(r.role)} /></td>
                <td className="p-3 hidden md:table-cell text-xs">
                  <span className="flex flex-col gap-0.5">
                    <span>{r.customerName || r.cleanerName || '—'}</span>
                    {/*
                      🔴 ACHU-790 (Sesiunea 157) — **lângă profil, nu lângă email**: semnalul e despre
                      fișa legată, iar acolo se uită omul când se întreabă „cine e contul ăsta".
                      ⚠️ Roșu doar când celălalt cont e ACTIV: atunci doi oameni văd aceeași fișă
                      acum. Un cont stins care mai poartă legătura e de curățat, nu de speriat.
                    */}
                    {r.sharedProfileWith?.length > 0 && (
                      <span
                        title={`Also linked to: ${r.sharedProfileWith.join(', ')}`}
                        className={`inline-flex items-center gap-0.5 font-medium ${r.sharedProfileActive ? 'text-destructive' : 'text-muted-foreground'}`}
                      >
                        <Users className="h-3.5 w-3.5 shrink-0" />
                        {r.sharedProfileActive ? 'Shared with an active account' : 'Also on a switched-off account'}
                      </span>
                    )}
                  </span>
                </td>
                <td className="p-3">
                  {r.active ? <span className="text-green-600 text-xs font-medium">Active</span> : (
                    <span className="flex flex-col gap-0.5">
                      <span className="text-destructive text-xs font-medium">Inactive</span>
                      {/*
                        🆕 §3 (Sesiunea 158) — DE CE și DE CÂND e stins contul, sub cuvântul „Inactive".
                        🔴 Până acum un cont stins arăta identic indiferent dacă omul a plecat, a
                        greșit cineva, sau a fost o măsură de o zi — iar „îl repornim?" nu avea niciun
                        răspuns în ecran. ⚠️ Se arată **numai** la conturile stinse: la cele active
                        n-are ce spune, iar o coloană nouă ar fi costat lățime pe toate rândurile.
                        ⛔ Data e cea de la **prima** stingere (serverul o păstrează), nu de la ultima
                        salvare a fișei — altfel s-ar fi împrospătat singură la orice editare.
                      */}
                      {r.deactivatedAt && (
                        <span className="text-[11px] text-muted-foreground">Since {fmtDate(r.deactivatedAt)}</span>
                      )}
                      {r.deactivationReason && (
                        <span className="text-[11px] text-muted-foreground break-words" title={r.deactivationReason}>
                          {r.deactivationReason}
                        </span>
                      )}
                    </span>
                  )}
                </td>
                {/* ⛔ Eticheta vine de la server: „No sign-in recorded" e un fapt despre jurnal, nu despre om. */}
                <td className={`p-3 hidden lg:table-cell text-xs ${r.everRecorded ? '' : 'text-muted-foreground'}`}>{r.label}</td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    {/*
                      🆕 §3 (Sesiunea 157) — lângă Edit, nu pe coloana „Last Sign-in": aceea se ascunde
                      sub `lg`, iar întrebarea „de când are acces" se pune și de pe telefon.
                    */}
                    <button
                      aria-label={`Access history for ${r.email ?? 'account'}`}
                      title={`Access history for ${r.email ?? 'account'}`}
                      className="p-1.5 rounded hover:bg-muted"
                      onClick={() => setHistoryFor({ id: r.id, email: r.email })}
                    ><History className="h-3.5 w-3.5" /></button>
                    <button aria-label={`Edit ${r.email ?? 'account'}`} title={`Edit ${r.email ?? 'account'}`} className="p-1.5 rounded hover:bg-muted" onClick={() => { setEditItem(r); setDialogOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/*
        🆕 §3 (Sesiunea 155) — sub tabel, nu deasupra: e o întrebare de „cine lipsește", pusă după ce
        te-ai uitat la cine e. ⛔ Se arată doar dacă există cineva — o secțiune goală care spune
        „nimeni" în fiecare zi devine zgomot.
      */}
      {hasData && (cleanersWithoutAccount.length > 0 || customersWithoutAccount.length > 0) && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <h3 className="text-sm font-medium">People with no sign-in</h3>
          {cleanersWithoutAccount.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-destructive">
                {cleanersWithoutAccount.length} cleaner{cleanersWithoutAccount.length === 1 ? '' : 's'} cannot use the app
              </p>
              <p className="text-xs text-muted-foreground">
                {/* ⚠️ `LinkOption` poartă numele pe câmpul potrivit felului lui — nu există un `label` comun. */}
                {cleanersWithoutAccount.map(c => c.cleanerName ?? 'Unnamed').join(' · ')}
              </p>
            </div>
          )}
          {customersWithoutAccount.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium">
                {customersWithoutAccount.length} customer{customersWithoutAccount.length === 1 ? '' : 's'} without a portal account
              </p>
              {/* ⚠️ Spune că e NORMAL — altfel cifra se citește ca o listă de lipsuri de reparat. */}
              <p className="text-xs text-muted-foreground">
                This is normal: a portal account is only created for a customer who asks for one. A cleaner without
                one, though, cannot open the app on their phone.
              </p>
            </div>
          )}
        </div>
      )}

      {/*
        🔴 ACHU-790 — propoziția apare **doar când există măcar un rând cu semnalul**: una care stă
        acolo în fiecare zi devine zgomot, iar zgomotul e cum a stat starea asta nevăzută până azi.
      */}
      {req.data?.sharedProfileNote && records.some(r => r.sharedProfileWith?.length > 0) && (
        <p className="flex gap-2 text-xs text-muted-foreground">
          <Users className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{req.data.sharedProfileNote}</span>
        </p>
      )}

      {/* 🔴 Limita coloanei de intrări, lângă ea: „No sign-in recorded" nu înseamnă „nu a intrat niciodată". */}
      {req.data?.signInNote && (
        <p className="flex gap-2 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{req.data.signInNote}</span>
        </p>
      )}

      <AccountAccessHistoryDialog open={!!historyFor} account={historyFor} onClose={() => setHistoryFor(null)} />

      <UserAccountDialog open={dialogOpen} onClose={() => setDialogOpen(false)} item={editItem} customers={customers} cleaners={cleaners} onSaved={() => { setDialogOpen(false); load(); }} />
    </div>
  );
}

