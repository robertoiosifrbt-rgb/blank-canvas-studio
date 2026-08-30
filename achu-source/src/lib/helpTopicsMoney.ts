/**
 * §ajutor — subiectele pentru banii — încasări, cheltuieli, prețuri, facturi, setări financiare.
 *
 * ⚠️ **Ieșite din `helpContent.ts`** (Sesiunea 146): acela ajunsese la 485 de rânduri și ținea două
 * responsabilități — mecanismul (tipul, căutarea după rută) și tot textul. 🔴 Cele 12 ecrane fără
 * ajutor nu încăpeau fără să treacă pragul de 500 (`AGENT_RULES` §7.2), iar pragul nu se ridică.
 *
 * ⛔ Împărțirea urmează **secțiunile din meniu**, nu o tăietură inventată: cine caută ajutorul unui
 * ecran știe deja în ce secțiune stă el.
 */
import type { HelpTopic } from './helpTopic';

export const HELPTOPICSMONEY: Record<string, HelpTopic> = {
  '/admin/payments': {
    title: 'Payments',
    whatItIs: 'Money received and money refunded. This is where the Dashboard\'s income comes from.',
    steps: [
      { label: 'Record a payment', detail: 'Attach it to the job it pays for, so the outstanding balance on that job goes down.' },
      { label: 'Void instead of delete', detail: 'A mistake is voided, never deleted. Voided payments stop counting but stay visible, so the history stays honest.' },
    ],
    warnings: [
      'The app refuses to refund more than was received on a job. If that looks wrong, check whether an earlier refund is already recorded.',
      'A subscription paid in advance writes its own payment automatically, with no job attached. Do not add a second one by hand — you would double your own income.',
    ],
  },

  '/admin/expenses': {
    title: 'Expenses',
    whatItIs: 'What the business spends. Subtracted from income to give profit.',
    steps: [
      { label: 'Scan a receipt', detail: 'Photograph it and the app reads the supplier, date and amount. Check them before saving — it reads well, not perfectly.' },
      { label: 'Categories', detail: 'Used for the breakdown on the Dashboard. Add one only when you actually need it.' },
    ],
    warnings: [
      'The app warns if you scan the same receipt twice, by comparing the image itself. Take the warning seriously — a duplicated expense quietly lowers your profit and your tax bill, which is a problem with HMRC, not with the app.',
      'A refund to a customer is NOT an expense. It already reduces income on the Payments side; recording it here too would count the same money out twice.',
    ],
  },

  '/admin/price-calculator': {
    title: 'Price Calculator',
    whatItIs: 'Works out a quote from the service options and produces a PDF you can send.',
    steps: [
      { label: 'It is a quote, not a job', detail: 'Calculating a price changes nothing. Create the job separately when the customer says yes.' },
    ],
  },

  '/admin/invoice-settings': {
    title: 'Invoice Settings',
    whatItIs: 'Your business details as they appear on invoices, the invoice numbering, and whether you are VAT registered.',
    steps: [
      { label: 'Fill this in before the first invoice', detail: 'Each invoice freezes these details at the moment it is issued. Correcting them later does not change invoices already sent.' },
    ],
    warnings: [
      'Invoice numbers are never reused, even for a voided invoice. That is a UK requirement, not a limitation — a gap in the sequence is a question you would have to answer.',
      'Turning VAT on affects only invoices issued from that point. It does not, and must not, change old ones.',
    ],
  },

  '/admin/financial-settings': {
    title: 'Financial Settings',
    whatItIs: 'The percentages set aside from profit for tax, National Insurance and emergencies. They drive "Available cash" on the Dashboard.',
    warnings: [
      'Until these are set, "Available cash" equals profit — which will make the business look better off than it is. This is the single most useful thing to fill in before you start relying on the Dashboard.',
    ],
  },
  /**
   * 🆕 §38 (Sesiunea 154). ⚠️ **Avertismentele spun ce NU e cifra**: TVA-ul e consemnat, nu de
   * recuperat, iar totalul nu e profit.
   */
  /**
   * 🆕 §38 (Sesiunea 154). ⚠️ **Avertismentul principal explică DE CE sunt două totaluri** —
   * altfel diferența față de prima pagină se citește ca o greșeală.
   */
  '/admin/payment-report': {
    title: 'Payments and refunds',
    whatItIs:
      'What came in over a period and by what route, what went back out and why, and how much of it counts as income '
      + 'on the Dashboard.',
    steps: [
      { label: 'Read the line at the top first', detail: 'It reconciles this screen with the front page: what was recorded, and how much of it counts as income. If the two differ it says by how much and why, so you are never left guessing which figure to trust.' },
      { label: 'The refund table is the one nobody had', detail: 'Refunds grouped by the reason somebody typed. It answers "why do we give money back?" — a question the payments list could never answer, because there a refund is one row among many.' },
      { label: 'By route tells you about the bank', detail: 'Cash taken and not banked is the most common way money goes missing in a cleaning business. This is where a growing cash share shows up.' },
    ],
    warnings: [
      'Two totals, deliberately: RECORDED and COUNTS AS INCOME. Money taken against a job that carries no charge yet (an enquiry) is real money and appears here, but the Dashboard only counts what the business has actually charged for. Both are correct — they answer different questions, and the top line names the difference.',
      'A payment counts in the month it was PAID, not the month it was typed in. A payment with no date at all is left out here, exactly as it is on the Dashboard.',
      'Voided payments are left out — a voided payment is a correction, not money that moved.',
      'Refund reasons are what somebody typed. Refunds made before the reason became mandatory have none, and are counted as "no reason recorded" rather than guessed at.',
      'This is money in and money back out — not profit. Costs are not in it.',
    ],
  },

  '/admin/expense-report': {
    title: 'Spend by category',
    whatItIs:
      'Where the money went over a period — by category and by supplier — and how much of it has no receipt attached.',
    steps: [
      { label: 'Read the receipt line at the top first', detail: 'It is the only figure on this screen you can still fix. A cost with no receipt cannot be justified at an inspection, and looking for it now is much easier than looking for it in a year.' },
      { label: 'Then the category table', detail: 'Biggest first. It answers "where does the money actually go", which is the question behind every price decision.' },
      { label: 'The supplier table is for negotiating', detail: 'One supplier taking a large share of the spend is either a good relationship or a price nobody has checked in a while.' },
    ],
    warnings: [
      'VAT here is what was RECORDED from receipts, not VAT you can reclaim. Whether any of it is reclaimable depends on whether the business is VAT registered — a question for you and the accountant, not something the app decides. The screen also says on how many rows a VAT figure was read: without that, "£0" looks like a business with no VAT rather than receipts nobody has read.',
      'This is money OUT only. It is not profit: overheads are deliberately not spread across individual jobs (the profitability report explains why).',
      'Voided expenses are left out — a correction is not money spent. The total here should match the Dashboard total for the same period; if it ever does not, one of the two is wrong and it is worth saying so.',
      'The receipt figure counts the FILE, not the "receipt available" tick. The tick says somebody believes a receipt exists somewhere; only an attached file can be shown to anybody.',
    ],
  },


  '/admin/time-variance': {
    title: 'Sold time vs worked time',
    whatItIs:
      'A price here is built from a number of minutes. This says whether the work actually fits in them — so a service you consistently sell short stops being invisible.',
    steps: [
      { label: 'Read the service table first', detail: 'One job running late is noise. A service running over on every job is a price that is too low, and that is the row worth acting on.' },
      { label: 'Positive means it took longer than you sold', detail: 'So the price is short by roughly the same proportion. +20% on a service means every job of that kind is priced about a fifth under what the work costs in time.' },
      { label: 'Check the coverage line at the top', detail: 'A job can only be compared if it has BOTH a final price quote and approved hours on its timesheet. If only a few qualify, the figures describe those few, not the business.' },
    ],
    warnings: [
      'The estimate is the minutes the PRICE was built from, not the times on the schedule. Those are different things: a quote and a timesheet are both LABOUR minutes, while a scheduled window is elapsed time — on a job worked by two people the two differ by half.',
      'Jobs quoted at under 30 minutes are counted but left out of the percentages. A 15-minute job running 8 minutes over is +53%, which would sit at the top of the list and mean nothing.',
      'Only APPROVED hours count. Hours waiting to be approved are excluded, so a period where nobody has approved anything will show nothing to compare.',
    ],
  },

  /**
   * §24 (Sesiunea 153). ⚠️ Avertismentul spune ce NU e în raport, fiindcă acolo se poate greși citind:
   * totalul nu e toată datoria firmei cât timp facturile de termen nu se pot îmbătrâni.
   */
  '/admin/aged-receivables': {
    title: 'Money owed',
    whatItIs: 'Invoices that are past their due date and still not paid, grouped by how long they have been overdue.',
    warnings: [
      'The age is counted from the due date written on the invoice, not from the day it was sent.',
      'Invoices for a prepaid term are listed separately and not counted: a payment is recorded against a job, not against an invoice, so the app cannot tell which term a payment settles.',
    ],
  },
  /**
   * §26 (Sesiunea 154) — ecranul are acum trei întrebări, nu una, iar pașii spun în ce ordine se
   * citesc. ⚠️ Avertismentul despre „sub estimare" e aici fiindcă exact acolo se citește greșit:
   * arată ca un câștig și poate fi o vizită făcută în grabă sau ore neaprobate.
   */
  /**
   * §26 (Sesiunea 154). 🔴 Avertismentul cel mai important e ce ecranul NU spune: cât din facturile
   * lunii a fost plătit. ⚠️ Iar „care bază" e o întrebare pentru contabil, nu o hotărâre a codului.
   */
  '/admin/monthly-summary': {
    title: 'Monthly summary',
    whatItIs:
      'Month by month, on both bases at once: what was invoiced, and what money actually moved. The two are different questions and both answers are right.',
    steps: [
      { label: 'Read the sentence at the top first', detail: 'It names the difference between the two figures and why it exists. Without it, two different totals for the same month look like one of them is wrong.' },
      { label: '"Invoiced" counts the work when the invoice is issued', detail: 'So a clean done in July and invoiced in July sits in July, even if the money arrives in August.' },
      { label: '"Money in" counts it when it arrives', detail: 'Net of refunds. A payment counts in the month it was PAID, not the month somebody typed it in.' },
      { label: 'Read the month table for the lag', detail: 'A month with a lot invoiced and little in is a customer paying late. The period total hides that; the monthly rows do not.' },
      { label: '"Export for accountant" is the whole table', detail: 'Month by month on both bases, plus a total row and the VAT recorded. It is a POST, and it is written into the audit log, because the file leaves the business.' },
    ],
    warnings: [
      'The app does NOT decide which payment settles which invoice: a payment is recorded against a JOB, not against an invoice. So "how much of this month\'s invoices has been paid" is a question this screen deliberately does not answer, rather than answering it with a guess.',
      'Which basis your accounts are prepared on is a question for your accountant. The app shows both and chooses neither.',
      '"Cash movement" is money in minus money out for the month. It is NOT profit: it ignores work done and not yet paid for, and costs incurred and not yet paid.',
      'VAT here is what was written on invoices and read off receipts, not VAT owed or reclaimable — that depends on whether the business is VAT registered.',
      'Voided invoices and voided payments are left out of both columns. A correction is not work done and not money moved.',
    ],
  },
  '/admin/profitability': {
    title: 'Profitability',
    whatItIs: 'What each job, customer and cleaner actually earns you, once the cost of the work is taken off.',
    steps: [
      { label: 'Read the labour panel at the top first', detail: 'Labour is the biggest cost in cleaning. If it is not recorded, every margin below it is too high — the panel says so in those words, and says how to fix it.' },
      { label: '"What an hour of work leaves" is the pricing figure', detail: 'Two jobs with the same margin are not the same business if one takes twice as long. The hour is the scarce thing, not the pound.' },
      { label: '"Against the price we sold" is the one that changes a price', detail: 'A service that consistently comes in under what it was sold for is priced wrong, and that is fixed once on the price list rather than job by job.' },
      { label: 'Then the breakdowns', detail: 'By property answers "which of this customer\'s houses is the bad one"; by booking source answers "where do the good jobs come from".' },
    ],
    warnings: [
      'It is only as good as the figures behind it. If cleaner pay or expenses are not being recorded, this will show a profit you are not making.',
      'A coverage line sits beside every average, and it matters: an average over three jobs out of ninety looks exactly like an average over all of them.',
      'A job that came in UNDER its estimate is not money in the bank. It may have been rushed, or its hours may not all be approved yet — read it as a pricing signal, not a profit.',
      'Only APPROVED hours are costed and counted. Draft hours are somebody\'s claim, and costing them would move a margin on a figure nobody has agreed.',
      'The money half of "estimated versus actual" and the time half on Sold time vs worked time use the SAME estimate — the minutes the price was built from. If the two screens ever disagree, one of them is wrong.',
    ],
  },
};

