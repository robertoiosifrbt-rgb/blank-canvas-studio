import { useCallback, useEffect, useState } from 'react';
import { FileLock2, ChevronDown, ChevronUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getPrivacyNotice } from '@/lib/endpoints';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import type { PortalPrivacyNotice } from './portalTypes';

/**
 * ACHU-545 (Sesiunea 120) — „Nota de confidențialitate + scopul procesării datelor",
 * Nivel 2 din `docs/Backlog_Client_Prioritar.md`.
 *
 * ─── Golul, exact ────────────────────────────────────────────────────────
 * Clientul putea deja să-și **descarce** datele (ACHU-528) și să ceară **ștergerea**
 * contului (ACHU-529). Ce nu putea era să afle **ce facem cu ele și de ce** — singurul
 * loc unde scria era PDF-ul „Privacy Notice", pe alt tab, pe care îl deschide cine îl
 * caută. Art. 13 nu cere un fișier descărcabil, cere ca informația să fie **accesibilă**.
 *
 * ─── De ce ecranul nu conține niciun text ────────────────────────────────
 * 🔴 **Tot ce citește clientul vine de la server**, inclusiv titlurile secțiunilor, iar
 * partea de retenție e **derivată din politica de ștergere care rulează**
 * (`backend/src/lib/gdprAnonymisePolicy.ts`). Scrisă aici, ar fi fost a doua afirmație
 * despre același fapt — iar cea din interfață e mereu cea care rămâne în urmă, fiindcă
 * nimeni nu recitește o pagină ca s-o compare cu un fișier de politică.
 *
 * ⚠️ Concret: o categorie nouă de date adăugată în politică apare aici **fără** ca cineva
 * să atingă componenta, și nu poate apărea pe jumătate descrisă — testul de acoperire
 * (`backend/src/lib/privacyNoticeContent.test.ts`) pică întâi.
 *
 * ─── Plasarea ────────────────────────────────────────────────────────────
 * Sub „My account", adică **imediat sub cele două butoane pe care le descrie**
 * („Download my data" și „Request account closure"). Explicația a ce se întâmplă când
 * apeși un buton stă lângă buton, nu pe alt tab.
 *
 * ⚠️ **Lista de retenție e închisă la deschidere.** Nu e o ascundere: sunt cincisprezece
 * rânduri de detaliu sub un rezumat de trei propoziții care spune deja răspunsul
 * („nimic nu se șterge după un calendar; tu decizi când"). Deschisă din start, ar împinge
 * restul contului sub trei ecrane de derulare pentru fiecare client care nu o caută.
 */
export default function PrivacyNotice() {
  const req = useTrackedRequest<PortalPrivacyNotice>({ timeoutMs: 20000 });
  const [detailOpen, setDetailOpen] = useState(false);

  const { fire } = req;
  const load = useCallback(() => { fire(() => getPrivacyNotice()); }, [fire]);
  useEffect(() => { load(); }, [load]);

  const data = req.data;

  /**
   * ⚠️ O eroare aici nu e o eroare tăcută. Un ecran gol pe locul notei de
   * confidențialitate arată ca „firma nu are una" — deci spune ce s-a întâmplat și lasă
   * o cale mai departe.
   */
  if (!data) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileLock2 className="h-4 w-4 shrink-0" />
          <h2 className="font-semibold">How we use your data</h2>
        </div>
        {req.error ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">Could not load this right now.</p>
            <Button variant="outline" size="sm" onClick={load}>Try again</Button>
          </div>
        ) : (
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        )}
      </div>
    );
  }

  const { controller, sections, retention } = data;

  /**
   * ⛔ Un câmp necompletat se SARE. Nu se afișează `[Legal Business Name — set this in
   * Invoice Settings]`, care e un memento adresat biroului: un client care l-ar citi ar
   * afla doar că firma nu-și poate spune numele. Cât timp Invoice Settings e gol
   * (`docs/CURRENT_STATE.md` §5.1), rămâne rândul de contact, care nu vine din setări.
   */
  const identityRows: { label: string; value: string }[] = [
    ...(controller.legalName ? [{ label: 'Who is responsible', value: controller.legalName }] : []),
    ...(controller.address ? [{ label: 'Registered address', value: controller.address }] : []),
    ...(controller.companyRegistrationNumber ? [{ label: 'Company number', value: controller.companyRegistrationNumber }] : []),
    {
      label: 'How to contact us',
      value: controller.phone ? `${controller.email} · ${controller.phone}` : controller.email,
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <FileLock2 className="h-4 w-4 shrink-0" />
        <h2 className="font-semibold">How we use your data</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        This is the short version of our privacy notice, in your account so you do not have to go
        looking for it. You can also download the full document under Documents.
      </p>

      <dl className="space-y-1.5">
        {identityRows.map(row => (
          <div key={row.label} className="flex justify-between items-start gap-3">
            <dt className="text-sm text-muted-foreground shrink-0">{row.label}</dt>
            <dd className="text-sm font-medium text-right break-words">{row.value}</dd>
          </div>
        ))}
      </dl>

      {sections.map(section => (
        <section key={section.key} className="space-y-1.5 border-t border-border pt-3">
          <h3 className="text-sm font-semibold">{section.heading}</h3>
          {section.paragraphs.map((p, i) => (
            <p key={i} className="text-sm text-muted-foreground">{p}</p>
          ))}
          {section.bullets && section.bullets.length > 0 && (
            <ul className="list-disc pl-5 space-y-1">
              {section.bullets.map((b, i) => (
                <li key={i} className="text-sm text-muted-foreground">{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="space-y-1.5 border-t border-border pt-3">
        <h3 className="text-sm font-semibold">{retention.heading}</h3>
        {retention.summary.map((p, i) => (
          <p key={i} className="text-sm text-muted-foreground">{p}</p>
        ))}

        <Button
          variant="outline"
          size="sm"
          className="text-xs mt-1"
          aria-expanded={detailOpen}
          onClick={() => setDetailOpen(o => !o)}
        >
          {detailOpen
            ? <><ChevronUp className="h-3.5 w-3.5 mr-1" />Hide the detail</>
            : <><ChevronDown className="h-3.5 w-3.5 mr-1" />What happens to each part</>}
        </Button>

        {detailOpen && (
          <div className="space-y-3 pt-2">
            {retention.groups.map(group => (
              <div key={group.outcome} className="rounded-md border border-border p-3 space-y-1.5">
                <p className="text-sm font-medium">{group.heading}</p>
                <p className="text-xs text-muted-foreground">{group.intro}</p>
                <ul className="list-disc pl-5 space-y-1">
                  {group.items.map(item => (
                    <li key={item.model} className="text-xs text-muted-foreground">{item.text}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

