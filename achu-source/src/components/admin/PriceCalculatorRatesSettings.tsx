import { useState, useEffect, useRef } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { getPriceCalculatorRates, savePriceCalculatorRates } from '@/lib/endpoints';
import { ApiError } from '@/lib/apiClient';

// ACHU-401 (felia 20) — era o a doua copie a formei publicate de rută; acum e chiar ea.
// ⚠️ `hourlyRate: 0` înseamnă NETARIFAT, nu gratis: câmpul apare atunci în `unpriced` la calcul.
import type { PriceRateRow as RateRow } from '@/lib/billingEndpoints';

/** Owner decision: every service has its own editable minutes + hourly rate — nothing numeric is fixed in code. */
export default function RatesSettings() {
  const [rates, setRates] = useState<RateRow[] | null>(null);
  const [edits, setEdits] = useState<Record<string, { minutesPerUnit: string; hourlyRate: string }>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * 🔴 **ACHU-717 — versiunea setului de rate, într-un `ref`.** ⛔ Ratele ASTEA sunt prețurile: două
   * persoane cu ecrane vechi își rescriau reciproc minutele și tarifele, iar clientul întreba de ce
   * oferta de ieri și cea de azi diferă cu £40. ⚠️ `ref`, nu `state`: nu se randează.
   */
  const revisionRef = useRef<string>('');

  const load = () => {
    getPriceCalculatorRates().then(d => {
      setRates(d.rates);
      const initial: Record<string, { minutesPerUnit: string; hourlyRate: string }> = {};
      for (const r of d.rates as RateRow[]) initial[r.field] = { minutesPerUnit: String(r.minutesPerUnit), hourlyRate: String(r.hourlyRate) };
      setEdits(initial);
      revisionRef.current = d._revision;
    }).catch(() => setRates([]));
  };
  useEffect(load, []);

  if (rates === null) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const groups = Array.from(new Set(rates.map(r => r.group)));

  const handleSaveAll = async () => {
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const payload = rates.map(r => ({
        field: r.field,
        minutesPerUnit: parseInt(edits[r.field]?.minutesPerUnit ?? '0', 10) || 0,
        hourlyRate: parseFloat(edits[r.field]?.hourlyRate ?? '0') || 0,
      })).filter(r => r.minutesPerUnit > 0 && r.hourlyRate >= 0);
      // 🔴 ACHU-717 — versiunea citită pleacă înapoi cu salvarea.
      const saved = await savePriceCalculatorRates({ rates: payload, _revision: revisionRef.current });
      revisionRef.current = saved._revision;
      setSavedAt(Date.now());
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground">Each service has its own time estimate and hourly rate — price is always calculated as time × rate, per service.</p>
        {groups.map(group => (
          <div key={group} className="space-y-2">
            <p className="text-sm font-semibold">{group}</p>
            <div tabIndex={0} className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/50">
                  <th scope="col" className="text-left p-2 font-medium">Item</th>
                  <th scope="col" className="text-right p-2 font-medium">Minutes</th>
                  <th scope="col" className="text-right p-2 font-medium">Hourly Rate (£)</th>
                </tr></thead>
                <tbody>
                  {rates.filter(r => r.group === group).map(r => (
                    <tr key={r.field} className="border-t">
                      <td className="p-2">{r.label}</td>
                      <td className="p-2 text-right"><Input type="number" min="1" aria-label={`Minutes for ${r.label}`} className="w-24 ml-auto text-right" value={edits[r.field]?.minutesPerUnit ?? ''} onChange={e => setEdits(prev => ({ ...prev, [r.field]: { ...prev[r.field], minutesPerUnit: e.target.value } }))} /></td>
                      <td className="p-2 text-right"><Input type="number" min="0" step="0.5" aria-label={`Hourly rate for ${r.label}`} className="w-24 ml-auto text-right" value={edits[r.field]?.hourlyRate ?? ''} onChange={e => setEdits(prev => ({ ...prev, [r.field]: { ...prev[r.field], hourlyRate: e.target.value } }))} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {savedAt && <p className="text-sm text-green-700">Saved.</p>}

        <div className="flex justify-end">
          <Button onClick={handleSaveAll} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}<Save className="h-4 w-4 mr-1.5" />Save All
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

