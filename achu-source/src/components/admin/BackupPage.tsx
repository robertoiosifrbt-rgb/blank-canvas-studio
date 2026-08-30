import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Loader2, ShieldAlert, CheckCircle, FileArchive, Upload, AlertTriangle, SearchCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  exportFullBackupText, getBackupStatus, getBackupFiles, restoreFromBackup, previewRestore,
  type RestorePreview, type RestorePreviewConflict, type BackupStatus,
} from '@/lib/endpoints';
import {
  isEncryptedBackupText, backupFilename, readBackupFile, restoreBody, type ChosenBackup,
} from '@/lib/backupFileFormat';
import { buildFileArchive } from '@/lib/backupArchive';
import RefreshButton from '../shared/RefreshButton';
import { errMsg } from '@/lib/errorMessage';

/**
 * Sesiunea 29 (backlog 46 — "Backup", "Restore testing"). Owner confirmed the
 * Supabase free plan includes no project backups at all.
 *
 * Three things live here, and the page is written for a non-technical reader
 * throughout: a feature nobody understands well enough to use on a schedule is
 * not protection.
 *
 * 1. **Data backup** — the whole database as one file.
 * 2. **Receipt archive** — the files, which the data backup does NOT contain.
 *    Receipts live in Supabase Storage, a separate service; restoring the
 *    database alone would leave expense rows pointing at objects that may be
 *    gone, and for accounting it is the source document that matters. Built
 *    client-side because the backend holds only the anon key and cannot read a
 *    private bucket — the browser already has a session that can.
 * 3. **Restore** — deliberately guarded behind a typed phrase, and honest that
 *    it is a last resort rather than a routine button.
 */
const RESTORE_PHRASE = 'RESTORE ALL DATA';


function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoked at once: these files are the entire business, so they should not sit
  // around as live object URLs any longer than the click needs.
  URL.revokeObjectURL(url);
}

export default function BackupPage() {
  // ACHU-401 (felia 15): forma vine de la funcția care o produce, nu redeclarată aici.
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState<null | 'data' | 'receipts' | 'restore'>(null);
  const [lastCounts, setLastCounts] = useState<Record<string, number> | null>(null);
  const [progress, setProgress] = useState('');

  const loadStatus = useCallback(async () => {
    try { setStatus(await getBackupStatus()); } catch { /* the page still works without it */ }
  }, []);
  useEffect(() => { loadStatus(); }, [loadStatus]);

  /**
   * ACHU-396 — the file is fetched as TEXT, because it may be ciphertext.
   *
   * ⚠️ The row counts shown afterwards therefore come from a parse that only
   * succeeds on an unencrypted file. That is not a loss: an encrypted file is
   * opaque to the browser by design, and the counts are a reassurance about the
   * download, not part of it. The message says which kind was saved instead.
   */
  const downloadData = async () => {
    setBusy('data');
    try {
      const text = await exportFullBackupText();
      const encrypted = isEncryptedBackupText(text);
      const stamp = new Date().toISOString().slice(0, 10);

      download(
        /**
         * 🔴 `application/octet-stream` for the encrypted file, NOT `text/plain`.
         *
         * Seen on Roberto's iPhone, 14/08/2026: the download arrived as
         * `ACHU-backup-2026-08-14.achubak.txt`. Safari on iOS appends the
         * extension that matches the blob's MIME type, ignoring the name in
         * `a.download` — so `text/plain` earned a `.txt` on the end. The file was
         * perfectly valid and restored fine; the name was just a lie about what it
         * is, and a name nobody can predict is one nobody can find later.
         *
         * `octet-stream` maps to no extension, so the browser has nothing to add.
         */
        new Blob([text], { type: encrypted ? 'application/octet-stream' : 'application/json' }),
        backupFilename(stamp, encrypted),
      );

      if (encrypted) {
        setLastCounts(null);
        toast.success('Backup downloaded and protected with the backup password', { duration: 6000 });
      } else {
        try { setLastCounts(JSON.parse(text).backup.counts); } catch { setLastCounts(null); }
        toast.warning(
          'Backup downloaded, but it is NOT protected: no backup password is set on the server. '
          + 'The file contains bank details and National Insurance numbers in plain text.',
          { duration: 10000 },
        );
      }
      loadStatus();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not produce the backup.');
    } finally {
      setBusy(null);
    }
  };

  /**
   * 🔴 ACHU-675 — arhiva acoperă acum TOATE fișierele, nu doar bonurile: poze de la vizite,
   * fișierele caselor, pozele din cereri, certificatele medicale. ⚠️ Construirea ei stă în
   * `lib/backupArchive.ts` — ecranul rămâne despre butoane și stare.
   */
  const downloadReceipts = async () => {
    setBusy('receipts');
    setProgress('');
    try {
      const { files } = await getBackupFiles();
      if (!files.length) {
        toast.info('No files uploaded yet — nothing to archive.');
        return;
      }

      const { blob, ok, total, failed } = await buildFileArchive(files, setProgress);
      download(blob, `ACHU-files-${new Date().toISOString().slice(0, 10)}.zip`);

      if (failed.length) {
        // Raportat, nu înghițit: o arhivă tăcut incompletă e mai rea decât una eșuată,
        // fiindcă arată ca un succes.
        toast.warning(`Archive saved with ${ok} of ${total} files. ${failed.length} could not be downloaded — see CONTENTS.txt.`, { duration: 8000 });
      } else {
        toast.success(`Archive saved — ${ok} files`);
      }
    } catch (e) {
      toast.error(errMsg(e) || 'Could not build the file archive.');
    } finally {
      setBusy(null);
      setProgress('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Backup</h2>
          <p className="text-sm text-muted-foreground">
            Keep your own copy of the business data and the receipt files.
          </p>
        </div>
        <RefreshButton onRefresh={loadStatus} />
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="flex gap-3 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="space-y-1 text-sm text-amber-900">
            <p className="font-medium">Your database has no automatic backups.</p>
            <p>
              The Supabase free plan does not include them. If the database were lost, everything —
              customers, jobs, payments, invoices — would be gone. These two downloads are your
              safety net until that changes.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Staleness is the real risk: a backup that relies on someone remembering
          will be forgotten, so the page says so out loud. */}
      {status && (
        <Card className={status.stale ? 'border-rose-200 bg-rose-50' : ''}>
          <CardContent className="flex items-center gap-3 p-4 text-sm">
            {status.stale
              ? <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              : <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />}
            <p className={status.stale ? 'text-rose-900' : ''}>
              {status.lastBackupAt === null
                ? <>No backup has ever been taken. <strong>Do one now.</strong></>
                : status.daysSince === 0
                  ? <>Last backup: <strong>today</strong>, by {status.lastBackupBy}.</>
                  : <>Last backup: <strong>{status.daysSince} day{status.daysSince === 1 ? '' : 's'} ago</strong>{status.stale ? ' — time for another one.' : `, by ${status.lastBackupBy}.`}</>}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <div>
              <h3 className="font-semibold">1. Data</h3>
              <p className="text-sm text-muted-foreground">
                Customers, jobs, payments, expenses, invoices, chat, audit history.
              </p>
            </div>
            <Button onClick={downloadData} disabled={busy !== null}>
              {busy === 'data'
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing…</>
                : <><Download className="mr-2 h-4 w-4" />Download data</>}
            </Button>

            {lastCounts && (
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="mb-1.5 text-xs font-medium">
                  {Object.values(lastCounts).reduce((n, c) => n + c, 0)} records saved
                </p>
                <div className="grid grid-cols-2 gap-x-3 text-xs text-muted-foreground">
                  {Object.entries(lastCounts).filter(([, n]) => n > 0).map(([t, n]) => (
                    <span key={t} className="tabular-nums">{t}: <span className="font-medium text-foreground">{n}</span></span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <div>
              <h3 className="font-semibold">2. Receipt files</h3>
              <p className="text-sm text-muted-foreground">
                The scanned receipts and invoices themselves. <strong>These are not in the data
                file</strong> — they are stored separately, so they need their own copy.
              </p>
            </div>
            <Button variant="outline" onClick={downloadReceipts} disabled={busy !== null}>
              {busy === 'receipts'
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{progress || 'Working…'}</>
                : <><FileArchive className="mr-2 h-4 w-4" />Download receipts (.zip)</>}
            </Button>
            <p className="text-xs text-muted-foreground">
              The archive includes a CONTENTS.txt listing every receipt with its date, supplier and
              amount — so the files stay meaningful even without the database.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-2 p-5 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">What to do with the files</p>
          <ul className="list-inside list-disc space-y-1">
            <li>Keep them somewhere that is <strong>not</strong> your computer alone — Google Drive, a USB stick, an email to yourself.</li>
            <li>Do this <strong>once a week</strong>, and straight after any busy day. The banner above turns red after seven days.</li>
            <li>Keep the last few, not just the newest. If a problem goes unnoticed for days, the newest copy may already contain it.</li>
            <li>They hold customer names, addresses and phone numbers — treat them like your accounts, not something to leave on a shared machine.</li>
          </ul>
        </CardContent>
      </Card>

      <RestoreSection busy={busy} setBusy={setBusy} onDone={loadStatus} />
    </div>
  );
}

/**
 * Restore is a last resort, not a routine action, and the page says so. Three
 * gates, matching the backend: Admin only (this whole page is), a typed phrase,
 * and the server's own refusal to write over a database that still has data.
 */
function RestoreSection({ busy, setBusy, onDone }: {
  busy: null | 'data' | 'receipts' | 'restore';
  setBusy: (v: null | 'data' | 'receipts' | 'restore') => void;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<ChosenBackup | null>(null);
  const [phrase, setPhrase] = useState('');
  const [result, setResult] = useState<string | null>(null);
  /** ACHU-496 — the dry-run report. Null until the file has actually been checked. */
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [checking, setChecking] = useState(false);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      // ACHU-396 — plain JSON or an encrypted file; `readBackupFile` tells which.
      setFile(await readBackupFile(f));
      setResult(null);
      // ⚠️ A report about the PREVIOUS file left on screen beside a new one is
      // worse than no report: it is a confident answer to a question nobody asked.
      setPreview(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'That file does not look like an ACHU data backup.');
      setFile(null);
      setPreview(null);
    }
  };

  /**
   * ACHU-496. Read-only on the server — it writes nothing and needs no typed
   * phrase, so it can be run as often as the reader wants before deciding.
   */
  const check = async () => {
    if (!file) return;
    setChecking(true);
    setPreview(null);
    try {
      const res = await previewRestore(restoreBody(file));
      setPreview(res.preview);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not check the file.');
    } finally {
      setChecking(false);
    }
  };

  const run = async () => {
    if (!file) return;
    setBusy('restore');
    setResult(null);
    try {
      const res = await restoreFromBackup({ ...restoreBody(file), confirmation: phrase });
      /**
       * 🔴 ACHU-495. This showed a GREEN "Restore finished" whatever the
       * verification said. The one moment anyone reads this screen is straight
       * after a restore, deciding whether their data is safe — and a green tick
       * ends that decision. A false alarm costs a second look; a false all-clear
       * costs the recovery, because nobody goes hunting for another backup and
       * the older files age out.
       *
       * The old wording was wrong too: "some counts do not match" described the
       * only failure the check could then detect. A conflicting row is not a
       * count problem — it is there, under the right id, holding the wrong values.
       */
      const conflicts = res.conflicts?.length ?? 0;
      const missing = res.missing?.length ?? 0;
      if (res.verified) {
        setResult(`Restored ${res.totalRestored} records. Everything in the file is now in the database.`);
        toast.success('Restore finished — data verified');
      } else {
        const parts = [
          conflicts > 0 && `${conflicts} record(s) are already in the database with DIFFERENT values, so the file's version was NOT written`,
          missing > 0 && `${missing} record(s) from the file are missing`,
        ].filter(Boolean).join(', and ');
        setResult(
          `⚠️ Restored ${res.totalRestored} records, but YOUR DATA IS NOT FULLY BACK. ${parts || 'The database does not match the file.'}. ` +
          `Do not delete this backup file. Details: ${res.mismatches.join('; ')}`,
        );
        toast.error('Restore did NOT fully succeed — read the message below');
      }
      setPhrase('');
      // The report described the database as it was BEFORE this write. Leaving it
      // up would show a stale "would insert 40 records" beside a finished restore.
      setPreview(null);
      onDone();
    } catch (e) {
      toast.error(errMsg(e) || 'Restore failed.');
    } finally {
      setBusy(null);
    }
  };

  // An encrypted file has no readable counts — the server reports them at preview.
  const counts: Record<string, number> = file?.kind === 'plain' ? file.parsed.counts : {};
  const total = Object.values(counts).reduce((n: number, c) => n + (c as number), 0);

  return (
    <Card className="border-dashed">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">Restore from a backup file</h3>
            <p className="text-sm text-muted-foreground">
              Only for recovering after data loss. It writes the file's contents into the database.
            </p>
          </div>
          {!open && (
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Show</Button>
          )}
        </div>

        {open && (
          <div className="space-y-3 border-t border-border pt-3">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              <p className="flex items-center gap-1.5 font-medium"><AlertTriangle className="h-4 w-4" />Read before using</p>
              <p className="mt-1">
                This will refuse to run if the database still has data in it — that is deliberate, to
                stop a restore being run over live records by accident. If you genuinely need to
                overwrite existing data, ask whoever maintains the app.
              </p>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
              <Upload className="h-4 w-4" />
              {file ? file.name : 'Choose a backup file (.json or .achubak)'}
              {/* ⚠️ `.txt` is here for the files already on somebody's phone: before the blob
                  type was fixed, iOS saved them as `….achubak.txt`. Those must stay
                  choosable — what identifies a backup is its CONTENTS, never its name. */}
              <input type="file" accept="application/json,.json,.achubak,.txt,text/plain" className="hidden" onChange={pick} />
            </label>

            {file?.kind === 'plain' && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="font-medium">This file contains {total} records</p>
                <p className="text-xs text-muted-foreground">
                  Taken {file.parsed.generatedAt ? new Date(file.parsed.generatedAt).toLocaleString('en-GB', { timeZone: 'Europe/London' }) : 'at an unknown time'}
                  {file.parsed.generatedBy ? ` by ${file.parsed.generatedBy}` : ''}
                </p>
              </div>
            )}

            {/*
              * ACHU-396 — an encrypted file cannot be summarised here, because the
              * browser genuinely cannot read it. Saying so plainly beats an empty
              * box or a "0 records" that reads like a broken file. "Check the
              * file" below asks the server, which can open it.
              */}
            {file?.kind === 'encrypted' && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="font-medium">This file is protected with the backup password</p>
                <p className="text-xs text-muted-foreground">
                  Its contents cannot be read in the browser. Use “Check the file” below — the
                  server opens it with the password and reports what is inside.
                </p>
              </div>
            )}

            {/*
              * ACHU-496 — the check goes BEFORE the phrase, deliberately. Until
              * this existed, the only way to learn what a restore would do was
              * to run it and read the report afterwards, by which point the
              * decision had been made for you.
              */}
            {file && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={check} disabled={checking || busy !== null}>
                    {checking
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Checking…</>
                      : <><SearchCheck className="mr-2 h-4 w-4" />Check this file against the database</>}
                  </Button>
                  <span className="text-xs text-muted-foreground">Changes nothing. It only reports what a restore would do.</span>
                </div>

                {preview && (
                  <div className="space-y-2 border-t border-border pt-2 text-sm">
                    {!preview.formatVersionOk && (
                      <p className="rounded-md border border-rose-200 bg-rose-50 p-2 text-rose-900">
                        This file is in a format this app cannot restore. Nothing below will work on it.
                      </p>
                    )}
                    <p>
                      The file holds <strong>{preview.totalInFile}</strong> records.
                      {' '}The database is currently <strong>{preview.databaseEmpty ? 'empty' : 'not empty'}</strong>.
                    </p>
                    <ul className="space-y-1">
                      <li>✅ <strong>{preview.totalWouldInsert}</strong> would be added — they are not in the database at all.</li>
                      <li>➖ <strong>{preview.totalIdentical}</strong> are already there and already match. A restore would leave them alone.</li>
                      <li className={preview.totalWouldConflict > 0 ? 'text-rose-900' : ''}>
                        {preview.totalWouldConflict > 0 ? '⚠️' : '✅'} <strong>{preview.totalWouldConflict}</strong> are already there with
                        {' '}<strong>different values</strong>.
                        {preview.totalWouldConflict > 0
                          ? " A restore would KEEP what the database holds and would NOT write the file's version. Nothing tells you afterwards which value was the right one — decide before, not after."
                          : ' Nothing in the file disagrees with the database.'}
                      </li>
                    </ul>

                    {preview.conflicts?.length > 0 && (
                      <details className="rounded-md border border-border bg-background p-2">
                        <summary className="cursor-pointer text-xs font-medium">
                          Show the first {preview.conflicts.length} disagreeing record(s)
                        </summary>
                        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                          {preview.conflicts.map((c: RestorePreviewConflict) => (
                            <li key={`${c.table}-${c.id}`}>
                              <span className="font-mono">{c.table}</span> · {c.id} — differs on: {c.fields.join(', ')}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}

                    {preview.unverifiable?.length > 0 && (
                      <p className="text-xs text-amber-800">{preview.unverifiable.join(' · ')}</p>
                    )}

                    <p className="text-xs text-muted-foreground">
                      This is a snapshot taken just now. If somebody changes data before you restore, the answer can change.
                    </p>
                  </div>
                )}
              </div>
            )}

            {file && (
              <div className="space-y-2">
                <p className="text-sm">
                  To continue, type <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{RESTORE_PHRASE}</code>
                </p>
                <Input aria-label="Type the confirmation phrase to continue"
                  value={phrase}
                  onChange={e => setPhrase(e.target.value)}
                  placeholder={RESTORE_PHRASE}
                  className="max-w-xs font-mono"
                />
                <Button
                  variant="destructive"
                  onClick={run}
                  disabled={busy !== null || phrase !== RESTORE_PHRASE}
                >
                  {busy === 'restore'
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Restoring…</>
                    : 'Restore now'}
                </Button>
              </div>
            )}

            {result && (
              <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">{result}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

