import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Hash, Lock, Send, Plus, ArrowLeft, AlertCircle, Loader2, MessageSquare, Search, ChevronUp, Users,
  Pencil, Trash2, Check, X, ImagePlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { prepareImageForUpload } from '@/lib/imageCompression';
import { getChatPeople, createChatChannel, openChatDm } from '@/lib/chatEndpoints';
import { useChat, type ChatChannel, type ChatMessage } from './useChat';
import DeleteConfirm from '@/components/shared/DeleteConfirm';
import { errMsg } from '@/lib/errorMessage';

/**
 * Sesiunea 29 — the whole chat UI, one responsive component used by both the
 * Admin page and the Cleaner portal tab.
 *
 * Two panes on a wide screen; on a phone the list and the conversation are
 * separate screens with a back arrow, because a 320px-wide sidebar next to a
 * 320px-wide conversation is unusable. Building it as one component rather than
 * an "admin chat" plus a "mobile chat" keeps a fix in one place — the previous
 * session's lesson from three copies of the same record picker.
 */
export default function ChatView({ canCreateChannels, openChannelId, onRefreshed }: {
  canCreateChannels: boolean;
  /**
   * ACHU-233 (Sesiunea 34): a conversation to open on arrival, from a
   * notification click. Applied ONCE per id rather than on every render — the
   * user must be able to click away to another conversation without being
   * yanked back, which is what an unguarded effect on this prop would do.
   */
  openChannelId?: string | null;
  /** Lets a parent page's Refresh button reload the conversation list. */
  onRefreshed?: (refresh: () => void) => void;
}) {
  const chat = useChat();
  const [showListOnMobile, setShowListOnMobile] = useState(true);
  const appliedOpenRef = useRef<string | null>(null);

  const active = chat.channels?.find(c => c.id === chat.activeId) ?? null;

  const open = (id: string) => {
    chat.openChannel(id);
    setShowListOnMobile(false);
  };

  // Opens the conversation a notification pointed at. Waits for the channel list
  // so a hidden or deleted id fails as "not in your list" rather than as a
  // request for a channel the server will refuse.
  useEffect(() => {
    if (!openChannelId || !chat.channels) return;
    if (appliedOpenRef.current === openChannelId) return;
    if (!chat.channels.some(c => c.id === openChannelId)) return;
    appliedOpenRef.current = openChannelId;
    open(openChannelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openChannelId, chat.channels]);

  // Hands the parent a way to reload, so a page-level Refresh button covers the
  // chat too instead of the chat being the one screen it does not reach.
  useEffect(() => {
    onRefreshed?.(() => {
      chat.loadChannels();
      if (chat.activeId) chat.openChannel(chat.activeId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRefreshed, chat.activeId]);

  return (
    <div className="flex h-[calc(100vh-13rem)] min-h-[420px] overflow-hidden rounded-xl border border-border bg-card">
      {/* ── List pane ── */}
      <div className={`${showListOnMobile ? 'flex' : 'hidden'} md:flex w-full md:w-72 shrink-0 flex-col border-r border-border`}>
        <ChannelList
          channels={chat.channels}
          activeId={chat.activeId}
          canCreateChannels={canCreateChannels}
          onOpen={open}
          onChanged={chat.loadChannels}
        />
      </div>

      {/* ── Conversation pane ── */}
      <div className={`${showListOnMobile ? 'hidden' : 'flex'} md:flex flex-1 min-w-0 flex-col`}>
        {active ? (
          <Conversation
            channel={active}
            messages={chat.messages}
            hasMore={chat.hasMore}
            sending={chat.sending}
            error={chat.error}
            onSend={chat.send}
            onEdit={chat.editMessage}
            onDelete={chat.deleteMessage}
            onLoadOlder={chat.loadOlder}
            onBack={() => setShowListOnMobile(true)}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Pick a channel or a person to start talking.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChannelList({ channels, activeId, canCreateChannels, onOpen, onChanged }: {
  channels: ChatChannel[] | null;
  activeId: string | null;
  canCreateChannels: boolean;
  onOpen: (id: string) => void;
  onChanged: () => void;
}) {
  const [people, setPeople] = useState<{ id: string; name: string; role: string }[] | null>(null);
  const [showPeople, setShowPeople] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [adminOnly, setAdminOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [peopleFilter, setPeopleFilter] = useState('');

  const loadPeople = async () => {
    setShowPeople(true);
    if (people) return;
    try {
      const res = await getChatPeople();
      setPeople(res.people);
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not load people.');
      setShowPeople(false);
    }
  };

  const startDm = async (userId: string) => {
    setBusy(true);
    try {
      const res = await openChatDm({ userId });
      onChanged();
      onOpen(res.id);
      setShowPeople(false);
      setPeopleFilter('');
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not open the conversation.');
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const res = await createChatChannel({ name, visibility: adminOnly ? 'adminOnly' : 'all' });
      toast.success(`Channel #${name.replace(/^#/, '')} created`);
      setNewName(''); setAdminOnly(false); setCreating(false);
      onChanged();
      onOpen(res.id);
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not create the channel.');
    } finally {
      setBusy(false);
    }
  };

  if (!channels) {
    return <div className="space-y-2 p-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-lg" />)}</div>;
  }

  const rooms = channels.filter(c => c.kind === 'channel');
  const dms = channels.filter(c => c.kind === 'dm');
  const visiblePeople = (people ?? []).filter(p => p.name.toLowerCase().includes(peopleFilter.toLowerCase()));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-2">
        <Section title="Channels">
          {rooms.length === 0 && <Empty>No channels yet.</Empty>}
          {rooms.map(c => (
            <Row key={c.id} active={c.id === activeId} unread={c.unreadCount} onClick={() => onOpen(c.id)}>
              {c.visibility === 'adminOnly'
                ? <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                : <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              <span className="truncate">{c.displayName}</span>
            </Row>
          ))}
          {canCreateChannels && !creating && (
            <button
              onClick={() => setCreating(true)}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />New channel
            </button>
          )}
          {creating && (
            <div className="mt-1 space-y-2 rounded-lg border border-border p-2">
              <Input autoFocus aria-label="Name for the new channel"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setCreating(false); }}
                placeholder="channel-name"
                className="h-8 text-sm"
              />
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={adminOnly} onChange={e => setAdminOnly(e.target.checked)} />
                Office only — cleaners will not see it
              </label>
              <div className="flex gap-1.5">
                <Button size="sm" className="h-7 flex-1 text-xs" onClick={create} disabled={busy || !newName.trim()}>Create</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setCreating(false); setNewName(''); }}>Cancel</Button>
              </div>
            </div>
          )}
        </Section>

        <Section title="Direct messages">
          {dms.length === 0 && <Empty>No conversations yet.</Empty>}
          {dms.map(c => (
            <Row key={c.id} active={c.id === activeId} unread={c.unreadCount} onClick={() => onOpen(c.id)}>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
              <span className="truncate">{c.displayName}</span>
            </Row>
          ))}

          {!showPeople ? (
            <button
              onClick={loadPeople}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />Message someone
            </button>
          ) : (
            <div className="mt-1 space-y-1.5 rounded-lg border border-border p-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input autoFocus aria-label="Search people"
                  value={peopleFilter}
                  onChange={e => setPeopleFilter(e.target.value)}
                  placeholder="Search people…"
                  className="h-8 pl-7 text-sm"
                />
              </div>
              <div className="max-h-44 overflow-y-auto">
                {!people ? (
                  <p className="p-2 text-xs text-muted-foreground">Loading…</p>
                ) : visiblePeople.length === 0 ? (
                  <p className="p-2 text-xs text-muted-foreground">Nobody found.</p>
                ) : visiblePeople.map(p => (
                  <button
                    key={p.id}
                    disabled={busy}
                    onClick={() => startDm(p.id)}
                    // Named explicitly: the visible text is just "Maria" plus a
                    // role chip, which reads identically to the existing DM row
                    // in the list above — ambiguous for a screen reader.
                    aria-label={`Message ${p.name}`}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">{p.role}</span>
                  </button>
                ))}
              </div>
              <Button size="sm" variant="ghost" className="h-7 w-full text-xs" onClick={() => { setShowPeople(false); setPeopleFilter(''); }}>Cancel</Button>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{title}</p>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-2 py-1 text-xs text-muted-foreground">{children}</p>;
}

function Row({ active, unread, onClick, children }: {
  active: boolean; unread: number; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
      }`}
    >
      {children}
      {unread > 0 && (
        <span className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
          active ? 'bg-primary-foreground/20' : 'bg-primary text-primary-foreground'
        }`}>
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}

function Conversation({ channel, messages, hasMore, sending, error, onSend, onEdit, onDelete, onLoadOlder, onBack }: {
  channel: ChatChannel;
  messages: ChatMessage[] | null;
  hasMore: boolean;
  sending: boolean;
  error: string | null;
  /** ACHU-219 — `photo` e un data-URL, opțional. Un mesaj doar-poză are `body` gol. */
  onSend: (body: string, photo?: string) => Promise<boolean>;
  onEdit: (messageId: string, body: string) => Promise<boolean>;
  onDelete: (messageId: string) => Promise<boolean>;
  onLoadOlder: () => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState('');
  /**
   * ACHU-219 — poza aleasă, ca data-URL, plus numele ei pentru rândul de confirmare.
   * ⚠️ Ținută ca data-URL și nu ca `File` fiindcă exact asta se trimite pe rețea, deci
   * previzualizarea și ce pleacă la server sunt garantat același lucru.
   */
  const [photo, setPhoto] = useState<{ dataUrl: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | null>(null);

  // Jump to the newest message when the conversation changes or a new message
  // arrives — but NOT on every render, or reading older history would keep
  // yanking the view back down.
  useEffect(() => {
    const newest = messages?.[messages.length - 1]?.id ?? null;
    if (newest !== lastIdRef.current) {
      lastIdRef.current = newest;
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  /**
   * ⛔ ACHU-219: condiția NU mai poate fi „există text". Un mesaj doar-poză e permis, iar
   * `!text.trim()` l-ar fi respins tăcut — butonul apăsat, nimic trimis, nicio eroare.
   */
  const submit = async () => {
    const text = draft;
    const attached = photo;
    if (!text.trim() && !attached) return;
    // Clear optimistically so typing feels immediate; restore if it failed.
    setDraft('');
    setPhoto(null);
    const ok = await onSend(text, attached?.dataUrl);
    if (!ok) { setDraft(text); setPhoto(attached); }
  };

  /**
   * Aceleași reguli ca la selectorul de poze al clientului (`PropertyInfoEditDialog.tsx`),
   * cu O SINGURĂ diferență deliberată: **15 MB, nu 10** — cifra decisă de Archana pentru
   * bucketul `chat-photos`. Serverul o verifică din nou pe fișierul decodificat; asta de
   * aici doar scutește o încărcare de 20 MB care ar fi refuzată la capăt.
   */
  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Resetat imediat, ca aceeași poză să poată fi aleasă a doua oară după o anulare —
    // altfel `onChange` nu se mai declanșează pentru un fișier identic.
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      // Lista pe care bucketul însuși o impune — un GIF ar fi refuzat de Storage.
      toast.error('Only JPEG, PNG and WebP photos can be sent');
      return;
    }
    /**
     * 🔴 **MICȘORATĂ ÎNTÂI (§32, Sesiunea 147).** ⚠️ Plafonul de aici rămâne 15 MB, al lui
     * (`CHAT_PHOTO_MAX_BYTES`), nu 10 ca pe restul — dar refuzul vine acum DUPĂ ce s-a încercat
     * micșorarea, nu în loc de ea. ⛔ O poză de 18 MB dintr-o conversație despre o pagubă e exact
     * poza pe care nu vrei să o pierzi.
     */
    const { dataUrl, bytes } = await prepareImageForUpload(file);
    if (bytes > 15 * 1024 * 1024) { toast.error('Photo must be under 15MB, even after shrinking it'); return; }
    setPhoto({ dataUrl, name: file.name });
  };

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <button onClick={onBack} className="md:hidden rounded-lg p-1 hover:bg-muted" aria-label="Back to conversations" title="Back to conversations">
          <ArrowLeft className="h-4 w-4" />
        </button>
        {channel.kind === 'dm'
          ? <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
          : channel.visibility === 'adminOnly'
            ? <Lock className="h-4 w-4 shrink-0 text-amber-600" />
            : <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <p className="truncate text-sm font-semibold">{channel.displayName}</p>
        {channel.visibility === 'adminOnly' && channel.kind === 'channel' && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">Office only</span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages === null ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No messages yet — say something.</p>
        ) : (
          <>
            {hasMore && (
              <button onClick={onLoadOlder} className="mx-auto flex items-center gap-1 rounded-lg px-3 py-1 text-xs text-muted-foreground hover:bg-muted">
                <ChevronUp className="h-3.5 w-3.5" />Load older messages
              </button>
            )}
            {messages.map((m, i) => {
              // Only repeat the author when it actually changes — a wall of
              // repeated names is what makes a chat log hard to skim.
              const prev = messages[i - 1];
              const grouped = prev && prev.authorId === m.authorId && !prev.deleted && !m.deleted
                && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
              return <Bubble key={m.id} message={m} grouped={!!grouped} onEdit={onEdit} onDelete={onDelete} />;
            })}
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 border-t border-destructive/20 bg-destructive/10 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* ACHU-219 — rândul de confirmare a pozei alese. Fără el, singurul semn că o poză e
          atașată ar fi lipsa oricărui semn: apeși trimite și pleacă ceva ce nu ai văzut. */}
      {photo && (
        <div className="flex items-center gap-2 border-t border-border bg-muted/40 px-3 py-2">
          <img src={photo.dataUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{photo.name}</span>
          <Button
            size="icon" variant="ghost" className="h-7 w-7 shrink-0"
            onClick={() => setPhoto(null)} aria-label="Remove photo" title="Remove photo"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2 border-t border-border p-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={pickPhoto}
        />
        <Button
          size="icon" variant="ghost" className="h-10 w-10 shrink-0"
          onClick={() => fileRef.current?.click()}
          disabled={sending}
          aria-label="Attach photo" title="Attach photo"
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
        <Textarea aria-label="Message"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            // Enter sends, Shift+Enter makes a new line — what people expect
            // from a chat box.
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
          }}
          placeholder={`Message ${channel.displayName}…`}
          rows={1}
          className="max-h-32 min-h-[40px] resize-none text-base"
        />
        <Button size="icon" className="h-10 w-10 shrink-0" onClick={submit} disabled={sending || (!draft.trim() && !photo)} aria-label="Send message" title="Send message">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </>
  );
}

/**
 * ACHU-262 — a message sent by mistake could not be corrected or withdrawn.
 * Backend and endpoint wrappers already existed (`editChatMessage`,
 * `deleteChatMessage`); nothing in the UI ever called them.
 *
 * ⛔ Only the author's own messages carry these controls. The backend also
 * lets an Admin delete anyone's message (moderation), but that is a distinct
 * capability with its own UI/audit questions — out of scope here, and adding
 * it silently would let an Admin remove someone else's words with no prompt
 * explaining why.
 */
function Bubble({ message, grouped, onEdit, onDelete }: {
  message: ChatMessage;
  grouped: boolean;
  onEdit: (messageId: string, body: string) => Promise<boolean>;
  onDelete: (messageId: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.body ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  }).format(new Date(message.createdAt));

  if (message.deleted) {
    return <p className="px-1 text-xs italic text-muted-foreground">Message deleted</p>;
  }

  const saveEdit = async () => {
    if (!editText.trim()) return;
    setBusy(true);
    const ok = await onEdit(message.id, editText);
    setBusy(false);
    if (ok) setEditing(false);
  };

  const confirmDelete = async () => {
    setBusy(true);
    await onDelete(message.id);
    setBusy(false);
    setConfirmingDelete(false);
  };

  return (
    <div className={grouped ? '' : 'mt-1'}>
      {!grouped && (
        <div className="mb-0.5 flex items-baseline gap-2">
          <span className="text-xs font-semibold">{message.mine ? 'You' : message.authorName}</span>
          {message.authorRole && !message.mine && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{message.authorRole}</span>
          )}
          <span className="text-[10px] tabular-nums text-muted-foreground">{time}</span>
        </div>
      )}

      {editing ? (
        <div className="flex items-center gap-1.5">
          <Input autoFocus aria-label="Edit the message"
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') saveEdit();
              if (e.key === 'Escape') { setEditing(false); setEditText(message.body ?? ''); }
            }}
            className="h-8 text-sm"
          />
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" disabled={busy || !editText.trim()} onClick={saveEdit} aria-label="Save edit" title="Save edit">
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" disabled={busy} onClick={() => { setEditing(false); setEditText(message.body ?? ''); }} aria-label="Cancel edit" title="Cancel edit">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-start gap-1.5">
          <div className="min-w-0">
            {/* ACHU-219 — poza, deasupra legendei.
                🔴 `hasPhoto` ȘI `photoUrl` sunt DOUĂ lucruri diferite, iar diferența e tot
                rostul acestei ramuri: bucketul e privat, deci linkul e semnat la fiecare
                citire și semnarea poate eșua. Fără al doilea caz, o zi proastă la Storage
                ar arăta ca un mesaj gol — utilizatorul n-ar avea cum să știe că lipsește o
                poză, nici că merită reîncărcat. */}
            {message.hasPhoto && (
              message.photoUrl ? (
                <a href={message.photoUrl} target="_blank" rel="noopener noreferrer" className="mb-1 block">
                  <img
                    src={message.photoUrl}
                    alt={message.body || 'Photo'}
                    className="max-h-64 max-w-[min(20rem,100%)] rounded border border-border object-contain"
                  />
                </a>
              ) : (
                <p className="mb-1 text-xs italic text-muted-foreground">Photo unavailable — try reloading</p>
              )
            )}
            {/* Un mesaj doar-poză are `body` gol; fără condiție ar rămâne un paragraf vid
                care împinge aiurea spațierea. */}
            {(message.body || message.editedAt) && (
              <p className="whitespace-pre-wrap break-words text-sm">
                {message.body}
                {message.editedAt && <span className="ml-1.5 text-[10px] text-muted-foreground">(edited)</span>}
              </p>
            )}
          </div>
          {/* Always visible, not hover-only: half the point is fixing a typo
              sent from a phone, where there is no hover at all. */}
          {message.mine && (
            <div className="flex shrink-0 gap-0.5">
              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground" onClick={() => setEditing(true)} aria-label="Edit message" title="Edit message">
                <Pencil className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => setConfirmingDelete(true)} aria-label="Delete message" title="Delete message">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      )}

      <DeleteConfirm open={confirmingDelete} onClose={() => setConfirmingDelete(false)} onConfirm={confirmDelete} label="this message" />
    </div>
  );
}

