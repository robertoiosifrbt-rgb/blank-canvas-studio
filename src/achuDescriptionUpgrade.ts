import { ACHU_BACKLOG_GROUPS, ACHU_BACKLOG_TASKS } from './data/achuBacklog';

type StoredTask = {
  id: string;
  name: string;
  description?: string;
  groupId?: string | null;
  children?: StoredTask[];
  [key: string]: unknown;
};

const VERSION_KEY = 'achuDescriptionsV2';
const PLACEHOLDER = /^\s*Status ACHU:\s*(De făcut|Partial|Parțial)\.?\s*$/i;

const groups = new Map(
  (ACHU_BACKLOG_GROUPS as readonly { id: string; name: string }[]).map((group) => [
    group.id,
    group.name.replace(/^\d+\.\s*/, '').trim(),
  ]),
);

const sentence = (text: string) => {
  const value = text.trim().replace(/[.]+$/, '');
  return value ? value[0].toLowerCase() + value.slice(1) : value;
};

const explain = (name: string, groupName: string) => {
  const title = name.trim().replace(/[.]+$/, '');

  const exact: Record<string, string> = {
    'Password reset': 'Permite utilizatorului să solicite resetarea parolei și să seteze în siguranță o parolă nouă prin fluxul de autentificare.',
    'Email verification': 'Verifică adresa de email a utilizatorului și tratează clar situațiile în care confirmarea lipsește, expiră sau este deja folosită.',
    'Change password': 'Permite utilizatorului autentificat să își schimbe parola în siguranță, cu validare și confirmarea rezultatului.',
    'Change email address': 'Permite schimbarea adresei de email a contului, cu verificarea noii adrese și fără pierderea legăturii cu profilul business.',
    'Expirarea sesiunii': 'Definește și aplică expirarea sesiunii astfel încât o sesiune invalidă sau expirată să nu mai poată accesa date protejate.',
    'Redirect după expirarea sesiunii': 'După expirarea sesiunii, trimite utilizatorul într-un ecran sigur de autentificare, fără bucle de redirect și fără acces la ruta protejată.',
    'Mesaj clar pentru sesiune expirată': 'Afișează un mesaj explicit care explică faptul că sesiunea a expirat și că utilizatorul trebuie să se autentifice din nou.',
    'Reautentificare fără pierderea formularului curent, unde este sigur': 'Păstrează datele nesensibile introduse într-un formular când sesiunea expiră și restaurează fluxul după reautentificare, numai acolo unde este sigur.',
    'Blocarea contului': 'Permite blocarea unui cont astfel încât utilizatorul să nu se mai poată autentifica sau folosi funcțiile protejate până la deblocare.',
    'Deblocarea contului': 'Permite deblocarea controlată a unui cont blocat și restabilirea accesului conform rolului său curent.',
    'Dezactivarea temporară a contului': 'Permite dezactivarea temporară a contului fără ștergerea datelor, cu refuzarea accesului cât timp contul este inactiv.',
    'Închiderea contului': 'Implementează închiderea contului cu tratamentul corect al datelor asociate, sesiunilor active și obligațiilor de audit/GDPR.',
    'Revocarea tuturor sesiunilor active': 'Oferă o acțiune care invalidează toate sesiunile active ale contului, inclusiv cele deschise pe alte dispozitive.',
    'Vizualizarea ultimului login': 'Afișează data și ora ultimei autentificări relevante pentru cont, folosind o sursă de date sigură și consecventă.',
    'Tratarea profilurilor duplicate': 'Detectează și tratează profilele business duplicate pentru același utilizator, fără alegerea arbitrară a unui profil și fără coruperea legăturilor existente.',
  };
  if (exact[title]) return exact[title];

  const patterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/^Testare\s+(.+)/i, (m) => `Testează ${sentence(m[1])} și acoperă atât fluxul normal, cât și cazurile de margine relevante, astfel încât regresiile să fie detectabile.`],
    [/^Audit pentru\s+(.+)/i, (m) => `Înregistrează în audit ${sentence(m[1])}, cu actorul, momentul și contextul necesar pentru a putea urmări ulterior acțiunea.`],
    [/^Mesaj separat pentru\s+(.+)/i, (m) => `Afișează un mesaj distinct pentru situația „${m[1].trim()}”, astfel încât utilizatorul să înțeleagă cauza și următoarea acțiune posibilă.`],
    [/^Protecție împotriva\s+(.+)/i, (m) => `Previne ${sentence(m[1])} și tratează cazul în mod sigur, fără expunere de date sau acces neautorizat.`],
    [/^Validarea\s+(.+)/i, (m) => `Validează ${sentence(m[1])} înainte de salvare sau procesare și afișează o eroare clară când regula nu este respectată.`],
    [/^Validare\s+(.+)/i, (m) => `Validează ${sentence(m[1])} înainte de salvare sau procesare și blochează datele invalide cu un mesaj clar.`],
    [/^Crearea\s+(.+)/i, (m) => `Permite crearea ${sentence(m[1])}, cu toate câmpurile obligatorii, validările și permisiunile necesare modulului.`],
    [/^Creare\s+(.+)/i, (m) => `Permite crearea ${sentence(m[1])}, cu validări, erori clare și salvarea corectă a datelor.`],
    [/^Editarea\s+(.+)/i, (m) => `Permite editarea ${sentence(m[1])} fără pierderea datelor existente și cu validarea modificărilor înainte de salvare.`],
    [/^Editare\s+(.+)/i, (m) => `Permite editarea ${sentence(m[1])}, păstrând consistența datelor și regulile de acces ale modulului.`],
    [/^Ștergerea\s+(.+)/i, (m) => `Permite ștergerea ${sentence(m[1])} numai când regulile de business o permit, cu protecție împotriva pierderii accidentale de date.`],
    [/^Ștergere\s+(.+)/i, (m) => `Implementează ștergerea ${sentence(m[1])} cu confirmare, verificări de dependențe și comportament sigur.`],
    [/^Afișarea\s+(.+)/i, (m) => `Afișează ${sentence(m[1])} într-un mod clar și consecvent, folosind datele reale și stările corecte ale modulului.`],
    [/^Afișare\s+(.+)/i, (m) => `Afișează ${sentence(m[1])} clar și consecvent în interfața relevantă.`],
    [/^Vizualizarea\s+(.+)/i, (m) => `Permite vizualizarea ${sentence(m[1])} numai utilizatorilor autorizați și prezintă informația într-o formă clară.`],
    [/^Filtrare(?:a)?\s+(.+)/i, (m) => `Permite filtrarea ${sentence(m[1])} după criteriile relevante și păstrează rezultatele corecte când filtrele sunt combinate sau resetate.`],
    [/^Căutare(?:a)?\s+(.+)/i, (m) => `Permite căutarea ${sentence(m[1])} rapid și predictibil, inclusiv pentru rezultate inexistente sau termeni parțiali unde este relevant.`],
    [/^Sortare(?:a)?\s+(.+)/i, (m) => `Permite sortarea ${sentence(m[1])} în ordine relevantă și menține ordinea consecventă după actualizarea datelor.`],
    [/^Export(?:ul)?\s+(.+)/i, (m) => `Permite exportul ${sentence(m[1])} într-un format utilizabil, respectând filtrele, permisiunile și datele afișate.`],
    [/^Import(?:ul)?\s+(.+)/i, (m) => `Permite importul ${sentence(m[1])} cu validarea fișierului, raportarea erorilor și evitarea duplicatelor nedorite.`],
    [/^Calcul(?:ul)?\s+(.+)/i, (m) => `Calculează ${sentence(m[1])} folosind reguli deterministe și verificabile, inclusiv pentru valori-limită și date lipsă.`],
    [/^Generare(?:a)?\s+(.+)/i, (m) => `Generează ${sentence(m[1])} din datele corecte ale sistemului și tratează explicit cazurile în care informațiile necesare lipsesc.`],
    [/^Trimitere(?:a)?\s+(.+)/i, (m) => `Trimite ${sentence(m[1])} către destinatarul corect, cu stare de succes/eșec și fără trimiteri duplicate accidentale.`],
    [/^Notificare(?:a)?\s+(.+)/i, (m) => `Notifică ${sentence(m[1])} la momentul potrivit, fără duplicate și cu informația necesară pentru acțiunea următoare.`],
    [/^Configurare(?:a)?\s+(.+)/i, (m) => `Permite configurarea ${sentence(m[1])} din setările potrivite și aplică modificarea în mod consecvent în sistem.`],
    [/^Integrare(?:a)?\s+(.+)/i, (m) => `Integrează ${sentence(m[1])} cu fluxul ACHU, cu autentificare, erori și sincronizare tratate explicit.`],
    [/^Redirect\s+(.+)/i, (m) => `Asigură redirecționarea ${sentence(m[1])}, fără bucle și fără posibilitatea de a ocoli regulile de acces.`],
    [/^Eliminarea\s+(.+)/i, (m) => `Elimină ${sentence(m[1])} și verifică faptul că informația veche nu mai influențează starea sau comportamentul curent.`],
    [/^Detectare(?:a)?\s+(.+)/i, (m) => `Detectează ${sentence(m[1])} în mod fiabil și oferă un rezultat clar pentru fluxul care trebuie să decidă ce urmează.`],
    [/^Prevenirea\s+(.+)/i, (m) => `Previne ${sentence(m[1])} prin validări și constrângeri aplicate înainte ca datele sau operațiunea să producă efecte nedorite.`],
    [/^Reconciliere(?:a)?\s+(.+)/i, (m) => `Reconciliază ${sentence(m[1])} folosind o regulă clară pentru diferențe, duplicate și situații care necesită intervenție manuală.`],
  ];

  for (const [pattern, build] of patterns) {
    const match = title.match(pattern);
    if (match) return build(match);
  }

  return `Implementează și clarifică funcționalitatea „${title}” în modulul „${groupName}”. Fluxul trebuie să aibă comportament predictibil, validări și mesaje de eroare clare, fără să ocolească permisiunile sau regulile de business existente.`;
};

const completionCriterion = (name: string) => {
  if (/^Testare\s+/i.test(name)) return 'Criteriu de finalizare: scenariul este testat reproductibil, iar rezultatul așteptat și cazurile de eroare sunt verificate.';
  if (/^Audit pentru\s+/i.test(name)) return 'Criteriu de finalizare: evenimentul apare o singură dată în audit, cu date suficiente pentru identificarea actorului și acțiunii.';
  if (/^(Mesaj|Afiș|Vizual|Filtr|Căut|Sort)/i.test(name)) return 'Criteriu de finalizare: comportamentul este vizibil în interfață, funcționează cu date reale și tratează corect stările goală, eroare și acces interzis unde se aplică.';
  return 'Criteriu de finalizare: fluxul principal funcționează cap-coadă, validările și permisiunile sunt respectate, erorile sunt explicite și nu apar efecte secundare sau duplicate nedorite.';
};

const buildDescription = (task: StoredTask) => {
  const current = typeof task.description === 'string' ? task.description.trim() : '';
  if (current && !PLACEHOLDER.test(current)) return current;

  const status = current || 'Status ACHU: De făcut';
  const groupName = task.groupId ? groups.get(task.groupId) || 'ACHU' : 'ACHU';
  return `${status}\n\nCe înseamnă: ${explain(task.name, groupName)}\n\n${completionCriterion(task.name)}`;
};

const enrich = (task: StoredTask): StoredTask => ({
  ...task,
  description: task.id.startsWith('achu-') ? buildDescription(task) : task.description,
  children: Array.isArray(task.children) ? task.children.map(enrich) : task.children,
});

const runUpgrade = () => {
  try {
    if (localStorage.getItem(VERSION_KEY) === '1') return;

    const source = (ACHU_BACKLOG_TASKS as unknown as StoredTask[]).map(enrich);
    const raw = localStorage.getItem('tasks');

    if (!raw) {
      localStorage.setItem('tasks', JSON.stringify(source));
      localStorage.setItem('achuTasksImportedV1', '1');
      localStorage.setItem(VERSION_KEY, '1');
      return;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    const sourceById = new Map(source.map((task) => [task.id, task]));
    const upgraded = parsed.map((value: unknown) => {
      if (!value || typeof value !== 'object') return value;
      const task = value as StoredTask;
      const sourceTask = sourceById.get(task.id);
      if (!sourceTask || !task.id.startsWith('achu-')) return task;

      const current = typeof task.description === 'string' ? task.description.trim() : '';
      if (current && !PLACEHOLDER.test(current)) return task;
      return { ...task, description: sourceTask.description };
    });

    const existingIds = new Set(
      upgraded
        .filter((task: unknown): task is StoredTask => Boolean(task) && typeof task === 'object' && typeof (task as StoredTask).id === 'string')
        .map((task: StoredTask) => task.id),
    );
    source.forEach((task) => {
      if (!existingIds.has(task.id)) upgraded.push(task);
    });

    localStorage.setItem('tasks', JSON.stringify(upgraded));
    localStorage.setItem(VERSION_KEY, '1');
  } catch {
    // Do not block application startup if browser storage is unavailable/corrupt.
  }
};

runUpgrade();
