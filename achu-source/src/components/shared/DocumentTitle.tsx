/**
 * §48 „Consistent page titles" (Sesiunea 148) — **componenta care scrie titlul.**
 *
 * ⛔ **O singură componentă lângă `<Routes>`, nu un apel în fiecare dintre cele ~50 de ecrane.**
 * ⚠️ Motivul e că a doua variantă s-ar fi aplicat doar ecranelor pe care cineva își amintește să le
 * atingă — iar cele uitate ar fi rămas cu titlul altui ecran pe tab, ceea ce e mai rău decât un
 * titlu constant: ar afirma ceva fals.
 *
 * 🔴 **Nu randează nimic.** Regula (ce titlu are ce adresă) e în `lib/pageTitle.ts`, pură și
 * testată; aici e doar efectul.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { documentTitleFor } from '@/lib/pageTitle';

export default function DocumentTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    const next = documentTitleFor(pathname);
    /**
     * ⚠️ Pe o adresă necunoscută **nu se atinge titlul**: rămâne cel din `index.html`. ⛔ Nu se
     * „curăță" la ceva generic, fiindcă atunci un ecran de „not found" ar șterge numele firmei din
     * tab — iar omul care caută unde a greșit ar pierde și reperul.
     */
    if (next) document.title = next;
  }, [pathname]);

  return null;
}

