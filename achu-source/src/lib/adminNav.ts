/**
 * §48 „Consistent terminology / page titles" (Sesiunea 148) — **MENIUL, ÎNTR-UN SINGUR LOC.**
 *
 * ⛔ **Mutat din `AdminLayout.tsx`, și nu ca refactorizare de dragul curățeniei** — modularizarea e
 * OPRITĂ (Roberto, 15/08). Motivul e o funcționalitate: titlul din tab-ul browserului trebuie să
 * spună **exact** cuvântul din meniu (`lib/pageTitle.ts`), iar pentru asta lista trebuie citită și
 * din afara componentei. ⛔ Exportată dintr-un `.tsx` de componentă, ar fi picat lintul
 * (`react-refresh/only-export-components`) — și pe bună dreptate: nu e o componentă, e o hartă.
 *
 * ⚠️ **Conținutul e mutat verbatim**, cu toate motivele scrise pe rânduri: fiecare grup și fiecare
 * link poartă istoria deciziei care l-a pus acolo. 🔴 A doua sursă de adevăr ar fi fost varianta
 * proastă: meniul ar fi zis „Action Centre" iar tab-ul „Actions", și nimeni n-ar fi știut care e
 * numele adevărat al ecranului.
 */
import { Baby, BadgeCheck, CopyCheck, BadgePoundSterling, Banknote, BellRing, Briefcase, Bug, Calculator, CalendarDays, CalendarRange, ClipboardList, Clock, CreditCard, FileSpreadsheet, FileText, History, Inbox, LayoutDashboard, LineChart, ListChecks, ListTodo, Mail, MessageSquare, PauseCircle, Receipt, Repeat, RotateCw, Settings, ShieldAlert, ShieldCheck, Sparkles, Star, Thermometer, Timer, TrendingUp, Umbrella, UserCog, Users, CalendarClock, Filter, PieChart, ArrowLeftRight, Scale, Shield, TriangleAlert, BarChart3, Palette, Share2, Package, Truck, FolderArchive,
} from 'lucide-react';

/**
 * Sesiunea 28 (owner request: "si meniul principal... surprinde-ma") — the nav
 * was 14 flat links in one list, so "Jobs" (used every day) carried exactly the
 * same visual weight as "Invoice Settings" (touched twice a year), and there
 * was no cue about which screens belong together.
 *
 * Grouped by how often the work actually happens, not by data model. Order
 * inside each group is the order of a real working day: see what needs doing,
 * then the job, then the money.
 */
/**
 * Sesiunea 57 (ACHU-256). Owner: *"sa organizezi un pic aplicatia... e cam
 * dezordine pe acolo"*. He was right: "Daily" had grown to ELEVEN entries, which
 * is not a group — it is a list with a heading. Everything from the Dashboard to
 * the chat lived in it, so the sidebar read as one undifferentiated column and
 * the headings did no work at all.
 *
 * Six groups now, none longer than six. The split is by the QUESTION you are
 * answering, not by which table the data lives in:
 *
 *   Today   — what is happening now
 *   Work    — the cleaning itself, and the arrangements behind it
 *   Money   — what came in, what went out, what it earned
 *   Clients — the people who pay, and the people who might
 *   Team    — the people who do the work, and talking to them
 *   Payroll — everything about paying people, in one place (ACHU-388)
 *   Setup   — things you configure once and rarely touch
 *
 * `tint` colours the group heading and the icons inside it. Purely so the eye
 * can find "the money section" without reading — which is exactly what a sidebar
 * of 24 identical grey rows made impossible. The ACTIVE row still uses the
 * theme's own primary colour, so the accent picker keeps meaning something and
 * "where am I" never competes with "what section is this".
 */
export const navGroups = [
  {
    title: 'Today',
    tint: 'text-sky-600 dark:text-sky-400',
    links: [
      { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/admin/action-centre', icon: ClipboardList, label: 'Action Centre' },
      // §43 (Sesiunea 144) — ⚠️ LÂNGĂ Action Centre, nu în el: acela arată ce spun DATELE că e
      // în neregulă, ăsta ce a decis un OM că trebuie făcut. Vecine, fiindcă se citesc împreună.
      { to: '/admin/tasks', icon: ListTodo, label: 'Tasks' },
      // §30 (Sesiunea 144) — ⚠️ lângă reclamații, nu în „Today”: o re-curățenie pornește
      // aproape mereu de la o reclamație, iar cele două se citesc una după alta.
      { to: '/admin/re-cleans', icon: RotateCw, label: 'Re-cleans' },
      { to: '/admin/calendar', icon: CalendarRange, label: 'Calendar' },
      { to: '/admin/schedule', icon: CalendarDays, label: 'Schedule' },
    ],
  },
  {
    title: 'Work',
    tint: 'text-indigo-600 dark:text-indigo-400',
    links: [
      { to: '/admin/jobs', icon: Briefcase, label: 'Jobs' },
      /**
       * 🆕 §38 (Sesiunea 155) — câtă muncă a fost în calendar, și ce s-a ales din ea.
       *
       * ⚠️ **Imediat sub „Jobs", ca „Payments & refunds" sub „Payments":** acolo se lucrează o
       * vizită, aici se citește luna — câte s-au făcut, câte nu s-au mai întâmplat, pe ce servicii,
       * pe ce zile. ⛔ **Nu sub Money, fiindcă nu are niciun ban în el**, dinadins: un total lângă
       * numărători ar fi fost al patrulea răspuns la „cât am făcut".
       */
      { to: '/admin/jobs-report', icon: BarChart3, label: 'Jobs Report' },
      { to: '/admin/recurring', icon: Repeat, label: 'Recurring' },
      // Next to Recurring on purpose: a subscription is a prepaid term over a
      // recurring contract, and the two are always worked on together — a term
      // cannot be sold without a contract underneath it.
      { to: '/admin/subscriptions', icon: BadgePoundSterling, label: 'Subscriptions' },
      /**
       * 🆕 §38 (Sesiunea 154) — „programat vs. real".
       *
       * ⚠️ **Sub Work, nu sub Money, și e o alegere:** întrebarea e a biroului care PROGRAMEAZĂ —
       * *„dacă scriu două ore, se termină în două ore?"* — iar o fereastră scrisă greșit costă un loc
       * în calendar la fiecare rezervare. ⛔ „Sold vs Worked Time" stă sub Money fiindcă acela e
       * despre PREŢ: minute de muncă, nu timp scurs. Două întrebări, două grupuri.
       */
      { to: '/admin/schedule-accuracy', icon: CalendarClock, label: 'Booked vs Actual' },
    ],
  },
  {
    title: 'Money',
    tint: 'text-emerald-600 dark:text-emerald-400',
    links: [
      { to: '/admin/payments', icon: CreditCard, label: 'Payments' },
      /**
       * 🆕 §38 (Sesiunea 154) — ce a intrat și ce s-a întors, pe perioadă.
       *
       * ⚠️ **Imediat sub „Payments", ca „Spend by category" sub „Expenses":** acolo se scrie o plată,
       * aici se citește luna — pe drumul banilor, plus rambursările **pe motiv**. ⛔ Și spune cât din
       * ce s-a consemnat contează ca venit pe prima pagină, ca cele două cifre să nu se contrazică
       * fără explicație.
       */
      { to: '/admin/payment-report', icon: ArrowLeftRight, label: 'Payments & refunds' },
      { to: '/admin/expenses', icon: Receipt, label: 'Expenses' },
      /**
       * 🆕 §38 (Sesiunea 154) — unde se duc banii, pe perioadă.
       *
       * ⚠️ **Imediat sub „Expenses", fiindcă e aceeași zonă citită din alt capăt:** acolo se scrie o
       * cheltuială, aici se citește ce s-a cheltuit — pe categorie, pe furnizor, și **cât nu are
       * chitanță**. ⛔ Nu sub Setup: nu e o unealtă de configurare, e o cifră de condus firma.
       */
      { to: '/admin/expense-report', icon: PieChart, label: 'Spend by category' },
      { to: '/admin/profitability', icon: TrendingUp, label: 'Profitability' },
      /**
       * 🆕 §26 (Sesiunea 154) — lună cu lună, pe AMÂNDOUĂ bazele (facturat / încasat).
       *
       * ⚠️ **Sub Profitability, fiindcă e ecranul de dus la contabil**, nu unul de condus ziua:
       * profitabilitatea răspunde „ce merită vândut", asta răspunde „ce raportăm și ce a intrat în
       * cont". ⛔ Nu sub Setup — nu configurează nimic.
       */
      { to: '/admin/monthly-summary', icon: Scale, label: 'Monthly summary' },
      /**
       * §24 (Sesiunea 153). Sub Money, lângă Profitability, fiindcă răspunde la o întrebare de
       * ÎNCASARE: cine ne datorează bani și de cât timp. ⛔ Nu sub Work — nu se programează nimic din ea.
       */
      { to: '/admin/aged-receivables', icon: Clock, label: 'Money owed' },
      // ACHU-288. Under Money, next to Profitability, because it answers a PRICING
      // question: a price is built from a number of minutes, and this says whether the
      // work fits in them. Not under Work — nobody schedules from it.
      { to: '/admin/time-variance', icon: Timer, label: 'Sold vs Worked Time' },
    ],
  },
  {
    title: 'Clients',
    tint: 'text-violet-600 dark:text-violet-400',
    links: [
      { to: '/admin/customers', icon: Users, label: 'Customers' },
      // ACHU-434 (Sesiunea 95). Renamed from "Quote Requests" / "Customer Requests" at
      // the owner's request, because the two names differed by one word and described
      // opposite things — he had to ask which was which. The labels now say who is on
      // the other end: a stranger wanting a price, versus an existing client with a
      // problem on a booked visit.
      //
      // ⛔ The ROUTES are deliberately unchanged. `/admin/quote-requests` and
      // `/admin/customer-requests` are stored inside notifications already written to
      // the database (customerPortal.ts, publicQuoteRequest.ts), and renaming a path
      // would leave every one of those pointing at nothing.
      { to: '/admin/quote-requests', icon: FileText, label: 'New Enquiries' },
      { to: '/admin/customer-requests', icon: Inbox, label: 'Client Issues' },
      /**
       * 🆕 §38 (Sesiunea 154) — raportul despre ce se întâmplă cu cererile: câte devin muncă, de
       * unde vin, câte oferte se acceptă.
       *
       * 🔴 **DUPĂ „Client Issues", nu între cele două de deasupra**, și nu din estetică: un test
       * (`AdminLayout.test.tsx`, ACHU-434) cere ca cele două ecrane de INTRARE — „New Enquiries" și
       * „Client Issues" — să rămână **lipite**, fiindcă la capătul fiecăruia e un om care așteaptă un
       * răspuns. ⚠️ Prima variantă le-a despărțit, iar testul a spus-o. ⛔ Un raport nu se așează între
       * două cozi de lucru.
       *
       * ⛔ Și nu sub Money: nu e o cifră de încasare — sumele din el sunt ce s-a TRIMIS, nu ce a intrat.
       */
      { to: '/admin/quote-funnel', icon: Filter, label: 'Enquiries & Quotes' },
      // ACHU-569. Lânga „Client Issues" fiindca sunt aceeasi zona citita din doua capete:
      // acolo e ce a reclamat CLIENTUL, aici e ce a deschis FIRMA — inclusiv ce clientul nu
      // a vazut niciodata (o cheie pierduta, o accidentare pe drum).
      { to: '/admin/incidents', icon: ShieldAlert, label: 'Incidents' },
      // §34 (Sesiunea 160). ⚠️ Lângă Incidents fiindcă e aceeași zonă de operare — ce ține munca în
      // picioare: o substanță expirată sau o fișă COSHH lipsă e tot un risc, nu o cifră de birou.
      { to: '/admin/inventory', icon: Package, label: 'Stock' },
      // §35 (Sesiunea 160) — lângă Stock: tot ce ține munca în picioare, nu cifre de birou.
      { to: '/admin/vehicles', icon: Truck, label: 'Vehicles' },
      // ACHU-537. Imediat după „Client Issues", fiindcă e aceeași întrebare citită din
      // celălalt capăt: acolo e ce a mers prost și a fost raportat, aici e ce au spus
      // clienții despre curățenii care au mers, inclusiv cele bune.
      { to: '/admin/feedback', icon: Star, label: 'Feedback' },
      // §31 (Sesiunea 145) — ⚠️ LÂNGĂ Feedback, fiindcă e aceeași întrebare pusă din partea
      // firmei: acolo e ce au spus clienții, aici e ce am văzut noi când ne-am uitat singuri.
      // ⛔ Nu în „Today": o verificare nu e o urgență, e o obișnuință.
      { to: '/admin/quality-checks', icon: BadgeCheck, label: 'Quality Checks' },
      // §31 (Sesiunea 145, felia a doua) — raportul, imediat sub lista de lucru: ⚠️ una e ce ai
      // de făcut acum, cealaltă e ce se vede din tot ce s-a făcut. ⛔ Două ecrane, nu un tab,
      // ca la Feedback/Customer Report — cifrele se citesc rar, lista de lucru zilnic.
      { to: '/admin/quality-report', icon: LineChart, label: 'Quality Report' },
      /**
       * 🆕 §38 (Sesiunea 155) — ce a mers prost: reclamații, incidente, re-curățenii, pe perioadă.
       *
       * ⚠️ **Imediat sub „Quality Report", fiindcă e aceeași specie de ecran citită din alt capăt:**
       * acela spune cum a ieșit munca pe care ne-am uitat singuri, ăsta spune ce s-a stricat și ce am
       * făcut. ⛔ Nu în „Today": nu e o listă de lucru — cozile lor sunt „Client Issues", „Incidents"
       * și „Re-cleans", fiecare la locul lui.
       *
       * 🔴 Și nu lângă „Incidents", deși le numără: ecranul acoperă **trei** registre, iar așezat
       * lângă unul dintre ele s-ar citi ca raportul acelui registru.
       */
      { to: '/admin/problem-report', icon: TriangleAlert, label: 'What Went Wrong' },
      // ACHU-540. Lângă Feedback fiindcă sunt aceeași întrebare pe două scale: acolo e ce a
      // spus un client despre o curățenie, aici e ce fac clienții în timp — cine rămâne.
      { to: '/admin/customer-report', icon: TrendingUp, label: 'Customer Report' },
      // §8 (Sesiunea 146) — ⚠️ IMEDIAT ÎNAINTEA lui Price Calculator, fiindcă e ordinea în care
      // se citesc: catalogul spune ce servicii există, tarifele spun cât costă fiecare poziție.
      // ⛔ Nu un tab în Price Calculator: un serviciu se editează rar, un tarif și mai rar, dar
      // sunt două întrebări diferite, iar amestecate ar sugera că prețul se pune din catalog.
      { to: '/admin/services', icon: ListChecks, label: 'Services' },
      { to: '/admin/price-calculator', icon: Calculator, label: 'Price Calculator' },
    ],
  },
  {
    title: 'Team',
    tint: 'text-amber-600 dark:text-amber-400',
    links: [
      { to: '/admin/cleaners', icon: Sparkles, label: 'Cleaners' },
      /**
       * 🆕 §26 „Profit by team" B (Sesiunea 154) — ⚠️ **sub Team, imediat după Cleaners**, nu sub
       * Setup: e o listă de oameni grupați, nu o configurare. ⛔ Iar echipa unui om se pune pe fișa
       * LUI, deci cele două ecrane stau unul lângă altul din același motiv.
       */
      { to: '/admin/teams', icon: Shield, label: 'Teams' },
      // ACHU-267. Under Team rather than Setup, unlike Employee Pay Details: pay
      // details are reference data you set once per person, while a timesheet is
      // recurring work touched every pay period. It sits next to Cleaners because
      // it is about the same people.
      { to: '/admin/timesheets', icon: Clock, label: 'Timesheets' },
      // ACHU-289. Immediately after Timesheets, because the two are one subject read
      // from opposite ends: the timesheet is the hours worked, and the holiday
      // entitlement is 12.07% OF those hours. Someone checking whether a week off can
      // be granted has just been looking at the hours it came from.
      { to: '/admin/leave', icon: Umbrella, label: 'Holiday & Leave' },
      // Sesiunea 75 (secțiunea 5). Lângă concedii fiindcă sunt aceeași întrebare —
      // „cine nu e la muncă, și cât i se plătește" — dar tabele SEPARATE, fiindcă
      // boala nu cheltuie drept de concediu. Adiacența pe ecran, nu în date.
      { to: '/admin/sickness', icon: Thermometer, label: 'Sickness & Sick Pay' },
      // Sesiunea 76 (secțiunea 6). Al treilea din grupul „cine nu e la muncă, și cât
      // i se plătește" — concediu, boală, familie. Tabele SEPARATE, fiindcă cele trei
      // plăți nu au nicio regulă comună; adiacența e pe ecran, nu în date.
      { to: '/admin/family-leave', icon: Baby, label: 'Family Leave' },
      // Moved out of the old "Daily" pile: chat is how you talk to the cleaners,
      // so it belongs with them rather than beside the day's takings.
      { to: '/admin/chat', icon: MessageSquare, label: 'Chat' },
      { to: '/admin/users', icon: UserCog, label: 'User Accounts' },
      { to: '/admin/invitations', icon: Mail, label: 'Invitations' },
    ],
  },
  {
    /**
     * ─── ACHU-388 (Sesiunea 88): payroll gets its own group ─────────────────
     *
     * 🔴 WHY. The owner could not find `Employee Pay Details` and asked "Unde e payroll
     * people?". Nothing was broken: it was the fourth of EIGHT links under Setup, the nav
     * scrolls, and `Sign Out` is pinned outside the scroll area — so on a phone the group
     * appeared to end at Payroll Simulator. He concluded the screen did not exist.
     *
     * The four payroll screens were split across two groups for reasons that were each
     * sound on their own (see the historic notes below) and added up to a system where
     * "where is the payroll thing" had four different answers. A group named Payroll has
     * one.
     *
     * 📜 THE REASONING THAT WAS MOVED HERE, NOT DISCARDED — it argued Team-vs-Money and
     * Setup-vs-Work, and a dedicated group was never one of the options it weighed:
     *   · ACHU-294, Payroll Runs: "under Team rather than Money — it is about the people,
     *     and it is touched every pay period rather than being reference data." Still
     *     true, and still the reason this group is NOT inside Money.
     *   · ACHU-295, Payroll Reports: "next to the runs it reports on, rather than under
     *     Money: 'what did this year's payroll cost' is asked by whoever has just been
     *     approving the runs." Still true — they are still adjacent.
     *   · Payroll Simulator: "under Setup, not Work — it is a calculator you consult, not
     *     work you process. It stores nothing and sends nothing to HMRC, and putting it
     *     beside the daily screens would suggest it is part of running payroll." Honoured
     *     by ORDER instead of by group: it is LAST here, after the things that do store
     *     and do run.
     *
     * ⚠️ ORDERED BY HOW OFTEN IT IS TOUCHED, not by the flow. On a phone the top of a
     * group is what you see without scrolling, so the monthly job comes first and the
     * reference data after. A flow order (set up the person, then pay them) reads better
     * on paper and puts the screen used twelve times a year below the one used once.
     *
     * ⛔ The absence screens (Holiday, Sickness, Family Leave) deliberately stay in Team.
     * They feed payroll, but their comments there record that they are one subject with
     * Timesheets — "who is not at work and what are they paid" — and somebody granting a
     * week off has just been looking at the hours it accrued from.
     */
    title: 'Payroll',
    tint: 'text-rose-600 dark:text-rose-400',
    links: [
      { to: '/admin/payroll-runs', icon: Banknote, label: 'Payroll Runs' },
      { to: '/admin/payroll-reports', icon: FileSpreadsheet, label: 'Payroll Reports' },
      /**
       * ⚠️ The label stays `Employee Pay Details`, NOT `Payroll People`. The file is
       * called PayrollPeoplePage and Claude told the owner to look under "Payroll
       * People" — a name that exists nowhere in the UI, which is part of what sent him
       * looking. The label is the better name for somebody who is not a developer; the
       * filename is the one that is wrong, and renaming a file is not worth a churn.
       */
      { to: '/admin/payroll-people', icon: UserCog, label: 'Employee Pay Details' },
      { to: '/admin/payroll-simulator', icon: Calculator, label: 'Payroll Simulator' },
    ],
  },
  {
    title: 'Setup',
    tint: 'text-slate-500 dark:text-slate-400',
    links: [
      /**
       * 🆕 §22 (Sesiunea 158) — cerut de Roberto: *„pui appearance in setari"*. ⚠️ **Primul rând din
       * Setup**, fiindcă e singurul de aici pe care îl atinge cineva care nu caută nimic stricat: e
       * despre cum arată aplicația, nu despre TVA sau despre un jurnal de erori.
       */
      { to: '/admin/appearance', icon: Palette, label: 'Appearance' },
      { to: '/admin/financial-settings', icon: Settings, label: 'Financial Settings' },
      { to: '/admin/invoice-settings', icon: FileSpreadsheet, label: 'Invoice Settings' },
      /**
       * §33 (Sesiunea 161). ⚠️ Sub **Setup**, lângă Invoice Settings: hârtiile firmei sunt configurarea
       * ei legală, nu munca zilei. ⛔ Nu sub Clients — nu sunt despre niciun client.
       */
      { to: '/admin/company-documents', icon: FolderArchive, label: 'Company Documents' },
      { to: '/admin/notifications-setup', icon: BellRing, label: 'Phone Alerts' },
      { to: '/admin/audit-history', icon: History, label: 'Audit History' },
      // ACHU-261. Next to Audit History because they are the same kind of thing:
      // a record you consult when something needs explaining. Audit History says
      // who changed what; this says what broke.
      /**
       * §40 (Sesiunea 154). Sub Setup, lângă Audit History și Error Log: e o unealtă de întreținere a
       * datelor, nu o cifră de condus firma. ⛔ Nu sub Clients — nu e o listă de clienți, e o listă de
       * întrebări despre fișe, iar cine o deschide caută curățenie, nu clienți.
       */
      { to: '/admin/duplicates', icon: CopyCheck, label: 'Duplicates' },
      { to: '/admin/error-log', icon: Bug, label: 'Error Log' },
      { to: '/admin/backup', icon: ShieldCheck, label: 'Backup' },
      /**
       * 🔴 §45 „Third-party sharing record" (Sesiunea 158) — ÎN MENIU, nu deschis dintr-un alt
       * ecran. ⚠️ Spre deosebire de registrul breșelor, care se citește doar în ziua în care ceva
       * s-a stricat, ăsta se completează **în zile liniștite** — iar un ecran fără rând de meniu se
       * deschide numai de cine știe deja că există.
       */
      { to: '/admin/data-sharing', icon: Share2, label: 'Who We Share Data With' },
      // 🔴 În MENIU, nu într-un document. Roberto, 15/08/2026: „Asta nu trebuie sa
      // stea in aplicatie?". Se citește exact când ceva e deja stricat, iar atunci
      // nimeni nu deschide un dosar de cod și nu caută o notiță pe telefon.
      { to: '/admin/data-breach', icon: ShieldAlert, label: 'If Data Gets Out' },
      // 🔴 Lângă „If Data Gets Out" fiindcă e aceeași specie: ceva ce citești ca să nu fii luat
      // prin surprindere. Roberto, 15/08/2026: „vreau sa iei din fata mea unele probleme" — dar
      // scoase din listă, nu din vedere.
      { to: '/admin/waiting', icon: PauseCircle, label: 'Waiting On' },
    ],
  },
];

/**
 * 🔴 **ECRANELE DE ADMIN CARE NU AU RÂND DE MENIU — și pe cine costă asta.**
 *
 * ⚠️ Măsurat, nu presupus: din cele 44 de rute de sub `/admin`, exact **două** nu sunt în meniu — se
 * ajunge la ele dintr-un link de pe alt ecran. ⛔ Consecința nu e estetică: mecanismul prin care
 * aplicația spune „unde ești" e **rândul aprins din meniu**, iar pe ecranele astea două nu se aprinde
 * niciun rând. Deci ele erau singurele fără nici un reper, și singurele fără drum înapoi în afară de
 * butonul browserului.
 *
 * 🔴 **`parent` e ecranul de unde se AJUNGE aici**, nu „ecranul apropiat tematic": e ce se pune ca
 * link în urma de navigare (`lib/breadcrumbs.ts`), deci trebuie să ducă unde omul crede că se
 * întoarce. ⚠️ Ambele au și eticheta aici, într-un singur loc: `lib/pageTitle.ts` citește de aici
 * numele pentru tab-ul browserului, urma de navigare citește tot de aici numele și părintele. ⛔ Două
 * liste s-ar fi despărțit la prima redenumire.
 */
export const offMenuScreens: Record<string, { label: string; parent: string }> = {
  // Se deschide din „If Data Gets Out" (Sesiunea 148): registrul propriu-zis.
  '/admin/data-breach-register': { label: 'Breach Register', parent: '/admin/data-breach' },
  // Foaia de drum a zilei, deschisă din program.
  '/admin/dispatch': { label: 'Dispatch Sheet', parent: '/admin/schedule' },
};

