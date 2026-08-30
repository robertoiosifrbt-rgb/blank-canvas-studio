/**
 * §31 (Sesiunea 145) — TRAGEREA LA SORȚI, pe ecran.
 *
 * 🔴 **Jumătatea care schimbă ce ȘTIE firma despre ea însăși.** Cine se uită azi la o vizită se uită
 * fiindcă a sunat clientul — deci calitatea e cunoscută exact atât cât au reclamat clienții. ⚠️ Un
 * eșantion tras la sorți e singurul fel de a răspunde la *„câte le prindem noi înainte să sune"*.
 *
 * ⛔ **Nu se programează singur, și nu are o rată scrisă nicăieri:** un om apasă și spune câte, de
 * fiecare dată (`AGENT_RULES` §8 — uneltele conțin mecanisme, nu decizii de azi).
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shuffle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { sampleQualityChecks } from '@/lib/qualityCheckEndpoints';
import { errMsg } from '@/lib/errorMessage';

export default function QualityCheckSample({ onPicked }: { onPicked: () => void }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState('5');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [saving, setSaving] = useState(false);

  const ready = Number(count) > 0 && !!from && !!to;

  const draw = async () => {
    if (!ready || saving) return;
    setSaving(true);
    try {
      const res = await sampleQualityChecks({ count: Number(count), from, to });
      /**
       * ⚠️ **Se spune din CÂTE s-a ales.** „Am cerut 5 și am primit 2" fără a doua cifră arată ca un
       * defect, când de fapt atâtea vizite neverificate existau în interval.
       */
      toast.success(
        res.picked === 0
          ? 'Nothing to pick — every finished job in those dates has already been looked at.'
          : `${res.picked} job(s) added to the list, picked at random out of ${res.availableToPickFrom}.`,
      );
      setOpen(false);
      onPicked();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not pick a sample.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Shuffle className="h-4 w-4 mr-1" aria-hidden="true" />Pick a random sample
      </Button>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-md border p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <Label htmlFor="qs-count" className="text-xs">How many jobs?</Label>
          <Input id="qs-count" type="number" min={1} max={20} value={count} onChange={e => setCount(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="qs-from" className="text-xs">From</Label>
          <Input id="qs-from" type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="qs-to" className="text-xs">To</Label>
          <Input id="qs-to" type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      {/* 🔴 Ce NU face, spus pe ecran: nu ocolește vizitele reclamate. ⚠️ Un eșantion din care scoți
          cazurile nefericite nu mai e aleatoriu, iar „94% trec" scos din el ar fi liniștitor și
          fals. Și nu judecă nimic — doar pune pe listă. */}
      <p className="text-[11px] text-muted-foreground">
        Picks finished jobs nobody has looked at yet — including ones the customer was happy with,
        which is the point. It does not skip jobs that were complained about, and it does not score
        anything: somebody still has to look.
      </p>

      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={draw} disabled={!ready || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Pick them'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
      </div>
    </div>
  );
}

