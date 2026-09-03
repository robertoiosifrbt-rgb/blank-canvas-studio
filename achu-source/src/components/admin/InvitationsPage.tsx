import { useEffect, useState, useCallback } from 'react';
import { roleLabel } from '@/lib/roleLabels';
import {
  getInvitations, createInvitation, revokeInvitation, getCleaners,
  type InvitationRow, type InvitableRole, type LinkOption,
} from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { StatusBadge } from '@/lib/format';
import { Plus, RefreshCw, AlertCircle, Copy, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import RefreshButton from '../shared/RefreshButton';
import PageHeader from '../shared/PageHeader';
import { errMsg } from '@/lib/errorMessage';

/**
 * ACHU-142: Admin sends an invitation (email + role, optionally linked to a
 * Cleaner record); the invitee accepts it at /accept-invite?token=... while
 * signed in with that exact email. This page never shows a token after the
 * moment it's created — copy it then, or revoke and send a new one.
 */
export default function InvitationsPage() {
  const req = useTrackedRequest<{ records: InvitationRow[] }>({ timeoutMs: 30000 });
  const records = req.data?.records ?? [];
  /**
   * ⚠️ `LinkOption`, nu o formă scrisă aici: ruta de curățători împrăștie rândul Prisma întreg,
   * deci nu se poate tipiza cinstit — dar cele două câmpuri citite de selector au deja un nume
   * publicat (`accountEndpoints.ts`), folosit identic de ecranul de conturi.
   */
  const [cleaners, setCleaners] = useState<LinkOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [revokeItem, setRevokeItem] = useState<InvitationRow | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const load = useCallback(() => {
    req.fire(() => getInvitations({}));
  }, [req.fire]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getCleaners({}).then(d => setCleaners(d.records)).catch(() => {}); }, []);

  const handleRevoke = async () => {
    if (!revokeItem) return;
    try {
      await revokeInvitation({ id: revokeItem.id });
      toast.success('Invitation revoked');
      setRevokeItem(null);
      load();
    } catch (e) {
      toast.error(errMsg(e) || 'Failed to revoke invitation');
      setRevokeItem(null);
    }
  };

  const showSkeleton = !req.data && !req.error;
  const showFullError = !!req.error && !req.data;
  const showEmpty = !!req.data && records.length === 0;

  return (
    <div className="space-y-4">
      <PageHeader
        as="h2"
        titleClassName="text-2xl font-bold"
        title="Invitations"
        actions={
          <>
            <RefreshButton onRefresh={load} />
            <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />New Invitation</Button>
          </>
        }
      />
      <p className="text-xs text-muted-foreground">
        Admin and Cleaner access can only be granted through an accepted invitation — never by email match alone (ACHU-142).
        Each invitation is single-use and expires 48 hours after it's sent.
      </p>

      {req.error && records.length > 0 && (
        <div className={`rounded-lg p-3 flex items-center gap-2 ${req.stale ? 'bg-amber-50 border border-amber-200' : 'bg-destructive/10 border border-destructive/20'}`}>
          <AlertCircle className={`h-4 w-4 shrink-0 ${req.stale ? 'text-amber-600' : 'text-destructive'}`} />
          <p className={`text-sm flex-1 ${req.stale ? 'text-amber-800' : 'text-destructive'}`}>{req.error}{req.stale ? ' — showing cached data' : ''}</p>
          <Button variant="ghost" size="sm" onClick={load} disabled={req.loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${req.loading ? 'animate-spin' : ''}`} />{req.loading ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      )}

      <div tabIndex={0} className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/50">
            <th scope="col" className="text-left p-3 font-medium">Email</th>
            <th scope="col" className="text-left p-3 font-medium">Role</th>
            <th scope="col" className="text-left p-3 font-medium hidden md:table-cell">Linked Cleaner</th>
            <th scope="col" className="text-left p-3 font-medium">Status</th>
            <th scope="col" className="text-left p-3 font-medium hidden md:table-cell">Invited By</th>
            <th scope="col" className="text-left p-3 font-medium hidden md:table-cell">Expires</th>
            <th scope="col" className="p-3 w-16"></th>
          </tr></thead>
          <tbody>
            {showSkeleton ? Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}><td colSpan={7} className="p-3"><div className="h-5 bg-muted animate-pulse rounded" /></td></tr>
            )) : showFullError ? (
              <tr><td colSpan={7} className="p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <AlertCircle className="h-8 w-8 text-destructive/60" />
                  <p className="text-muted-foreground">Unable to load invitations. Please try again.</p>
                  <Button variant="outline" size="sm" onClick={load} disabled={req.loading}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${req.loading ? 'animate-spin' : ''}`} />{req.loading ? 'Retrying…' : 'Retry'}
                  </Button>
                </div>
              </td></tr>
            ) : showEmpty ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No invitations yet</td></tr>
            ) : records.map(r => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                <td className="p-3 break-all">{r.email}</td>
                <td className="p-3"><StatusBadge status={roleLabel(r.role)} /></td>
                <td className="p-3 hidden md:table-cell text-xs">{r.cleanerName || '—'}</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
                <td className="p-3 hidden md:table-cell text-xs">{r.invitedBy}</td>
                <td className="p-3 hidden md:table-cell text-xs">{new Date(r.expiresAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })}</td>
                <td className="p-3">
                  {r.status === 'Pending' && (
                    <button className="p-1.5 rounded hover:bg-destructive/10 text-destructive" title="Revoke" onClick={() => setRevokeItem(r)}>
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <NewInvitationDialog
        open={dialogOpen}
        cleaners={cleaners}
        onClose={() => setDialogOpen(false)}
        onCreated={(link) => { setDialogOpen(false); setCreatedLink(link); load(); }}
      />

      <Dialog open={!!createdLink} onOpenChange={v => !v && setCreatedLink(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invitation created</DialogTitle>
            <DialogDescription>Copy this link and send it to the invitee — it won't be shown again.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input readOnly aria-label="The invitation link" value={createdLink ?? ''} className="font-mono text-xs" />
            <Button
              variant="outline"
              aria-label="Copy the invitation link" title="Copy the invitation link"
              onClick={() => { if (createdLink) { navigator.clipboard.writeText(createdLink); toast.success('Copied'); } }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Button className="w-full" onClick={() => setCreatedLink(null)}>Done</Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revokeItem} onOpenChange={v => !v && setRevokeItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke invitation to {revokeItem?.email}?</AlertDialogTitle>
            <AlertDialogDescription>They will no longer be able to accept it. You can send a new invitation afterward.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NewInvitationDialog({ open, cleaners, onClose, onCreated }: {
  open: boolean; cleaners: LinkOption[]; onClose: () => void; onCreated: (link: string) => void;
}) {
  const [email, setEmail] = useState('');
  // ⛔ Lista rolurilor nu se mai scrie aici: `InvitableRole` vine din `z.enum`-ul rutei.
  const [role, setRole] = useState<InvitableRole>('Cleaner');
  const [cleanerId, setCleanerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setEmail(''); setRole('Cleaner'); setCleanerId(''); setError(''); }
  }, [open]);

  const handleSave = async () => {
    if (!email.trim()) { setError('Email is required'); return; }
    if (role === 'Cleaner' && !cleanerId) { setError('Select a Cleaner record to link before sending a Cleaner invitation'); return; }
    setSaving(true);
    setError('');
    try {
      const result = await createInvitation({ email: email.trim(), role, cleanerId: role === 'Cleaner' ? (cleanerId || undefined) : undefined });
      const link = `${window.location.origin}/accept-invite?token=${result.token}`;
      onCreated(link);
    } catch (e) {
      setError(errMsg(e) || 'Failed to create invitation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Invitation</DialogTitle>
          <DialogDescription>Expires 48 hours after it's sent. Single-use — accepting it requires signing in with this exact email.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label htmlFor="invitation-email">Email *</Label><Input id="invitation-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" /></div>
          <div><Label htmlFor="invitation-role">Role *</Label>
            <Select value={role} onValueChange={v => setRole(v as 'Admin' | 'Cleaner' | 'ReadOnly' | 'FinanceOnly' | 'HROnly')}>
              <SelectTrigger id="invitation-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Cleaner">Cleaner</SelectItem>
                {/* ⚠️ Numele vine dintr-un singur loc (`roleLabels.ts`), plus o propoziție despre
                    ce poate rolul: un nume singur nu spune „control complet" nimănui. */}
                <SelectItem value="Admin">{roleLabel('Admin')}</SelectItem>
                {/* ACHU-348. Named for what it CAN do, not for what it cannot:
                    "Read-only" alone reads like a restricted Cleaner. */}
                <SelectItem value="ReadOnly">Read-only (sees everything, changes nothing)</SelectItem>
                {/* ACHU-357. Named by the AREA each one covers rather than by rank.
                    They are narrower than read-only in subject and wider in power —
                    a viewer sees everything and changes nothing, these two see one
                    area and change it — so "more" and "less" are the wrong words. */}
                <SelectItem value="FinanceOnly">Finance only (payroll money, no employee records)</SelectItem>
                <SelectItem value="HROnly">HR only (employee records, no pay figures)</SelectItem>
              </SelectContent>
            </Select>
            {role === 'ReadOnly' && (
              <p className="mt-1 text-xs text-muted-foreground">
                {/* Said before the invitation is sent, because the person granting it
                    needs to know it is not a limited view — it is the whole business,
                    wages included, without the ability to change anything. */}
                They will see <strong>every admin screen, including every wage</strong>, and can download reports —
                but cannot save, approve, delete or send anything, and cannot take a full data export. Use it for an
                accountant or a bookkeeper who needs to look, not edit.
              </p>
            )}
          </div>
          {role === 'FinanceOnly' && (
            <p className="text-xs text-muted-foreground">
              They will see <strong>pay runs, payroll reports, the CSV export, the P60 and P45 the office issues, and
              the simulator</strong> — and can approve and lock a run. They will <strong>not</strong> see National
              Insurance numbers, addresses, timesheets, holiday or sickness, and nothing outside payroll.
            </p>
          )}
          {role === 'HROnly' && (
            <p className="text-xs text-muted-foreground">
              They will see <strong>employee details, timesheets, holiday, sickness, family leave and pension
              enrolment dates</strong> — and can edit them. They will <strong>not</strong> see any pay rate, tax code,
              pay run or payroll report, and nothing outside payroll. ⚠️ They can approve timesheets, which is what
              allows those hours to be paid.
            </p>
          )}
          {role === 'Cleaner' && (
            <div>
              <Label htmlFor="invitation-link-to-cleaner-record">Link to Cleaner record *</Label>
              <Select value={cleanerId} onValueChange={setCleanerId}>
                <SelectTrigger id="invitation-link-to-cleaner-record"><SelectValue placeholder="Select a Cleaner record" /></SelectTrigger>
                <SelectContent>{cleaners.map(c => <SelectItem key={c.id} value={c.id}>{c.cleanerName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? 'Sending...' : 'Create Invitation'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

