/**
 * ACHU-401, felia a douăsprezecea — NOTIFICĂRILE PE TELEFON (push): apelurile, plus forma
 * fiecărui răspuns.
 *
 * ⛔ **Fișier propriu, nu tipuri adăugate în `endpoints.ts`:** acela are peste 1200 de rânduri
 * și **nu are voie să crească** (`AGENT_RULES` §7).
 *
 * ⚠️ **Altceva decât `notificationEndpoints.ts`** (felia 11): acela e clopoțelul DIN aplicație,
 * ăsta e livrarea către sistemul de operare al telefonului. Un mock pe tot modulul celuilalt
 * acoperea din greșeală și panoul ăsta — de-aia stau separat.
 *
 * 🔴 **Fiecare câmp e citit din `backend/src/routes/push.ts`**, din `res.json`-ul rutei care îl
 * produce.
 */
import { apiGet, apiPost } from './apiClient';

export type PushStatusResponse = {
  /** Serverul are cheile VAPID. Fals = butonul de activare nu poate funcționa, oricât s-ar apăsa. */
  configured: boolean;
  /** `null` cât timp nu e configurat. Nu e secret — vine de aici ca rotirea cheilor să nu ceară o recompilare. */
  publicKey: string | null;
  /** Câte dintre dispozitivele ACESTUI om sunt abonate. */
  deviceCount: number;
  /** Motivul, în cuvinte, când nu e configurat — ca ecranul să nu arate un buton care nu poate face nimic. */
  reason: string | null;
};

export function getPushStatus() {
  return apiGet<PushStatusResponse>('/push/status');
}

export function subscribeToPush(params: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  return apiPost<{ success: true; id: string }>('/push/subscribe', params);
}

export function unsubscribeFromPush(params: { endpoint: string }) {
  return apiPost<{ success: true; removed: number }>('/push/unsubscribe', params);
}

/**
 * ⚠️ `note` e prezent (nenul) exact când nu s-a trimis nimic **fiindcă nu e abonat niciun
 * dispozitiv** — „trimis 0" se citește ca eșec, dar cauza e alta și se poate repara.
 */
export type TestPushResponse = {
  success: true;
  sent: number;
  /** Abonamente moarte, șterse chiar acum de server. */
  removed: number;
  failed: number;
  note: string | null;
};

export function sendTestPush() {
  return apiPost<TestPushResponse>('/push/test', {});
}

/**
 * ⛔ Fără `endpoint` și fără chei: nimic din ele nu ajută un om să-și recunoască telefonul,
 * iar o cheie într-un răspuns JSON e o cheie în cache-ul browserului.
 */
export type PushDevice = {
  id: string;
  userAgent: string | null;
  createdAt: string;
  /** Ultima livrare reușită. `null` = nu a primit niciodată nimic. */
  lastSuccessAt: string | null;
  /**
   * 🆕 §20 „Delivery status" (Sesiunea 155) — starea, judecată pe server
   * (`backend/src/lib/pushDeviceState.ts`).
   *
   * ⛔ **Nu se derivă în ecran din `lastSuccessAt`:** cifra care contează e numărul de eșecuri
   * consecutive, iar el nu se vede din data ultimei livrări. 🔴 `failing` e singura stare care cere
   * ceva de la om; „nimic trimis încă" NU e o problemă și nu se arată ca una.
   */
  status: 'failing' | 'delivered' | 'waiting';
  /** Propoziția pentru om, scrisă de server ca cele trei ecrane să nu spună fiecare altceva. */
  label: string;
  needsAttention: boolean;
};

export function getPushDevices() {
  /** ⚠️ `note` spune ce NU poate arăta lista: un dispozitiv mort de tot nu mai are rând în ea. */
  return apiGet<{ devices: PushDevice[]; note: string }>('/push/devices');
}

export function removePushDevice(params: { id: string }) {
  return apiPost<{ success: true }>(`/push/devices/${params.id}/remove`, {});
}

/**
 * 🆕 §20 „Retry failed message" (ruta la Sesiunea 157, butonul la 158) — trimite ACUM, către UN
 * dispozitiv, și spune ce s-a întâmplat **cu el**.
 *
 * ⛔ **Nu retrimite un mesaj de dinainte, și numele rândului din backlog e înșelător:** aplicația nu
 * ține nicăieri „notificarea X a ajuns la telefonul Y" — există doar numărătoarea de eșecuri pe
 * dispozitiv. 🔴 Deci singurul lucru pe care un om îl poate face cu un telefon care eșuează e să afle
 * dacă mai eșuează. Motivele întregi: `backend/src/routes/push.ts`.
 *
 * ⚠️ `verdict: 'removed'` e un răspuns **diferit** de `'failed'`: rândul nu mai există, deci nu mai
 * are ce reîncerca — notificările trebuie aprinse din nou pe telefonul acela. `device` e `null` atunci.
 */
export function testPushDevice(params: { id: string }) {
  return apiPost<{
    verdict: 'sent' | 'removed' | 'failed';
    removed: boolean;
    /** Propoziția vine de la server, ca ecranele să nu scrie fiecare alta. */
    message: string;
    device: PushDevice | null;
  }>(`/push/devices/${params.id}/test`, {});
}

/**
 * Admin-only. Returns a fresh VAPID keypair, shown once and never stored.
 *
 * ⚠️ `privateKey` **nu se salvează nicăieri** — se arată o dată și se lipește în Railway.
 * `instructions` vine de pe server, click cu click, fiindcă cei care o rulează nu sunt developeri.
 */
export type GeneratePushKeysResponse = {
  success: true;
  publicKey: string;
  privateKey: string;
  instructions: string[];
  warning: string;
};

export function generatePushKeys() {
  return apiPost<GeneratePushKeysResponse>('/push/generate-keys', {});
}

