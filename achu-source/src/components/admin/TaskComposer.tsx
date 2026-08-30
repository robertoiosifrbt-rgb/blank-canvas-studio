/**
 * §43 „Tasks și internal workflow" (Sesiunea 144) — DE UNDE SE SCRIE O SARCINĂ.
 *
 * ⛔ **Fișier propriu, nu un bloc în pagină** (`AGENT_RULES` §9): formularul are starea lui, iar
 * pagina are lista și filtrele. Amestecate, fiecare tastare în câmpul de titlu ar fi re-randat
 * lista întreagă.
 *
 * ⚠️ **Un singur câmp obligatoriu: titlul.** Restul se poate completa mai târziu, iar un formular
 * care cere termen și responsabil ÎNAINTE de a nota ceva e un formular pe care nimeni nu-l
 * deschide când e grăbit — adică exact atunci când o sarcină se pierde.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createTask, aboutToLink, TASK_PRIORITIES, type TaskPriority, type TaskAbout } from '@/lib/taskEndpoints';
import { errMsg } from '@/lib/errorMessage';

export default function TaskComposer({ onCreated, about }: {
  onCreated: () => void;
  /**
   * 🔴 §43 „Related …" (Sesiunea 150) — **DESPRE CE e sarcina, când formularul se deschide de pe
   * ecranul lucrului respectiv.**
   *
   * ⛔ Nu un selector de căutat: ecranul care deschide formularul **știe deja** despre ce e vorba, iar
   * a-l pune pe om să caute din nou reclamația pe care o are deschisă e chiar frecarea din care
   * sarcinile nu se mai notează. ⚠️ Absent pe ecranul de sarcini, unde nu există un „lucrul acesta".
   */
  about?: TaskAbout;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await createTask({
        title: title.trim(),
        notes: notes.trim() || undefined,
        priority,
        // ⚠️ Gol = fără termen, nu „azi": o sarcină fără dată nu a promis nimic și nu poate fi restantă.
        dueDate: dueDate || null,
        assignedTo: assignedTo.trim().toLowerCase() || null,
        // §43 (Sesiunea 150) — traducerea e într-un singur loc (`aboutToLink`), nu în fiecare ecran.
        ...aboutToLink(about),
      });
      setTitle(''); setNotes(''); setDueDate(''); setAssignedTo(''); setPriority('Medium');
      setOpen(false);
      onCreated();
    } catch (e) {
      // Mesajul serverului AȘA CUM E: el dă exemplul de titlu, sau spune că adresa nu e o adresă.
      toast.error(errMsg(e) || 'Could not save that task.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button type="button" size="sm" variant={about ? 'outline' : 'default'} onClick={() => setOpen(true)}>
        {/* ⚠️ Butonul spune despre CE ar fi sarcina, nu doar „New task": pe ecranul unei reclamații,
            „New task" singur nu spune dacă se leagă de ea sau e o notiță oarecare. */}
        <Plus className="h-4 w-4 mr-1" aria-hidden="true" />{about ? 'New task about this' : 'New task'}
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      {/* 🔴 Legătura se ARATĂ, nu se presupune: cine notează trebuie să vadă de ce se agață sarcina.
          ⛔ Iar dacă nu se vede, nimeni nu poate observa că e greșită. */}
      {about && (
        <p className="text-[11px] text-muted-foreground">
          About <span className="font-medium text-foreground">{about.label}</span>
        </p>
      )}
      <div>
        <Label htmlFor="task-title" className="text-xs">What needs doing</Label>
        <Input
          id="task-title"
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Ring Mrs Smith about Thursday"
          // ⚠️ Enter salvează: biroul notează ceva în trecere, iar mutarea mâinii pe buton e chiar
          // motivul pentru care lucrurile nu se notează.
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void save(); } }}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <Label htmlFor="task-priority" className="text-xs">Priority</Label>
          {/* ⚠️ `select` simplu, nu un Radix: pe un formular de notat în trecere, un meniu care
              cere două apăsări și o animație e mai lent decât tastatura. */}
          <select
            id="task-priority"
            className="w-full rounded-md border bg-background px-2 py-2 text-sm"
            value={priority}
            onChange={e => setPriority(e.target.value as TaskPriority)}
          >
            {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="task-due" className="text-xs">Due (optional)</Label>
          <Input id="task-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="task-who" className="text-xs">Who (optional)</Label>
          <Input
            id="task-who" type="email" value={assignedTo}
            onChange={e => setAssignedTo(e.target.value)}
            placeholder="denisa@achu.uk"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="task-notes" className="text-xs">Notes (optional)</Label>
        <Textarea id="task-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {/* 🔴 Spus pe ecran, nu doar în cod: cine scrie numele unui client aici trebuie să știe unde
          ajunge textul. ⚠️ Aceeași propoziție ca decizia din politica de ștergere. */}
      <p className="text-[11px] text-muted-foreground">
        Notes here can be seen by the office, and a customer asking for a copy of their data will be
        shown anything written about them.
      </p>

      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={save} disabled={!title.trim() || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Save task'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

