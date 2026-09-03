/**
 * §ajutor — subiectele pentru ce e de făcut azi și munca programată — Today și Work din meniu.
 *
 * ⚠️ **Ieșite din `helpContent.ts`** (Sesiunea 146): acela ajunsese la 485 de rânduri și ținea două
 * responsabilități — mecanismul (tipul, căutarea după rută) și tot textul. 🔴 Cele 12 ecrane fără
 * ajutor nu încăpeau fără să treacă pragul de 500 (`AGENT_RULES` §7.2), iar pragul nu se ridică.
 *
 * ⛔ Împărțirea urmează **secțiunile din meniu**, nu o tăietură inventată: cine caută ajutorul unui
 * ecran știe deja în ce secțiune stă el.
 */
import type { HelpTopic } from './helpTopic';

export const HELPTOPICSWORK: Record<string, HelpTopic> = {
  '/admin/action-centre': {
    title: 'Action Centre',
    whatItIs:
      'Everything that needs a human, in one place: jobs not started, completions waiting for your approval, unpaid work, new enquiries.',
    steps: [
      { label: 'Work top to bottom', detail: 'Each card is a count. Open it to see the list, and click any row to jump straight to that job, payment or expense.' },
      { label: 'Approve completions', detail: 'A cleaner marking a job finished does not finish it. It waits here for you.' },
    ],
    warnings: [
      '"Not started" uses London time, not your phone\'s. If you are abroad, a job can look late when it is not.',
    ],
  },

  /**
   * 🆕 §38 (Sesiunea 154). ⚠️ **Avertismentele spun ce NU e raportul**, fiindcă acolo se poate greși
   * citind: nu e „Sold vs Worked Time" (minute de muncă), și nu e o cifră de plată.
   */
  '/admin/schedule-accuracy': {
    title: 'Booked window vs actual',
    whatItIs:
      'Whether a job written as two hours takes two hours. It compares the window you booked on the job with the '
      + 'app\'s own start and finish stamps.',
    steps: [
      { label: 'Read the service table first', detail: 'One job running late is traffic or a chatty customer. A service that never fits its window is a window written wrong — and that one costs you a slot in the calendar every time you book it.' },
      { label: 'Both directions matter', detail: 'A job booked for two hours and finished in forty minutes is either a window written too wide or a clean done in a hurry. The list shows the biggest gaps either way.' },
      { label: 'Check the coverage line at the top', detail: 'A job can only be compared if it has BOTH a booked window and start/finish stamps. If only a few qualify, the figures describe those few.' },
    ],
    warnings: [
      'This is NOT "Sold vs Worked Time". That one compares the minutes the PRICE was built from against approved timesheet hours — labour minutes. This one is elapsed time. A job worked by two people is 60 elapsed minutes and 120 labour minutes, so the two answer different questions and must not be compared with each other.',
      'Nobody is paid from this figure. Paid hours are the approved timesheet, always.',
      'Only jobs marked Completed are read, and a job stamped on a different day than its own date is left out: somebody moved the status later, so subtracting the clock times would invent a delay that did not happen.',
      'Jobs booked for under 30 minutes are counted in the minutes but kept out of the percentages: a 20-minute job running 10 minutes over is +50%, which would top the list and mean nothing.',
    ],
  },

  /**
   * 🆕 §38 (Sesiunea 155). ⚠️ **Avertismentele spun ce NU e raportul:** niciun ban în el, niciun motiv
   * de anulare (nu există câmpul), și nicio măsură de capacitate — nimic nu consemnează cine e liber când.
   */
  '/admin/jobs-report': {
    title: 'Jobs Report',
    whatItIs: 'How much work was in the diary over a period and what happened to it: done, cancelled, or nobody could get in.',
    steps: [
      { label: 'Start with "Did not happen"', detail: 'Cancelled plus no access, as a share of the diary. It is the number you can do something about.' },
      { label: '"No access" is its own figure', detail: 'Somebody travelled and could not get in — a key, a code or a wrong time. A different fix from a cancellation.' },
    ],
    warnings: [
      'No money on this screen, deliberately. Use Profitability, Monthly summary or the Dashboard: each has its own rule for what counts, and a total here would be a fourth answer.',
      'Nothing records WHY a job was cancelled, so the report can count cancellations but cannot break them down.',
      'The day-of-week table is DEMAND, not capacity. Nothing records who is available when, so no figure here means "we were full".',
    ],
  },

  '/admin/jobs': {
    title: 'Jobs',
    whatItIs: 'Every clean, past and future. Who, where, when, how much, and what state it is in.',
    steps: [
      { label: 'Statuses', detail: 'Enquiry, Booked, Confirmed, In Progress, Completion Review, Completed, Cancelled, No Access. Only Completed counts as income.' },
      { label: 'Amount Charged', detail: 'What the customer pays for this job. Leave it empty for an enquiry — a job with no amount is not counted as owed.' },
      { label: 'Invoice a job', detail: 'The invoice button issues a real, numbered invoice. See Invoice Settings for the numbering.' },
    ],
    warnings: [
      'A job covered by a paid subscription CANNOT be invoiced on its own — the customer already paid for the whole term. The app refuses it and says which subscription.',
      'Cancelled and No Access jobs still count as owed if they carry an amount. That is deliberate: a late cancellation you still charge for is still money.',
    ],
  },

  '/admin/subscriptions': {
    title: 'Subscriptions',
    whatItIs:
      'A prepaid term of cleaning at a discount: the customer pays for 3, 6 or 12 months up front, and the jobs come from a recurring contract you have already set up.',
    steps: [
      { label: 'The contract comes first', detail: 'A subscription is money laid over a recurring contract. If the contract does not exist yet, build it in Recurring Contracts first — a term with nothing behind it would never produce a job.' },
      { label: 'Preview before you sell', detail: 'Type the term, the full price per job and the discount. The figures you will quote appear before anything is saved. Nothing is stored until you press Save.' },
      { label: 'The four stages', detail: 'Draft (still deciding) → Awaiting Payment (you have asked for the money) → Active (the money arrived) → Completed (the term ran out).' },
      { label: 'Raise the invoice', detail: 'One invoice for the whole term, at the discounted total. You can raise it before the money arrives — that is the normal way round.' },
      { label: 'Cancelling', detail: 'The refund is what they paid, minus the jobs already done charged at the FULL price. The customer loses the discount. That is your rule, and the sentence on screen is the one to read out on the phone.' },
    ],
    warnings: [
      '"End the term" CANNOT be undone. A Completed term cannot be reopened or cancelled. Press it only when the term has genuinely run out — not to tidy the list.',
      'A Draft or Awaiting Payment term does NOT protect its jobs. They are invoiced as normal, because nobody has paid yet. Only mark it Active when the money is really in.',
      'Marking a term Active records the whole amount as income that day, and stops its jobs counting as owed. Both happen automatically — do not also record a payment by hand.',
    ],
  },

  '/admin/recurring': {
    title: 'Recurring Contracts',
    whatItIs: 'A repeating schedule — every week, every fortnight, monthly — that creates the jobs by itself.',
    steps: [
      { label: 'Read the sentence', detail: 'Under the settings there is a plain sentence: "This means: Every other week (fortnightly), on Tuesday". It updates as you type. If that sentence is not what you meant, the settings are wrong.' },
      { label: 'Jobs appear ahead of time', detail: 'The app creates jobs for the coming weeks, not for the whole year at once. More appear as time passes.' },
    ],
    warnings: [
      'Changing the price on a contract does NOT change jobs already created. Existing jobs keep the price they were made with — deliberately, so a price rise cannot silently rewrite what a customer was already told.',
    ],
  },

  '/admin/calendar': {
    title: 'Calendar',
    whatItIs:
      'Everything that happens on a date — jobs, payments, invoices falling due, expenses, and prepaid terms running out.',
    steps: [
      { label: 'Switch the layers off', detail: 'The coloured buttons at the top turn each kind of event on and off. Turn expenses off to see a clean week of work.' },
      { label: 'Click anything', detail: 'Every entry opens the record behind it — the job, the payment, the subscription.' },
      { label: 'Calendar or Schedule?', detail: 'Calendar answers "what happens on the 14th". Schedule answers "who is working when, and is anyone double-booked". Different questions, same data.' },
    ],
    warnings: [
      'Watch the amber "Terms ending" entries. A prepaid subscription simply stops when its term runs out — nothing chases it, and the first sign of a missed renewal is a customer asking why nobody came. Ring them before the date, not after.',
    ],
  },

  '/admin/schedule': {
    title: 'Schedule',
    whatItIs: 'Who is working when. Built to show the two things a list of jobs cannot: double-bookings and idle gaps in a cleaner\'s day.',
    steps: [
      { label: 'Spot the gaps', detail: 'Jobs with no cleaner assigned are the ones that will go wrong. They are what this screen is for.' },
      { label: 'For everything else, use Calendar', detail: 'Payments, invoices and expenses are not here on purpose — they have no cleaner and no hours, so they cannot clash with anything. They are on the Calendar screen.' },
    ],
    warnings: [
      'A job with no times cannot be part of a clash — it still appears, at the end of the day. That is deliberate: treating a missing time as midnight would invent overlaps that do not exist.',
    ],
  },

  '/admin/dispatch': {
    title: 'Dispatch Sheet',
    whatItIs: 'The day\'s work, printable — who goes where, at what time, with the access instructions.',
    warnings: [
      'It contains key safe and alarm codes. Do not leave a printed copy in a van or a customer\'s house.',
    ],
  },

  '/admin/tasks': {
    title: 'Tasks',
    whatItIs: 'Things a person decided somebody should do. Action Centre shows what the data says is wrong; this shows what someone asked for.',
    steps: [
      { label: 'It does not clear itself', detail: 'A task stays until a person closes it. Nothing in the app finishes one for you.' },
    ],
  },

  '/admin/re-cleans': {
    title: 'Re-cleans',
    whatItIs: 'Requests to go back and redo a clean, and the decision on each one.',
    steps: [
      { label: 'A refusal needs a reason', detail: 'Saying no without words is the same as ignoring it — whoever speaks to the customer needs to know what to tell them.' },
    ],
    warnings: [
      'A free re-clean is at your discretion, not a promise. Nothing here creates one automatically, and no screen tells the customer they are entitled to it.',
      'The cleaner is paid for a re-clean like any other job.',
    ],
  },
};

