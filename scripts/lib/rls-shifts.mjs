/**
 * The cases for shifts: the anchor, its three extension tables, and the stamp
 * that makes them travel.
 *
 * The guarantee here is not only "whose rows are these". It is that a change
 * to a number nobody looks up on its own still reaches the other device — so
 * the stamp on the anchor is checked as strictly as the isolation is.
 */

import { A, B, CONSTRAINT, DENIED } from './rls-context.mjs'

/** Refusal: a foreign key with nothing to point at. */
const FOREIGN_KEY = '23503'
/** Refusal: a key already taken. */
const DUPLICATE = '23505'

/** A shift anchor owned by someone, made by the administrator. */
async function shiftOwnedBy(t, owner) {
  const { rows } = await t.q(
    `insert into public.items (owner, title, kind, state, due)
     values ($1, 'Shift', 'shift', 'active', current_date) returning id`,
    [owner],
  )
  return rows[0].id
}

/** The anchor's version right now. */
async function versionOf(t, id) {
  const { rows } = await t.q('select version from public.items where id = $1', [id])
  return rows[0].version
}

export const CASES = [
  // ── Negative ────────────────────────────────────────────────────────────
  {
    group: 'negative',
    name: 'an unauthenticated visitor cannot read shifts, sessions or earnings',
    run: (t) =>
      t.asAnon(async () => {
        for (const table of ['shifts', 'shift_sessions', 'shift_earnings']) {
          await t.denied(DENIED, `select * from public.${table}`)
        }
      }),
  },
  {
    group: 'negative',
    name: "A sees none of B's shift numbers",
    run: async (t) => {
      const theirs = await shiftOwnedBy(t, B)
      await t.q(
        'insert into public.shifts (owner, item_id, tips) values ($1, $2, 40)',
        [B, theirs],
      )
      await t.asA(async () => {
        const { rows } = await t.q('select item_id from public.shifts')
        t.require(rows.length === 0, `A saw ${rows.length} of B's shifts`)
      })
    },
  },
  {
    group: 'negative',
    name: "A cannot hang its numbers on B's shift",
    run: async (t) => {
      const theirs = await shiftOwnedBy(t, B)
      await t.asA(async () => {
        // No row (theirs, A) exists for the composite key to point at. Not a
        // policy that could be written wrong: a statement nothing satisfies.
        await t.denied(
          FOREIGN_KEY,
          'insert into public.shifts (item_id, tips) values ($1, 5)',
          [theirs],
        )
        await t.denied(
          FOREIGN_KEY,
          `insert into public.shift_earnings (item_id, platform, amount)
           values ($1, 'uber_eats', 5)`,
          [theirs],
        )
      })
    },
  },
  {
    group: 'negative',
    name: 'A cannot move a shift row to B, nor re-anchor it',
    run: async (t) => {
      const mine = await shiftOwnedBy(t, A)
      await t.q('insert into public.shifts (owner, item_id) values ($1, $2)', [A, mine])
      await t.asA(async () => {
        for (const column of ['owner', 'item_id']) {
          await t.denied(
            DENIED,
            `update public.shifts set ${column} = ${column} where item_id = $1`,
            [mine],
          )
        }
      })
    },
  },

  // ── Positive ────────────────────────────────────────────────────────────
  {
    group: 'positive',
    name: 'A records a whole shift, and every part of it stamps the anchor',
    run: (t) =>
      t.asA(async () => {
        const anchor = await t.q(
          `insert into public.items (title, kind, state, due)
           values ('Shift', 'shift', 'active', current_date)
           returning id, version`,
        )
        const id = anchor.rows[0].id
        t.require(anchor.rows[0].version === 1, 'the anchor did not start at version 1')

        await t.q(
          'insert into public.shifts (item_id, odo_start, tips) values ($1, 120345.0, 12.50)',
          [id],
        )
        const afterShift = await versionOf(t, id)
        t.require(afterShift === 2, `version ${afterShift} after the shift row, expected 2`)

        await t.q(
          `insert into public.shift_sessions (item_id, started_at, ended_at) values
             ($1, now() - interval '9 hours', now() - interval '6 hours'),
             ($1, now() - interval '4 hours', now() - interval '1 hour')`,
          [id],
        )
        const afterSessions = await versionOf(t, id)
        t.require(afterSessions === 4, `version ${afterSessions} after two sessions`)

        await t.q(
          `insert into public.shift_earnings (item_id, platform, amount) values
             ($1, 'uber_eats', 64.20), ($1, 'deliveroo', 31.00), ($1, 'just_eat', 18.75)`,
          [id],
        )
        const afterEarnings = await versionOf(t, id)
        t.require(afterEarnings === 7, `version ${afterEarnings} after three platforms`)

        // This is the whole strategy: nobody ever asks for these rows by
        // themselves, so the only way the other device hears about them is
        // the anchor moving. It moved seven times for seven writes.
        const total = await t.q(
          'select sum(amount) as total from public.shift_earnings where item_id = $1',
          [id],
        )
        t.require(Number(total.rows[0].total) === 113.95, 'the money does not add up')
      }),
  },
  {
    group: 'positive',
    name: 'A removes a session outright, and the anchor hears about that too',
    run: (t) =>
      t.asA(async () => {
        const anchor = await t.q(
          `insert into public.items (title, kind, state, due)
           values ('Shift', 'shift', 'active', current_date) returning id`,
        )
        const id = anchor.rows[0].id
        const session = await t.q(
          `insert into public.shift_sessions (item_id, started_at)
           values ($1, now()) returning id`,
          [id],
        )
        const before = await versionOf(t, id)

        // A physical DELETE, which items themselves never get. A session is
        // only ever read as one of this anchor's, so removing it cannot leave
        // a row that is nowhere to be found.
        const gone = await t.q('delete from public.shift_sessions where id = $1', [
          session.rows[0].id,
        ])
        t.require(gone.rowCount === 1, `deleted ${gone.rowCount} rows, expected 1`)
        t.require((await versionOf(t, id)) === before + 1, 'the delete did not stamp')
      }),
  },

  // ── Constraints ─────────────────────────────────────────────────────────
  {
    group: 'constraint',
    name: 'a platform is counted once per shift, and only the three that exist',
    run: (t) =>
      t.asA(async () => {
        const anchor = await t.q(
          `insert into public.items (title, kind, state, due)
           values ('Shift', 'shift', 'active', current_date) returning id`,
        )
        const id = anchor.rows[0].id
        await t.q(
          `insert into public.shift_earnings (item_id, platform, amount)
           values ($1, 'uber_eats', 64.20)`,
          [id],
        )

        await t.denied(
          DUPLICATE,
          `insert into public.shift_earnings (item_id, platform, amount)
           values ($1, 'uber_eats', 5)`,
          [id],
        )
        await t.denied(
          CONSTRAINT,
          `insert into public.shift_earnings (item_id, platform, amount)
           values ($1, 'bolt', 5)`,
          [id],
        )
        await t.denied(
          CONSTRAINT,
          `insert into public.shift_earnings (item_id, platform, amount)
           values ($1, 'deliveroo', -1)`,
          [id],
        )
      }),
  },
  {
    group: 'constraint',
    name: 'the odometer does not run backwards, and a session does not end before it starts',
    run: (t) =>
      t.asA(async () => {
        const anchor = await t.q(
          `insert into public.items (title, kind, state, due)
           values ('Shift', 'shift', 'active', current_date) returning id`,
        )
        const id = anchor.rows[0].id
        await t.q(
          'insert into public.shifts (item_id, odo_start) values ($1, 120345.0)',
          [id],
        )

        await t.denied(
          CONSTRAINT,
          'update public.shifts set odo_end = 120000.0 where item_id = $1',
          [id],
        )
        await t.denied(
          CONSTRAINT,
          `insert into public.shift_sessions (item_id, started_at, ended_at)
           values ($1, now(), now() - interval '1 hour')`,
          [id],
        )
      }),
  },
]
