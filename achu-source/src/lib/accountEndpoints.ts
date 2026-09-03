/**
 * ACHU-401, felia a treisprezecea — CONTURILE, ROLUL și INVITAȚIILE: apelurile, plus forma
 * fiecărui răspuns.
 *
 * ⛔ **Fișier propriu, nu tipuri adăugate în `endpoints.ts`:** acela are peste 1200 de rânduri
 * și **nu are voie să crească** (`AGENT_RULES` §7).
 *
 * 🔴 **Zona asta a fost aleasă anume.** E singura unde un defect înseamnă *cineva vede ce nu
 * trebuie* — și e chiar zona pe care Roberto a numit-o „neverificată" pe 15/08. Tipizarea nu
 * ține locul verificării rută cu rută, dar pune numele rolurilor **într-un singur loc**, iar de
 * acolo o valoare inventată nu mai compilează.
 *
 * ⚠️ **Rolurile sunt `string` acolo unde COLOANA e `String`, și uniune acolo unde SERVERUL
 * validează un enum.** Diferența e reală: `Invitation.role` trece prin `z.enum` la creare
 * (`backend/src/routes/invitations.ts`), deci se poate afirma; `UserAccount.role` e o coloană
 * liberă, iar o uniune aici ar afirma ceva ce baza nu garantează.
 */
import { apiGet, apiPost } from './apiClient';

/** Rolurile care se acordă **numai** prin invitație. Sursa: `z.enum` din `invitations.ts`. */
export type InvitableRole = 'Admin' | 'Cleaner' | 'ReadOnly' | 'FinanceOnly' | 'HROnly';

/**
 * Un rând din lista de conturi.
 *
 * ⚠️ Ruta împrăștie rândul Prisma întreg și adaugă trei câmpuri derivate
 * (`backend/src/routes/userAccounts.ts:43`). Modelul are exact câmpurile de mai jos — verificat
 * în `schema.prisma`, nu presupus din ecran.
 */
export type UserAccountRow = {
  id: string;
  userAccountId: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  /** ⛔ `string`, nu o uniune: coloana e `String` liberă în bază. */
  role: string;
  customerId: string | null;
  cleanerId: string | null;
  active: boolean;
  /**
   * 🆕 §3 „Data dezactivării" + „Motiv de dezactivare" (Sesiunea 158).
   *
   * 🔴 Un cont oprit avea doar `active: false` — iar întrebarea „de când nu mai poate intra și de ce"
   * vine mereu de la omul care nu mai poate intra, la telefon. ⚠️ Amândouă sunt `null` pe un cont
   * activ: se **șterg** la reactivare, fiindcă un cont activ care poartă „oprit pe 3 august" spune
   * ceva fals despre prezent. ⛔ Istoria rămâne în audit, care e locul ei.
   */
  deactivatedAt: string | null;
  deactivationReason: string | null;
  /**
   * 🆕 §3 „Note administrative despre cont" (Sesiunea 158) — ce știe biroul despre contul ăsta.
   *
   * ⚠️ **Despre CONT, nu despre persoană:** „nu mai răspunde la telefon", „a cerut să fie oprit
   * temporar", „i-am trimis invitație de trei ori". 🔴 La salvare, câmpul **absent** înseamnă „nu
   * atinge", iar `null` înseamnă „șterge" — deci un ecran care nu-l trimite nu golește nota.
   */
  notes: string | null;
  createdAt: string;
  /** Derivat pe server: clientul/curățătorul legat, sau `''` când nu e legat niciunul. */
  customerName: string;
  cleanerName: string;
  /** Derivat pe server: alt cont poartă același email, ignorând majusculele. */
  duplicateEmail: boolean;
  /**
   * 🔴 ACHU-790 (Sesiunea 157) — **alte conturi legate la ACELAȘI profil** (client sau curățător).
   *
   * ⚠️ Măsurat: `customerId`/`cleanerId` nu sunt unice, iar nicio rută nu verifică legarea — deci doi
   * oameni pot vedea vizitele aceluiași curățător, sau portalul aceluiași client. ⛔ Ruta doar
   * **spune**; refuzul e o hotărâre de acces a owner-ului (ACHU-790 în registru).
   */
  sharedProfileWith: string[];
  /** 🔴 Cel puțin unul dintre celelalte conturi e **activ** — riscul e viu acum, nu o urmă veche. */
  sharedProfileActive: boolean;
  /**
   * 🆕 §1 „Vizualizarea ultimului login" / §3 „Last active" (Sesiunea 155) — ultima intrare,
   * întrebată **jurnalului de audit** (`backend/src/lib/lastSignIn.ts`), nu ținută într-o coloană.
   *
   * ⛔ `null` = **niciun rând scris**, nu „nu a intrat niciodată": jurnalul de intrări e mai tânăr
   * decât conturile. 🔴 De asta eticheta vine de la server și spune „No sign-in recorded".
   */
  lastSignInAt: string | null;
  label: string;
  everRecorded: boolean;
  /** 🔴 MOȘTENIT — vezi ACHU-524. Nu vine de pe ruta asta; rămâne ca ecranul de sortare să compileze. */
  createdDate?: string;
};

/** Doar cât îi trebuie selectorului de legare. */
export type LinkOption = { id: string; customerName?: string; cleanerName?: string };

export function getUserAccounts(_params: Record<string, never> = {}) {
  /**
   * ⚠️ Propozițiile vin de la server, fiecare lângă cifra pe care o explică: `signInNote` — ce nu
   * poate ști coloana de intrări; `sharedProfileNote` — ce e de făcut cu un profil legat la două
   * conturi (ACHU-790).
   */
  return apiGet<{
    records: UserAccountRow[]; customers: LinkOption[]; cleaners: LinkOption[];
    signInNote: string; sharedProfileNote: string;
  }>('/user-accounts');
}

/**
 * ⚠️ Două forme, după cum s-a editat sau s-a creat: la editare vine doar `{ success, id }`, la
 * creare și `message` — propoziția care spune că omul trebuie să se înregistreze cu **același**
 * email. De-aia `message` e opțional și nu se poate afișa necondiționat.
 */
export function saveUserAccount(data: Record<string, unknown>) {
  return apiPost<{ success: true; id: string; message?: string }>('/user-accounts/save', data);
}

/**
 * 🆕 §3 „Istoric al accesului" (Sesiunea 157) — toate intrările scrise pentru UN cont.
 *
 * ⛔ **Nu se cheamă ruta de audit cu emailul în filtru:** acolo `performedBy` se caută cu
 * `contains`, iar `ana@achu.uk` e conținut în `diana@achu.uk` — pe contul Anei ar fi apărut
 * intrările Dianei. 🔴 Ruta asta leagă pe **egalitate** de email și primește un **id de cont**,
 * nu o adresă. Restul hotărârilor: `backend/src/lib/accessHistory.ts`.
 */
export type AccessEventRow = {
  id: string;
  /** ⛔ Moment ISO din bază — se afișează cu `fmtDateTime`, care traduce în ora UK (ACHU-787). */
  at: string;
  /** `ui` | `api` | `system`, sau `null` pe rândurile de dinainte de 22/08/2026. ⛔ Indiciu, nu dovadă. */
  source: string | null;
};

export type AccessHistoryResponse = {
  /** Emailul, cum e scris pe CONT. */
  email: string;
  records: AccessEventRow[];
  /** Câte rânduri EXISTĂ, nu câte s-au trimis. */
  total: number;
  offset: number;
  hasMore: boolean;
  /** Propoziția care spune ce NU înseamnă lista — de la server, ca să nu existe două variante. */
  note: string;
};

/**
 * 🆕 §1 „Revocarea tuturor sesiunilor active" (Sesiunea 160) — SCOATE-L DE PE TOATE DISPOZITIVELE.
 *
 * ⛔ **Nu stinge contul** — omul intră înapoi imediat, cu o autentificare nouă. Aia e chiar
 * diferența față de butonul de dezactivare de lângă el.
 *
 * ⚠️ `self` vine de la server: când omul s-a scos pe el însuși, următoarea lui cerere e refuzată,
 * deci ecranul trebuie să-l ducă la autentificare în loc să-l lase să apese mai departe.
 */
/**
 * 🆕 §1 „Închiderea contului" (Sesiunea 160) — CONTUL UNUI OM DIN FIRMĂ, ÎNCHIS LA CEREREA LUI.
 *
 * ✅ Hotărârea lui Roberto, 29/08/2026: nu se șterge decât dacă o cere el; altfel se arhivează.
 *
 * ⛔ **Nu merge pe conturi de client** — alea au drumul lor, care șterge și datele de business.
 * Serverul refuză, cu propoziția care spune unde e drumul acela.
 */
export function closeAccountOnRequest(accountId: string, note?: string) {
  return apiPost<{ success: true; alreadyClosed: boolean; employmentRecordKept?: boolean }>(
    '/user-account-closure/close', note ? { accountId, note } : { accountId });
}

export function revokeAccountSessions(accountId?: string) {
  return apiPost<{ success: true; sessions: number; self: boolean }>('/user-account-sessions/revoke', accountId ? { accountId } : {});
}

export function getAccountAccessHistory(params: { id: string; offset?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params.offset !== undefined) q.set('offset', String(params.offset));
  if (params.limit !== undefined) q.set('limit', String(params.limit));
  const qs = q.toString();
  return apiGet<AccessHistoryResponse>(`/user-accounts/${params.id}/access-history${qs ? `?${qs}` : ''}`);
}

/**
 * Cine ești și ce ai voie. ⛔ Fără parametri, deliberat: serverul citește emailul din sesiune.
 *
 * ⚠️ `role: null` cu `active: false` **nu** e o eroare — e contul care s-a autentificat fără să
 * fi fost invitat. `configError` e propoziția pentru om atunci când contul există dar e legat
 * greșit; `null` înseamnă că nu e nimic de spus.
 */
export type UserRoleResponse = {
  role: string | null;
  active: boolean;
  customerId: string | null;
  cleanerId: string | null;
  configError: string | null;
  firstName: string | null;
  lastName: string | null;
  /** Prezent doar dacă o reparație automată a scris ceva ce merită văzut într-un jurnal. */
  auditWarning?: string;
};

export function getUserRole(_params: Record<string, never> = {}) {
  return apiGet<UserRoleResponse>('/get-user-role');
}

export function completeProfile(data: { firstName: string; lastName: string }) {
  return apiPost<{ success: true; firstName: string; lastName: string }>('/complete-profile', data);
}

/**
 * O invitație, așa cum o vede biroul.
 *
 * ⛔ **`token` nu apare aici, și lipsa lui e o decizie:** cine îl are, îl poate folosi, deci
 * serverul nu îl mai trimite niciodată după creare (`invitations.ts:107`).
 *
 * ⚠️ `status` e calculat la citire (`effectiveStatus`), nu scris în bază — un `GET` nu scrie.
 * Deci o invitație expirată apare ca `Expired` fără ca rândul să fi fost atins.
 */
export type InvitationRow = {
  id: string;
  email: string;
  role: string;
  status: 'Pending' | 'Accepted' | 'Revoked' | 'Expired';
  cleanerId: string | null;
  cleanerName: string | null;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
};

export function getInvitations(_params: Record<string, never> = {}) {
  return apiGet<{ records: InvitationRow[] }>('/invitations');
}

/**
 * ACHU-348 added `ReadOnly` — an admin who cannot change anything. ACHU-357 added
 * `FinanceOnly` and `HROnly` — admins narrowed to one subject, full inside it.
 * All granted by invitation like Admin and Cleaner, per ACHU-142.
 *
 * 🔴 **`token` se întoarce O SINGURĂ DATĂ, aici.** E linkul care se trimite omului; după
 * răspunsul ăsta nu mai există nicio cale de a-l afla.
 */
export function createInvitation(data: {
  email: string;
  role: InvitableRole;
  cleanerId?: string;
}) {
  return apiPost<{ success: true; id: string; token: string; expiresAt: string }>('/invitations', data);
}

export function revokeInvitation(params: { id: string }) {
  return apiPost<{ success: true }>(`/invitations/${params.id}/revoke`, {});
}

/**
 * Ce e în spatele unui link de invitație, **înainte** de a-l accepta.
 *
 * ⚠️ Un token nevalid **nu** e o eroare HTTP: ruta răspunde 200 cu `valid: false` și un motiv.
 * Deliberat — ecranul poate spune *„linkul a expirat"* în loc de *„a apărut o eroare"*, iar
 * cele două se citesc complet diferit de către cel care tocmai a primit invitația.
 *
 * ⛔ **O singură formă cu câmpuri opționale, NU o uniune discriminată** — și nu din comoditate:
 * `tsconfig.app.json` are `strict: false`, deci `strictNullChecks` e oprit, iar sub el
 * `valid: true` / `valid: false` **nu discriminează** — `if (!r.valid)` nu îngustează nimic și
 * `r.reason` nu compilează. Măsurat, nu presupus: varianta cu uniune a picat build-ul pe trei
 * rânduri din `AcceptInvitePage.tsx`. ⚠️ Serverul chiar trimite două forme; tipul spune care
 * câmp vine cu care, în comentariu, fiindcă atât poate compilatorul de aici.
 */
export type InvitationLookup = {
  valid: boolean;
  /** Doar când `valid` e adevărat. */
  email?: string;
  role?: string;
  /** Doar când `valid` e fals. */
  reason?: 'not_found' | 'expired' | 'revoked' | 'accepted';
};

export function lookupInvitation(params: { token: string }) {
  return apiGet<InvitationLookup>(`/invitations/lookup/${params.token}`);
}

/** ⚠️ `customerId` e mereu `null`: un client nu ajunge niciodată aici, are alt drum. */
export function acceptInvitation(params: { token: string }) {
  return apiPost<{
    success: true;
    role: string;
    active: true;
    cleanerId: string | null;
    customerId: null;
  }>('/invitations/accept', params);
}

