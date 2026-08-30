/**
 * §15 „Report incident" (Sesiunea 160) — OMUL DE LA UȘĂ SCRIE CE A GĂSIT.
 *
 * 🔴 **Hotărârea lui Roberto, 29/08/2026.** Până azi, o pagubă sau un pericol se scriau în Chat sau
 * ca notă pe vizită. ⛔ Nimic nu le **numea**, deci nu se putea căuta nimic și nu se deschidea
 * niciun dosar.
 *
 * ⚠️ **Ecranul spune ce se întâmplă mai departe.** Fără propoziția aia, omul ar apăsa „Send" și
 * n-ar ști dacă a anunțat pe cineva sau a scris într-un sertar.
 *
 * ⛔ **Nu poate închide nimic.** Deschide, atât — restul e al biroului, iar ecranul nu sugerează
 * altceva.
 */
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { reportIncident, addIncidentPhoto } from '@/lib/cleanerIncidentEndpoints';
import { prepareImageForUpload } from '@/lib/imageCompression';
import { errMsg } from '@/lib/errorMessage';

/**
 * ⚠️ Etichetele sunt scrise pentru cineva care stă în ușă cu telefonul în mână, nu pentru registru.
 * ⛔ Cele două feluri care rămân ale biroului (`theft-allegation`, `cleaner-conduct`) **nu apar** —
 * serverul le refuză oricum, dar o listă care le-ar arăta ar fi o promisiune retrasă la apăsare.
 */
const KINDS: { value: string; label: string }[] = [
  { value: 'damage', label: 'Something got damaged' },
  { value: 'hazard', label: 'Something here is dangerous' },
  { value: 'injury', label: 'Somebody was hurt' },
  { value: 'access', label: 'I could not get in' },
  { value: 'alarm', label: 'Trouble with the alarm' },
  { value: 'lost-key', label: 'A key or code is lost' },
  { value: 'chemical-spill', label: 'A spill' },
  { value: 'equipment', label: 'Our equipment broke' },
  { value: 'vehicle', label: 'Something with the vehicle' },
  { value: 'customer-conduct', label: 'How the customer behaved towards me' },
  { value: 'safeguarding', label: 'I am worried about somebody here' },
  { value: 'other', label: 'Something else' },
];

const SEVERITIES = [
  { value: 'low', label: 'Can wait' },
  { value: 'medium', label: 'They should know today' },
  { value: 'high', label: 'Somebody needs to ring me now' },
];

export default function ReportProblemDialog({
  open, onOpenChange, jobs, today, onReported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /**
   * Vizitele lui de azi, ca să poată lega problema de una. ⚠️ Serverul verifică oricum că e a lui.
   * ⛔ **Legarea e opțională**, deliberat: un pericol găsit între două vizite e tot un incident, iar
   * un câmp obligatoriu l-ar fi împins să aleagă o vizită care n-are treabă.
   */
  jobs?: { id: string; label: string }[];
  today: string;
  onReported?: () => void;
}) {
  const [kind, setKind] = useState('damage');
  const [severity, setSeverity] = useState('medium');
  const [occurredOn, setOccurredOn] = useState(today);
  const [description, setDescription] = useState('');
  const [immediateAction, setImmediateAction] = useState('');
  const [jobId, setJobId] = useState('');
  const [sending, setSending] = useState(false);
  /**
   * 🔴 §15 „Upload damage photos" — pozele vin DUPĂ trimitere, și n-are cum altfel: dovada se pune
   * pe un dosar care există. ⛔ Iar asta e și ordinea potrivită pentru om — întâi anunță, apoi
   * fotografiază; dacă îi sună telefonul între timp, anunțul a plecat deja.
   */
  const [reportedId, setReportedId] = useState<string | null>(null);
  const [photos, setPhotos] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const send = async () => {
    setSending(true);
    try {
      const res = await reportIncident({
        kind, severity, occurredOn,
        description: description.trim(),
        immediateAction: immediateAction.trim() || null,
        jobId: jobId || null,
      });
      toast.success('Sent. The office has been told.');
      setReportedId(res.id);
      onReported?.();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not send that. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const addPhoto = async (file: File) => {
    if (!reportedId) return;
    setUploading(true);
    try {
      // ⚠️ Micșorată întâi, ca la punctele de checklist: altfel poza pleacă întreagă pe date mobile
      // și e refuzată abia pe server, după ce omul a așteptat în casa clientului.
      const { dataUrl } = await prepareImageForUpload(file);
      await addIncidentPhoto(reportedId, dataUrl);
      setPhotos(n => n + 1);
    } catch (e) {
      toast.error(errMsg(e) || 'Could not send that photo. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const inchide = () => {
    setReportedId(null); setPhotos(0); setDescription(''); setImmediateAction('');
    onOpenChange(false);
  };

  /**
   * 🔴 **Pasul al doilea: pozele.** ⛔ Ecranul spune că raportul a plecat DEJA — altfel omul ar
   * crede că trebuie să pună o poză ca să conteze, iar unul care n-are ce fotografia ar rămâne
   * blocat cu degetul pe buton.
   */
  if (reportedId) {
    return (
      <Dialog open={open} onOpenChange={v => { if (!v) inchide(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Sent to the office</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              They have it. {photos > 0 && <strong>{photos} photo{photos === 1 ? '' : 's'} attached. </strong>}
              Add a photo if there is something to show — or just close this.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              aria-label="Take a photo of the problem"
              onChange={e => { const f = e.target.files?.[0]; if (f) void addPhoto(f); }}
            />
            <Button variant="outline" className="w-full min-h-[44px]" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
              {photos > 0 ? 'Add another photo' : 'Add a photo'}
            </Button>
            <Button className="w-full min-h-[44px]" onClick={inchide}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Report a problem</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="report-kind">What happened</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger id="report-kind"><SelectValue /></SelectTrigger>
              <SelectContent>
                {KINDS.map(k => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="report-description">Tell them what you saw</Label>
            <Textarea
              id="report-description"
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. The hoover caught the skirting board in the hallway and took a chip out of the paint."
            />
          </div>

          <div>
            <Label htmlFor="report-action">What you did about it <span className="text-muted-foreground font-normal">(if anything)</span></Label>
            <Input
              id="report-action"
              value={immediateAction}
              onChange={e => setImmediateAction(e.target.value)}
              placeholder="e.g. Took a photo and told the customer"
            />
          </div>

          {jobs && jobs.length > 0 && (
            <div>
              <Label htmlFor="report-job">Which job <span className="text-muted-foreground font-normal">(if it was on one)</span></Label>
              <Select value={jobId} onValueChange={v => setJobId(v === 'none' ? '' : v)}>
                <SelectTrigger id="report-job"><SelectValue placeholder="Not about a job" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not about a job</SelectItem>
                  {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="report-when">When</Label>
              <Input id="report-when" type="date" value={occurredOn} onChange={e => setOccurredOn(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="report-severity">How urgent</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger id="report-severity"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/*
            🔴 Propoziția care spune unde ajunge. ⛔ Fără ea, omul apasă „Send" și nu știe dacă a
            anunțat pe cineva sau a scris într-un sertar. ⚠️ Și spune limpede că **nu se închide** de
            către el: ce urmează e al biroului.
          */}
          <p className="text-xs text-muted-foreground">
            This goes straight to the office and stays open until somebody there closes it. You are
            not expected to sort it out — writing it down <em>is</em> the job here.
          </p>

          <Button className="w-full" disabled={sending || !description.trim()} onClick={send}>
            {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

