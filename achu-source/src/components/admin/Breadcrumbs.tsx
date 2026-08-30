/**
 * §48 „Breadcrumbs / Back navigation" (Sesiunea 149) — **desenul urmei de navigare.**
 *
 * ⛔ **Montat o dată în `AdminLayout`, nu pe fiecare ecran.** ⚠️ A doua variantă s-ar fi aplicat doar
 * ecranelor pe care cineva își amintește să le atingă, iar cele uitate ar fi rămas fără reper — exact
 * greșeala pe care titlul din tab a evitat-o montându-se lângă `<Routes>` (`shared/DocumentTitle`).
 *
 * 🔴 Regula (ce urmă are ce adresă) e în `lib/breadcrumbs.ts`, pură și testată. Aici e doar HTML-ul,
 * și singurul lucru de care trebuie să-ți amintești citindu-l: **`<nav>` cu nume, `<ol>`, iar ultimul
 * pas marcat `aria-current="page"`** — asta e ce transformă un șir de text într-o urmă anunțată ca
 * atare de un cititor de ecran, în loc de cinci cuvinte citite la rând.
 */
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { trailFor } from '@/lib/breadcrumbs';

export default function Breadcrumbs({ pathname }: { pathname: string }) {
  const trail = trailFor(pathname);
  /**
   * ⚠️ Pe o adresă necunoscută nu se desenează nimic. ⛔ Un singur pas n-ar fi urmă, ci o etichetă
   * repetată: ecranul își spune oricum numele în titlul lui.
   */
  if (trail.length < 2) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {trail.map((crumb, i) => (
          <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && (
              /* ⚠️ Săgeata e decor: cititorul de ecran citește pașii dintr-o listă, iar un „›"
                 anunțat între ei ar fi zgomot. De asta `aria-hidden`, nu un caracter în text. */
              <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
            )}
            {crumb.to ? (
              <Link to={crumb.to} className="rounded hover:text-foreground hover:underline">
                {crumb.label}
              </Link>
            ) : (
              /**
               * ⚠️ Ultimul pas e locul în care ești, deci poartă `aria-current="page"` și e scris
               * mai apăsat. ⛔ Pașii fără link care NU sunt ultimul (grupul din meniu) rămân text
               * simplu: un grup nu e o pagină, deci n-are voie să se anunțe ca fiind pagina curentă.
               */
              <span
                aria-current={i === trail.length - 1 ? 'page' : undefined}
                className={i === trail.length - 1 ? 'font-medium text-foreground' : undefined}
              >
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

