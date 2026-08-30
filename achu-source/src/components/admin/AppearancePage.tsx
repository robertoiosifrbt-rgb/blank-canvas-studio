import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '../shared/PageHeader';
import ThemeControls from '../shared/ThemeControls';

/**
 * §22 „Appearance în Setări" (Sesiunea 158) — cerut de Roberto pe 28/08/2026: *„pui appearance in
 * setari"*.
 *
 * ─── 🔴 De ce a plecat din bara de sus ──────────────────────────────────────
 * Paleta ocupa una din cele patru iconițe ale barei — cea mai scumpă bucată de ecran din aplicație —
 * pentru ceva ce omul apasă **o dată**. ⛔ Pe telefon bara are 390 de pixeli și trebuie să încapă și
 * căutarea.
 *
 * ⚠️ **Ce pierde omul, scris ca să nu fie o surpriză:** până azi schimba tema din orice ecran, într-o
 * apăsare; acum sunt trei (meniu → Setup → Appearance). 🔴 Pentru ceva făcut o dată, e o afacere
 * bună; pentru ceva făcut zilnic n-ar fi fost, iar aceea e chiar linia pe care s-a luat hotărârea.
 *
 * ─── ⛔ De ce ecran, și nu o secțiune într-o pagină existentă ───────────────
 * Cele două „Settings" care existau — `Financial Settings`, `Invoice Settings` — sunt despre **bani**,
 * nu despre aplicație. ⚠️ Aspectul pus într-una din ele ar fi stat lângă TVA și numărul de cont, iar
 * cine caută „cum schimb culoarea" nu se uită acolo.
 *
 * ⛔ **Fără buton „Salvează".** Alegerea se aplică imediat, ca înainte — 📜 motivul e din Sesiunea 57:
 * întrebarea onestă când alegi o culoare e *„cum o să arate ecranul meu"*, iar răspunsul se vede doar
 * dacă se aplică pe loc.
 */
export default function AppearancePage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Appearance"
        description="How the app looks on this device"
      />

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base">Light or dark, and the highlight colour</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/*
            ⚠️ **Propoziția stă SUS, înaintea controalelor.** 🔴 „Doar pe acest dispozitiv" e lucrul
            pe care omul trebuie să-l știe **înainte** să aleagă — altfel schimbă tema pe telefon și
            se întreabă a doua zi de ce laptopul a rămas cum era, iar aia se raportează ca defect.
          */}
          <p className="text-sm text-muted-foreground">
            Changes apply straight away, and only on this device — your phone and your laptop can
            look different.
          </p>
          <ThemeControls />
        </CardContent>
      </Card>
    </div>
  );
}

