import { useState, useEffect, useCallback } from 'react';
import { BellRing, KeyRound, Copy, Check, Loader2, AlertTriangle, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import RefreshButton from '../shared/RefreshButton';
import { getPushStatus, generatePushKeys, type PushStatusResponse } from '@/lib/endpoints';
import { errMsg } from '@/lib/errorMessage';

/**
 * Sesiunea 35 (ACHU-235). One-off setup for phone notifications.
 *
 * ─── Why this screen exists at all ──────────────────────────────────────
 * Push needs a VAPID keypair. The private half is a secret, so it cannot live in
 * the repository (rule 5), and the owner has no terminal — a script he cannot run
 * is not a solution. Without this screen the only route would be "ask Claude to
 * press something", which is not a working process for a business.
 *
 * So: he clicks a button, gets two values and a numbered list, and pastes them
 * into Railway. Done once, ever.
 *
 * ─── The iOS instruction is on the page, not in a document ──────────────
 * On iPhone and iPad, Web Push works only from an app added to the Home Screen.
 * Whoever is setting this up needs to know that BEFORE they try it on their phone
 * and conclude it is broken — so it is here, in full, not a link to a doc.
 */
export default function PushSetupPage() {
  const [status, setStatus] = useState<PushStatusResponse | null>(null);
  const [keys, setKeys] = useState<{ publicKey: string; privateKey: string; instructions: string[]; warning: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await getPushStatus());
    } catch (e) {
      toast.error(errMsg(e) || 'Could not check the notification setup.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await generatePushKeys();
      setKeys({ publicKey: res.publicKey, privateKey: res.privateKey, instructions: res.instructions, warning: res.warning });
    } catch (e) {
      toast.error(errMsg(e) || 'Could not generate the keys.', { duration: 12000 });
    } finally {
      setGenerating(false);
    }
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard access can be refused. Selecting the text by hand still works,
      // which is why the value is always visible rather than hidden behind Copy.
      toast.error('Could not copy. Select the text and copy it manually.');
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Phone notifications</h2>
          <p className="text-sm text-muted-foreground">
            Alerts on the team's phones when ACHU is closed. Set up once.
          </p>
        </div>
        <RefreshButton onRefresh={load} />
      </div>

      {/* ─── Current state ────────────────────────────────────────────── */}
      {status && (
        <Card className={`p-3 ${status.configured ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
          <p className={`flex items-center gap-1.5 text-sm font-medium ${
            status.configured ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
          }`}>
            {status.configured ? <BellRing className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            {status.configured ? 'Phone notifications are set up' : 'Not set up yet'}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {status.configured
              ? 'Each person turns them on themselves, on each of their devices — tap the bell, then "Get alerts on this device".'
              : 'Follow the two steps below. It takes about five minutes and is only done once.'}
          </p>
        </Card>
      )}

      {/* ─── Step 1 ───────────────────────────────────────────────────── */}
      {!status?.configured && (
        <Card className="p-4 space-y-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />Step 1 — generate the keys
          </p>
          <p className="text-xs text-muted-foreground">
            These identify ACHU to Google's and Apple's notification services. They are generated here because the
            private one is a password — it must never be stored in the code.
          </p>

          {!keys ? (
            <Button size="sm" onClick={generate} disabled={generating}>
              {generating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5 mr-1.5" />}
              Generate the keys
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">
                {/* Shown once and stored nowhere, so this is the only chance. */}
                <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{keys.warning}
              </p>

              {([['VAPID_PUBLIC_KEY', keys.publicKey], ['VAPID_PRIVATE_KEY', keys.privateKey]] as const).map(([label, value]) => (
                <div key={label}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[11px] font-semibold">{label}</p>
                    <button
                      onClick={() => copy(label, value)}
                      className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-muted"
                    >
                      {copied === label ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      {copied === label ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  {/* Always visible, never masked: if the clipboard is blocked, selecting
                      by hand is the only fallback and the value is shown only once. */}
                  <p className="mt-0.5 break-all rounded bg-muted p-2 font-mono text-[11px] select-all">{value}</p>
                </div>
              ))}

              <div>
                <p className="font-mono text-[11px] font-semibold">VAPID_SUBJECT</p>
                <p className="mt-0.5 break-all rounded bg-muted p-2 font-mono text-[11px] select-all">mailto:roberto@achu.uk</p>
              </div>

              <ol className="ml-4 list-decimal space-y-1 text-xs text-muted-foreground">
                {keys.instructions.map((line, i) => <li key={i}>{line}</li>)}
              </ol>
            </div>
          )}
        </Card>
      )}

      {/* ─── Step 2 — the iOS reality ─────────────────────────────────── */}
      <Card className="p-4 space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
          {status?.configured ? 'How each person turns them on' : 'Step 2 — each person turns them on'}
        </p>
        <p className="text-xs text-muted-foreground">
          On Android or a computer: open ACHU, tap the bell, then <strong>Get alerts on this device</strong> and allow it
          when the browser asks.
        </p>
        <div className="rounded-md border border-border bg-muted/40 p-2.5">
          <p className="text-xs font-medium">On iPhone or iPad there is one extra step, and it is required</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {/* Apple's restriction, not ours. Stated here because someone who does not
                know it will try it in Safari, see nothing happen, and reasonably
                conclude the feature does not work. */}
            Apple only allows notifications from an app that has been added to the Home Screen:
          </p>
          <ol className="ml-4 mt-1 list-decimal space-y-0.5 text-xs text-muted-foreground">
            <li>Open ACHU in Safari.</li>
            <li>Tap the <strong>Share</strong> button (the square with an arrow pointing up).</li>
            <li>Choose <strong>Add to Home Screen</strong>.</li>
            <li>Open ACHU from the <strong>new icon</strong> — not from Safari.</li>
            <li>Tap the bell, then <strong>Get alerts on this device</strong>.</li>
          </ol>
          <p className="mt-1 text-[11px] text-muted-foreground">
            ACHU detects this on its own and shows those steps instead of a button that could not work.
          </p>
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-sm font-semibold">What gets sent</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Direct messages only, and never for your own messages. Channel messages do not alert anyone —
          a busy channel would produce dozens of buzzes a day and people would turn the whole thing off.
          Several messages in one conversation collapse into a single alert.
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {/* Honest about the limits: a push is best-effort, and over-promising here
              means someone relies on it and misses something. */}
          A notification is a nudge, not a guarantee — a phone that is off or has no signal receives nothing,
          and the message is still waiting in ACHU either way.
        </p>
      </Card>
    </div>
  );
}

