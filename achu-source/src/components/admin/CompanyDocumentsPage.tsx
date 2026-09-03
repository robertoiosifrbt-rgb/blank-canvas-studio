/**
 * §33 „Document management" (Sesiunea 161) — HÂRTIILE FIRMEI.
 *
 * 🔴 **Sub Setup, nu sub Clients sau Team**, fiindcă nu sunt despre nimeni anume: polița de
 * asigurare, certificatul de înregistrare, evaluarea de risc generică. ⚠️ Sunt configurarea legală a
 * firmei, lângă Invoice Settings și Who We Share Data With.
 *
 * ⛔ **Pagina e o coajă**, deliberat: tot ce face e în `DocumentsSection`, aceeași folosită pe vizită,
 * ofertă și factură. 🔴 Patru copii ale aceleiași liste ar fi însemnat patru locuri în care se repară
 * aceeași greșeală — și bugetul de pachete (ACHU-808) nu suportă patru ecrane pentru o listă.
 */
import DocumentsSection from '@/components/shared/DocumentsSection';

export default function CompanyDocumentsPage() {
  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Company documents</h1>
        <p className="text-sm text-muted-foreground">
          The paperwork the business itself is asked for — insurance, registrations, risk assessments.
          Documents about a person live on their cleaner record; documents about a property live on the property.
        </p>
      </div>
      <DocumentsSection scope="Company" title="Company paperwork" />
    </div>
  );
}

