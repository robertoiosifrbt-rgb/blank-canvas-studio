/**
 * §ajutor — subiectele pentru setarea aplicației și urmele pe care le lasă.
 *
 * ⚠️ **Ieșite din `helpContent.ts`** (Sesiunea 146): acela ajunsese la 485 de rânduri și ținea două
 * responsabilități — mecanismul (tipul, căutarea după rută) și tot textul. 🔴 Cele 12 ecrane fără
 * ajutor nu încăpeau fără să treacă pragul de 500 (`AGENT_RULES` §7.2), iar pragul nu se ridică.
 *
 * ⛔ Împărțirea urmează **secțiunile din meniu**, nu o tăietură inventată: cine caută ajutorul unui
 * ecran știe deja în ce secțiune stă el.
 */
import type { HelpTopic } from './helpTopic';

export const HELPTOPICSSETUP: Record<string, HelpTopic> = {
  /**
   * 🆕 §34 „Equipment și inventory" (Sesiunea 160). ⚠️ Avertismentul spune ce NU face cifra de stoc,
   * fiindcă exact acolo se greșește: **nu se scade singură** când cineva ia o sticlă de pe raft.
   */
  '/admin/inventory': {
    title: 'Stock',
    whatItIs:
      'Everything the company keeps on a shelf: cleaning products, chemicals, equipment and consumables — what it is, who supplies it, where it is kept and how much is left.',
    steps: [
      { label: 'Add what you buy', detail: 'One row per item. Set a minimum level and the Action Centre will tell you when it runs low.' },
      { label: 'Correct the count by hand', detail: 'Change the quantity after a stock check. Every change is recorded, with who made it.' },
      { label: 'Hand things out', detail: 'An item can be marked as held by a cleaner or kept in a vehicle, with the date and its condition.' },
    ],
    warnings: [
      'The quantity does NOT go down on its own when someone takes a bottle to a job. It is what a person last wrote.',
      'A chemical with no COSHH sheet, one that has expired, and anything below its minimum all show up in the Action Centre.',
    ],
  },

  /**
   * 🆕 §35 „Vehicles" (Sesiunea 160). 🔴 Avertismentul cel mai important e despre gol: o fișă goală
   * **nu** înseamnă „e în regulă" — iar amenda vine la firmă.
   */
  '/admin/vehicles': {
    title: 'Vehicles',
    whatItIs:
      'One card per vehicle: registration, who drives it, mileage, and the three papers that expire — insurance, MOT and tax — plus the next service.',
    steps: [
      { label: 'Add the vehicle', detail: 'The registration has to be unique: two cards for the same van means two sets of expiry dates, and the wrong one is the one somebody reads.' },
      { label: 'Fill in the dates you know', detail: 'Insurance, MOT, tax and service. Leave blank only what you genuinely have not checked.' },
      { label: 'Take it off the road when needed', detail: 'A vehicle in for repair is marked, not deleted — its history stays.' },
    ],
    warnings: [
      'An empty date means "nobody has recorded it", NOT "it is fine". A blank card must never be read as a clean one.',
      'Without valid insurance, MOT and tax the van cannot legally leave — and the fine comes to the company.',
    ],
  },

  '/admin/error-log': {
    title: 'Error log',
    whatItIs:
      'Every crash the app caught, with the screen it happened on and who was using it. The app has been recording these since late July; this is the first screen that can read them.',
    steps: [
      { label: 'Read the top row first', detail: 'Errors are grouped by what went wrong and sorted by how often. The most frequent one is usually the one worth fixing, and fixing it often removes most of the list.' },
      { label: 'Two dates, not one', detail: 'Each group shows when it first happened and when it last did. "Started nine days ago and still happening" is a different problem from "happened twice in a minute".' },
      { label: 'Click a group to see every occurrence', detail: 'Each one shows the screen, the person and the browser. Technical detail is collapsed — open it only if you are sending it to somebody.' },
      { label: 'An empty screen is good news', detail: 'It means nothing has crashed on anybody. There is nothing to switch on.' },
    ],
    warnings: [
      'Reports stop being shown after 30 days. They are NOT deleted — there is no scheduled cleanup, so old rows stay hidden rather than disappearing.',
      'The live app is minified, so a stack trace often has unrecognisable names. The screen and the message are usually what locates the problem.',
      'Admin only, deliberately: an error message can incidentally contain a fragment of somebody\'s data.',
    ],
  },

  '/admin/duplicates': {
    title: 'Duplicates',
    whatItIs:
      'Records that look like the same thing twice: two customers with one email address, two cleaners '
      + 'with one phone number, the same job written twice. The screen looks and asks. It changes nothing.',
    steps: [
      { label: 'Start with "sigur" (certain)', detail: 'These rows share something that belongs to one person by definition — an email address, a phone number. They are almost always the same person.' },
      { label: '"Probabil" (likely) just needs a look', detail: 'Same name, or same name at the same postcode. Two John Smiths exist; a father and son at one house exist. Open the records and decide.' },
      { label: 'Find the record by its number', detail: 'Every row shows the visible number ("#412") — the one you search for in Customers or Jobs.' },
      { label: 'An empty screen is good news, but read the count', detail: 'It also says how many records were compared. "Nothing to check, out of 0" and "nothing, out of 4000" are very different pieces of news.' },
    ],
    warnings: [
      'Merging two records is NOT done here: it touches data and cannot be undone. Open the records and decide yourself.',
      'A cancelled job plus a new one on the same day is a RESCHEDULE, not a duplicate — which is why it does not appear here.',
      'Anonymised records (a GDPR erasure) are not compared: they deliberately lost their name, so they would all look alike.',
    ],
  },

  '/admin/audit-history': {
    title: 'Audit History',
    whatItIs: 'Who changed what, and when. Every meaningful change to money or records is recorded here.',
    steps: [
      { label: 'Use it when figures disagree', detail: 'If a number is not what you expected, this says who moved it and when — usually faster than working it out from the records.' },
    ],
  },

  /**
   * 🆕 §22 (Sesiunea 158) — ecranul de aspect, mutat aici din bara de sus.
   *
   * ⚠️ **Scris fiindcă o pază l-a cerut, nu fiindcă mi-am amintit:** `helpCoverage.test.ts` a picat
   * pe `/admin/appearance`. 🔴 Butonul „?" dispare **tăcut** fără un subiect — nu dă nicio eroare,
   * pur și simplu nu apare, iar nimeni nu raportează un buton care n-a existat.
   */
  '/admin/appearance': {
    title: 'Appearance',
    whatItIs: 'How the app looks: light or dark, and the highlight colour.',
    steps: [
      { label: 'It changes as you pick', detail: 'There is no Save button. Tap a choice and the screen changes behind the panel, so you can see it before you decide.' },
      { label: 'Per device', detail: 'This is remembered on the device you are using. Your phone and your laptop can look different, and changing one does not change the other.' },
    ],
    warnings: [
      'Only the highlight colour changes. Text and backgrounds stay readable in every combination, so nothing here can produce a screen you cannot read.',
    ],
  },

  '/admin/backup': {
    title: 'Backup',
    whatItIs: 'Download a copy of everything in the database, as a file you keep.',
    steps: [
      { label: 'Do it regularly', detail: 'Before anything big, and on a routine you can actually keep to. A backup you did not take is the one you will want.' },
    ],
    warnings: [
      'The file contains every customer\'s personal details. Keep it somewhere private — not in a shared folder or an email to yourself.',
    ],
  },

  '/admin/notifications-setup': {
    title: 'Phone Alerts',
    whatItIs: 'Turns on notifications that reach your phone even when the app is closed.',
    steps: [
      { label: 'Once per device', detail: 'Each phone or computer has to be turned on separately. Turning it on here does not turn it on for the other one.' },
    ],
  },

  '/admin': {
    title: 'Dashboard',
    whatItIs:
      'The money view. What came in, what went out, what is still owed, and how much is safe to spend once tax and NI are set aside.',
    steps: [
      { label: 'Change the period', detail: 'The buttons at the top switch between this week, this month, this quarter, the tax year and all time. Only income and expenses move with the period.' },
      { label: 'Read "Outstanding"', detail: 'Money customers still owe. It is always all-time, never period-based, because a debt does not disappear at the end of a month.' },
      { label: 'Read "Available cash"', detail: 'Profit minus the tax, NI and emergency reserves you set in Financial Settings. It answers "what can I actually spend".' },
      { label: 'Change how it looks', detail: 'The palette button at the top switches between light and dark and picks a colour. It is remembered on that device only, so your phone and your laptop can differ.' },
    ],
    warnings: [
      'The reserves are zero until you fill in Financial Settings. Until then "Available cash" is just profit, and it will look better than it is.',
      'A subscription paid in advance counts as income on the day it is marked paid, in one lump. That was your decision on 31/07/2026, and it means the month you sell a term looks unusually big.',
      'Jobs already covered by a paid subscription are NOT counted as owed — the customer paid for the whole term up front.',
    ],
  },

  '/admin/data-sharing': {
    title: 'Who We Share Data With',
    whatItIs: 'The record of everyone outside the company who receives customer or staff data — the accountant, an insurer, HMRC, a supplier — and what covers each of them.',
    steps: [
      { label: 'Two things start a row', detail: 'Who they are and what they get. Everything else can be filled in later, and the row tells you what is still missing.' },
      { label: 'Answer the contract question', detail: 'Anyone handling the data on our behalf needs a written contract. HMRC and an insurer do not — but then the reason has to be written, because that is the question you will be asked.' },
      { label: 'Answer the UK question', detail: 'If the data leaves the UK, something has to cover that transfer. The row says so in red until it is written down.' },
    ],
    warnings: [
      'Nothing was filled in for you. An empty list means nobody has written it down yet, not that no data leaves the company.',
      'The app does not check whether a contract or a safeguard is actually valid. It records what you tell it — that judgement is legal, not code.',
      'Only a full Admin can open this. It is the map of every way personal data leaves the company.',
    ],
  },

  '/admin/data-breach': {
    title: 'If Data Escapes',
    whatItIs: 'What to do if customer or staff data gets out — the steps, in the app rather than in a document nobody can find.',
    warnings: [
      'There is a clock on this. Some breaches have to be reported to the ICO within 72 hours of you becoming aware.',
      'The text here is fixed and works offline. It is a procedure to follow, not a form that records anything.',
    ],
  },

  '/admin/waiting': {
    title: 'Waiting On',
    whatItIs: 'Problems parked on purpose — not forgotten, waiting for something specific to happen.',
    steps: [
      { label: 'Every row names its trigger', detail: 'What has to happen before it becomes work again, and what breaks if nobody notices.' },
    ],
    warnings: ['Parked is not solved. These come back.'],
  },
};

