import { ACHU_BACKLOG_GROUPS, ACHU_BACKLOG_TASKS } from './data/achuBacklog';

type Task = { id: string; name: string; description?: string; groupId?: string | null; children?: Task[]; [key: string]: unknown };

const VERSION_KEY = 'achuSourceDescriptionsV1';
const GENERATED = /(Ce trebuie făcut:|Ce înseamnă:|Finalizat când:|Criteriu de finalizare:)/i;
const PLACEHOLDER = /^\s*Status ACHU:\s*(De făcut|Partial|Parțial)\.?\s*$/i;

const groupNames = new Map((ACHU_BACKLOG_GROUPS as readonly { id: string; name: string }[]).map(g => [g.id, g.name]));

// Context preluat din „Hartă de priorități” și notele secțiunilor din Backlog_Functionalitati_Viitoare.md.
const sourceContext: Record<string, string> = {
  'achu-group-1': 'Majoritatea elementelor de bază pentru autentificare sunt deja reparate; au rămas mai ales cazuri de margine precum multi-tab, PWA reopen și fluxurile native Supabase Auth (password reset / change email) care trebuie conectate în UI.',
  'achu-group-2': 'Rolurile granulare devin importante când echipa Admin crește peste 1–2 persoane; este o zonă de scalare, nu construcție de bază.',
  'achu-group-5': 'Property management este identificat în backlog ca diferențiator de business cu valoare mare și cost mediu.',
  'achu-group-6': 'Quote Requests este un modul de bază deja construit; itemurile rămase sunt rafinări ale fluxului existent, nu reconstrucție de la zero.',
  'achu-group-7': 'Pricing engine este identificat în backlog ca diferențiator de business cu valoare mare și cost mediu.',
  'achu-group-8': 'Services catalogue este identificat în backlog ca diferențiator de business cu valoare mare și cost mediu.',
  'achu-group-9': 'Jobs este un modul de bază deja construit; itemurile rămase sunt rafinări ale funcționalității existente.',
  'achu-group-10': 'Job statuses/state machine este deja parte din modulul Jobs; itemurile rămase sunt rafinări ale fluxului existent.',
  'achu-group-11': 'Scheduling și calendar este identificat în backlog ca diferențiator de business cu valoare mare și cost mediu.',
  'achu-group-12': 'Cleaner assignment este deja parte din modulul de bază; itemurile rămase sunt rafinări ale funcției existente.',
  'achu-group-13': 'Cleaner availability și workforce planning este identificat în backlog ca diferențiator de business cu valoare mare și cost mediu.',
  'achu-group-14': 'Cleaner onboarding și compliance este identificat în backlog ca diferențiator de business cu valoare mare și cost mediu.',
  'achu-group-15': 'Cleaner Portal există deja; backlog-ul tratează aici în principal extinderi ale portalului existent.',
  'achu-group-16': 'Job checklists există deja ca parte din modulul de bază; itemurile rămase sunt rafinări.',
  'achu-group-17': 'Time tracking este important inclusiv pentru payroll; secțiunea a fost reconciliată după ACHU-267, iar un gol real notat este că cleanerii nu își pot înregistra singuri orele.',
  'achu-group-18': 'Recurring services are valoare mare dacă există mulți clienți pe contract recurent și este tratat ca diferențiator de business.',
  'achu-group-19': 'Customer Portal există deja; backlog-ul tratează aici în principal extinderi ale portalului existent.',
  'achu-group-20': 'Communication centre este identificat în backlog ca diferențiator de business cu valoare mare și cost mediu.',
  'achu-group-23': 'Payments este un modul de bază deja construit; itemurile rămase sunt rafinări ale funcționalității existente.',
  'achu-group-24': 'Invoicing este identificat ca diferențiator de business; secțiunea a fost reconciliată cu codul deoarece mai multe funcții erau deja construite, deși rămăseseră nebifate.',
  'achu-group-25': 'Expenses este un modul de bază deja construit; itemurile rămase sunt rafinări ale funcționalității existente.',
  'achu-group-26': 'Profitability și management accounting necesită reconciliere separată după ACHU-269, care a schimbat premisa raportului prin introducerea costului muncii.',
  'achu-group-27': 'Cleaner pay și labour cost a fost reconciliat după ACHU-267; backlog-ul notează explicit că aprobarea și plata trebuie legate pentru a evita plata aceleiași săptămâni de două ori.',
  'achu-group-28': 'Complaints este identificat în backlog ca diferențiator de business cu valoare mare și cost mediu.',
  'achu-group-29': 'Incidents și damage este identificat în backlog ca diferențiator de business cu valoare mare și cost mediu.',
  'achu-group-30': 'Re-clean workflow este identificat în backlog ca diferențiator de business cu valoare mare și cost mediu.',
  'achu-group-31': 'Quality assurance este identificat în backlog ca diferențiator de business cu valoare mare și cost mediu.',
  'achu-group-32': 'Photos și file uploads este o zonă de scalare pentru echipă și volum mai mare, nu o prioritate de lansare.',
  'achu-group-33': 'Document management este o zonă de scalare pentru echipă și volum mai mare.',
  'achu-group-34': 'Equipment și inventory este o zonă de scalare pentru echipă și volum mai mare.',
  'achu-group-35': 'Vehicles și travel este o zonă de scalare pentru echipă și volum mai mare.',
  'achu-group-36': 'Reviews și feedback este identificat în backlog ca diferențiator de business cu valoare mare și cost mediu.',
  'achu-group-37': 'Dashboard este un modul de bază deja construit; itemurile rămase sunt rafinări ale funcționalității existente.',
  'achu-group-38': 'Reports și exports este identificat în backlog ca diferențiator de business cu valoare mare și cost mediu.',
  'achu-group-39': 'Audit trail de bază există deja prin AuditEvents; majoritatea acțiunilor de business sunt deja auditate.',
  'achu-group-40': 'Data quality și duplicate prevention este o zonă de scalare pentru volume mai mari de date.',
  'achu-group-41': 'Bulk operations este o zonă de scalare pentru echipă și volum mai mare.',
  'achu-group-42': 'Notifications inside application devine rapid necesar cu volum real, de exemplu pentru job nou sau plată restantă.',
  'achu-group-43': 'Tasks și internal workflow este o zonă de scalare pentru echipă și volum mai mare.',
  'achu-group-44': 'RBAC de bază există deja prin invitații; backlog-ul tratează restul ca extindere și hardening de securitate.',
  'achu-group-45': 'Privacy și GDPR este tratat în backlog ca obligație legală UK și nu ca funcție opțională.',
  'achu-group-46': 'Reliability și error handling este hardening continuu cu valoare mare; secțiunea a fost reconciliată item cu item și unele acoperiri au rămas intenționat parțiale.',
  'achu-group-47': 'Performance este o zonă de scalare pentru volume mai mari de date și utilizare.',
  'achu-group-48': 'UX și accessibility este o zonă de scalare/polish pentru produs.',
  'achu-group-49': 'Integrarea website-ului are o decizie separată: formularul public de quote este deja live; pentru rest trebuie clarificat ce poate face vizitatorul neautentificat față de clientul logat.',
  'achu-group-50': 'Integrations este o zonă de scalare pentru conectarea ACHU cu servicii externe.',
  'achu-group-51': 'Configuration și business settings este o zonă de scalare pentru configurare mai flexibilă a firmei.',
  'achu-group-52': 'Testing și production readiness este tratat ca suită formală pe termen lung; testarea manuală continuă rămâne obligatorie.',
  'achu-group-53': 'Abonamentele de curățenie înseamnă contract recurent + termen plătit integral în avans (1/3/6/12 luni) + discount crescător cu termenul și se construiesc peste RecurringSeries, nu ca sistem paralel.'
};

const sourceById = new Map((ACHU_BACKLOG_TASKS as unknown as Task[]).map(t => [t.id, t]));

const cleanOne = (task: Task): Task => {
  if (!task.id?.startsWith('achu-')) return task;
  const src = sourceById.get(task.id);
  const srcDescription = typeof src?.description === 'string' ? src.description.trim() : '';
  let description = typeof task.description === 'string' ? task.description.trim() : '';
  if (GENERATED.test(description)) description = srcDescription;
  if ((!description || PLACEHOLDER.test(description)) && task.groupId && sourceContext[task.groupId]) {
    const status = srcDescription || description || 'Status ACHU: De făcut';
    description = `${status}\n\nContext din backlog: ${sourceContext[task.groupId]}`;
  }
  return { ...task, description, children: Array.isArray(task.children) ? task.children.map(cleanOne) : task.children };
};

export const applyAchuSourceDescriptions = () => {
  try {
    if (localStorage.getItem(VERSION_KEY) === '1') return;
    const raw = localStorage.getItem('tasks');
    if (!raw) { localStorage.setItem(VERSION_KEY, '1'); return; }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    localStorage.setItem('tasks', JSON.stringify(parsed.map((v: unknown) => v && typeof v === 'object' ? cleanOne(v as Task) : v)));
    localStorage.setItem(VERSION_KEY, '1');
  } catch { /* do not block startup */ }
};
