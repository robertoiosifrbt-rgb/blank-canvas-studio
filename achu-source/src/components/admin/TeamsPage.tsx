import { useEffect, useState, useCallback } from 'react';
import { getTeams, saveTeam, type TeamRecord } from '@/lib/endpoints';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { errMsg } from '@/lib/errorMessage';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Info, Shield, Plus } from 'lucide-react';
import RefreshButton from '@/components/shared/RefreshButton';
import PageHeader from '@/components/shared/PageHeader';

/**
 * §26 „Profit by team" B (Sesiunea 154) — ECHIPELE FIXE.
 *
 * ─── Cele două hotărâri ale owner-ului, 24/08/2026, scrise pe ecran ─────────
 * 1. **Un om e într-o singură echipă.** Echipa se pune pe fișa curățătorului, nu de aici — de asta
 *    ecranul ăsta nu are nicio listă de oameni: ar fi al doilea loc în care se poate schimba același
 *    lucru, iar cele două s-ar contrazice.
 * 2. **Rapoartele vechi se recitesc pe echipa de ACUM.** ⚠️ Scris în propoziția de sus, fiindcă e
 *    singurul lucru de pe ecranul ăsta care poate surprinde: muți un om azi și se schimbă și iunie.
 *
 * ⛔ **O echipă nu se ȘTERGE, se dezactivează.** Una ștearsă ar goli tăcut rapoartele vechi care se
 * citesc pe ea — iar o cifră dispărută nu se vede, spre deosebire de un rând scris „inactive".
 */
export default function TeamsPage() {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const req = useTrackedRequest<{ records: TeamRecord[] }>({ timeoutMs: 30000 });
  const { fire } = req;
  const load = useCallback(() => { fire(() => getTeams({ includeInactive: '1' })); }, [fire]);
  useEffect(() => { load(); }, [load]);

  const teams = req.data?.records ?? [];

  const save = async (data: { id?: string; name: string; active?: boolean }) => {
    setBusy(true);
    try {
      await saveTeam(data);
      toast.success(data.id ? 'Team updated' : 'Team created');
      setName('');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not save the team.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Shield className="h-5 w-5" />}
        title="Teams"
        description="Fixed teams, so the profitability report can be read by team as well as by person."
        actions={<RefreshButton onRefresh={load} />}
      />

      {/* 🔴 Cele două lucruri care pot surprinde, ÎNAINTEA listei. */}
      <Card className="p-3">
        <p className="flex gap-2 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            A cleaner belongs to <strong>one</strong> team, and you set it on their own record
            (Team → Cleaners), not here. Reports read whoever is in the team <strong>now</strong>, so
            moving somebody today also changes what last month looks like. A team is never deleted,
            only made inactive — deleting one would quietly empty the older reports that read it.
          </span>
        </p>
      </Card>

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="grow">
            <Label htmlFor="team-new-name">New team name</Label>
            <Input
              id="team-new-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Team North"
            />
          </div>
          <Button onClick={() => void save({ name: name.trim() })} disabled={busy || !name.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" />Add team
          </Button>
        </CardContent>
      </Card>

      {req.error && (
        <Card>
          <CardContent className="pt-6 flex gap-3 text-sm">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <span>{req.error}</span>
          </CardContent>
        </Card>
      )}

      {req.loading && !req.data && <Skeleton className="h-32 w-full" />}

      {req.data && (
        <Card>
          <CardContent className="pt-6">
            <div tabIndex={0} className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-2 pr-3">Team</th>
                    <th scope="col" className="py-2 pr-3">People</th>
                    <th scope="col" className="py-2 pr-3">Status</th>
                    <th scope="col" className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {teams.length === 0 && (
                    <tr><td colSpan={4} className="py-3 text-muted-foreground">No teams yet. Add one above, then set it on each cleaner&apos;s record.</td></tr>
                  )}
                  {teams.map(t => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        {editing?.id === t.id ? (
                          <Input
                            aria-label={`Rename ${t.name}`}
                            value={editing.name}
                            onChange={e => setEditing({ id: t.id, name: e.target.value })}
                          />
                        ) : t.name}
                      </td>
                      {/* ⚠️ Numărul nu e decorativ: o echipă goală nu va avea niciun rând în raport. */}
                      <td className="py-2 pr-3 tabular-nums">
                        {t.cleanerCount}
                        {t.cleanerCount === 0 && <span className="ml-1 text-xs text-muted-foreground">(nobody yet)</span>}
                      </td>
                      <td className="py-2 pr-3">
                        {t.active ? 'Active' : <span className="text-muted-foreground">Inactive</span>}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        {editing?.id === t.id ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => void save({ id: t.id, name: editing.name.trim(), active: t.active })}
                              disabled={busy || !editing.name.trim()}
                            >Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setEditing({ id: t.id, name: t.name })}>Rename</Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void save({ id: t.id, name: t.name, active: !t.active })}
                              disabled={busy}
                            >{t.active ? 'Make inactive' : 'Reactivate'}</Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

