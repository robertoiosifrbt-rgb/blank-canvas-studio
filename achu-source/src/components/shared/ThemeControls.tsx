import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, ACCENTS, type Mode } from '@/lib/useTheme';

/**
 * §22 „Appearance în Setări" (Sesiunea 158) — CONTROALELE DE ASPECT, fără fereastră.
 *
 * ─── 🔴 De ce au ieșit din `ThemeSwitcher` ──────────────────────────────────
 * Roberto, 28/08/2026: *„pui appearance in setari"*. ⚠️ Avea dreptate, și motivul se poate spune în
 * cifre: paleta ocupa un loc în bara de sus — cea mai scumpă bucată de ecran din aplicație — pentru
 * ceva ce omul apasă **o dată**. ⛔ Iar pe telefon bara are patru iconițe și 390 de pixeli.
 *
 * ✅ Ce s-a mutat e **corpul** panoului, neatins: aceleași trei moduri, aceleași opt culori, aceleași
 * două propoziții. 🔴 Ce a dispărut e **fereastra** — pe un ecran dedicat aspectului, un buton care
 * deschide o fereastră ca să arate ce e deja pe pagină ar fi fost un click în plus fără nimic în el.
 *
 * ─── ⚠️ Ce NU s-a schimbat, și e chiar valoarea originalului ────────────────
 * **Alegerea se aplică imediat.** 📜 Scris în Sesiunea 57: *„întrebarea onestă când alegi o culoare e
 * «cum o să arate ecranul meu», nu «ce e 271 76% 42%»"*. ⛔ Deci fără buton „Salvează": pagina se
 * schimbă sub ochii omului, iar el se poate răzgândi fără să caute nimic.
 *
 * ⚠️ Și rămâne **per dispozitiv** — telefonul și laptopul pot arăta diferit. Scris pe ecran, fiindcă
 * altfel cineva schimbă tema pe telefon și se întreabă de ce laptopul a rămas cum era.
 */
const MODES: { value: Mode; label: string; icon: typeof Sun; hint: string }[] = [
  { value: 'light', label: 'Light', icon: Sun, hint: 'Always light' },
  { value: 'dark', label: 'Dark', icon: Moon, hint: 'Always dark' },
  { value: 'system', label: 'Auto', icon: Monitor, hint: 'Follows your phone' },
];

export default function ThemeControls() {
  const { mode, accent, setMode, setAccent } = useTheme();

  return (
      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium mb-2">Light or dark</p>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map(m => {
              const Icon = m.icon;
              const on = mode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setMode(m.value)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition ${
                    on ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {m.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {MODES.find(m => m.value === mode)?.hint}
          </p>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Colour</p>
          <div className="grid grid-cols-4 gap-2">
            {ACCENTS.map(a => {
              const on = accent === a.value;
              return (
                <button
                  key={a.value}
                  type="button"
                  aria-pressed={on}
                  aria-label={a.label}
                  onClick={() => setAccent(a.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 text-xs transition ${
                    on ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                  }`}
                >
                  <span className={`h-6 w-6 rounded-full ${a.swatch}`} />
                  {a.label}
                </button>
              );
            })}
          </div>
          {/* Said out loud because it is the reassuring part: no combination
              here can produce text you cannot read. Only the accent moves. */}
          <p className="mt-1.5 text-xs text-muted-foreground">
            Only the highlight colour changes — text and backgrounds stay readable in every combination.
          </p>
        </div>
      </div>
  );
}

