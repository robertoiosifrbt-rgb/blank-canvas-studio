import { useEffect, useState } from 'react';
import { getPayHistory, type PayHistoryResponse } from '@/lib/endpoints';

/**
 * ─── One person's pay history (ACHU-351, Sesiunea 82) ───────────────────────
 *
 * Backlog section 12 said the data existed and the screen did not. Any payslip could
 * already be reprinted — but only by first finding the run it was in. There was no
 * way to ask "what has this person been paid, ever".
 *
 * ⚠️ **Deliberately NOT a payslip.** It shows what was paid and when, and points at
 * the run so the payslip itself is one click away. A third rendering of those
 * figures would be the one that drifts, and a list of pay figures that looked like a
 * pay statement would be issuing a document by accident.
 *
 * ⚠️ Collapsed by default. Somebody opening this dialog is usually editing a tax
 * code, and twelve rows of history above the field they came for is noise — but a
 * history hidden behind another screen is the gap this closes.
 */
export function PayHistory({ cleanerId }: { cleanerId: string }) {
  const [d, setD] = useState<PayHistoryResponse | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    // Swallowed: a panel beside the real form must not put an error over somebody's
    // pay details.
    getPayHistory({ cleanerId }).then(r => { if (live) setD(r); }).catch(() => {});
    return () => { live = false; };
  }, [cleanerId]);

  if (!d) return null;

  const money = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const paid = d.allTime.payments;

  return (
    <div className="rounded border p-3 space-y-2">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-xs font-medium">Pay history</span>
        <span className="text-xs text-muted-foreground">
          {paid === 0
            ? '— never paid through payroll'
            : `— ${paid} payment${paid === 1 ? '' : 's'}, ${money(d.allTime.gross)} gross all time`}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && paid > 0 && (
        <div className="space-y-3">
          {d.years.map(y => (
            <div key={y.taxYear}>
              <p className="text-xs font-medium">
                {y.taxYear} — {money(y.totals.gross)} gross · {money(y.totals.netPay)} net · {y.totals.payments} payments
              </p>
              <div tabIndex={0} className="overflow-x-auto">
                <table className="mt-1 w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th scope="col" className="py-1 pr-2">Paid</th>
                      <th scope="col" className="py-1 pr-2">Period</th>
                      <th scope="col" className="py-1 pr-2 text-right">Gross</th>
                      <th scope="col" className="py-1 pr-2 text-right">Net</th>
                      <th scope="col" className="py-1">Tax code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {y.payments.map(pmt => (
                      <tr key={pmt.lineId} className="border-b last:border-0">
                        <td className="py-1 pr-2">{pmt.payDate}</td>
                        <td className="py-1 pr-2">
                          {pmt.periodNumber}
                          {/* The name as it was, shown only when it differs from the
                              person's name now — otherwise it is noise on every row. */}
                          {pmt.nameSnapshot !== d.person.name && (
                            <span className="text-muted-foreground"> · paid as {pmt.nameSnapshot}</span>
                          )}
                        </td>
                        <td className="py-1 pr-2 text-right">{money(pmt.gross)}</td>
                        <td className="py-1 pr-2 text-right">{money(pmt.netPay)}</td>
                        <td className="py-1">{pmt.taxCodeSnapshot}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {d.notice && <p className="text-xs text-amber-700 dark:text-amber-500">{d.notice}</p>}
          <p className="text-xs text-muted-foreground">{d.notAPayslip}</p>
        </div>
      )}
    </div>
  );
}

