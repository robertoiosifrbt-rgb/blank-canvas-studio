/**
 * ACHU-577 (`Backlog_Functionalitati_Viitoare` §5, Grupul E) — CE SE FACE DE FIECARE DATĂ AICI.
 *
 * 🔴 **De ce e un card separat de instrucțiunile vizitei.** Cele două se citesc în același
 * moment, dar au vârste diferite: *„azi nu intrați în dormitor, doarme copilul"* e despre ziua
 * asta, iar *„aspiratorul e în debara"* e adevărat de doi ani. Într-un singur câmp, al doilea ar
 * fi fost rescris la fiecare vizită — adică exact problema pe care grupul o repară.
 *
 * ⚠️ **Întotdeauna deschis**, ca celelalte carduri ale casei: cine citește asta e la ușă.
 * ⛔ Serverul nu trimite nimic pe o vizită închisă și nimic când nu s-a scris nimic
 * (`standardInstructionsForCleaner`), deci aici nu e niciun caz de tratat.
 */
import { ListChecks } from 'lucide-react';

export default function StandingWorkCard({ instructions }: { instructions: string }) {
  return (
    <div className="rounded-lg border border-sky-500/40 bg-sky-500/5 p-2.5">
      <p className="text-xs font-semibold flex items-center gap-1.5">
        <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />Every time at this property
      </p>
      {/* `whitespace-pre-wrap break-words`, ca la celelalte: biroul scrie liste pe rânduri
          separate, iar un text lipit într-un paragraf se citește greșit la ușă. */}
      <p className="mt-0.5 text-sm whitespace-pre-wrap break-words">{instructions}</p>
    </div>
  );
}

