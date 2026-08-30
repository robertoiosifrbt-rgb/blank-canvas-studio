/**
 * ACHU-573 (Sesiunea 126, `Backlog_Functionalitati_Viitoare` §5) — LA CARE CASĂ E VIZITA.
 *
 * Felia 2 a proprietăților, cea care plătește fundația din ACHU-570.
 *
 * ─── Golul, în cuvintele problemei ────────────────────────────────────────
 * 🔴 Casele există de ieri, dar **vizitele nu le foloseau**: adresa se retasta la mână în
 * dialogul de programare, la fiecare vizită. Deci aceeași casă scrisă de zece ori putea arăta
 * în zece feluri, iar o adresă greșită nu se corecta nicăieri — nu avea un „nicăieri".
 *
 * ⛔ **Nu blochează câmpul de adresă**, și e o decizie, nu o scăpare (`CURRENT_STATE` §5.0):
 * o vizită la „casa mamei, poarta din spate" trebuie să se poată descrie. Alegerea completează
 * adresa **o dată**; ce scrie omul după aceea rămâne.
 *
 * ⚠️ **Fișier propriu, nu încă 60 de rânduri în `JobDialog.tsx`** — `CLAUDE.md` §2.1a, clichetul
 * de mărime: o capabilitate nouă se scrie în fișierele ei.
 */
import { useEffect, useCallback } from 'react';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Home } from 'lucide-react';
import { getCustomerProperties, type PropertyRecord } from '@/lib/endpoints';

/**
 * Radix nu acceptă `value=""` pe un `SelectItem` — șirul gol e chiar felul lui de a spune
 * „nimic ales". Deci opțiunea „fără casă anume" poartă un santinel, tradus înapoi la `''` la
 * ieșire, ca restul aplicației să nu afle de el.
 */
const NONE = '__none__';

/** Adresa dintr-o casă, într-un singur rând — aceeași compunere ca pe server. */
function addressOf(p: PropertyRecord): string {
  return [p.address?.trim(), p.postcode?.trim()].filter(Boolean).join(', ');
}

export default function JobPropertySelect({
  customerId, value, disabled = false, onPick,
}: {
  customerId: string;
  value: string;
  disabled?: boolean;
  /** `address` e `''` când casa nu are una — atunci ce e deja scris în formular NU se atinge. */
  onPick: (propertyId: string, address: string) => void;
}) {
  const req = useTrackedRequest<{ records: PropertyRecord[] }>({ timeoutMs: 20000 });

  const { fire } = req;
  const load = useCallback(() => {
    if (!customerId) return;
    fire(() => getCustomerProperties({ customerId }));
  }, [fire, customerId]);

  useEffect(() => { load(); }, [load]);

  const all = customerId ? req.data?.records ?? [] : [];

  /**
   * ⚠️ Casele **stinse** nu se oferă, dar cea deja legată de vizită se arată chiar dacă e
   * stinsă. Altfel, deschizând o vizită veche, biroul ar vedea select-ul gol și ar crede că
   * vizita nu are casă — iar prima salvare chiar i-ar rupe legătura.
   */
  const options = all.filter(p => p.isActive || p.id === value);

  // Nimic de ales: un select cu un singur rând gol e zgomot pe un ecran deja plin.
  if (options.length === 0) return null;

  return (
    <div>
      <Label id="jobdlg-property-label" className="flex items-center gap-1">
        <Home className="h-3.5 w-3.5" /> Property
      </Label>
      <Select
        disabled={disabled}
        value={value || NONE}
        onValueChange={v => {
          if (v === NONE) { onPick('', ''); return; }
          const picked = options.find(p => p.id === v);
          onPick(v, picked ? addressOf(picked) : '');
        }}
      >
        <SelectTrigger id="jobdlg-property" aria-labelledby="jobdlg-property-label">
          <SelectValue placeholder="No specific property" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>No specific property</SelectItem>
          {options.map(p => (
            <SelectItem key={p.id} value={p.id}>
              {p.summary}{p.isActive ? '' : ' (switched off)'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground mt-1">
        Picking a property fills the address below. You can still edit it — it is kept as it was on the day.
      </p>
    </div>
  );
}

