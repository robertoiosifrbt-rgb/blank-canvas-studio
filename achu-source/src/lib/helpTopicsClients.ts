/**
 * §ajutor — subiectele pentru clienții și calitatea muncii făcute pentru ei.
 *
 * ⚠️ **Ieșite din `helpContent.ts`** (Sesiunea 146): acela ajunsese la 485 de rânduri și ținea două
 * responsabilități — mecanismul (tipul, căutarea după rută) și tot textul. 🔴 Cele 12 ecrane fără
 * ajutor nu încăpeau fără să treacă pragul de 500 (`AGENT_RULES` §7.2), iar pragul nu se ridică.
 *
 * ⛔ Împărțirea urmează **secțiunile din meniu**, nu o tăietură inventată: cine caută ajutorul unui
 * ecran știe deja în ce secțiune stă el.
 */
import type { HelpTopic } from './helpTopic';

export const HELPTOPICSCLIENTS: Record<string, HelpTopic> = {
  '/admin/customers': {
    title: 'Customers',
    whatItIs: 'Everyone you clean for. Their details, their address, their jobs and what they owe.',
    steps: [
      { label: 'Add a customer', detail: 'Only the name is required. Everything else can be filled in later.' },
      { label: 'Access instructions', detail: 'Key safe codes, alarm codes, where the bins are. The cleaner sees these on their phone when the job starts.' },
      { label: 'Delete personal data (GDPR)', detail: 'If a customer asks to be forgotten, this clears their name, contact details, address and notes, while keeping the payments and invoices — you are legally required to keep those.' },
    ],
    warnings: [
      'Deleting personal data CANNOT be undone. The name and address are gone for good; only the money records remain, with no person attached.',
      'Do it only when a customer actually asks. Erasing a live customer\'s details will make their jobs unusable for the cleaners.',
    ],
  },
  /**
   * 🆕 §38 (Sesiunea 154). ⚠️ **Avertismentele spun ce NU e raportul** — cele două jumătăți nu se
   * adună, iar sumele din el sunt ce s-a TRIMIS, nu ce a intrat în cont.
   */
  '/admin/quote-funnel': {
    title: 'Enquiries and quotes',
    whatItIs:
      'How much of what comes in turns into paid work: enquiries received and how many became a job, where they came '
      + 'from, and what happened to the prices you sent out.',
    steps: [
      { label: 'The two halves are counted separately', detail: 'An enquiry can become a job with no quote written (a subscription, or a customer who rings up), and a quote can be written with no enquiry behind it. Adding them into one rate would give a figure nobody could check.' },
      { label: 'Read the source table for the public form', detail: 'It answers one question well: does the form on the website actually bring work? Anything typed in by the office shows separately.' },
      { label: '"No answer" is the row to act on', detail: 'A price nobody answered is not a refusal — it is a phone call waiting to be made, and the ones already past their date are named.' },
    ],
    warnings: [
      'Duplicated enquiries are counted separately and left out of the conversion rate: the same person twice is not a lost opportunity.',
      'The acceptance rate is accepted ÷ (accepted + rejected). Silence is not counted as a "no" — otherwise the figure would look worst in the months when the most quotes were written.',
      'The money on this screen is what was SENT and what was ACCEPTED, not what reached the bank. For money in, use the Dashboard or Payments.',
      'Source is what the app records — the public form, or an enquiry typed in by the office. Nothing here tracks which advert or referral a customer came from.',
    ],
  },


  '/admin/quote-requests': {
    title: 'New Enquiries',
    whatItIs: 'Somebody asking for a price. Every new customer who has not phoned starts here.',
    steps: [
      { label: 'Convert to a job', detail: 'Turning an enquiry into a job creates the customer at the same time. You do not need to add them first.' },
    ],
    warnings: [
      'These come from the public form on the website. If they stop arriving, check the website button still points at the app — a broken link looks exactly like a quiet week.',
      'You now get a bell notification the moment one arrives, so you do not have to keep this screen open.',
    ],
  },

  '/admin/customer-requests': {
    title: 'Client Issues',
    whatItIs: 'Reschedules, cancellations and problems raised by existing clients from their own portal. Always about a job that is already booked.',
    warnings: [
      'Nothing here changes a job by itself. A request is a message, not an instruction — you still have to move the job.',
    ],
  },

  '/admin/services': {
    title: 'Services',
    whatItIs: 'The list of services the business offers, and what the office knows about each one.',
    steps: [
      { label: 'Order on the form', detail: 'Just the position in the list — 10 shows above 20, which shows above 100. Nothing else uses this number. Leave it alone if you do not care about the order.' },
      { label: 'Priced positions', detail: 'What gets counted on a quote for that service — “Bedroom”, “2 Seat Sofa”. Open a service to add or switch them off.' },
      { label: 'Adding a position', detail: 'It appears on the quote forms and in Price Calculator straight away, but with NO rate. Set its minutes and hourly rate in Price Calculator, or quotes come back flagged instead of priced.' },
    ],
    warnings: [
      'Nothing on this screen changes what anybody is charged. Prices and minutes live in Price Calculator.',
      'A service cannot be renamed. Every past job and quote stores the name as text, so they would all stop matching — switch the old one off and add the new name.',
      'Switching a service off only takes it off new quote forms. Jobs and quotes that already use it are untouched.',
    ],
  },

  '/admin/incidents': {
    title: 'Incidents',
    whatItIs: 'Things that went wrong on a job and that the business opened itself — damage, an accident, something broken.',
    warnings: [
      'An incident is not a complaint. A complaint comes from the customer and is owed an answer; an incident is often something the customer never saw.',
      'The tick that says it was reported to an authority is put there by a person, never by the app.',
    ],
  },

  '/admin/feedback': {
    title: 'Feedback',
    whatItIs: 'What customers said about their cleans, and how the scores move over time.',
    steps: [
      { label: 'A low score stays on the list', detail: 'It clears when somebody writes that they spoke to the customer — not when it is read.' },
    ],
  },

  '/admin/quality-checks': {
    title: 'Quality Checks',
    whatItIs: 'Jobs somebody in the office has looked at on purpose — asked for one by one, or drawn at random.',
    steps: [
      { label: 'Draw a sample', detail: 'You say how many, every time. There is no percentage set anywhere: the rate is a decision somebody takes, not a number left in a file.' },
      { label: 'A failed check needs two sentences', detail: 'What was seen, and what is being done about it. “Spoke to her” is a valid answer — it just has to be written.' },
    ],
    warnings: [
      'Office only. A check never reaches the customer or the cleaner.',
      'A recorded verdict cannot be edited or deleted. If it was wrong, the next job gets a new one.',
      'A failed check does not create a re-clean. Somebody has to ask for one.',
    ],
  },

  '/admin/quality-report': {
    title: 'Quality Report',
    whatItIs: 'What the checks add up to — pass rate by service and by customer.',
    warnings: [
      'Read the coverage sentence at the top first. “94% pass” out of three jobs looked at from four hundred is an opinion about three jobs, not a fact about the business.',
      'A month nobody looked at shows as blank, not as 0%.',
      'There is no figure per cleaner here, and that is deliberate: a number about one person, shown to the office, is a statement about them.',
    ],
  },

  /**
   * 🆕 §38 (Sesiunea 155). ⚠️ **Avertismentele spun ce NU e raportul:** cele trei numărători nu se
   * adună, iar tot ce e pe ecran e ce s-a SCRIS — o reclamație primită la telefon și neconsemnată nu
   * apare în nicio cifră.
   */
  '/admin/problem-report': {
    title: 'What Went Wrong',
    whatItIs: 'Complaints, incidents and re-cleans over a period: how often each happens, why, and how they ended.',
    steps: [
      { label: 'Read “Why it happened” first', detail: 'It is the only table you can act on. “Eight quality complaints” tells you nothing; “eight, six of them rushed” tells you what to change.' },
      { label: 'Check “Approved, no job booked”', detail: 'Each one is a free re-clean already promised to a customer that nobody has put in the calendar.' },
      { label: '“We spotted it first” is the number to grow', detail: 'A re-clean the office or a quality check found is one the customer never had to ring about.' },
    ],
    warnings: [
      'The three counts do not add up to one number. One stained sofa can be a complaint, an incident AND a re-clean; a key lost on the way home is only an incident.',
      'Everything here is what was written down. A complaint taken on the phone and never recorded is in no figure, so a quiet month can also mean a quiet keyboard.',
      'Why it happened and what we did are filled in when a complaint is CLOSED, so open ones have neither. The number closed without them is shown under the tables.',
      'The incident cost is a register figure — what somebody wrote that it cost. It is not an invoice and it appears in no money screen.',
      '"Reported externally" is a tick somebody put on the dossier. It says they wrote that they reported it, not that a legal duty was met.',
      'No figure here is broken down by cleaner, deliberately: a number about one person, shown to the office, is a statement about them.',
    ],
  },

  '/admin/customer-report': {
    title: 'Customer Report',
    whatItIs: 'Who stays and who drifts away — customers over time rather than one at a time.',
  },
};

