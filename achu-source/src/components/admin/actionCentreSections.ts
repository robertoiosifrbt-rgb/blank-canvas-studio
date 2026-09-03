/**
 * ACTION CENTRE — CE SECȚIUNI EXISTĂ, cum se numesc și cum arată.
 *
 * ─── 🔴 De ce a ieșit din `ActionCentrePage.tsx` ─────────────────────────────
 * §36 (Sesiunea 142) adaugă o secțiune — notele mici pe care nimeni nu le-a urmărit. ⛔ Pagina e
 * de mult peste 500 de rânduri, iar regula proprietarului spune că un fișier peste prag **nu are
 * voie să crească** (`AGENT_RULES` §7.3): se extrage. ✅ Ce a ieșit e chiar partea care nu e
 * comportament — nume, texte, culori, rândurile de carduri — deci pagina rămâne cu logica ei.
 *
 * ⚠️ **Nu e o modularizare** (oprită de Roberto pe 15/08): e paza de 500 de linii făcută **din
 * mers, exact unde e activitate**, așa cum spune `CURRENT_STATE.md`.
 *
 * ⛔ **Nimic din acest fișier nu decide nimic.** O secțiune apare în răspunsul serverului sau nu;
 * aici stă doar cum se numește pentru un om.
 */
import type { LucideIcon } from 'lucide-react';
import {
  Briefcase, PoundSterling, RotateCcw, XCircle, Receipt, CalendarDays, FileText, UserCog,
  CheckCircle2, Clock, Inbox, Star, CalendarClock, IdCard, AlertTriangle, ClipboardCheck,
  CalendarPlus, MessageSquare, ShieldAlert, UserX, PhoneCall, HelpCircle, PackageOpen, Truck,
} from 'lucide-react';

export type SectionKey = 'jobs' | 'money' | 'refunds' | 'cancelled' | 'preparedAccounts' | 'expenses' | 'conversions' | 'hoursToApprove' | 'futureJobs' | 'completedJobs' | 'customerRequests' | 'poorRatings' | 'seriesCoverage' | 'cleanerDocuments' | 'openIncidents' | 'reCleansToDecide' | 'qualityChecksToDo' | 'quotesExpiring' | 'quotesAcceptedToBook' | 'feedbackMissing' | 'cleanerCompliance' | 'cleanerResponses' | 'followUpsDue' | 'enquiriesAwaitingInfo' | 'stockNeeds' | 'vehiclePapers';
export const SECTION_META: Record<SectionKey, { label: string; icon: LucideIcon; description: string }> = {
  jobs: { label: 'Jobs Requiring Action', icon: Briefcase, description: 'Overdue, unassigned, in-progress and enquiry jobs' },
  money: { label: 'Money to Collect', icon: PoundSterling, description: 'Outstanding and partially paid jobs' },
  // ACHU-300: "money held with no charge" is now part of this section, and it is the
  // kind a reader would not guess from the other three — so it is named.
  refunds: { label: 'Refunds & Corrections', icon: RotateCcw, description: 'Money held with no charge, overpayments, voided and flagged payments' },
  cancelled: { label: 'Cancelled & Exceptions', icon: XCircle, description: 'Cancelled jobs, data errors and duplicates' },
  preparedAccounts: { label: 'Prepared Accounts', icon: UserCog, description: 'Inactive accounts awaiting profile linking and activation' },
  expenses: { label: 'Expenses & Receipts', icon: Receipt, description: 'Missing receipts, reviews and duplicates' },
  conversions: { label: 'Quote Conversions', icon: FileText, description: 'Quote request conversion status and errors' },
  // ACHU-268 rule 5. The owner's rule was "tell the office before Friday's pay";
  // there is no scheduler in this app, so it is a standing row instead — which
  // cannot be dismissed, cannot be missed while somebody is away, and clears
  // itself when the work is done.
  hoursToApprove: { label: 'Hours to Approve', icon: Clock, description: 'Worked hours still waiting for a decision, and shifts nobody closed' },
  futureJobs: { label: 'Future Jobs', icon: CalendarDays, description: 'All jobs scheduled after today' },
  completedJobs: { label: 'Completed Jobs', icon: CheckCircle2, description: 'All jobs with Completed status' },
  // ACHU-342: the backend has returned this section since Sesiunea 42
  // (ACHU-238) — the customer's own reschedule/cancellation/problem
  // requests — but nothing in this screen ever rendered it, so it was
  // answerable only by someone who separately knew to check Client Issues.
  /**
   * 🆕 ACHU-543 (Sesiunea 119) — descrierea era învechită și enumera TREI feluri din nouă.
   *
   * ⚠️ O enumerare într-un text de ecran e o listă care trebuie ținută la zi de mână, în alt
   * fișier decât cel care definește felurile — exact greșeala pe care felia asta o repară pe
   * server. Deci textul nu mai enumeră: spune ce ESTE secțiunea, iar felurile se văd din
   * pastilele de dedesubt, care se derivă din politică.
   */
  customerRequests: { label: 'Customer Requests', icon: Inbox, description: 'Anything a customer has asked for and nobody has answered yet' },
  /**
   * 🆕 §36 (Sesiunea 142) — „Negative-feedback escalation".
   *
   * ⚠️ **Textul spune „nobody has called them", nu „bad ratings".** Secțiunea nu e o listă de
   * note mici: e lista celor pe care **nimeni nu le-a urmărit**, iar rândul dispare când cineva
   * scrie că a vorbit cu omul. Un titlu despre note ar fi sugerat un raport, iar un raport nu
   * cere nimic de la nimeni.
   */
  poorRatings: { label: 'Unhappy Customers', icon: Star, description: 'Jobs rated 1 or 2 stars that nobody has called the customer about' },
  /**
   * 🆕 §18 (Sesiunea 143) — „Failed-generation detection".
   *
   * ⚠️ **Titlul spune ce lipsește CLIENTULUI, nu ce a eșuat tehnic.** „Generation failed" ar fi
   * numit mecanismul; biroul are nevoie să știe că un contract activ nu mai are pe cine trimite.
   */
  seriesCoverage: { label: 'Contracts With No Jobs Booked', icon: CalendarClock, description: 'Active recurring contracts that have run out of booked jobs, or are about to' },
  /**
   * 🆕 §33 + §14 (Sesiunea 146) — hârtiile curățătorilor.
   *
   * ⚠️ **Textul spune „recorded", nu „missing".** Secțiunea nu poate fi lista celor cu acte lipsă:
   * nimeni nu a stabilit care documente sunt obligatorii. 🔴 Un titlu care ar sugera altceva ar fi
   * citit ca o listă de oameni neconformi — o afirmație despre ei, dedusă din nimic.
   */
  cleanerDocuments: { label: 'Cleaner Documents', icon: IdCard, description: 'Recorded paperwork that has run out, runs out soon, or nobody has checked' },
  /**
   * 🆕 §21 „Missing cleaner documents" (Sesiunea 158) — CE LIPSEȘTE, în sfârșit.
   *
   * 🔴 **Titlul poate spune „missing" abia de azi.** Paragraful de deasupra explică de ce nu putea
   * până acum: nimeni nu stabilise care documente sunt obligatorii, iar un astfel de titlu ar fi
   * fost o afirmație despre oameni, dedusă din nimic. ✅ Roberto a aprobat lista pe 28/08/2026 —
   * drept de muncă, act de identitate, DBS.
   *
   * ⚠️ **Secțiune separată de cea de sus, nu un rând în ea.** Aceea e o coadă de birou („cere polița
   * nouă"); asta e **o listă de oameni** care, pe hârtie, n-ar trebui să lucreze azi. ⛔ Amestecate,
   * a doua ar fi dispărut între zeci de rânduri despre asigurări.
   *
   * ⛔ **Descrierea spune că nu blochează nimic** — altfel biroul ar presupune că aplicația îl
   * oprește pe om, și n-ar mai verifica.
   */
  cleanerCompliance: { label: 'Missing Cleaner Paperwork', icon: ShieldAlert, description: 'Active cleaners without the papers decided as required — shown, never blocked' },
  /**
   * 🆕 §21 (Sesiunea 158) — vizitele refuzate, și cele la care nimeni nu a răspuns până seara
   * dinainte. ⚠️ Descrierea spune **și** că nimic nu se mută singur: un refuz citit în clopoțel poate
   * lăsa impresia că aplicația a rezolvat ceva.
   */
  cleanerResponses: { label: 'Jobs Not Confirmed', icon: UserX, description: 'Refused, or no answer by 6pm the day before — nothing is moved automatically' },
  /**
   * NOU §21 (Sesiunea 157) - capatul celalalt al notelor: curatenii terminate despre care nu a
   * intrebat nimeni. Nu apar cei cu o reclamatie deschisa sau recenta - aceeasi regula ca la
   * invitatiile din portal.
   */
  feedbackMissing: { label: 'No Feedback Asked', icon: MessageSquare, description: 'Finished cleans where nobody has asked the customer how it went' },
  /**
   * 🔴 §21 (Sesiunea 150) — patru cozi care existau în bază și pe niciun ecran.
   *
   * ⚠️ Descrierile spun **ce e lista**, nu enumeră feluri: o enumerare într-un text de ecran e o
   * listă ținută la zi de mână, în alt fișier decât cel care definește felurile — greșeala reparată
   * la ACHU-543. ⛔ Felurile se văd din pastile, care se derivă din date.
   */
  openIncidents: { label: 'Open Incidents', icon: AlertTriangle, description: 'Incident records nobody has closed yet' },
  reCleansToDecide: { label: 'Re-cleans Waiting For You', icon: RotateCcw, description: 'Free re-clean requests that need approving or declining' },
  qualityChecksToDo: { label: 'Quality Checks To Do', icon: ClipboardCheck, description: 'Jobs somebody asked to be checked, and nobody has looked at yet' },
  quotesExpiring: { label: 'Quotes Running Out', icon: FileText, description: 'Quotes the customer has not answered that expire soon, or already have' },
  /**
   * 🆕 §21 (Sesiunea 154) — oglinda secțiunii de mai sus.
   *
   * ⚠️ **Titlul spune ce LIPSEȘTE, nu ce s-a întâmplat.** „Accepted quotes" ar fi fost o veste
   * bună și s-ar fi citit ca un raport; ce cere secțiunea de la cineva e o vizită în calendar.
   */
  quotesAcceptedToBook: { label: 'Accepted Quotes With No Job', icon: CalendarPlus, description: 'Quotes the customer said yes to, with no job booked against them' },
  /**
   * 🆕 §4 „Next follow-up date" (Sesiunea 160). ⚠️ **Titlul spune ce e de făcut azi**, nu ce s-a
   * scris cândva: „Follow-ups" ar fi fost un raport, „Ring them back today" e o coadă.
   */
  followUpsDue: { label: 'Ring Them Back', icon: PhoneCall, description: 'Customers the office said it would come back to — today or earlier' },
  /**
   * 🆕 §6 „More information required" (Sesiunea 160). 🔴 **Descrierea spune că NOI trebuie să
   * întrebăm** — aplicația nu a trimis nimic nimănui (`ACHU-805`). ⛔ „Waiting on the customer" pe
   * card ar fi lăsat biroul să creadă că omul a fost întrebat și tace.
   */
  enquiriesAwaitingInfo: { label: 'Enquiries Missing Details', icon: HelpCircle, description: 'Enquiries you cannot price yet — ask the customer yourself, the app has not' },
  /**
   * 🆕 §34 „Equipment și inventory" (Sesiunea 160). ⚠️ **Titlul spune ce e de FĂCUT**, nu ce e pe
   * raft: „Stock levels" ar fi fost un raport, iar asta e o drumeție la magazin. ⛔ Trei feluri de
   * rând într-o singură coadă — s-a terminat, a expirat, lipsește fișa de siguranță — fiindcă toate
   * cer același lucru de la om.
   */
  stockNeeds: { label: 'Order Or Bin', icon: PackageOpen, description: 'Anything low, out, expired, or a chemical with no safety sheet on file' },
  /**
   * 🆕 §35 (Sesiunea 160). ⛔ **Un rând per HÂRTIE, nu per mașină** — cine rezolvă asigurarea nu a
   * rezolvat și ITP-ul, iar un rând pe mașină l-ar fi lăsat pe al doilea nevăzut până dimineața.
   */
  vehiclePapers: { label: 'Vehicle Paperwork', icon: Truck, description: 'Insurance, MOT, tax or a service that has run out or is about to' },
};
export const ACTION_SECTION_KEYS: SectionKey[] = ['jobs', 'money', 'refunds', 'cancelled', 'expenses', 'conversions', 'hoursToApprove', 'customerRequests', 'poorRatings', 'seriesCoverage', 'cleanerDocuments', 'openIncidents', 'reCleansToDecide', 'qualityChecksToDo', 'quotesExpiring', 'quotesAcceptedToBook', 'feedbackMissing', 'cleanerCompliance', 'cleanerResponses', 'followUpsDue', 'enquiriesAwaitingInfo', 'stockNeeds', 'vehiclePapers'];

// ACHU-135: Card layout rows for the overview grid
export const CARD_ROW_1: SectionKey[] = ['jobs', 'money', 'refunds'];
export const CARD_ROW_3: SectionKey[] = ['preparedAccounts', 'expenses', 'conversions'];
// ACHU-268 rule 5 — a row of its own rather than squeezed into row 3, because
// unlike the others this one has a DEADLINE: anything still here on the Friday
// is a wage that will not go out.
export const CARD_ROW_4: SectionKey[] = ['hoursToApprove'];
// ACHU-342. Its own row rather than tucked into row 3: unlike a housekeeping
// bucket, a customer is on the other end of every row in this one, waiting.
export const CARD_ROW_5: SectionKey[] = ['customerRequests'];
/**
 * 🆕 §36 — rândul lui, lângă cererile clienților și pentru același motiv: la capătul fiecărui
 * rând de aici e un om supărat care așteaptă un telefon, nu o sarcină de birou.
 */
export const CARD_ROW_6: SectionKey[] = ['poorRatings'];
/**
 * 🆕 §18 (Sesiunea 143) — contractele care au rămas fără vizite programate. Rând propriu, ca
 * celelalte trei de mai jos: nu e o listă de curățenie administrativă, e un client care în două
 * săptămâni nu are cine să vină.
 */
export const CARD_ROW_7: SectionKey[] = ['seriesCoverage'];
/**
 * 🆕 §33 + §14 — rând propriu, ca celelalte: un act expirat nu e curățenie administrativă, e o
 * hârtie pe care o cere cineva din afară, de obicei fără preaviz.
 */
export const CARD_ROW_8: SectionKey[] = ['cleanerDocuments', 'cleanerCompliance'];
/**
 * 🆕 §21 (Sesiunea 158) — rând propriu: „nu vine nimeni mâine" nu e o hârtie și nu e o vizită de
 * pornit. 🔴 E singura coadă din Action Centre cu un termen care trece **peste noapte**.
 */
export const CARD_ROW_15: SectionKey[] = ['cleanerResponses'];
/** NOU §21 (Sesiunea 157) - randul cozii "nu a intrebat nimeni". */
export const CARD_ROW_14: SectionKey[] = ['feedbackMissing'];

/**
 * 🔴 §21 (Sesiunea 150) — patru rânduri noi de card.
 *
 * ⚠️ **Ofertele care expiră stau primele** dintre cele patru: sunt singurele cu un TERMEN. ⛔ O coadă
 * fără termen poate aștepta o zi; un preț care expiră mâine nu poate.
 */
export const CARD_ROW_9: SectionKey[] = ['quotesExpiring'];
export const CARD_ROW_10: SectionKey[] = ['reCleansToDecide'];
export const CARD_ROW_11: SectionKey[] = ['openIncidents'];
export const CARD_ROW_12: SectionKey[] = ['qualityChecksToDo'];
/**
 * 🆕 §21 (Sesiunea 154) — ofertele acceptate fără vizită. ⚠️ Rând propriu, ca celelalte: la capătul
 * fiecărui rând e un client care a spus **da** și așteaptă o dată.
 */
export const CARD_ROW_13: SectionKey[] = ['quotesAcceptedToBook'];
/**
 * 🆕 Sesiunea 160 — două cozi despre **oameni pe care trebuie să-i sune cineva**, deci un rând
 * împreună: ziua în care biroul a spus că revine (§4) și cererea la care lipsește ceva (§6).
 *
 * 🔴 Amândouă cer **un telefon dat de noi**: aplicația nu trimite nici email, nici SMS
 * (`ACHU-805`). ⛔ Un card care ar fi spus „în așteptare" ar fi ascuns tocmai asta.
 */
export const CARD_ROW_16: SectionKey[] = ['followUpsDue', 'enquiriesAwaitingInfo'];
/**
 * 🆕 §34 (Sesiunea 160) — rând propriu: la capătul rândurilor de aici nu e un om care așteaptă un
 * telefon, ci o dubă care pleacă mâine fără ce-i trebuie. ⛔ Amestecată cu cozile despre oameni,
 * s-ar fi citit ca o treabă administrativă care mai poate aștepta o zi.
 */
export const CARD_ROW_17: SectionKey[] = ['stockNeeds', 'vehiclePapers'];

/**
 * 🔴 **RÂNDURILE DE UN SINGUR CARD, ÎNTR-O LISTĂ — ca o secțiune nouă să nu mai coste rânduri în
 * pagină.**
 *
 * ⚠️ Erau trei blocuri aproape identice în `ActionCentrePage.tsx`, fiecare cu propriul
 * `{data.X && …totalCount > 0 && (…)}`; al patrulea ar fi însemnat încă șapte rânduri într-un
 * fișier care e peste plafonul de mărime și **nu are voie să crească** (`AGENT_RULES` §7.3). ✅
 * Acum pagina iterează, iar ce se adaugă e un rând AICI.
 *
 * ⛔ **Regula pe care o duc toate cu ele, și de aceea stau împreună: se arată doar când au ceva în
 * ele.** Un card permanent gol învață ochiul să sară exact peste locul în care apare, cândva, un
 * lucru urgent.
 */
export const SINGLE_CARD_ROWS: SectionKey[][] = [CARD_ROW_4, CARD_ROW_5, CARD_ROW_6, CARD_ROW_7, CARD_ROW_8, CARD_ROW_9, CARD_ROW_10, CARD_ROW_11, CARD_ROW_12, CARD_ROW_13, CARD_ROW_14, CARD_ROW_15, CARD_ROW_16, CARD_ROW_17];

export const SECTION_COLORS: Record<SectionKey, { bg: string; border: string; activeBg: string; badge: string; icon: string; text: string }> = {
  jobs:      { bg: 'bg-blue-50',    border: 'border-blue-200',    activeBg: 'bg-blue-100',    badge: 'bg-blue-100 text-blue-700',    icon: 'bg-blue-100 text-blue-600',    text: 'text-blue-700' },
  money:     { bg: 'bg-emerald-50', border: 'border-emerald-200', activeBg: 'bg-emerald-100', badge: 'bg-emerald-100 text-emerald-700', icon: 'bg-emerald-100 text-emerald-600', text: 'text-emerald-700' },
  refunds:   { bg: 'bg-orange-50',  border: 'border-orange-200',  activeBg: 'bg-orange-100',  badge: 'bg-orange-100 text-orange-700',  icon: 'bg-orange-100 text-orange-600',  text: 'text-orange-700' },
  cancelled: { bg: 'bg-red-50',     border: 'border-red-200',     activeBg: 'bg-red-100',     badge: 'bg-red-100 text-red-700',     icon: 'bg-red-100 text-red-600',     text: 'text-red-700' },
  preparedAccounts: { bg: 'bg-slate-50', border: 'border-slate-200', activeBg: 'bg-slate-100', badge: 'bg-slate-100 text-slate-600', icon: 'bg-slate-100 text-slate-500', text: 'text-slate-600' },
  expenses:  { bg: 'bg-purple-50',  border: 'border-purple-200',  activeBg: 'bg-purple-100',  badge: 'bg-purple-100 text-purple-700',  icon: 'bg-purple-100 text-purple-600',  text: 'text-purple-700' },
  conversions: { bg: 'bg-indigo-50', border: 'border-indigo-200', activeBg: 'bg-indigo-100', badge: 'bg-indigo-100 text-indigo-700', icon: 'bg-indigo-100 text-indigo-600', text: 'text-indigo-700' },
  hoursToApprove: { bg: 'bg-amber-50', border: 'border-amber-200', activeBg: 'bg-amber-100', badge: 'bg-amber-100 text-amber-700', icon: 'bg-amber-100 text-amber-600', text: 'text-amber-700' },
  futureJobs: { bg: 'bg-cyan-50', border: 'border-cyan-200', activeBg: 'bg-cyan-100', badge: 'bg-cyan-100 text-cyan-700', icon: 'bg-cyan-100 text-cyan-600', text: 'text-cyan-700' },
  completedJobs: { bg: 'bg-green-50', border: 'border-green-200', activeBg: 'bg-green-100', badge: 'bg-green-100 text-green-700', icon: 'bg-green-100 text-green-600', text: 'text-green-700' },
  customerRequests: { bg: 'bg-teal-50', border: 'border-teal-200', activeBg: 'bg-teal-100', badge: 'bg-teal-100 text-teal-700', icon: 'bg-teal-100 text-teal-600', text: 'text-teal-700' },
  // 🆕 §18 — portocaliu: e un avertisment despre ceva care se strică în curând, nu o eroare de acum.
  seriesCoverage: { bg: 'bg-amber-50', border: 'border-amber-200', activeBg: 'bg-amber-100', badge: 'bg-amber-100 text-amber-800', icon: 'bg-amber-100 text-amber-700', text: 'text-amber-800' },
  // 🆕 §36 — roșu, ca „Cancelled & Exceptions": e singura culoare pe care nimeni nu o citește ca „informativ".
  poorRatings: { bg: 'bg-rose-50', border: 'border-rose-200', activeBg: 'bg-rose-100', badge: 'bg-rose-100 text-rose-700', icon: 'bg-rose-100 text-rose-600', text: 'text-rose-700' },
  // 🆕 §33 — portocaliu, ca §18: e un avertisment despre ceva care se strică în curând, nu o eroare de acum.
  cleanerDocuments: { bg: 'bg-amber-50', border: 'border-amber-200', activeBg: 'bg-amber-100', badge: 'bg-amber-100 text-amber-800', icon: 'bg-amber-100 text-amber-700', text: 'text-amber-800' },
  /**
   * 🆕 §21 (Sesiunea 158) — **roșu, nu chihlimbar**, deși stă lângă secțiunea de hârtii.
   * 🔴 Diferența e reală: acolo o hârtie **se strică în curând**; aici omul **nu are** ce trebuie ca
   * să lucreze, iar asta e adevărat de dimineață. ⛔ Aceeași culoare pentru amândouă ar fi făcut a
   * doua să pară o variantă a primei.
   */
  cleanerCompliance: { bg: 'bg-rose-50', border: 'border-rose-200', activeBg: 'bg-rose-100', badge: 'bg-rose-100 text-rose-700', icon: 'bg-rose-100 text-rose-600', text: 'text-rose-700' },
  cleanerResponses: { bg: 'bg-orange-50', border: 'border-orange-200', activeBg: 'bg-orange-100', badge: 'bg-orange-100 text-orange-700', icon: 'bg-orange-100 text-orange-600', text: 'text-orange-700' },
  /** Culoare calma, dinadins: e munca de facut, nu ceva stricat. */
  feedbackMissing: { bg: 'bg-sky-50', border: 'border-sky-200', activeBg: 'bg-sky-100', badge: 'bg-sky-100 text-sky-800', icon: 'bg-sky-100 text-sky-700', text: 'text-sky-800' },
  // §21 (Sesiunea 150). ⚠️ Ofertele care expiră au termen → chihlimbar, ca restul lucrurilor cu ceas;
  // incidentele roșu (dosare deschise), iar cele două cozi de lucru rămân neutre-albastru.
  quotesExpiring: { bg: 'bg-amber-50', border: 'border-amber-200', activeBg: 'bg-amber-100', badge: 'bg-amber-100 text-amber-800', icon: 'bg-amber-100 text-amber-700', text: 'text-amber-800' },
  reCleansToDecide: { bg: 'bg-sky-50', border: 'border-sky-200', activeBg: 'bg-sky-100', badge: 'bg-sky-100 text-sky-800', icon: 'bg-sky-100 text-sky-700', text: 'text-sky-800' },
  openIncidents: { bg: 'bg-rose-50', border: 'border-rose-200', activeBg: 'bg-rose-100', badge: 'bg-rose-100 text-rose-700', icon: 'bg-rose-100 text-rose-600', text: 'text-rose-700' },
  qualityChecksToDo: { bg: 'bg-sky-50', border: 'border-sky-200', activeBg: 'bg-sky-100', badge: 'bg-sky-100 text-sky-800', icon: 'bg-sky-100 text-sky-700', text: 'text-sky-800' },
  // 🆕 §21 (Sesiunea 154) — verde ca banii: e o sumă pe care clientul a acceptat-o și care nu intră
  // în casă până nu vine cineva la ușă. ⛔ Nu chihlimbar: nu are TERMEN, iar culoarea cu ceas
  // folosită unde nu e ceas o slăbește acolo unde e.
  quotesAcceptedToBook: { bg: 'bg-emerald-50', border: 'border-emerald-200', activeBg: 'bg-emerald-100', badge: 'bg-emerald-100 text-emerald-700', icon: 'bg-emerald-100 text-emerald-600', text: 'text-emerald-700' },
  // 🆕 Sesiunea 160 — amândouă albastru-ardezie, nu chihlimbar: niciuna n-are TERMEN promis, iar
  // culoarea cu ceas se slăbește dacă e folosită unde nu e ceas (aceeași regulă ca mai sus).
  followUpsDue: { bg: 'bg-teal-50', border: 'border-teal-200', activeBg: 'bg-teal-100', badge: 'bg-teal-100 text-teal-800', icon: 'bg-teal-100 text-teal-700', text: 'text-teal-800' },
  enquiriesAwaitingInfo: { bg: 'bg-cyan-50', border: 'border-cyan-200', activeBg: 'bg-cyan-100', badge: 'bg-cyan-100 text-cyan-800', icon: 'bg-cyan-100 text-cyan-700', text: 'text-cyan-800' },
  // 🆕 §34 — chihlimbar: aici CHIAR sunt rânduri cu ceas (ce s-a terminat, ce a expirat).
  stockNeeds: { bg: 'bg-amber-50', border: 'border-amber-200', activeBg: 'bg-amber-100', badge: 'bg-amber-100 text-amber-800', icon: 'bg-amber-100 text-amber-700', text: 'text-amber-800' },
  // §35 — roșu: o hârtie expirată oprește mașina legal, nu e o treabă de făcut săptămâna asta.
  vehiclePapers: { bg: 'bg-red-50', border: 'border-red-200', activeBg: 'bg-red-100', badge: 'bg-red-100 text-red-800', icon: 'bg-red-100 text-red-700', text: 'text-red-800' },
};

