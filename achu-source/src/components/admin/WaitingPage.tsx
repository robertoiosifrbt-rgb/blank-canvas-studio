/**
 * 🔴 CE AȘTEAPTĂ ȘI DE CE — problemele parcate, în APLICAȚIE.
 *
 * Roberto, 15/08/2026: *„vreau sa iei din fata mea unele probleme. De exemplu 218 care asteapta
 * pana incepem trade"*. Fila „Parcate" din registru le scoate din lista deschisă; ecranul ăsta e
 * partea pe care o vede el, fiindcă registrul e un fișier pe care îl deschide o sesiune, nu un om.
 *
 * ⛔ **Parcat nu înseamnă rezolvat.** Fiecare rând arată DECLANȘATORUL — ce trebuie să se întâmple
 * ca să redevină muncă — și **ce se strică dacă nimeni nu observă**. Fără a doua coloană, o listă
 * de amânări devine o listă de uitări.
 *
 * ⚠️ Ecran STATIC, ca `DataBreachPage`: textul e în cod, deci apare instant, offline, și nu are o
 * stare în care nu arată nimic. ⛔ Sursa de adevăr rămâne registrul, iar `handoff-check.mjs` pică
 * dacă ID-urile de aici nu sunt exact cele din fila „Parcate" — altfel ecranul s-ar învechi tăcut.
 */
import { Card, CardContent } from '@/components/ui/card';
import { PauseCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { PARKED_ISSUES } from '@/lib/parkedIssues';

export default function WaitingPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold">Waiting on something</h2>
        <p className="text-sm text-muted-foreground">
          Known problems that are not being worked on, and the one thing that has to happen before
          each becomes work again. Nothing here is broken today.
        </p>
      </div>

      {/* Spus o dată, sus: altfel pagina se citește ca o listă de lucruri rezolvate. */}
      <Card className="border-amber-400">
        <CardContent className="p-5 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm">
            <strong>Nothing here warns you by itself.</strong> These were moved out of the open list
            on purpose, so that list stays short — but a parked problem that nobody looks at is a
            forgotten one. That is what the middle column is for.
          </p>
        </CardContent>
      </Card>

      {PARKED_ISSUES.map(issue => (
        <Card key={issue.id}>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <PauseCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{issue.what}</p>
                <p className="text-xs text-muted-foreground">{issue.id}</p>
              </div>
            </div>

            <div className="pl-8 space-y-2 text-sm">
              <p>
                <span className="font-medium">Waiting for: </span>
                {issue.trigger}
              </p>
              <p className="flex items-start gap-2 text-muted-foreground">
                <ArrowRight className="h-4 w-4 shrink-0 mt-0.5" />
                <span><span className="font-medium">Then: </span>{issue.then}</span>
              </p>
              {/* 🔴 Consecința, nu severitatea: „Low" nu spune nimănui ce pierde. */}
              <p className="text-muted-foreground">
                <span className="font-medium">If nobody notices: </span>
                {issue.ifMissed}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}

      <p className="text-xs text-muted-foreground">
        The full record — why each was parked, and by whom — is in the issue register, sheet “Parcate”.
      </p>
    </div>
  );
}

