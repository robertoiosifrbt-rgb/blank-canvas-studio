/**
 * ACHU-401, felia a unsprezecea — CHATUL INTERN: apelurile lui, plus formele răspunsurilor.
 *
 * ⛔ **Fișier propriu, nu tipuri adăugate în `endpoints.ts`:** acela are peste 1300 de rânduri
 * și **nu are voie să crească** (`AGENT_RULES` §7). Același tipar ca `absenceEndpoints.ts`
 * (felia 10) și `portalTypes.ts` (felia 7): funcțiile pleacă din orchestrator cu totul, nu
 * rămân acolo cu un tip pus deasupra.
 *
 * 🔴 **Fiecare câmp de aici e citit din `backend/src/routes/chat.ts`**, din `res.json`-ul rutei
 * care îl produce — nu ghicit din cum arată ecranul. Un tip inventat e mai rău decât `any`:
 * `any` măcar nu minte.
 *
 * ⚠️ **`ChatChannel` și `ChatMessage` stăteau în `useChat.ts`** și erau deja corecte. Nu s-au
 * rescris — s-au **mutat** aici, lângă funcția care le produce, iar `useChat.ts` le re-exportă
 * ca `ChatView.tsx` să nu afle de mutare. Un fapt, un singur loc (`AGENT_RULES` §11).
 *
 * ⚠️ **Datele sunt `string`, nu `Date`:** ce trece prin JSON ajunge text, oricât de mult
 * seamănă cu un `DateTime` în Prisma.
 */
import { apiGet, apiPost, apiPatch, apiDelete } from './apiClient';

/**
 * 🆕 §22 „Chat în bara de sus" (Sesiunea 158) — o cifră, dintr-o rută proprie.
 *
 * ⛔ **NU se citește din `getChatChannels()`.** Aceea calculează necitite per canal plus ultimul
 * mesaj, apoi sortează — iar iconița stă pe **fiecare** ecran, la fiecare 30 de secunde. 🔴 A trage
 * tot setul ca să afișezi un număr e greșeala pentru care ACHU-181 e încă deschisă pe Dashboard.
 * 📜 Aceeași alegere ca la clopoțel, pentru același motiv.
 */
export function getChatUnreadCount() {
  return apiGet<{ unreadCount: number }>('/chat/unread-count');
}

/** Un rând din bara laterală. `displayName` e compus de server: un DM se numește după celălalt om. */
export type ChatChannel = {
  id: string;
  kind: 'channel' | 'dm';
  name: string | null;
  description: string | null;
  visibility: 'all' | 'adminOnly';
  displayName: string;
  unreadCount: number;
  /** `null` pentru un canal fără niciun mesaj încă — acelea se sortează la urmă. */
  lastMessageAt: string | null;
};

export type ChatMessage = {
  id: string;
  /** `null` pe un mesaj șters: serverul nu mai trimite textul deloc, nu îl ascunde ecranul. */
  body: string | null;
  /**
   * ACHU-219. URL semnat, valabil o oră — bucketul `chat-photos` e PRIVAT, deci nu există
   * link permanent. `null` fie pentru un mesaj fără poză, fie pentru unul a cărui semnare
   * a eșuat: `hasPhoto` deosebește cele două cazuri, ca ecranul să poată spune „poză
   * indisponibilă" în loc să nu arate nimic.
   */
  photoUrl?: string | null;
  hasPhoto?: boolean;
  deleted: boolean;
  createdAt: string;
  editedAt: string | null;
  authorId: string;
  /** `'Unknown'` dacă autorul nu mai există — serverul nu lasă niciodată gol. */
  authorName: string;
  authorRole: string | null;
  mine: boolean;
};

/** Cine poate primi un DM. ⛔ Clienții nu apar deloc: nu au acces la chat. */
export type ChatPerson = { id: string; name: string; role: string };

export type ChatChannelsResponse = { channels: ChatChannel[] };
export type ChatPeopleResponse = { people: ChatPerson[] };
/** `hasMore` spune dacă mai există pagini mai vechi, nu câte. */
export type ChatMessagesResponse = { hasMore: boolean; messages: ChatMessage[] };

/** Răspunsul comun al scrierilor de mesaje (trimitere, poză). */
export type ChatMessageWritten = { success: true; id: string; createdAt: string };
/** Marcarea ca citit, editarea și ștergerea nu întorc nimic altceva. */
export type ChatAck = { success: true };

/**
 * ⚠️ `created` deosebește „am deschis DM-ul existent" de „am creat unul" — ruta caută întâi,
 * și tot ea prinde cazul în care doi oameni apasă în același moment.
 */
export type ChatChannelCreated = { success: true; id: string; created?: boolean };

export function getChatChannels() {
  return apiGet<ChatChannelsResponse>('/chat/channels');
}

export function getChatPeople() {
  return apiGet<ChatPeopleResponse>('/chat/people');
}

export function createChatChannel(params: { name: string; description?: string; visibility?: 'all' | 'adminOnly' }) {
  return apiPost<ChatChannelCreated>('/chat/channels', params);
}

export function openChatDm(params: { userId: string }) {
  return apiPost<ChatChannelCreated>('/chat/dm', params);
}

export function getChatMessages(params: { channelId: string; before?: string }) {
  const { channelId, ...query } = params;
  return apiGet<ChatMessagesResponse>(`/chat/channels/${channelId}/messages`, query);
}

export function sendChatMessage(params: { channelId: string; body: string }) {
  return apiPost<ChatMessageWritten>(`/chat/channels/${params.channelId}/messages`, { body: params.body });
}

/**
 * ACHU-219 — o poză în chat. **Rută separată de cea de mesaje, nu un câmp în plus.**
 *
 * ⚠️ Motivul e pe server (`backend/src/lib/bodyParsers.ts`): calea asta primește un plafon
 * de cerere de 22 MB, fiindcă o poză de 15 MB pleacă codificată ca ~20 MB. Trimisă prin ruta
 * de mesaje, ar fi ridicat acel plafon pentru **fiecare mesaj de text** din aplicație.
 *
 * `caption` e opțional: un mesaj doar-poză e permis, iar `body` devine gol pe server.
 */
export function sendChatPhoto(params: { channelId: string; imageData: string; caption?: string }) {
  return apiPost<ChatMessageWritten>(`/chat/channels/${params.channelId}/photos`, {
    imageData: params.imageData, caption: params.caption,
  });
}

export function markChatChannelRead(params: { channelId: string }) {
  return apiPost<ChatAck>(`/chat/channels/${params.channelId}/read`);
}

export function editChatMessage(params: { messageId: string; body: string }) {
  return apiPatch<ChatAck>(`/chat/messages/${params.messageId}`, { body: params.body });
}

export function deleteChatMessage(params: { messageId: string }) {
  return apiDelete<ChatAck>(`/chat/messages/${params.messageId}`);
}

