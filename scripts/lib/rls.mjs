/**
 * The cases of the RLS test.
 *
 * This is the most dangerous part of the schema and the only one whose
 * mistakes do not show up as an ugly screen, but as your data read by somebody
 * else.
 *
 * The negatives are not enough on their own: if A could do nothing at all,
 * every one of them would go green. That is why there are positives too.
 */

import { A, B, CONSTRAINT, DENIED, rowOwnedBy } from './rls-context.mjs'

export const CASES = [
  // ── Negative ────────────────────────────────────────────────────────────
  {
    group: 'negative',
    name: 'an unauthenticated visitor cannot read',
    run: (t) => t.asAnon(() => t.denied(DENIED, 'select * from public.items')),
  },
  {
    group: 'negative',
    name: 'an unauthenticated visitor cannot write',
    run: (t) =>
      t.asAnon(() =>
        t.denied(DENIED, "insert into public.items (title) values ('from anon')"),
      ),
  },
  {
    group: 'negative',
    name: "A sees none of B's rows",
    run: async (t) => {
      await rowOwnedBy(t, B)
      const result = await t.asA(() => t.q('select id from public.items'))
      t.require(
        result.rowCount === 0,
        `saw ${result.rowCount} rows that are not its own`,
      )
    },
  },
  {
    group: 'negative',
    name: 'A cannot insert a row owned by B',
    run: (t) =>
      t.asA(() =>
        t.denied(DENIED, 'insert into public.items (owner, title) values ($1, $2)', [
          B,
          'smuggled',
        ]),
      ),
  },
  {
    group: 'negative',
    name: 'A cannot move a row to B',
    run: async (t) => {
      const id = await rowOwnedBy(t, A)
      await t.asA(() =>
        t.denied(DENIED, 'update public.items set owner = $1 where id = $2', [B, id]),
      )
    },
  },
  {
    group: 'negative',
    name: 'A cannot do a physical DELETE',
    run: async (t) => {
      const id = await rowOwnedBy(t, A)
      await t.asA(() =>
        t.denied(DENIED, 'delete from public.items where id = $1', [id]),
      )
    },
  },
  {
    group: 'negative',
    name: 'A cannot write id, owner, version, created_at or updated_at',
    run: async (t) => {
      const id = await rowOwnedBy(t, A)
      await t.asA(async () => {
        for (const [column, value] of [
          ['id', "'33333333-3333-3333-3333-333333333333'"],
          ['owner', `'${B}'`],
          ['version', '99'],
          ['created_at', 'now()'],
          ['updated_at', 'now()'],
        ]) {
          await t.denied(
            DENIED,
            `update public.items set ${column} = ${value} where id = $1`,
            [id],
          )
        }
      })
    },
  },

  {
    group: 'negative',
    name: 'A cannot choose the id, the owner or the version at INSERT',
    run: (t) =>
      t.asA(async () => {
        // The trigger pins id only on UPDATE, so at INSERT nothing but the
        // column grant stands between a client and an id of its own choosing.
        for (const [column, value] of [
          ['id', "'44444444-4444-4444-4444-444444444444'"],
          ['owner', `'${B}'`],
          ['version', '99'],
          ['created_at', 'now()'],
          ['updated_at', 'now()'],
        ]) {
          await t.denied(
            DENIED,
            `insert into public.items (title, ${column}) values ('call X', ${value})`,
          )
        }
      }),
  },

  // ── Positive: without these, the ones above can be green for nothing ────
  {
    group: 'positive',
    name: 'A inserts its own row',
    run: (t) =>
      t.asA(async () => {
        const { rows } = await t.q(
          "insert into public.items (title) values ('call X') returning owner, state, kind, version",
        )
        t.require(rows[0].owner === A, 'the default owner is not A')
        t.require(rows[0].state === 'inbox', 'the default state is not inbox')
        t.require(rows[0].kind === null, 'kind is not null on a capture')
        t.require(rows[0].version === 1, 'the version on insert is not 1')
      }),
  },
  {
    group: 'positive',
    name: 'A reads its own row',
    run: async (t) => {
      await rowOwnedBy(t, B)
      await t.asA(async () => {
        await t.q("insert into public.items (title) values ('call X')")
        const { rowCount } = await t.q('select id from public.items')
        t.require(rowCount === 1, `saw ${rowCount} rows, expected 1`)
      })
    },
  },
  {
    group: 'positive',
    name: 'A updates its own row, and the version grows',
    run: (t) =>
      t.asA(async () => {
        const { rows } = await t.q(
          "insert into public.items (title) values ('call X') returning id",
        )
        const after = await t.q(
          "update public.items set state = 'active', kind = 'task', due = '2026-09-05' where id = $1 returning version, created_at, updated_at",
          [rows[0].id],
        )
        t.require(after.rows[0].version === 2, `the version after update is ${after.rows[0].version}`)
        t.require(
          after.rows[0].updated_at >= after.rows[0].created_at,
          'updated_at fell behind created_at',
        )
      }),
  },
  {
    group: 'positive',
    name: 'A soft-deletes its own row',
    run: (t) =>
      t.asA(async () => {
        const { rows } = await t.q(
          "insert into public.items (title) values ('call X') returning id",
        )
        const after = await t.q(
          'update public.items set deleted_at = now() where id = $1 returning deleted_at',
          [rows[0].id],
        )
        t.require(after.rows[0].deleted_at !== null, 'deleted_at stayed empty')
      }),
  },

  // ── Writing: the version check, enforced by the database ────────────────
  {
    group: 'writing',
    name: 'the conditional UPDATE affects one row on the current version, zero on a stale one',
    run: (t) =>
      t.asA(async () => {
        const { rows } = await t.q(
          "insert into public.items (title) values ('call X') returning id, version",
        )
        const { id, version } = rows[0]

        // With the current version: exactly one row.
        const matched = await t.q(
          `update public.items set title = 'changed'
             where id = $1 and owner = auth.uid() and version = $2
           returning version`,
          [id, version],
        )
        t.require(matched.rowCount === 1, `affected ${matched.rowCount} rows, expected 1`)
        t.require(matched.rows[0].version === version + 1, 'the version did not grow')

        // With the previous version: none. This is the mechanism the entire
        // write path rests on — not a check in JavaScript.
        const stale = await t.q(
          `update public.items set title = 'over the top'
             where id = $1 and owner = auth.uid() and version = $2
           returning id`,
          [id, version],
        )
        t.require(stale.rowCount === 0, `affected ${stale.rowCount} rows, expected 0`)

        // And the row still holds what the write that succeeded left there.
        const now = await t.q('select title from public.items where id = $1', [id])
        t.require(now.rows[0].title === 'changed', 'the row was trampled by the stale write')
      }),
  },

  // ── The constraints the plan counts as machine-enforced ─────────────────
  {
    group: 'constraint',
    name: 'an empty title is refused',
    run: (t) =>
      t.asA(async () => {
        for (const title of ['', '   ', '\t\n']) {
          await t.denied(CONSTRAINT, 'insert into public.items (title) values ($1)', [
            title,
          ])
        }
      }),
  },
  {
    group: 'constraint',
    name: 'a contradictory state and kind are refused both ways round',
    run: (t) =>
      t.asA(async () => {
        // In the inbox there is no kind.
        await t.denied(
          CONSTRAINT,
          "insert into public.items (title, state, kind) values ('x', 'inbox', 'task')",
        )
        // You do not leave the inbox without a kind.
        await t.denied(
          CONSTRAINT,
          "insert into public.items (title, state) values ('x', 'active')",
        )
      }),
  },
  {
    group: 'constraint',
    name: 'a state or a kind that does not exist is refused',
    run: (t) =>
      t.asA(async () => {
        await t.denied(
          CONSTRAINT,
          "insert into public.items (title, state, kind) values ('x', 'dropped', 'task')",
        )
        await t.denied(
          CONSTRAINT,
          "insert into public.items (title, state, kind) values ('x', 'active', 'note')",
        )
      }),
  },
]
