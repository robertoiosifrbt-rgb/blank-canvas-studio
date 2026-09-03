import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import ChatView from '../chat/ChatView';
import RefreshButton from '../shared/RefreshButton';

/**
 * Sesiunea 29 — Admin-side wrapper around the shared ChatView. Admins are the
 * only role allowed to create or archive channels (enforced server-side in
 * chat.ts, not just hidden here), so the create controls are switched on.
 *
 * Sesiunea 34:
 * - `?channel=<id>` opens a specific conversation, which is how a notification
 *   click now lands somewhere useful (ACHU-233). Read from the URL rather than
 *   held in state so the link is shareable and survives a reload.
 * - A Refresh button, like every other page (ACHU-234). Chat already polls, but
 *   the poll is on a timer: when you are waiting on a reply, being able to ask
 *   now rather than wait out the interval is the whole point.
 */
export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const channel = searchParams.get('channel');
  const [refresh, setRefresh] = useState<(() => void) | null>(null);

  // Stored via a stable callback so ChatView's effect does not re-register on
  // every render — an unstable prop here would make it loop.
  const register = useCallback((fn: () => void) => setRefresh(() => fn), []);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Chat</h2>
          <p className="text-sm text-muted-foreground">
            Internal messages between the office and cleaners. Customers have no access.
          </p>
        </div>
        {refresh && <RefreshButton onRefresh={refresh} label="Refresh conversations" />}
      </div>
      <ChatView canCreateChannels openChannelId={channel} onRefreshed={register} />
    </div>
  );
}

