import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getChatChannels, getChatMessages, sendChatMessage, sendChatPhoto, markChatChannelRead,
  editChatMessage, deleteChatMessage, type ChatChannel, type ChatMessage,
} from '@/lib/chatEndpoints'; // ACHU-401: ieșite din `endpoints.ts`, care e la plafonul lui
import { errMsg } from '@/lib/errorMessage';

/**
 * Sesiunea 29 — the chat's data layer, shared by the Admin page and the Cleaner
 * portal tab so there is one implementation of the tricky parts rather than two
 * that drift apart.
 *
 * On "real time": this polls instead of holding a socket open. Supabase
 * Realtime is available and would be the obvious upgrade, but it needs the
 * client subscribed to Postgres changes on the chat tables, which in turn needs
 * Row Level Security policies written for them — otherwise a subscription is a
 * way to receive rows the REST layer would have refused, and the whole
 * adminOnly/DM privacy model (enforced in chat.ts) would be bypassed. That is a
 * security change to make deliberately, with its own tests, not a detail to
 * slip into the first version. Polling reuses the authorisation that is already
 * proven by 17 backend tests.
 *
 * The interval is deliberately different depending on what the user is looking
 * at: the open conversation refreshes quickly, the sidebar counts slowly.
 */
const MESSAGE_POLL_MS = 4000;
const CHANNEL_POLL_MS = 15000;

/**
 * ⚠️ ACHU-401 (felia 11) — cele două forme s-au MUTAT lângă funcțiile care le produc
 * (`@/lib/chatEndpoints`), citite din `backend/src/routes/chat.ts`. Re-exportate de aici
 * fiindcă `ChatView.tsx` le ia din hook; un fapt stă într-un singur loc (`AGENT_RULES` §11).
 */
export type { ChatChannel, ChatMessage } from '@/lib/chatEndpoints';

export function useChat() {
  const [channels, setChannels] = useState<ChatChannel[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards a slow poll from overwriting a newer one's result.
  const messageSeq = useRef(0);
  /**
   * ⚠️ Oglinda lui `activeId` pentru apelurile ASINCRONE: un poll pornit pe canalul A trebuie
   * să poată vedea că între timp s-a deschis B, iar `activeId` prins în închiderea lui e cel
   * vechi.
   *
   * ⛔ ACHU-401: se scria și **în timpul randării** (`activeIdRef.current = activeId`), ceea ce
   * React interzice — un ref scris la randare poate face componenta să nu se actualizeze.
   * Rândul era în plus: `setActiveId` se apelează într-**un singur** loc (`openChannel`), care
   * scrie ref-ul pe rândul următor, iar setter-ul nu e expus în afară. Cele două nu au cum să
   * se despartă.
   */
  const activeIdRef = useRef<string | null>(null);

  const loadChannels = useCallback(async () => {
    try {
      const res = await getChatChannels();
      setChannels(res.channels);
      setError(null);
    } catch (e) {
      // A failed background poll must not wipe what is already on screen.
      setChannels(prev => prev);
      setError(errMsg(e) ?? 'Could not load conversations.');
    }
  }, []);

  const loadMessages = useCallback(async (channelId: string, opts?: { silent?: boolean }) => {
    const seq = ++messageSeq.current;
    if (!opts?.silent) setMessages(null);
    try {
      const res = await getChatMessages({ channelId });
      // Discard if the user switched conversation, or a newer poll already landed.
      if (seq !== messageSeq.current || activeIdRef.current !== channelId) return;
      setMessages(res.messages);
      setHasMore(res.hasMore);
      setError(null);
    } catch (e) {
      if (seq !== messageSeq.current) return;
      setError(errMsg(e) ?? 'Could not load messages.');
    }
  }, []);

  const openChannel = useCallback(async (channelId: string) => {
    setActiveId(channelId);
    activeIdRef.current = channelId;
    await loadMessages(channelId);
    try {
      await markChatChannelRead({ channelId });
      // Clear the badge locally at once rather than waiting for the next poll.
      setChannels(prev => prev?.map(c => (c.id === channelId ? { ...c, unreadCount: 0 } : c)) ?? prev);
    } catch { /* a failed read-marker is not worth interrupting the user for */ }
  }, [loadMessages]);

  const loadOlder = useCallback(async () => {
    const channelId = activeIdRef.current;
    if (!channelId || !messages?.length) return;
    try {
      const res = await getChatMessages({ channelId, before: messages[0].createdAt });
      if (activeIdRef.current !== channelId) return;
      setMessages(prev => [...res.messages, ...(prev ?? [])]);
      setHasMore(res.hasMore);
    } catch (e) {
      setError(errMsg(e) ?? 'Could not load older messages.');
    }
  }, [messages]);

  /**
   * ACHU-219 — `photo` e opțional, iar când e prezent se folosește CEALALTĂ rută.
   *
   * ⚠️ Nu un câmp în plus pe ruta de mesaje: plafonul de cerere pentru o poză e 22 MB, iar
   * dacă poza ar fi mers pe aceeași cale, fiecare mesaj de text ar fi primit acel plafon
   * (`backend/src/lib/bodyParsers.ts`).
   *
   * ⛔ Un mesaj doar-poză E permis, deci condiția nu mai poate fi „există text".
   */
  const send = useCallback(async (body: string, photo?: string) => {
    const channelId = activeIdRef.current;
    const text = body.trim();
    if (!channelId || (!text && !photo) || sending) return false;
    setSending(true);
    try {
      if (photo) await sendChatPhoto({ channelId, imageData: photo, caption: text || undefined });
      else await sendChatMessage({ channelId, body: text });
      await loadMessages(channelId, { silent: true });
      loadChannels();
      setError(null);
      return true;
    } catch (e) {
      setError(errMsg(e) ?? 'Message not sent.');
      return false;
    } finally {
      setSending(false);
    }
  }, [sending, loadMessages, loadChannels]);

  /**
   * ACHU-262 — the backend and the wrapper both existed with zero UI callers.
   * Silent reload after either: the same pattern `send` already uses, so a
   * slow poll a moment later cannot show a stale body/deleted flag.
   */
  const editMessage = useCallback(async (messageId: string, body: string) => {
    const channelId = activeIdRef.current;
    const text = body.trim();
    if (!channelId || !text) return false;
    try {
      await editChatMessage({ messageId, body: text });
      await loadMessages(channelId, { silent: true });
      loadChannels();
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save the edit.');
      return false;
    }
  }, [loadMessages, loadChannels]);

  const deleteMessage = useCallback(async (messageId: string) => {
    const channelId = activeIdRef.current;
    if (!channelId) return false;
    try {
      await deleteChatMessage({ messageId });
      await loadMessages(channelId, { silent: true });
      loadChannels();
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not delete the message.');
      return false;
    }
  }, [loadMessages, loadChannels]);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  // Sidebar counts — slow poll, and only while the tab is actually visible so a
  // forgotten background tab stops calling the server every 15 seconds.
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') loadChannels(); };
    const t = setInterval(tick, CHANNEL_POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [loadChannels]);

  // Open conversation — fast poll, same visibility guard.
  useEffect(() => {
    if (!activeId) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') loadMessages(activeId, { silent: true });
    }, MESSAGE_POLL_MS);
    return () => clearInterval(t);
  }, [activeId, loadMessages]);

  const totalUnread = (channels ?? []).reduce((n, c) => n + c.unreadCount, 0);

  return {
    channels, activeId, messages, hasMore, sending, error, totalUnread,
    openChannel, loadOlder, send, editMessage, deleteMessage, loadChannels, setError,
  };
}

