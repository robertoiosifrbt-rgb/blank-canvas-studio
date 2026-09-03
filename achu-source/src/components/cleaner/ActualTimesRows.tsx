/**
 * Orele REALE ale vizitei — când s-a apăsat „Start" și când „Finish".
 *
 * ⚠️ **Extras din `JobCard.tsx` la ACHU-578**, nu rescris: cele două rânduri erau identice în
 * afară de etichetă, iar fișierul e la plafonul lui de mărime (`file-size-ratchet.mjs`). ⛔ Regula
 * spune să EXTRAGI, nu să ridici plafonul — a patra oară la rând când felia caselor plătește
 * pentru spațiul pe care îl cere.
 *
 * 🔴 **Se arată doar ce EXISTĂ.** O vizită neîncepută n-are oră reală, iar un rând gol care spune
 * „Actual Start: —" ar arăta ca o vizită la care cineva a ajuns și n-a consemnat nimic.
 */
import { Clock } from 'lucide-react';
import { fmtDateTime } from '@/lib/format';

export default function ActualTimesRows({ startedAt, finishedAt }: {
  startedAt: string | null | undefined;
  finishedAt: string | null | undefined;
}) {
  const rows = [
    ['Actual Start:', startedAt],
    ['Actual Finish:', finishedAt],
  ] as const;

  return (
    <>
      {rows.filter(([, at]) => at).map(([label, at]) => (
        <p key={label} className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-muted-foreground">{label}</span>
          <span className="text-green-700 font-medium">{fmtDateTime(at)}</span>
        </p>
      ))}
    </>
  );
}

