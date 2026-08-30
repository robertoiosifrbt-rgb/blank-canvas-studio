import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { HelpCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import type { HelpTopic } from '@/lib/helpTopic';

/**
 * Sesiunea 55 (ACHU-252) — the "?" button, on every screen.
 *
 * ─── Mounted once, in the layout ──────────────────────────────────────────
 * It reads the current route and looks the topic up itself, rather than each of
 * the 24 admin screens passing its own. Two reasons, and the second is the real
 * one:
 *
 * 1. Adding help to a screen means editing one content file, not the screen.
 * 2. A screen that nobody remembered to wire up would have silently had no
 *    help — and nobody would ever notice, because a missing button looks like
 *    a screen that does not need one.
 *
 * ─── The button hides itself when there is nothing to say ─────────────────
 * A "?" that opens an empty panel teaches people that the "?" is not worth
 * pressing, everywhere, including where it would have helped.
 *
 * ─── Why the warnings are visually loudest ────────────────────────────────
 * The owner asked for this after pressing a one-tap, irreversible button
 * without knowing what it did. The part of a manual that earns its place is
 * not the description of the screen — it is the sentence that says what cannot
 * be undone. So warnings are not a footnote here; they are the section with
 * the colour.
 *
 * ─── 🔴 TEXTUL SE ADUCE LA CERERE (Sesiunea 155) — și cifra e motivul ─────
 * Manualul întreg — cele cinci fișiere de subiecte — cântărea **19 din cele 25 kB** ale bucății
 * care ține cadrul Adminului, adică se descărca la fiecare intrare în aplicație, de toată lumea,
 * ca să fie citit de câteva ori pe lună. ⚠️ Măsurat, nu presupus: cu `helpFor` scos, bucata a
 * căzut de la 25,1 la **6**.
 *
 * ⛔ **Și creștea cu fiecare ecran nou:** un rând de meniu plus un subiect de ajutor, de fiecare
 * dată. Paza de mărime (`scripts/bundle-budget.mjs`) a picat exact pe felia care a adăugat al
 * cincizeci și unulea ecran — iar cifra nu se ridică, deci importul static a devenit `import()`.
 *
 * ⚠️ **Ce se schimbă pe ecran:** butonul „?" apare cu o clipă mai târziu decât restul cadrului, nu
 * odată cu el. ⛔ Ce NU se schimbă: nu apare niciodată pe un ecran fără subiect, iar panoul are
 * același conținut. 🔴 De asta testele lui caută butonul cu `findBy`, nu cu `getBy`: forma
 * asincronă e chiar comportamentul apărat.
 */
export default function HelpPanel() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const [topic, setTopic] = useState<HelpTopic | undefined>(undefined);

  /**
   * ⚠️ **Manualul se aduce o singură dată**, la prima nevoie: modulul rămâne în memoria paginii
   * după primul `import()`, deci schimbarea ecranului nu îl mai descarcă. ⛔ `live` oprește
   * scrierea în starea unei componente demontate — ecranul se poate schimba în timpul aducerii.
   */
  useEffect(() => {
    let live = true;
    void import('@/lib/helpContent').then(m => {
      if (live) setTopic(m.helpFor(pathname));
    });
    return () => { live = false; };
  }, [pathname]);

  if (!topic) return null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Help with ${topic.title}`}
        title={`Help with ${topic.title}`}
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{topic.title}</DialogTitle>
            <DialogDescription>{topic.whatItIs}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 text-sm">
            {topic.steps && topic.steps.length > 0 && (
              <div className="space-y-3">
                {topic.steps.map(s => (
                  <div key={s.label}>
                    <p className="font-medium">{s.label}</p>
                    <p className="text-muted-foreground">{s.detail}</p>
                  </div>
                ))}
              </div>
            )}

            {topic.warnings && topic.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700/60 dark:bg-amber-950/30">
                <p className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Worth knowing before you click
                </p>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-amber-900/90 dark:text-amber-200/90">
                  {topic.warnings.map(w => <li key={w}>{w}</li>)}
                </ul>
              </div>
            )}

            {/* Said on every screen, deliberately. The two people using this app
                are not developers, and the fastest route to an answer is asking
                in a session — not hunting for a screen that might not exist. */}
            <p className="text-xs text-muted-foreground border-t pt-3">
              Anything here out of date or missing? Say so in a Claude Code session — this text lives with the code, so it gets fixed in the same place.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

