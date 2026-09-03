/**
 * §16 „Room-based sections" (Sesiunea 144) — LISTA PE CAMERE, NU PE SERVICII.
 *
 * ─── 🔴 CE SE ÎNTÂMPLĂ AZI, ȘI DE CE E O PROBLEMĂ DE PICIOARE ───────────────
 * Punctele se generează **grupate pe serviciu**: „Deep Cleaning", „Carpet Cleaning", „Steam
 * Sanitisation". ⚠️ Pe o casă cu trei servicii, curățătorul are „Bedroom 1" în **trei** locuri
 * diferite din listă — deci fie umblă prin casă de trei ori, fie caută de fiecare dată prin ce a
 * bifat. ⛔ Iar ordinea pe servicii **nu e greșită** pentru birou: acolo e ordinea în care se
 * vinde munca și se calculează prețul.
 *
 * ✅ Deci nu se înlocuiește nimic — se adaugă **a doua citire a aceleiași liste**, pe cameră, iar
 * omul alege. Aceleași puncte, aceleași bife, nicio scriere: e o regrupare, nu o funcționalitate.
 *
 * ─── ⚠️ CE ESTE O „CAMERĂ", ȘI CE NU ────────────────────────────────────────
 * Eticheta unui punct e `„<lucru> <număr>"` (`Bedroom 1`, `Interior Window 3`), iar numărul e
 * poziția în cantitatea comandată. 🔴 **Deci „Bedroom 1" din „Deep Cleaning" și „Bedroom 1" din
 * „Steam Sanitisation" SUNT aceeași cameră** — amândouă înseamnă „primul dormitor". Pe asta stă
 * toată felia.
 *
 * ⛔ **Și exact aici e granița care trebuie scrisă, nu ghicită:** o fereastră, un cuptor, o
 * canapea, un gard sau o mașină **nu sunt camere**, iar „Carpeted Room 1" e o cameră despre care
 * nu se poate ști CARE e (biroul o numără separat de dormitoare). ⚠️ A le împerechea după număr ar
 * fi trimis omul să șteargă covorul din dormitorul greșit — mai rău decât o listă lungă. Toate
 * acelea stau la sfârșit, într-un grup propriu, cu numele lor de serviciu neatins.
 */

/** Ce fel de puncte se pot împerechea între servicii, în ordinea în care se umblă printr-o casă. */
const ROOM_KINDS = ['Bedroom', 'Bathroom', 'Kitchen', 'Living Room', 'Hallway'] as const;

/** Titlul grupului care adună tot ce nu e o cameră. */
export const NON_ROOM_GROUP = 'Elsewhere in the job';

export type RoomGroupItem = {
  id: string;
  itemLabel: string;
  /** Numele serviciului. 🔴 În citirea pe cameră **el** e textul vizibil: eticheta e titlul grupului. */
  groupName: string;
};

export type RoomGroup<T> = { groupName: string; items: T[] };

/**
 * Din ce grup face parte punctul, și pe ce poziție se așează grupul.
 *
 * ⚠️ Potrivirea e pe `„<fel> <număr>"` **exact**, nu pe „conține": „Bedroom 1" da, „Bedroom Window
 * 2" nu. ⛔ Un `startsWith` ar fi băgat ferestrele de dormitor în dormitor, iar ele se spală de pe
 * scară, nu din cameră.
 */
function roomOf(itemLabel: string): { title: string; kind: number; index: number } | null {
  const m = /^(.+?) (\d+)$/.exec(itemLabel.trim());
  if (!m) return null;
  const kind = ROOM_KINDS.indexOf(m[1] as typeof ROOM_KINDS[number]);
  if (kind < 0) return null;
  return { title: `${m[1]} ${m[2]}`, kind, index: Number(m[2]) };
}

/**
 * Aceleași puncte, regrupate pe cameră. ⛔ Nu filtrează și nu pierde nimic: fiecare punct primit
 * iese exact o dată — un test o afirmă pe numărătoare, fiindcă o listă de lucru din care dispare
 * un rând e mai rea decât una prost ordonată.
 *
 * ⚠️ **Ordinea din interiorul unei camere e cea primită**, adică ordinea canonică pe servicii
 * (`checklistFieldOrder` pe server): curățenia de bază înaintea aburului, nu invers.
 */
export function groupChecklistByRoom<T extends RoomGroupItem>(items: T[]): RoomGroup<T>[] {
  const rooms = new Map<string, { kind: number; index: number; items: T[] }>();
  const rest: T[] = [];

  for (const item of items) {
    const room = roomOf(item.itemLabel);
    if (!room) { rest.push(item); continue; }
    const existing = rooms.get(room.title);
    if (existing) existing.items.push(item);
    else rooms.set(room.title, { kind: room.kind, index: room.index, items: [item] });
  }

  const ordered = [...rooms.entries()]
    .sort((a, b) => a[1].kind - b[1].kind || a[1].index - b[1].index)
    .map(([groupName, v]) => ({ groupName, items: v.items }));

  /** ⚠️ Restul la SFÂRȘIT, ca lista să înceapă cu camerele — și doar dacă are ce pune în el. */
  return rest.length ? [...ordered, { groupName: NON_ROOM_GROUP, items: rest }] : ordered;
}

