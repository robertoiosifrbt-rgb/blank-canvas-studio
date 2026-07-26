import { useEffect, useState, useRef } from 'react';
import { getJobAssignments, saveJobAssignment, deleteJobAssignment, getCleaners } from 'zite-endpoints-sdk';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, UserPlus, Pencil, Check, X, Loader2, Phone, Mail, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { fmtDate } from '@/lib/format';
import { ukToday } from '@/lib/ukDate';

const ROLES = ['Lead Cleaner', 'Cleaner', 'Assistant Cleaner'];

type JobInfo = {
  jobDate?: string;
  startTime?: string;
  service?: string;
  address?: string;
};

export default function JobAssignmentsPanel({ jobId, jobInfo }: { jobId: string; jobInfo?: JobInfo }) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [allCleaners, setAllCleaners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ cleanerId: '', assignmentRole: '', assignedDate: '', notes: '' });
  const [newForm, setNewForm] = useState({ cleanerId: '', assignmentRole: 'Cleaner', assignedDate: ukToday(), notes: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const load = async () => {
    setLoading(true);
    const [aData, cData] = await Promise.all([getJobAssignments({ jobId }), getCleaners({})]);
    setAssignments(aData.assignments);
    setAllCleaners(cData.records);
    setLoading(false);
  };

  useEffect(() => { load(); }, [jobId]);

  const activeCleaners = allCleaners.filter((c: any) => c.active);
  const assignedIds = assignments.map(a => { const c = Array.isArray(a.cleaner) ? a.cleaner[0] : a.cleaner; return c; });
  const available = activeCleaners.filter(c => !assignedIds.includes(c.id));

  // Selected cleaner details for Add form
  const selectedCleaner = allCleaners.find(c => c.id === newForm.cleanerId);

  const handleAdd = async () => {
    if (!newForm.cleanerId || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const addResult = await saveJobAssignment({ jobId, cleanerId: newForm.cleanerId, assignmentRole: newForm.assignmentRole || undefined, assignedDate: newForm.assignedDate || undefined, notes: newForm.notes || undefined });
      // ACHU-047: Show audit warning if present
      if (addResult.auditWarning) {
        console.warn('[JobAssignmentsPanel] Audit warning:', addResult.auditWarning);
        toast.warning('Cleaner assigned, but audit history could not be updated.', { duration: 6000 });
      } else {
        toast.success('Cleaner assigned');
      }
      setNewForm({ cleanerId: '', assignmentRole: 'Cleaner', assignedDate: ukToday(), notes: '' });
      setShowAdd(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to assign');
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  };

  const startEdit = (a: any) => {
    const cid = Array.isArray(a.cleaner) ? a.cleaner[0] : a.cleaner;
    setEditForm({ cleanerId: cid ?? '', assignmentRole: a.assignmentRole ?? '', assignedDate: a.assignedDate ?? '', notes: a.notes ?? '' });
    setEditingId(a.id);
  };

  const handleEditSave = async () => {
    if (!editingId || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const editResult = await saveJobAssignment({ id: editingId, jobId, cleanerId: editForm.cleanerId, assignmentRole: editForm.assignmentRole || undefined, assignedDate: editForm.assignedDate || undefined, notes: editForm.notes || undefined });
      // ACHU-047: Show audit warning if present
      if (editResult.auditWarning) {
        console.warn('[JobAssignmentsPanel] Audit warning:', editResult.auditWarning);
        toast.warning('Assignment updated, but audit history could not be updated.', { duration: 6000 });
      } else {
        toast.success('Assignment updated');
      }
      setEditingId(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update');
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  };

  const remove = async (id: string) => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      const delResult = await deleteJobAssignment({ id });
      // ACHU-047: Show audit warning if present
      if (delResult.auditWarning) {
        console.warn('[JobAssignmentsPanel] Audit warning:', delResult.auditWarning);
        toast.warning('Assignment removed, but audit history could not be updated.', { duration: 6000 });
      } else {
        toast.success('Assignment removed');
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to remove');
    } finally {
      savingRef.current = false;
    }
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-1"><UserPlus className="h-4 w-4" /> Assigned Cleaners</Label>

      {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cleaners assigned yet</p>
      ) : (
        <div className="space-y-2">
          {assignments.map(a => editingId === a.id ? (
            <div key={a.id} className="border border-border rounded-lg p-3 space-y-2 bg-muted/20">
              <div><Label className="text-xs">Assignment Role</Label>
                <Select value={editForm.assignmentRole} onValueChange={v => setEditForm(f => ({ ...f, assignmentRole: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Assigned Date</Label>
                <Input type="date" className="h-8 text-sm" value={editForm.assignedDate} onChange={e => setEditForm(f => ({ ...f, assignedDate: e.target.value }))} />
              </div>
              <div><Label className="text-xs">Notes</Label>
                <Textarea className="text-sm" rows={2} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Assignment notes..." />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleEditSave} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={saving}><X className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ) : (
            <div key={a.id} className="bg-muted rounded-lg px-3 py-2 text-sm space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{a.cleanerName}</p>
                    {a.cleanerActive === false && <Badge variant="destructive" className="text-[10px]">Inactive</Badge>}
                  </div>
                  {a.assignmentRole && <p className="text-xs text-muted-foreground">{a.assignmentRole}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button className="p-1 rounded hover:bg-muted-foreground/10" onClick={() => startEdit(a)}><Pencil className="h-3.5 w-3.5" /></button>
                  <button className="p-1 rounded hover:bg-destructive/10 text-destructive" onClick={() => remove(a.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                {a.assignedDate && <span>Assigned: {fmtDate(a.assignedDate)}</span>}
                {a.cleanerPhone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" />{a.cleanerPhone}</span>}
                {a.cleanerEmail && <span className="flex items-center gap-0.5"><Mail className="h-3 w-3" />{a.cleanerEmail}</span>}
              </div>
              {a.notes && <p className="text-xs text-muted-foreground truncate">{a.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/10">
          {/* ACHU-046: Show Job context info */}
          {jobInfo && (
            <div className="bg-muted/30 rounded-md p-2 text-xs space-y-0.5">
              <p className="font-medium text-muted-foreground">Job Details</p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {jobInfo.jobDate && <span>Date: {fmtDate(jobInfo.jobDate)}</span>}
                {jobInfo.startTime && <span>Start: {jobInfo.startTime}</span>}
                {jobInfo.service && <span>Service: {jobInfo.service}</span>}
                {jobInfo.address && <span>Address: {jobInfo.address}</span>}
              </div>
            </div>
          )}

          <div><Label className="text-xs">Cleaner *</Label>
            <Select value={newForm.cleanerId} onValueChange={v => setNewForm(f => ({ ...f, cleanerId: v }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select cleaner" /></SelectTrigger>
              <SelectContent>{available.map(c => <SelectItem key={c.id} value={c.id}>{c.cleanerName}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* ACHU-046: Show selected cleaner details */}
          {selectedCleaner && (
            <div className="bg-muted/30 rounded-md p-2 text-xs space-y-0.5">
              <p className="font-medium text-muted-foreground">Cleaner Details</p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {selectedCleaner.phone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" />{selectedCleaner.phone}</span>}
                {selectedCleaner.email && <span className="flex items-center gap-0.5"><Mail className="h-3 w-3" />{selectedCleaner.email}</span>}
                <span>Active: {selectedCleaner.active ? 'Yes' : 'No'}</span>
              </div>
              {!selectedCleaner.active && (
                <p className="text-destructive flex items-center gap-1 mt-1"><AlertTriangle className="h-3 w-3" />This cleaner is inactive</p>
              )}
            </div>
          )}

          <div><Label className="text-xs">Assignment Role</Label>
            <Select value={newForm.assignmentRole} onValueChange={v => setNewForm(f => ({ ...f, assignmentRole: v }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* ACHU-046: Assigned Date visible during creation */}
          <div><Label className="text-xs">Assigned Date</Label>
            <Input type="date" className="h-8 text-sm" value={newForm.assignedDate} onChange={e => setNewForm(f => ({ ...f, assignedDate: e.target.value }))} />
          </div>

          <div><Label className="text-xs">Notes</Label>
            <Textarea className="text-sm" rows={2} value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} placeholder="Assignment notes..." />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving || !newForm.cleanerId}>{saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Saving</> : <><Plus className="h-3.5 w-3.5 mr-1" />Assign</>}</Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      ) : available.length > 0 ? (
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}><Plus className="h-3.5 w-3.5 mr-1" />Add Cleaner</Button>
      ) : assignments.length > 0 ? (
        <p className="text-xs text-muted-foreground">All active cleaners are assigned</p>
      ) : null}
    </div>
  );
}
