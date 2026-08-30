/**
 * ISTORICUL OFERTELOR — tabelul, plus §6 „Multiple quote options" (Sesiunea 160).
 *
 * 🔴 **Ce aduce nou rândul de backlog:** biroul care voia să pună două drumuri în fața clientului
 * („la două săptămâni, £90 de vizită" sau „o curățenie în profunzime, £280, o singură dată")
 * trimitea două oferte fără nicio legătură. ⛔ Clientul le citea ca pe două cereri de bani, nu ca pe
 * o alegere — iar biroul rămânea cu **două oferte acceptate** pentru aceeași casă dacă omul spunea
 * „da" la amândouă.
 *
 * ⛔ **Fiecare variantă rămâne o ofertă întreagă**, cu numărul, liniile și PDF-ul ei. Se leagă doar
 * între ele.
 *
 * ⚠️ **Tabelul a plecat din `PriceCalculatorPage`** fiindcă pagina e sub clichet de mărime: ce se
 * adaugă, se extrage (`AGENT_RULES` §7.4).
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Pencil, Lock, LockOpen, Loader2, Layers, Unlink, Paperclip} from 'lucide-react';
import { toast } from 'sonner';
// §33 (Sesiunea 161) — aceeași secțiune ca pe firmă, vizită și factură.
import DocumentsSection from '@/components/shared/DocumentsSection';
import { fmtDate } from '@/lib/format';
import { errMsg } from '@/lib/errorMessage';
import { groupQuotesAsOptions, ungroupQuoteOptions, type PriceQuoteRecord } from '@/lib/billingEndpoints';
import QuoteRowBadges from './QuoteRowBadges';

/** ⛔ Peste patru nu mai e o alegere, e un catalog. Oglindește `MIN/MAX_OPTIONS` de pe server. */
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;

export default function QuoteHistoryTable({
  quotes, onPreview, onEdit, onToggleStatus, onChanged,
}: {
  quotes: PriceQuoteRecord[];
  onPreview: (q: PriceQuoteRecord) => void;
  onEdit: (q: PriceQuoteRecord) => void;
  onToggleStatus: (q: PriceQuoteRecord) => void;
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  /** §33 — care ofertă își arată hârtiile. Una singură deodată. */
  const [openDocs, setOpenDocs] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const alese = quotes.filter(q => selected.includes(q.id));
  /**
   * ⚠️ Motivul se calculează ÎNAINTE de apăsare, nu după: un refuz care apare abia la click se
   * citește ca o defecțiune. 🔴 Aceleași reguli le impune și serverul — ăsta e doar ecranul lor.
   */
  const motiv =
    alese.length < MIN_OPTIONS ? `Pick at least ${MIN_OPTIONS} quotes to offer as a choice.`
    : alese.length > MAX_OPTIONS ? `A set of more than ${MAX_OPTIONS} is a catalogue, not a choice.`
    : alese.some(q => !q.customerId) ? 'A quote with no customer never reaches the portal.'
    : new Set(alese.map(q => q.customerId)).size > 1 ? 'Those quotes belong to different customers.'
    : alese.find(q => q.customerResponse === 'Accepted' || q.customerResponse === 'Rejected')
      ? 'One of those has already been answered.'
      : null;

  const grupeaza = async () => {
    setBusy(true);
    try {
      await groupQuotesAsOptions(alese.map(q => q.id));
      setSelected([]);
      onChanged();
      toast.success('They now show in the portal as one choice.');
    } catch (e) {
      toast.error(errMsg(e));
    } finally { setBusy(false); }
  };

  const desface = async (optionGroupId: string) => {
    setBusy(true);
    try {
      await ungroupQuoteOptions(optionGroupId);
      onChanged();
      toast.success('Broken up. They are separate quotes again.');
    } catch (e) {
      toast.error(errMsg(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2">
          <span className="text-sm">{selected.length} selected</span>
          <Button size="sm" disabled={!!motiv || busy} onClick={grupeaza}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Layers className="h-3.5 w-3.5 mr-1" />}
            Offer as a choice
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected([])}>Clear</Button>
          {/* ⚠️ Motivul stă lângă buton, nu într-un toast de după: altfel omul apasă și nu află de ce nu merge. */}
          {motiv && <span className="text-xs text-muted-foreground">{motiv}</span>}
        </div>
      )}

      <div tabIndex={0} className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/50">
            <th scope="col" className="p-2"><span className="sr-only">Select</span></th>
            <th scope="col" className="text-left p-2 font-medium">Quote #</th>
            <th scope="col" className="text-left p-2 font-medium">Date</th>
            <th scope="col" className="text-left p-2 font-medium">Customer</th>
            <th scope="col" className="text-left p-2 font-medium">Job</th>
            <th scope="col" className="text-left p-2 font-medium">Status</th>
            <th scope="col" className="text-right p-2 font-medium">Total</th>
            <th scope="col" className="p-2"></th>
          </tr></thead>
          <tbody>
            {quotes.map(q => (
              <tr key={q.id} className="border-t">
                <td className="p-2">
                  <Checkbox
                    aria-label={`Select quote ${q.quoteNumber}`}
                    checked={selected.includes(q.id)}
                    onCheckedChange={v => setSelected(prev => (v === true ? [...prev, q.id] : prev.filter(id => id !== q.id)))}
                  />
                </td>
                <td className="p-2 font-mono text-xs">{q.quoteNumber}</td>
                <td className="p-2">{fmtDate(q.createdAt)}</td>
                <td className="p-2">{q.customerName ?? '—'}</td>
                <td className="p-2">{q.jobDisplayId ? `#${q.jobDisplayId}` : '—'}</td>
                <td className="p-2">
                  <QuoteRowBadges quote={q} />
                  {/*
                    🔴 Insigna spune că oferta e o VARIANTĂ, nu o cerere de bani de sine stătătoare.
                    ⛔ Fără ea, biroul ar fi văzut trei oferte pe același client și ar fi crezut că
                    a trimis din greșeală de trei ori.
                  */}
                  {q.optionGroupId && (
                    <Badge variant="outline" className="ml-1 border-violet-500 text-violet-700 dark:text-violet-400" title="One of a set the customer chooses from">
                      {q.optionLabel || 'One of a choice'}
                    </Badge>
                  )}
                </td>
                <td className="p-2 text-right">£{Number(q.grandTotal).toFixed(2)}</td>
                <td className="p-2 text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" aria-label={`Preview quote ${q.quoteNumber} as PDF`} title={`Preview quote ${q.quoteNumber} as PDF`} onClick={() => onPreview(q)}><FileText className="h-3.5 w-3.5" /></Button>
                  {q.status === 'Draft' && (
                    <Button variant="ghost" size="sm" aria-label={`Edit quote ${q.quoteNumber}`} title={`Edit quote ${q.quoteNumber}`} onClick={() => onEdit(q)}><Pencil className="h-3.5 w-3.5" /></Button>
                  )}
                  {q.optionGroupId && (
                    <Button variant="ghost" size="sm" disabled={busy} aria-label={`Break up the choice ${q.quoteNumber} belongs to`} title={`Break up the choice ${q.quoteNumber} belongs to`} onClick={() => desface(q.optionGroupId!)}><Unlink className="h-3.5 w-3.5" /></Button>
                  )}
                  <Button variant="ghost" size="sm" aria-label={q.status === 'Draft' ? `Mark quote ${q.quoteNumber} as final` : `Reopen quote ${q.quoteNumber} as draft`} onClick={() => onToggleStatus(q)} title={q.status === 'Draft' ? `Mark quote ${q.quoteNumber} as final` : `Reopen quote ${q.quoteNumber} as draft`}>
                    {q.status === 'Draft' ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                  </Button>
                  {/*
                    §33 (Sesiunea 161) — hârtiile ofertei: specificația trimisă, planul locului,
                    corespondența pe care s-a construit prețul. ⛔ Se desface pe loc, ca la facturi.
                  */}
                  <Button
                    variant="ghost" size="sm"
                    aria-expanded={openDocs === q.id}
                    aria-label={`Documents for quote ${q.quoteNumber}`}
                    title={`Documents for quote ${q.quoteNumber}`}
                    onClick={() => setOpenDocs(openDocs === q.id ? null : q.id)}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            {/*
              ⚠️ **Rândul de hârtii e un `<tr>` propriu, sub cel al ofertei** — nu îmbrăcat în celula
              de acțiuni: un tabel cu o secțiune întreagă într-o celulă îngustă ar fi ilizibil, iar
              `colSpan` păstrează coloanele aliniate pentru restul rândurilor.
            */}
            {openDocs && quotes.some(q => q.id === openDocs) && (
              <tr className="border-t bg-muted/30">
                <td colSpan={8} className="p-3">
                  <DocumentsSection
                    scope="Quote"
                    ownerId={openDocs}
                    title={`Documents for ${quotes.find(q => q.id === openDocs)?.quoteNumber ?? 'quote'}`}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

