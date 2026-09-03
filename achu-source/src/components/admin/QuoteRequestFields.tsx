/**
 * 🔴 §6 (Sesiunea 158) — CĂRĂMIZILE DE AFIȘARE ale unei cereri de ofertă, extrase.
 *
 * ─── ⛔ DE CE AU IEȘIT DIN PAGINĂ ──────────────────────────────────────────
 * `QuoteRequestPage` e sub clichetul lui de mărime (`AGENT_RULES` §7): felia care adaugă evaluarea
 * biroului l-ar fi împins peste, iar regula spune **extrage, nu ridica cifra**. ⚠️ Bucățile de aici
 * sunt curat de afișare — nu știu nimic despre cerere, despre server sau despre salvare — deci sunt
 * exact ce se scoate primul dintr-un ecran prea mare.
 *
 * 🔴 **Nimic nu s-a schimbat la comportament**, dinadins: aceleași funcții, aceleași comentarii, cu
 * capcanele lor cu tot (vezi `when` mai jos, ACHU-365). O extragere care repară ceva pe drum face
 * imposibil de spus, mai târziu, dacă mutarea a stricat ceva.
 */
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { LucideIcon } from 'lucide-react';
import { hasVal } from '@/lib/hasValue';

/**
 * ACHU-500 (Sesiunea 108) — see the note on the same component in
 * `QuoteRequestSection.tsx`. Fixed here as well, and NOT because the two look
 * alike: the field that overflows is the email address, and this page shows the
 * same one. A fix applied only to the panel would leave the photographed defect
 * behind the "Open Full Quote Request" button.
 *
 * ⚠️ `mono` makes it worse rather than better — a monospace submission ID has no
 * spaces at all — so `break-words` matters most on exactly the values that look
 * least like prose.
 */
export function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!hasVal(value)) return null;
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`text-sm mt-0.5 whitespace-pre-wrap break-words ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}

export function NumField({ label, value }: { label: string; value?: number | null }) {
  if (!hasVal(value)) return null;
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

/** A service sub-section that only renders if at least one row has a value */
export function ServiceSection({ title, rows }: { title: string; rows: { label: string; value?: number | null }[] }) {
  const populated = rows.filter(r => hasVal(r.value));
  if (populated.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{title}</p>
      <div className="bg-muted/40 rounded-lg px-3 py-1 divide-y divide-border/50">
        {populated.map((r, i) => <NumField key={i} label={r.label} value={r.value} />)}
      </div>
    </div>
  );
}

/**
 * ⚠️ ACHU-365 (Sesiunea 85). `when` is not decoration — it is the whole guard.
 *
 * This used to be `children.filter(Boolean)`, which looks like it drops the empty
 * fields and does not: `<Field value={null}/>` is a React ELEMENT, and an element
 * is truthy even though it renders `null`. So `filtered.length` was never 0 and
 * every row survived, heading and all. Found by the first test written against
 * this screen; a quote request with nothing in it rendered all five section cards
 * empty. The two rows at "Total Bedrooms" already passed an explicit `null` for
 * exactly this reason, which is what makes the mistake easy to make: the pattern
 * worked wherever somebody had happened to guard the call site.
 *
 * ⚠️ `ServiceSection` and `ServiceDetailsCard` never had the bug, because they
 * filter on **values** (`rows.filter(r => hasVal(r.value))`). Value-based is the
 * pattern that works; element-based is the one that silently does not.
 */
export function FieldRow({ when, children }: { when?: boolean; children: React.ReactNode[] }) {
  const filtered = children.filter(Boolean);
  if (filtered.length === 0 || when === false) return null;
  return <div className="grid grid-cols-2 gap-4">{filtered}</div>;
}

export function SectionHeading({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
    </div>
  );
}

/** `when` for the same reason as `FieldRow` — see the note there (ACHU-365). */
export function SectionCard({ icon, title, when, children }: { icon: LucideIcon; title: string; when?: boolean; children: React.ReactNode[] }) {
  const filtered = children.filter(Boolean);
  if (filtered.length === 0 || when === false) return null;
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <SectionHeading icon={icon} title={title} />
        <Separator />
        {filtered}
      </CardContent>
    </Card>
  );
}

