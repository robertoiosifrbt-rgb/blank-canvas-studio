/**
 * 🔴 §46 „Form recovery" (Sesiunea 150) — **BARA CARE ÎNTREABĂ DACĂ SE PUNE ÎNAPOI CE S-A SCRIS.**
 *
 * ⚠️ **O întrebare, nu o restaurare automată.** ⛔ Un formular care se umple singur cu altceva decât
 * ce e în bază e mai rău decât unul gol: cine îl salvează fără să observe scrie în bază o ciornă pe
 * care nu a recitit-o. ✅ Deci: se spune că există, se pune înapoi doar la apăsare.
 *
 * ⚠️ **Fișier propriu, nu un bloc în fiecare dialog:** dialogurile sunt la clichetele lor de mărime,
 * iar bara e aceeași peste tot — două copii s-ar fi despărțit la primul cuvânt schimbat.
 *
 * ⚠️ Textele **nu** spun „draft": pentru cine îl citește, e „ce scriai". Motivul de fond e în
 * `lib/useUnsavedGuard.ts`.
 */
import { RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RestoreDraftBar({ onRestore, onDismiss }: {
  onRestore: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30">
      <p className="flex-1 text-xs text-amber-900 dark:text-amber-200">
        You were part-way through filling this in and it was not saved.
      </p>
      <Button type="button" size="sm" variant="outline" onClick={onRestore}>
        <RotateCcw className="h-3.5 w-3.5 mr-1" aria-hidden="true" />Put it back
      </Button>
      {/* ⚠️ „Nu" e o apăsare, nu o închidere tăcută: altfel bara ar reapărea la fiecare deschidere. */}
      <Button type="button" size="sm" variant="ghost" onClick={onDismiss} aria-label="Discard what was typed" title="Discard what was typed">
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}

