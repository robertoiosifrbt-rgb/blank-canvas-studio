type AchuTaskLike = { id: string; name: string; description?: string; groupId?: string | null };

const PLACEHOLDER = /^\s*Status ACHU:\s*(De făcut|Partial|Parțial)\.?\s*$/i;

const actionText = (name: string) => {
  const title = name.trim().replace(/[.]+$/, '');
  const lower = title ? title[0].toLowerCase() + title.slice(1) : title;
  if (/^Testare\s+/i.test(title)) return `Testează „${title.replace(/^Testare\s+/i, '')}” pe fluxul normal și pe cazurile de eroare relevante.`;
  if (/^Audit pentru\s+/i.test(title)) return `Înregistrează corect în audit „${title.replace(/^Audit pentru\s+/i, '')}”, cu actor, moment și context.`;
  if (/^(Validare|Validarea)\s+/i.test(title)) return `Validează ${lower.replace(/^(validare|validarea)\s+/i, '')} înainte de salvare sau procesare și afișează o eroare clară când regula nu este respectată.`;
  if (/^(Creare|Crearea)\s+/i.test(title)) return `Permite ${lower}, cu toate validările, permisiunile și stările de eroare necesare.`;
  if (/^(Editare|Editarea)\s+/i.test(title)) return `Permite ${lower}, fără pierderea datelor existente și cu verificarea permisiunilor.`;
  if (/^(Ștergere|Ștergerea)\s+/i.test(title)) return `Permite ${lower} în siguranță, cu confirmare și verificarea dependențelor relevante.`;
  if (/^(Afișare|Afișarea|Vizualizare|Vizualizarea)\s+/i.test(title)) return `Implementează ${lower} folosind date reale, stări corecte și acces numai pentru rolurile autorizate.`;
  if (/^(Filtrare|Filtrarea|Căutare|Căutarea|Sortare|Sortarea)\s+/i.test(title)) return `Implementează ${lower} predictibil, inclusiv pentru rezultate goale, resetare și combinații relevante.`;
  if (/^(Trimitere|Trimiterea|Notificare|Notificarea)\s+/i.test(title)) return `Implementează ${lower} către destinatarul corect, fără duplicate și cu tratarea explicită a eșecurilor.`;
  return `Implementează funcționalitatea „${title}” astfel încât fluxul să fie clar, complet și verificabil, cu validări, permisiuni și erori tratate explicit.`;
};

export const describeAchuTask = (task: AchuTaskLike, groupName = 'ACHU') => {
  const current = typeof task.description === 'string' ? task.description.trim() : '';
  if (!task.id.startsWith('achu-') || (current && !PLACEHOLDER.test(current))) return current;
  const status = current || 'Status ACHU: De făcut';
  return `${status}\n\nCe trebuie făcut: ${actionText(task.name)}\n\nContext: task din modulul „${groupName.replace(/^\d+\.\s*/, '')}”.\n\nFinalizat când: funcția merge cap-coadă cu date reale, respectă permisiunile și validările, iar cazurile de eroare nu produc date incorecte sau acțiuni duplicate.`;
};
