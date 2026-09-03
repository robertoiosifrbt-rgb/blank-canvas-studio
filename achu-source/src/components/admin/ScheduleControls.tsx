import { ChevronLeft, ChevronRight, Download, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { ColourMode } from '@/lib/scheduleColour';

/**
 * Bara de controale a orarului — extrasă din `SchedulePage.tsx` la Sesiunea 158.
 *
 * ─── 🔴 De ce a plecat din pagină ───────────────────────────────────────────
 * Felia asta adaugă **patru** controale (echipa, ofertele, culoarea, căutarea) pe un ecran care era
 * la clichetul lui de mărime. ⛔ Regula spune ce se face atunci: **iese cod, cifra nu urcă**
 * (`AGENT_RULES` §7). ⚠️ Iar bara e chiar partea care nu întreabă nimic pe nimeni: primește starea și
 * întoarce apăsările, deci se poate citi fără a ține minte cum se încarcă orarul.
 *
 * ─── Ce merge pe server și ce nu, scris aici ca să nu se uite ───────────────
 * ⚠️ **Perioada, curățătorul, echipa, anulările și ofertele** cer o cerere nouă: sunt filtre pe care
 * baza le aplică, iar o vizită neadusă nu poate fi arătată. ⛔ **Culoarea și căutarea NU:** se aplică
 * pe rândurile deja aduse, deci răspund la fiecare tastă fără rețea. 🔴 Diferența e vizibilă pentru
 * om — de asta căutarea nu golește niciodată calendarul „în timp ce se încarcă".
 */
type View = 'day' | 'week' | 'month';

export default function ScheduleControls({
  view, onView, title, onStep, onToday,
  cleanerId, onCleaner, cleaners,
  teamId, onTeam, teams,
  showCancelled, onShowCancelled,
  showEnquiries, onShowEnquiries,
  colourMode, onColourMode,
  search, onSearch,
  onExport, exporting,
}: {
  view: View;
  onView: (v: View) => void;
  title: string;
  onStep: (direction: 1 | -1) => void;
  onToday: () => void;
  cleanerId: string;
  onCleaner: (id: string) => void;
  cleaners: { id: string; cleanerName: string; active?: boolean }[];
  teamId: string;
  onTeam: (id: string) => void;
  /** ⚠️ Doar echipele ACTIVE ajung aici: o echipă dezactivată nu mai e o vedere de lucru. */
  teams: { id: string; name: string }[];
  showCancelled: boolean;
  onShowCancelled: (on: boolean) => void;
  showEnquiries: boolean;
  onShowEnquiries: (on: boolean) => void;
  colourMode: ColourMode;
  onColourMode: (m: ColourMode) => void;
  search: string;
  onSearch: (q: string) => void;
  /**
   * 🆕 §11 „Calendar export". ⚠️ Fișierul urmează **filtrele**, nu căutarea: aceea e locală, deci
   * poate rămâne pe ecran cu mai puține rânduri decât are fișierul. ⛔ Butonul o spune, nu o ascunde.
   */
  onExport: () => void;
  exporting: boolean;
}) {
  return (
    <Card className="p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onStep(-1)} aria-label="Previous period" title="Previous period">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={onToday}>Today</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onStep(1)} aria-label="Next period" title="Next period">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-sm font-medium min-w-0 truncate px-1">{title}</p>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border overflow-hidden">
            {(['day', 'week', 'month'] as View[]).map(v => (
              <button
                key={v}
                onClick={() => onView(v)}
                className={`px-2.5 py-1 text-xs capitalize transition-colors ${
                  view === v ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <Select value={cleanerId} onValueChange={onCleaner}>
            <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Filter by cleaner"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cleaners</SelectItem>
              {cleaners.filter(c => c.active !== false).map(c => (
                <SelectItem key={c.id} value={c.id}>{c.cleanerName}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/*
            🆕 §11 „Team view" (Sesiunea 158). ⚠️ **Se ascunde când nu există echipe** — un filtru
            „All teams" pe o firmă fără echipe e un control care nu poate face nimic, iar biroul îl
            apasă o dată și învață să nu mai creadă bara.
            ⛔ Se compune cu filtrul pe curățător, nu îl înlocuiește (serverul aplică ambele).
          */}
          {teams.length > 0 && (
            <Select value={teamId} onValueChange={onTeam}>
              <SelectTrigger className="h-8 w-[130px] text-xs" aria-label="Filter by team"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teams</SelectItem>
                {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {/*
            🆕 §11 „Colour coding by cleaner / by service". ⚠️ Starea rămâne modul IMPLICIT: e singurul
            care are înțeles fără legendă. ⛔ Pe celelalte două, pagina desenează legenda — o culoare
            fără nume nu spune nimic (vezi `lib/scheduleColour.ts`).
          */}
          <Select value={colourMode} onValueChange={v => onColourMode(v as ColourMode)}>
            <SelectTrigger className="h-8 w-[135px] text-xs" aria-label="Colour the jobs by"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="status">Colour: status</SelectItem>
              <SelectItem value="cleaner">Colour: cleaner</SelectItem>
              <SelectItem value="service">Colour: service</SelectItem>
            </SelectContent>
          </Select>

          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={showCancelled} onChange={e => onShowCancelled(e.target.checked)} className="h-3.5 w-3.5" />
            Cancelled
          </label>

          {/*
            🆕 §11 „Draft jobs optional" (Sesiunea 158) — perechea rândului „Cancelled jobs visible".
            🔴 **Aprins din start, dinadins:** ofertele se vedeau în orar de la început, iar a le
            ascunde implicit ar fi schimbat tăcut ce vede biroul dimineața. ⚠️ „Optional" înseamnă că
            se pot STINGE, nu că dispar.
            ⛔ Filtrul pleacă la server, ca cel de anulări: o vizită neadusă nu poate fi arătată, iar
            numărătorile de sus trebuie să descrie exact ce e pe ecran.
          */}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={showEnquiries} onChange={e => onShowEnquiries(e.target.checked)} className="h-3.5 w-3.5" />
            Enquiries
          </label>

          {/*
            🆕 §11 „Calendar export" (Sesiunea 158). ⚠️ Lângă filtre, fiindcă **le urmează**: ce e
            filtrat afară nu intră în fișier. ⛔ Iar căutarea nu intră deloc — vezi `onExport`.
          */}
          <Button variant="outline" size="sm" className="h-8" onClick={onExport} disabled={exporting}
            title="Download this period as a CSV file">
            {exporting
              ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              : <Download className="mr-1.5 h-3.5 w-3.5" />}
            Export
          </Button>
        </div>
      </div>

      {/*
        🆕 §11 „Calendar search" (Sesiunea 158) — pe rândul ei, fiindcă e singurul control în care se
        SCRIE, iar pe telefon ar fi fost strivită între două liste derulante.
        ⛔ Caută în perioada de pe ecran, nu în toată istoria — aceea e căutarea globală (§22), și
        textul de sub casetă o spune, ca nimeni să nu creadă că lipsesc rezultate.
      */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search this period — customer, service, address or job number"
            aria-label="Search the jobs shown in this period"
            className="h-8 pl-7 text-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearch('')}
              aria-label="Clear the search"
              title="Clear the search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

