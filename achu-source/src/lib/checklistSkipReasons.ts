/**
 * §16 „Failure reason" (Sesiunea 143) — motivele gata scrise pentru un punct care nu s-a putut face.
 *
 * ⛔ **Fișier propriu, și nu din stil:** exportat din componentă, clichetul de lint dă un
 * avertisment nou (`react-refresh/only-export-components`), iar clichetul e EXACT — un avertisment
 * în plus oprește push-ul. ✅ Iar separarea e oricum corectă: lista e **date**, o citesc și testele,
 * și e primul loc unde firma o va schimba fără să atingă un ecran.
 */

/**
 * ⚠️ **O ALEGERE, nu o lege** — de corectat de Roberto, Denisa sau Archana. Sunt motivele auzite
 * cel mai des, scrise ca fapte despre MUNCĂ.
 *
 * ⛔ **Niciunul nu spune nimic despre PERSOANA clientului**, și e regula Archanei din 19/08, nu o
 * preferință de stil: o părere scrisă despre un client i-o dăm dacă cere copia datelor lui. Un test
 * ține granița.
 *
 * 🔴 **De ce motive gata scrise și nu doar text liber:** se apasă o dată, cu mănuși, în mașină — și,
 * fiind aceleași cuvinte de fiecare dată, se pot **NUMĂRA** mai târziu („de câte ori nu am avut
 * acces luna asta?"), ceea ce un text liber nu permite. Textul liber a rămas, pentru ce nu intră.
 */
export const SKIP_REASONS = [
  'Could not get in / no access',
  'Not there — nothing to clean',
  'Not enough time on this visit',
  'Broken or unsafe to touch',
  'Customer asked us to leave it',
] as const;

/** Cât încape în motiv. Aceeași cifră ca plafonul rutei — unul mai mare aici ar produce un refuz. */
export const SKIP_REASON_MAX = 500;

