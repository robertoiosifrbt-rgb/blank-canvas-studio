/**
 * §8, felia a doua (Sesiunea 146) — SUBSERVICIILE unui serviciu, în dialogul lui.
 *
 * 🔴 **Asta e bucata pe care a cerut-o owner-ul:** *„vreau sa pot sa adaug servicii si
 * subservicii… si la pret calculator si in forma"*. O poziție adăugată aici apare pe loc în
 * formularele de ofertă **și** în Price Calculator.
 *
 * ⛔ **Fișier propriu, nu încă 80 de rânduri în `ServicesPage.tsx`** (`AGENT_RULES` §9): o
 * capabilitate nouă intră în fișierul ei, iar ecranul doar o cheamă.
 *
 * ⚠️ **Cheia internă nu apare pe ecran deloc.** O derivă serverul din etichetă; motivul e în
 * `backend/src/lib/servicePolicy.ts` — o cheie tastată de un om ajunge la „bedroom", „Bedrooms" și
 * „bedRooms" pentru același lucru, iar cheia e puntea către tarif.
 */
import { useState } from 'react';
import { addServiceItem, updateServiceItem, type ServiceRecord } from '@/lib/serviceEndpoints';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { errMsg } from '@/lib/errorMessage';

export default function ServiceItemsSection({ service, onChanged }: {
  service: ServiceRecord;
  onChanged: () => void;
}) {
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!label.trim()) { toast.error('Give the position a label'); return; }
    setBusy(true);
    try {
      const result = await addServiceItem(service.id, { label: label.trim() });
      /**
       * 🔴 Avertismentul vine de la SERVER (`needsRate`), nu e scris aici: o poziție fără tarif nu
       * se cotează la £0, se raportează ca necotată — iar omul trebuie să afle asta în clipa în
       * care a adăugat-o, nu când se plânge un client de o ofertă.
       */
      toast.warning(result.needsRate, { duration: 10000 });
      setLabel('');
      onChanged();
    } catch (e) {
      toast.error(errMsg(e) || 'Failed to add the position');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (id: string, active: boolean) => {
    setBusy(true);
    try {
      await updateServiceItem(id, { active });
      onChanged();
    } catch (e) {
      toast.error(errMsg(e) || 'Failed to update the position');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-border pt-3 space-y-2">
      <p className="text-sm font-medium">Priced positions</p>
      <p className="text-xs text-muted-foreground">
        What gets counted on a quote for this service — “Bedroom”, “2 Seat Sofa”. Each one carries its
        own minutes and hourly rate in Price Calculator.
      </p>

      {service.items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Nothing to count yet — a quote for this service will come out empty until you add a position.
        </p>
      ) : (
        <ul className="space-y-1">
          {service.items.map(item => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                id={`item-${item.id}`}
                checked={item.active}
                disabled={busy}
                onCheckedChange={v => toggle(item.id, !!v)}
              />
              <Label htmlFor={`item-${item.id}`} className={item.active ? '' : 'text-muted-foreground line-through'}>
                {item.label}
              </Label>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2 pt-1">
        <div className="flex-1">
          <Label htmlFor="new-item-label" className="text-xs">Add a position</Label>
          <Input
            id="new-item-label"
            value={label}
            placeholder="Bedroom"
            onChange={e => setLabel(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={add} disabled={busy}>
          <Plus className="h-4 w-4 mr-1" />Add
        </Button>
      </div>
    </div>
  );
}

