/**
 * ACHU-549 — DESPRE PERSOANA DIN SPATELE UȘII, NU DESPRE UȘĂ.
 *
 * „E surd, nu aude soneria." „Are demență și se sperie de un necunoscut." „Lucrează în ture de
 * noapte și doarme ziua." ⚠️ Scrisă de BIROU, citită de curățătorul asignat — o notă de
 * accesibilitate pe care o citește doar biroul nu ajută pe nimeni la ușă.
 *
 * ⚠️ **Întotdeauna deschisă, niciodată după un buton**, ca „Getting in" și „ce poate merge
 * prost": ascunsă după un „arată mai mult", e o notă care nu există.
 *
 * ⚠️ **Extrasă din `JobCard.tsx` la ACHU-577**, când felia avea nevoie de încă un card și
 * clichetul de mărime era atins — a treia oară la rând când un card iese din fișierul acela în
 * loc să intre în el (`CLAUDE.md` §2.1a: se extrage, nu se ridică plafonul).
 */
import { HeartHandshake } from 'lucide-react';

export default function AccessibilityNoteCard({ note }: { note: string }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2.5">
      <p className="text-xs font-semibold flex items-center gap-1.5">
        <HeartHandshake className="h-3.5 w-3.5" aria-hidden="true" />What this person needs
      </p>
      <p className="mt-0.5 text-sm whitespace-pre-wrap break-words">{note}</p>
    </div>
  );
}

