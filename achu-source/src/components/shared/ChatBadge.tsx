import { useCallback, useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getChatUnreadCount } from '@/lib/chatEndpoints';

/**
 * §22 „Chat în bara de sus" (Sesiunea 158) — cerut de Roberto pe 28/08/2026.
 *
 * ─── 🔴 Ce lipsea ───────────────────────────────────────────────────────────
 * Chatul era **un rând de meniu**, în grupul „Team". ⛔ Pe telefon meniul e ascuns sub hamburger,
 * deci un mesaj nou de la un curățător nu se vedea deloc până nu-l căutai.
 *
 * ─── ⚠️ De ce iconița are un NUMĂR, și de ce numărul a costat o reparație ───
 *
 * O iconiță care doar duce la un ecran mută un click și nu adaugă nimic. 🔴 Numărul e ce face din ea
 * un semnal — dar punerea lui a scos la iveală că **clopoțelul anunța deja mesajele de chat**
 * (`type: 'chat_dm'`), iar citirea conversației **nu** stingea anunțul.
 *
 * ⛔ Deci cele două cifre divergeau **deja**, tăcut: deschideai conversația, necititele treceau pe 0,
 * clopoțelul continua să anunțe același mesaj. ⚠️ Cât timp chatul era un rând de meniu nimeni nu le
 * punea una lângă alta; felia asta le așează **în același loc**, unde dezacordul se citește ca un
 * defect. ✅ Reparat pe server, în `POST /chat/channels/:id/read` — un act, un adevăr.
 *
 * ─── ⛔ Ce NU e ─────────────────────────────────────────────────────────────
 * **Nu e un al doilea clopoțel.** Nu deschide un panou, nu marchează nimic citit, nu ține o listă:
 * duce la ecranul de chat, unde citirea se întâmplă oricum. 🔴 Un panou aici ar fi însemnat două
 * locuri în care un mesaj se marchează citit.
 */

/** ⚠️ Același ritm ca la clopoțel: o cifră la 30 de secunde, dintr-o rută care întoarce doar cifra. */
const POLL_MS = 30000;

/** ⛔ Peste asta se scrie „9+": un cerc de 18px nu ține trei cifre, iar „124" nu spune mai mult decât „multe". */
const MAX_SHOWN = 9;

export default function ChatBadge({ to }: { to: string }) {
  const [count, setCount] = useState(0);

  const load = useCallback(() => {
    getChatUnreadCount()
      /**
       * ⛔ **Un eșec nu se raportează.** Iconița stă pe fiecare ecran: un toast la fiecare
       * interogare picată (rețea slabă pe teren) ar învăța biroul să închidă mesajele fără să le
       * citească. ⚠️ Rămâne pe cifra de dinainte — nu se golește, ca o rețea proastă să nu arate ca
       * „nu ai mesaje".
       */
      .then(r => setCount(r.unreadCount ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const label = count > 0
    ? `Chat — ${count} unread message${count === 1 ? '' : 's'}`
    : 'Chat';

  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted"
    >
      <MessageSquare className="h-5 w-5" />
      {count > 0 && (
        /**
         * ⚠️ **`aria-hidden`**: cifra e deja în `aria-label`, scrisă în cuvinte. ⛔ Fără asta, un
         * cititor de ecran ar anunțat „Chat, 3 mesaje necitite, 3" — aceeași informație de două ori.
         */
        <span
          aria-hidden="true"
          data-testid="chat-unread"
          className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
        >
          {count > MAX_SHOWN ? `${MAX_SHOWN}+` : count}
        </span>
      )}
    </Link>
  );
}

