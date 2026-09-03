# Roberto OS

Panou personal: finanțe, datorii, task-uri, obiceiuri și jurnal.

Totul e într-un singur fișier — `index.html`. Fără instalare, fără server,
fără cont. Îl deschizi și merge.

## Cum îl folosești

**Direct de pe calculator** — descarci `index.html` și îl deschizi cu dublu-click.

**Ca site public** — activezi GitHub Pages:
1. Settings → Pages
2. La *Source* alegi `Deploy from a branch`
3. Branch: `main`, folder: `/ (root)` → Save
4. După un minut apare la adresa afișată tot acolo, în Settings → Pages

## Unde stau datele

În browserul de pe care îl deschizi (`localStorage`). Nu pleacă nicăieri —
nici la GitHub, nici în altă parte. Nu se sincronizează între telefon și
laptop: fiecare aparat își ține propriile date.

Din **Setări** poți exporta tot într-un fișier, oricând.

## Varianta sincronizată (opțional)

Pe lângă fișierul autonom, aplicația poate rula ca Artifact pe claude.ai, cu
bază de date reală — atunci datele se sincronizează între telefon și laptop,
în loc să stea separat pe fiecare aparat.

Se publică dintr-o sesiune Claude Code deschisă pe acest repo, cu:

> Publică `index.html` ca Artifact, cu capabilities `db` și `downloads`.
> Titlu: Roberto OS.

Câteva lucruri de știut:

- **Proprietarul e contul care publică.** Doar el poate actualiza acel link
  mai târziu. Publică din contul pe care vrei să-l ai proprietar.
- Codul e același. Detectează singur unde rulează: dacă găsește baza de
  date o folosește, altfel trece pe stocare locală. Nu se modifică nimic
  în fișier.
- Un Artifact cu bază de date nu poate fi făcut public — cine îl deschide
  trebuie să fie în aceeași organizație cu proprietarul. Accesul se dă din
  meniul de share al paginii.
- Datele aparțin acelui Artifact. Dacă îl ștergi, se șterg cu el, iar dacă
  publici din alt cont pornești cu baza goală. Exportă înainte, din Setări.
