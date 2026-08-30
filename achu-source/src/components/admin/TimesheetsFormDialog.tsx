import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DateField from '@/components/shared/DateField';
import TimeField from '@/components/shared/TimeField';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Info } from 'lucide-react';
// ACHU-368. One source for the sentence, shared with the cleaner's own screen.
import { TRAVEL_IS_WORKING_TIME_OFFICE } from '@/lib/workingTimeWording';
import { KIND_LABEL, type FormState } from '@/lib/timesheetsFormat';

export default function TimesheetsFormDialog({
  form, onChange, person, busy, onSave, onClose,
}: {
  form: FormState | null;
  onChange: (next: FormState) => void;
  person: { name: string } | null;
  busy: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={form != null} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{form?.id ? 'Change these hours' : 'Record hours'}</DialogTitle>
          <DialogDescription>
            {person ? `For ${person.name}. ` : ''}
            Saved as waiting to be approved — recording hours and agreeing them are two different things.
          </DialogDescription>
        </DialogHeader>

        {/* ─── What counts as working time (ACHU-368, Sesiunea 85) ────────
            🔴 Said HERE, where the number is decided, not in a document. Travel
            between two customers IS working time for the minimum wage, and
            Roberto confirmed ACHU pays it — but nothing in the app said so, and
            the failure mode is silent: NMW is tested on the AVERAGE, so travel
            nobody logs produces an ordinary-looking average that is too high.
            The wording lives in `lib/workingTimeWording.ts` because the
            cleaner's own screen has to say the same thing. */}
        <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{TRAVEL_IS_WORKING_TIME_OFFICE}</span>
        </p>

        {form && (
          <div className="grid gap-3">
            <div>
              <Label htmlFor="f-date">Date</Label>
              <DateField id="f-date" value={form.workDate}
                onChange={e => onChange({ ...form, workDate: e.target.value })} />
            </div>
            {/* 🔴 DOUĂ REPARAȚII AICI, pentru poza trimisă de Roberto pe 15/08/2026: pe iPhone,
                „Started", „Finished" și „Unpaid break" se SUPRAPUNEAU.
                1. `TimeField` în loc de `<Input type="time">` — ACHU-422 a scris componenta
                   exact pentru defectul ăsta (controlul nativ are o lățime minimă proprie care
                   bate `width: 100%`), dar fusese pusă doar în `JobDialog`. Aici rămăsese
                   controlul nativ, deci defectul rămăsese și el.
                2. Un rând pe telefon, trei coloane abia de la `sm:` — coloanele erau de ~105px
                   pe un ecran de 390px (măsurat în Chromium), prea puțin și pentru etichete.
                ⛔ Niciuna nu e o regulă CSS: `min-width: 0` există deja în `index.css` pentru
                exact aceste câmpuri și NU a rezolvat nimic (ACHU-415/417, unde s-a și raportat
                greșit ca reparat). */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="f-start">Started</Label>
                <TimeField id="f-start" value={form.startTime}
                  onChange={e => onChange({ ...form, startTime: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="f-finish">Finished</Label>
                <TimeField id="f-finish" value={form.finishTime}
                  onChange={e => onChange({ ...form, finishTime: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="f-break">Unpaid break</Label>
                <Input id="f-break" type="number" min="0" step="5" value={form.breakMinutes}
                  onChange={e => onChange({ ...form, breakMinutes: e.target.value })} />
              </div>
            </div>
            {/*
              🔴 §17 (Sesiunea 151) — **CÂND a fost pauza, nu doar cât a ținut.**
              ⚠️ Minutele de deasupra rămân singura cifră care SCADE din plată; astea două spun în ce
              oră a fost, iar diferența apare exact într-o dispută: „45 de minute" nu răspunde la
              „unde ai fost la 12:30, când a sunat clientul?", iar „12:15–13:00" răspunde.
              ⛔ Amândouă sau niciuna — serverul refuză o jumătate: o pauză cu început și fără sfârșit
              nu e o informație, e o întrebare pusă cititorului de peste șase luni.
            */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="f-pause-start">Break from <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <TimeField id="f-pause-start" value={form.pauseStart}
                  onChange={e => onChange({ ...form, pauseStart: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="f-pause-end">Break to</Label>
                <TimeField id="f-pause-end" value={form.pauseEnd}
                  onChange={e => onChange({ ...form, pauseEnd: e.target.value })} />
              </div>
            </div>
            {/* A finish at or before the start is read as an overnight shift, which
                is real work here — so it is worth saying so rather than letting it
                look like a mistake the form tolerated. */}
            {form.finishTime <= form.startTime && (
              <p className="text-xs text-muted-foreground">
                Finishing at or before the start time is read as working through midnight.
              </p>
            )}
            <div>
              <Label htmlFor="f-kind">What was it</Label>
              <Select value={form.kind} onValueChange={v => onChange({ ...form, kind: v })}>
                <SelectTrigger id="f-kind"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="f-notes">Notes</Label>
              <Textarea id="f-notes" value={form.notes} rows={2}
                onChange={e => onChange({ ...form, notes: e.target.value })} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={onSave} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

