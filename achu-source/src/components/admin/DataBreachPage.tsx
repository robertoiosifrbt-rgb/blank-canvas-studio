import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Phone, ExternalLink, Clock } from 'lucide-react';
// 🔴 ACHU-770 — registrul are ECRANUL lui: el cere serverul, pagina asta nu. Vezi comentariul de jos.

/**
 * 🔴 CE FACI DACĂ SCAPĂ DATE — în APLICAȚIE, nu într-un document.
 *
 * Roberto, 15/08/2026, după ce i-am spus că procedura e în `docs/`, apoi că poate
 * o ține pe telefon: *„Ce vorbești ma??? Asta nu trebuie sa stea in aplicatie?"*.
 * Avea dreptate, iar cele două variante ale mele erau amândouă greșite: un
 * document într-un dosar de cod nu se deschide niciodată, iar o notiță pe telefon
 * se pierde la prima schimbare de telefon. **Aplicația e locul unde intră zilnic.**
 *
 * ⚠️ Ecran STATIC, fără nicio cerere către server, deliberat: e citit exact în
 * momentul în care ceva e stricat, iar un ecran care se încarcă de undeva are o
 * stare în care nu arată nimic. Textul e în cod, deci apare instant și offline.
 *
 * ⛔ Nu duplică `docs/Procedura_Bresa_Date.md` — documentul rămâne varianta lungă,
 * pentru citit la rece. Aici sunt doar pașii, în ordinea în care se fac sub
 * presiune. *(Un fapt, un singur loc: pașii aici, motivele acolo.)*
 */
export default function DataBreachPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold">If data gets out</h2>
        <p className="text-sm text-muted-foreground">
          Read this when something has already happened. Nothing here needs the internet.
        </p>
      </div>

      {/* Ceasul e primul lucru pe ecran: e singura cifră cu consecință legală. */}
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="p-5 flex gap-3">
          <Clock className="h-6 w-6 text-destructive shrink-0" />
          <div>
            <p className="font-semibold">You have 72 hours to tell the ICO.</p>
            <p className="text-sm text-muted-foreground">
              The clock starts when someone here <strong>finds out</strong> — not when it happened.
              A weekend does not stop it.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />The first hour
          </h3>
          <ol className="space-y-2 text-sm list-decimal pl-5">
            <li>
              <strong>Stop the access.</strong> A suspicious account: <em>User Accounts</em> → deactivate it.
              A password that may have leaked: change it in Supabase and in Railway.
            </li>
            <li>
              <strong>Write down what you know, with the time.</strong> What data, how many people, how you
              found out, who told you. Write as you learn — in two days nobody remembers the order,
              and that is exactly what you will be asked.
            </li>
            <li>
              <strong>Do not delete anything</strong> to tidy up. <em>Audit History</em> shows who touched
              what and when — that is your evidence that you reacted, not a problem.
            </li>
            <li>
              <strong>Call the other two.</strong> Whoever finds out first decides. Do not wait for each
              other; the clock is running.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Phone className="h-4 w-4" />Tell the ICO
          </h3>
          <p className="text-sm">
            <strong>Yes, report it</strong> if what got out could harm someone: National Insurance numbers,
            bank details, wages, home addresses with access instructions, or fit notes.
          </p>
          {/* ⚠️ Regula care contează cel mai mult sub presiune, fiindcă e momentul
              în care oamenii se conving singuri că „nu e cazul". */}
          <p className="text-sm font-medium">If anyone is unsure whether to report — report.</p>
          <div className="flex flex-wrap gap-4 pt-1 text-sm">
            <a
              href="https://ico.org.uk/for-organisations/report-a-breach/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
            >
              ico.org.uk — Report a breach <ExternalLink className="h-3 w-3" />
            </a>
            <a href="tel:03031231113" className="text-primary hover:underline flex items-center gap-1">
              <Phone className="h-3 w-3" />0303 123 1113
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-2">
          <h3 className="font-semibold">Tell the people affected too</h3>
          <p className="text-sm">
            Separately, and without delay, if it can harm them directly — bank details, wages, health,
            home addresses. Say what got out, what you are doing, and what they should do. Plain words.
          </p>
        </CardContent>
      </Card>

      <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
        <CardContent className="p-5 space-y-2">
          <h3 className="font-semibold">Write it down even if you do NOT report it</h3>
          <p className="text-sm">
            The law requires a record of <strong>every</strong> breach, including the ones you decide not
            to report, with the reason why. If the ICO ever asks and the record is empty, the question
            becomes “did nothing ever happen, or did nobody write it down?”
          </p>
        </CardContent>
      </Card>

      {/*
        🔴 ACHU-770 / §45 (Sesiunea 148) — REGISTRUL, ca LINK, nu ca secțiune.
        ⛔ Prima variantă a randat registrul aici, iar testul acestui ecran a picat imediat, corect:
        el verifică, fără niciun mock, că pagina **nu depinde de nimic** — fiindcă e citită exact când
        ceva e deja stricat. Registrul cere serverul, deci ar fi rupt chiar proprietatea pe care
        Roberto a cerut-o pe 15/08. ✅ Un link e inert până e apăsat: pașii rămân instant și offline.
      */}
      <Card>
        <CardContent className="p-5 space-y-2">
          <h3 className="font-semibold">Write it down here</h3>
          <p className="text-sm">
            The register lives on its own screen, because it needs the internet and this page does not.
          </p>
          {/*
            ⚠️ **`<a>`, nu `<Link>`**, și e a doua lecție din același test: un `<Link>` cere contextul
            routerului, iar ecranul ăsta se randează **fără niciun înveliș** — exact ce verifică
            testul lui. ⛔ Deci ar fi picat din al doilea motiv, după cererea de rețea. Un `<a>` nu
            cere nimic; costul e o reîncărcare de pagină, care aici nu deranjează pe nimeni.
          */}
          <a href="/admin/data-breach-register" className="text-sm underline">
            Open the breach register
          </a>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Longer version, with what counts as a breach and the one-off setup:{' '}
        <code>docs/Procedura_Bresa_Date.md</code>
      </p>
    </div>
  );
}

