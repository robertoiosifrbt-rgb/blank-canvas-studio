/**
 * §ajutor — subiectele pentru oamenii — curățători, ore, absențe, conturi, salarii.
 *
 * ⚠️ **Ieșite din `helpContent.ts`** (Sesiunea 146): acela ajunsese la 485 de rânduri și ținea două
 * responsabilități — mecanismul (tipul, căutarea după rută) și tot textul. 🔴 Cele 12 ecrane fără
 * ajutor nu încăpeau fără să treacă pragul de 500 (`AGENT_RULES` §7.2), iar pragul nu se ridică.
 *
 * ⛔ Împărțirea urmează **secțiunile din meniu**, nu o tăietură inventată: cine caută ajutorul unui
 * ecran știe deja în ce secțiune stă el.
 */
import type { HelpTopic } from './helpTopic';

export const HELPTOPICSTEAM: Record<string, HelpTopic> = {
  /**
   * §26 „Profit by team" B (Sesiunea 154). 🔴 Cele două avertismente sunt exact cele două hotărâri
   * ale owner-ului din 24/08 — și amândouă pot surprinde pe cineva care nu a fost la discuție.
   */
  '/admin/teams': {
    title: 'Teams',
    whatItIs:
      'Fixed teams, so the profitability report can be read by team as well as by person. A cleaner belongs to one team, set on their own record.',
    steps: [
      { label: 'Add the team here first', detail: 'Just a name. Then open each cleaner under Team → Cleaners and pick their team on their record.' },
      { label: 'Read it on Money → Profitability', detail: 'The "By team" table appears once anybody has a team. Worst margin first, like every other breakdown there.' },
      { label: 'Rename freely', detail: 'A rename is recorded in the audit history, and nothing else changes — the reports follow the team, not its name.' },
    ],
    warnings: [
      'Reports read whoever is in the team NOW. Moving somebody to another team today also changes what last month looks like — that was a deliberate choice, because the alternative (freezing the team onto every job) is more machinery for a question nobody had yet.',
      'A team is never deleted, only made inactive. Deleting one would quietly empty the older reports that read it, and a figure that disappears is not something you notice.',
      'A job worked by people from two different teams is counted in FULL under each — same as the by-cleaner table. Splitting it would invent a share nobody chose, so the screen says when the rows add up to more than the period total.',
      'A team with nobody in it will have no row in the report at all. The people count on this screen is there so an empty team does not look like a broken report.',
    ],
  },
  '/admin/cleaners': {
    title: 'Cleaners',
    whatItIs: 'Your staff. Each cleaner needs a record here AND a user account before they can log in.',
    steps: [
      { label: 'Two things, not one', detail: 'The cleaner profile is who they are. The user account is how they log in. Both are needed, and they must be linked.' },
      { label: 'Active', detail: 'Turning Active off blocks their access immediately, without deleting their history.' },
      /**
       * 🆕 §33 + §14 (Sesiunea 146) — registrul de hârtii, în fișa omului. ⚠️ Cele două avertismente
       * de jos sunt jumătatea care ține registrul onest: ce NU spune, și ce NU face.
       */
      { label: 'Documents', detail: 'Open a cleaner to record their paperwork — right to work, ID, DBS, insurance, training. Each one can carry a valid-from and a runs-out date, and somebody in the office marks it checked or rejected.' },
      { label: 'Leave a date empty if you do not know it', detail: 'Some documents have no end date at all. A made-up date is worse than a blank one — it would sit in the list looking checked.' },
    ],
    warnings: [
      'A cleaner with a profile but no linked account cannot log in, and the error they see does not say why. If someone cannot get in, check the link first.',
      'The document list is a record of what was handed in and checked — not a statement that somebody is cleared to work. Nobody has set which documents are required, so nothing counts what is missing.',
      'Nothing here stops a cleaner being put on a job, even with an out-of-date document. That would be an operating rule, and nobody has asked for one.',
      'Changing the kind or the dates on a document that was already checked clears the verification — whoever checked it did not check that.',
    ],
  },

  '/admin/users': {
    title: 'User Accounts',
    whatItIs: 'Who can log in, and as what: Admin, Cleaner or Customer.',
    steps: [
      { label: 'Roles decide everything', detail: 'A role controls which part of the app someone sees. There is no partial access — a Cleaner cannot see money, an Admin sees everything.' },
    ],
    warnings: [
      'Do not change your own role. You would lock yourself out of the Admin area, and only another Admin could put it back.',
    ],
  },

  '/admin/payroll-people': {
    title: 'Employee pay details',
    whatItIs:
      'Tax code, National Insurance letter, wage and pension for each person — so the salary simulator stops asking for them every time.',
    steps: [
      { label: 'Whatever HMRC issued', detail: 'The app applies the tax code you enter. It never works one out, and it refuses a code it cannot read rather than guessing.' },
      { label: 'Hourly or salaried, not both', detail: 'Filling one clears the other. Contracted hours are used with an hourly rate to work out a period\'s pay.' },
      { label: 'Date of birth', detail: 'Sets which minimum wage applies — it is banded by age, and the underpayment warning is measured against it.' },
    ],
    warnings: [
      'These details feed the simulator only. Nothing is sent to HMRC and nobody is paid from them.',
      'There is no National Insurance number field, on purpose. That is the one thing you cannot report to HMRC without, so it belongs to the separate decision about real payroll — not to a calculator.',
    ],
  },

  '/admin/timesheets': {
    title: 'Timesheets',
    whatItIs:
      'The hours somebody actually worked. An hourly wage should be worked out from these, not from the hours in their contract — the two are rarely the same in cleaning.',
    steps: [
      { label: 'Pick the person and the period', detail: '"Suggest the period" fills in a window based on how they are paid. It is only a suggestion: the app has no pay calendar yet, so both dates stay editable.' },
      { label: 'Check what the jobs already say', detail: 'Jobs marked done carry the times the app stamped when their status changed. Those appear as suggestions you confirm one at a time — never added for you, because a stamp belongs to the job and a job may have had two people on it.' },
      { label: 'Approve before paying', detail: 'Recorded hours count for nothing until approved. Only approved hours produce a gross figure, and the approval records who agreed it and when.' },
      { label: 'Dispute instead of deleting', detail: 'If the hours look wrong, mark them disputed with a reason. That keeps the disagreement on the record rather than making it disappear.' },
    ],
    warnings: [
      'Holiday accrues on top of these hours at 12.07% — a legal entitlement for people with irregular hours, not an extra. The figure is shown with the totals; the gross does NOT already include it.',
      'Approved hours cannot be edited or deleted. Reopen the entry first, so a change to a figure somebody agreed to is recorded as a decision rather than an edit.',
      'Cleaners cannot enter their own hours yet — the office records them. Clocking in from the cleaner portal is a separate piece of work.',
    ],
  },

  '/admin/leave': {
    title: 'Holiday and leave',
    whatItIs:
      'What holiday somebody has built up this leave year, what they have taken, and what is left. The entitlement comes from the hours on their timesheets — 12.07% of them — so this screen and Timesheets are the same subject read from opposite ends.',
    steps: [
      { label: 'The leave year runs 6 April to 5 April', detail: 'Your decision of 31 July 2026. The screen opens on the current one; the buttons switch year in one click. It is not taken from the tax year — they match because that is what you chose.' },
      { label: 'Four figures, not two', detail: '"Taken" is holiday already had; "Approved for later" is promised but not yet taken. Both come off the balance. A request nobody has decided is shown separately and does NOT come off — asking is not the same as being granted.' },
      { label: 'Approve or decline, do not leave it sitting', detail: 'While a request is undecided the balance does not reflect it, so two people can both be told there is room. Declining asks for a reason, which the person is entitled to know.' },
      { label: 'Hours, not days', detail: 'A day off is not a fixed number of hours for somebody whose hours vary, and the entitlement it comes out of is measured in hours. Enter what the day was worth to them.' },
      { label: 'Read an amber warning before anything else', detail: 'If somebody has a settled weekly contract recorded, the screen compares 5.6 weeks of that week against what has accrued. A shortfall may mean an underpayment — see the warnings below.' },
    ],
    warnings: [
      'The figure grows all year — it is not a fixed allowance handed out on 6 April. For irregular hours, holiday is EARNED at 12.07% of hours worked, so "left" in April is small and means nothing is wrong.',
      '⚠️ If a person has a settled contracted week on their pay details, 12.07% may be the WRONG method for them: a settled pattern entitles them to 5.6 weeks of that week whether the hours are worked or not. The screen shows both figures and says so — do not pay the lower one without checking which describes them.',
      'EVERYTHING carries into the next leave year and nothing ever expires — your rule of 31 July 2026. That is more generous than the legal minimum, which is allowed: the law limits what a worker can insist on carrying, not what you may choose to give. Hours brought forward are shown as their own figure and are already included in what is left.',
      '⚠️ The cost of carrying, since nothing is lost: untaken holiday is money the business owes, and hours that keep rolling forward have to be paid eventually — as time off, or in cash when somebody leaves. That is why the screen warns when a person is behind on taking theirs. Acting in October is cheaper than discovering it in March.',
      'Holiday earned before the app started keeping timesheets (July 2026) is NOT in the brought-forward figure. If somebody had holiday owing from before then, it has to be recorded by hand.',
      'Only APPROVED timesheet hours build up entitlement. If a balance looks too low, the usual cause is a timesheet waiting to be approved, not a fault here.',
      '"Left" can go below zero, and that is not an error: holiday taken early in a year is real, and the entitlement for the rest of it has not been earned yet.',
      'Approved leave cannot be edited or deleted — cancel it instead. The person may already have arranged their life around the dates, and cancelling keeps the decision on the record.',
      'Sick leave is deliberately not here. Statutory sick pay has its own eligibility rules and waiting days, and recording it as ordinary leave would quietly get them wrong.',
      'Unpaid leave is recorded but spends no holiday entitlement, so it is reported apart from the balance.',
      'Typing your own dates instead of using the year buttons gives a figure for that window only. The screen labels it "Custom dates" and refuses to call it an entitlement.',
    ],
  },

  '/admin/sickness': {
    title: 'Sickness and sick pay',
    whatItIs:
      'Who has been off ill, and what Statutory Sick Pay it comes to. Kept apart from Holiday & Leave on purpose: being ill does not spend somebody\'s holiday.',
    steps: [
      { label: 'Say which days they normally work', detail: 'Sick pay is per working day, and it is not assumed. Somebody on three days a week gets a third of the weekly rate per day, not a fifth — and Monday–Friday would pay the wrong number of days to anybody who works weekends.' },
      { label: 'Read the figure before you save', detail: 'The form shows what the absence is worth as you fill it in, including when the answer is nothing. That is deliberate — a short absence really is worth £0, and it is better to see that now than to be asked about it later.' },
      { label: 'Leave it open if they are still off', detail: 'Sickness is not booked in advance. Tick "still off", and close the spell with the last day when they are back. The figure is worked out again then.' },
      { label: 'Record the return to work', detail: 'Not a legal requirement, but it is the record that shows somebody asked how they were. Ended spells with no conversation recorded are counted at the top.' },
    ],
    warnings: [
      '✅ Settled on 1 August 2026, from the gov.uk rates page you sent: there are NO waiting days for 2026/27 — sick pay runs from the first working day — and there is no minimum-earnings test either, because the 80% rule handles low earners instead of excluding them. Both had been flagged as unconfirmed for a few hours; they are now correct in the app.',
      '⚠️ One rule is still worth confirming: whether an absence must still last four or more days before any sick pay is due. The rates page says nothing about it. The app keeps the four-day rule — and if it has been removed, keeping it means WITHHOLDING pay for every short absence. If it has stayed and we dropped it, we would just pay slightly more than we must. One line from the Statutory Sick Pay guidance settles it.',
      'As it stands, nothing is paid for an absence under four days in a row. Weekends count towards the four, so Friday to Monday qualifies even for somebody who works neither weekend day.',
      'SSP stops after 28 weeks in one illness. Two absences 8 weeks apart or less count as the SAME illness, so the waiting days are not served twice and the 28-week clock keeps running.',
      'Company sick pay — anything above the legal minimum — is a decision, not a calculation. The app cannot work it out because there is no rule to work it out from. A blank field means nobody has decided; a zero means somebody decided nothing is paid.',
      'A fit note is health data, the most sensitive kind there is. Only the file path is stored, the bucket is private, and the file name is deliberately kept out of the audit log — a file name can carry somebody\'s name and their diagnosis.',
      'Records are cancelled, never deleted, and there is no delete button on purpose. An absence is something somebody acted on; deleting it would hide that it ever happened.',
      'Admin only, deliberately. Sickness records and fit notes are not readable by the team.',
    ],
  },

  '/admin/family-leave': {
    title: 'Family leave',
    whatItIs:
      'Maternity, paternity, adoption, shared parental, bereavement and neonatal care — what is owed, and what HMRC gives back. Kept apart from Sickness and from Holiday because the three payments share no rules at all.',
    steps: [
      { label: 'Pick the type first', detail: 'It sets the number of weeks and the rate. Maternity and adoption pay the first six weeks differently from the rest; everything else has one rate.' },
      { label: 'Read the figure before you save', detail: 'The form prices the leave as you fill it in, with the two rates shown separately, and tells you what can be recovered from HMRC.' },
      { label: 'If it refuses, fix the earnings first', detail: 'The pay is worked out from the average of the eight weeks before the leave starts. No hourly rate on the pay profile, or no approved timesheets in that window, means there is nothing to take 90% of — the form says which.' },
      { label: 'End the record when they return', detail: 'This closes it. The pay already worked out is not recalculated: it is what was paid.' },
    ],
    warnings: [
      '⚠️ The first SIX weeks of maternity and adoption pay are 90% of earnings with NO CAP. On £400 a week that is £360, not £194.32 — and applying the cap there would underpay somebody by £165.68 a week for six weeks, in the six weeks a new parent most needs the money.',
      '⚠️ 90% here, but 80% for sick pay. The two figures sit next to each other on the same gov.uk page and are easy to swap.',
      '⚠️ HMRC pays back 109% — MORE than you paid out. That is not a mistake in the app: the extra 9% covers the employer\'s National Insurance on the payment. It drops to 92% if your total Class 1 NI last year was above £45,000.',
      'The recovery figure is what you COULD claim, not what you have claimed. Claiming it happens in a submission to HMRC, which this app does not do yet.',
      'Somebody earning below £129 a week is probably not entitled to statutory family pay at all. The screen still shows what it would be, and warns — do not claim recovery on it without checking.',
      'Whether the person qualifies has NOT been checked. Most family payments need 26 weeks of continuous employment, and the app has not verified that rule against a source yet.',
      'The number of weeks each type lasts is not verified either. They are used as a limit with a warning rather than filled in for you, so a wrong figure cannot quietly pay anybody.',
      'Unpaid parental leave and time off for dependants carry no statutory pay. That is the law, not a gap in the app — and anything you choose to pay is a company decision, like company sick pay.',
      'Records are cancelled, never deleted. Family leave gets planned around, so hiding that a record existed would be worse than keeping it.',
      'Admin only, deliberately. A pregnancy is not team-readable.',
    ],
  },

  '/admin/payroll-simulator': {
    title: 'Salary Simulator',
    whatItIs:
      'Works out take-home pay, tax, National Insurance, pension and holiday for a wage — so you can see what an employee really costs before you hire.',
    steps: [
      { label: 'It calculates, it does not report', detail: 'Nothing is sent to HMRC and no payslip is saved. It is a calculator.' },
      { label: 'Check the figures panel', detail: 'It lists every rate in use and who confirmed it against the official page, so you never have to take a number on trust.' },
    ],
    warnings: [
      'Paying real people from this is NOT enough. UK payroll must be reported to HMRC at EVERY payment, with pension auto-enrolment and holiday tracking. That is a separate decision and a separate piece of work.',
      'Statutory sick pay, maternity pay, student loans and mileage are NOT calculated. The screen lists what is missing — read it before trusting a total for a real person.',
    ],
  },

  '/admin/chat': {
    title: 'Chat',
    whatItIs: 'Internal messages between you and the cleaners. Not visible to customers.',
    warnings: [
      'Messages refresh every few seconds, not instantly. For something urgent, phone.',
    ],
  },

  '/admin/invitations': {
    title: 'Invitations',
    whatItIs:
      'How a new cleaner or admin gets an account: you send an invitation, they sign in with their ' +
      'email, and accepting the invitation gives them the role.',
    warnings: [
      'An invitation link is as good as the account itself until it is used. Send it to the person, not to a shared inbox.',
      // 🔴 ACHU-801 — propoziția de deasupra spunea „they set their own password". Aplicația NU are
      // parole: intrarea e link pe email sau Google. Deci biroul îi promitea omului un câmp care nu
      // există, iar omul îl căuta.
      // ⚠️ Avertismentul de mai jos e ADEVĂRATA capcană, măsurată în `backend/src/routes/invitations.ts`
      // (`POST /accept`): invitația se acceptă doar de pe **exact** adresa invitată. ⛔ Deschiderea
      // linkului fără a fi intrat NU e o problemă — `LoginPage` întoarce omul pe aceeași adresă.
      'They must sign in with the same email address the invitation was sent to. Signing in with another address — a personal Google account, for example — will refuse the invitation.',
    ],
  },

  '/admin/payroll-runs': {
    title: 'Payroll Runs',
    whatItIs: 'A pay period with everybody in it — the office record of what it decided to pay.',
    steps: [
      { label: 'Draft, then approved', detail: 'A draft can be changed. Approving one is the point at which the figures stop moving.' },
    ],
    warnings: [
      'Only approved hours are paid. Anything still waiting in Timesheets on payday does not go out.',
      'Nothing here is sent to HMRC. Reporting is a separate step that needs credentials nobody has entered yet.',
    ],
  },

  '/admin/payroll-reports': {
    title: 'Payroll Reports',
    whatItIs: 'What the runs add up to — totals across pay periods rather than one person at a time.',
  },
};

