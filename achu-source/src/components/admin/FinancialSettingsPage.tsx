import { useEffect, useState, useCallback, useRef } from 'react';
import { getFinancialSettings, saveFinancialSettings } from '@/lib/endpoints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import DateField from '@/components/shared/DateField';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { LIMITS } from '@/lib/validation';
import { computeRevision, REVISION_FIELDS } from '@/lib/concurrency';
import RefreshButton from '../shared/RefreshButton';
import PageHeader from '../shared/PageHeader';
import { errMsg } from '@/lib/errorMessage';

type TaxYearMode = 'Automatic' | 'Manual';

export default function FinancialSettingsPage() {
  const [settingsId, setSettingsId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [taxYearMode, setTaxYearMode] = useState<TaxYearMode>('Manual');
  const [resolvedTaxYear, setResolvedTaxYear] = useState<{ start: string; end: string } | undefined>();
  const [form, setForm] = useState({
    taxReserve: 0, nationalInsuranceReserve: 0, emergencyReserve: 0,
    taxYearStart: '', taxYearEnd: '', notes: '', active: true,
  });
  const revisionRef = useRef<string | undefined>(undefined);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getFinancialSettings({}).then(data => {
      setResolvedTaxYear(data.resolvedTaxYear);
      if (data.settings) {
        setSettingsId(data.settings.id);
        revisionRef.current = computeRevision(data.settings, REVISION_FIELDS.financialSettings);
        const mode: TaxYearMode = data.settings.taxYearMode === 'Automatic' ? 'Automatic' : 'Manual';
        setTaxYearMode(mode);
        setForm({
          taxReserve: (data.settings.taxReserve ?? 0) * 100,
          nationalInsuranceReserve: (data.settings.nationalInsuranceReserve ?? 0) * 100,
          emergencyReserve: (data.settings.emergencyReserve ?? 0) * 100,
          taxYearStart: data.settings.taxYearStart ?? '',
          taxYearEnd: data.settings.taxYearEnd ?? '',
          notes: data.settings.notes ?? '',
          active: data.settings.active ?? true,
        });
      }
      setLoading(false);
    }).catch(e => {
      console.warn('[FinancialSettings] Load error:', e?.message);
      setLoadError(e?.message || 'Failed to load financial settings.');
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalPercent = form.taxReserve + form.nationalInsuranceReserve + form.emergencyReserve;
  // ACHU-125: Exact 100% limit using basis points (precision-safe, matches backend)
  const totalBasisPoints = Math.round(form.taxReserve * 100) + Math.round(form.nationalInsuranceReserve * 100) + Math.round(form.emergencyReserve * 100);
  const totalExceeds = totalBasisPoints > 10000;

  const dateErrors: string[] = [];
  if (taxYearMode === 'Manual') {
    if (!form.taxYearStart) dateErrors.push('Tax year start is required.');
    if (!form.taxYearEnd) dateErrors.push('Tax year end is required.');
    if (form.taxYearStart && !/^\d{4}-\d{2}-\d{2}$/.test(form.taxYearStart)) dateErrors.push('Start date format invalid.');
    if (form.taxYearEnd && !/^\d{4}-\d{2}-\d{2}$/.test(form.taxYearEnd)) dateErrors.push('End date format invalid.');
    if (form.taxYearStart && form.taxYearEnd && form.taxYearStart >= form.taxYearEnd) dateErrors.push('Start date must be before end date.');
  }

  const canSave = !totalExceeds && !saving && dateErrors.length === 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const result = await saveFinancialSettings({
        id: settingsId,
        _revision: revisionRef.current,
        taxReserve: form.taxReserve / 100,
        nationalInsuranceReserve: form.nationalInsuranceReserve / 100,
        emergencyReserve: form.emergencyReserve / 100,
        taxYearMode,
        taxYearStart: taxYearMode === 'Manual' ? form.taxYearStart : undefined,
        taxYearEnd: taxYearMode === 'Manual' ? form.taxYearEnd : undefined,
        notes: form.notes || undefined,
        active: form.active,
      });
      setSettingsId(result.id);
      if (result.auditWarning) {
        toast.warning(result.auditWarning);
      } else {
        toast.success('Financial settings saved');
      }
      load();
    } catch (e) {
      toast.error(errMsg(e) || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-60" /><Skeleton className="h-64 rounded-lg" /></div>;

  if (loadError && !settingsId) {
    return (
      <div className="space-y-4 max-w-2xl">
        <PageHeader
          as="h2"
          titleClassName="text-2xl font-bold"
          title="Financial Settings"
          actions={<RefreshButton onRefresh={load} />}
        />
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <AlertCircle className="h-10 w-10 mx-auto text-destructive/60" />
            <p className="text-muted-foreground">{loadError}</p>
            <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-2xl font-bold">Financial Settings</h2>

      {loadError && settingsId && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive flex-1">{loadError}</p>
          <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5 mr-1" />Retry</Button>
        </div>
      )}

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p>Tax and National Insurance reserve values are budgeting estimates only and are not an official tax calculation. Consult an accountant for your actual tax liability.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Reserve Percentages</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label htmlFor="financials-tax-reserve">Tax Reserve %</Label><Input id="financials-tax-reserve" type="number" step="0.1" min="0" max="100" value={form.taxReserve !== 0 ? form.taxReserve : ''} onFocus={e => e.target.select()} onChange={e => setForm(f => ({ ...f, taxReserve: parseFloat(e.target.value) || 0 }))} /></div>
            <div><Label htmlFor="financials-ni-reserve">NI Reserve %</Label><Input id="financials-ni-reserve" type="number" step="0.1" min="0" max="100" value={form.nationalInsuranceReserve !== 0 ? form.nationalInsuranceReserve : ''} onFocus={e => e.target.select()} onChange={e => setForm(f => ({ ...f, nationalInsuranceReserve: parseFloat(e.target.value) || 0 }))} /></div>
            <div><Label htmlFor="financials-emergency-reserve">Emergency Reserve %</Label><Input id="financials-emergency-reserve" type="number" step="0.1" min="0" max="100" value={form.emergencyReserve !== 0 ? form.emergencyReserve : ''} onFocus={e => e.target.select()} onChange={e => setForm(f => ({ ...f, emergencyReserve: parseFloat(e.target.value) || 0 }))} /></div>
          </div>
          <p className={`text-sm font-medium ${totalExceeds ? 'text-destructive' : 'text-muted-foreground'}`}>
            Total: {totalPercent.toFixed(1)}%{totalExceeds && ' — exceeds 100%'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Tax Year</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="financials-tax-year-mode">Tax Year Mode</Label>
            <Select value={taxYearMode} onValueChange={(v) => setTaxYearMode(v as TaxYearMode)}>
              <SelectTrigger id="financials-tax-year-mode" className="w-[260px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Automatic">Automatic (UK: 6 April – 5 April)</SelectItem>
                <SelectItem value="Manual">Manual Date Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {taxYearMode === 'Automatic' && (
            <p className="text-sm text-muted-foreground">
              The system dynamically calculates the current UK tax year (6 April to 5 April). Rollover is automatic — no resave required.
              {resolvedTaxYear && (
                <span className="block mt-1 font-medium text-foreground">
                  Current period: {resolvedTaxYear.start} to {resolvedTaxYear.end}
                </span>
              )}
            </p>
          )}

          {taxYearMode === 'Manual' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="financials-tax-year-start">Tax Year Start</Label>
                  <DateField id="financials-tax-year-start" value={form.taxYearStart} onChange={e => setForm(f => ({ ...f, taxYearStart: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="financials-tax-year-end">Tax Year End</Label>
                  <DateField id="financials-tax-year-end" value={form.taxYearEnd} onChange={e => setForm(f => ({ ...f, taxYearEnd: e.target.value }))} />
                </div>
              </div>
              {dateErrors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  {dateErrors.map((err, i) => (
                    <p key={i} className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />{err}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div><Label htmlFor="financials-notes">Notes</Label><Textarea id="financials-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} maxLength={LIMITS.notes} /></div>
          <div className="flex items-center gap-2"><Checkbox id="financials-active" checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: !!v }))} /><Label htmlFor="financials-active">Active</Label></div>
          <Button onClick={handleSave} disabled={!canSave}>{saving ? 'Saving...' : 'Save Settings'}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

