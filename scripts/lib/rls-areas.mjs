/**
 * The cases for areas — the tree an item can belong to.
 *
 * Separate from the item cases because together they pass the 300-line limit,
 * and because the guarantee they check is a different one: items are about
 * who may read a row, areas are also about whose tree a row may hang in.
 *
 * The composite key is the point. A policy that forgets a case lets one user
 * point at another user's row; a foreign key to (id, owner) cannot be
 * forgotten, because there is no statement that satisfies it.
 */

import { A, B, CONSTRAINT, DENIED, rowOwnedBy } from './rls-context.mjs'

/** Refusal: a foreign key with nothing to point at. */
const FOREIGN_KEY = '23503'

/** An area belonging to someone, made by the administrator. Returns its id. */
async function areaOwnedBy(t, owner, name = 'Business', parent = null) {
  const { rows } = await t.q(
    'insert into public.areas (owner, name, parent_id) values ($1, $2, $3) returning id',
    [owner, name, parent],
  )
  return rows[0].id
}

export const CASES = [
  // ── Negative ────────────────────────────────────────────────────────────
  {
    group: 'negative',
    name: 'an unauthenticated visitor cannot read areas',
    run: (t) => t.asAnon(() => t.denied(DENIED, 'select * from public.areas')),
  },
  {
    group: 'negative',
    name: 'A sees none of B areas',
    run: async (t) => {
      await areaOwnedBy(t, B)
      await t.asA(async () => {
        const { rows } = await t.q('select id from public.areas')
        t.require(rows.length === 0, `A saw ${rows.length} of B's areas`)
      })
    },
  },
  {
    group: 'negative',
    name: 'A cannot make an area owned by B',
    run: (t) =>
      t.asA(() =>
        t.denied(DENIED, 'insert into public.areas (owner, name) values ($1, $2)', [
          B,
          'not mine',
        ]),
      ),
  },
  {
    group: 'negative',
    name: 'A cannot move an area to B, nor rewrite its stamps',
    run: async (t) => {
      const id = await areaOwnedBy(t, A)
      await t.asA(async () => {
        for (const column of ['id', 'owner', 'version', 'created_at', 'updated_at']) {
          await t.denied(
            DENIED,
            `update public.areas set ${column} = ${column} where id = $1`,
            [id],
          )
        }
      })
    },
  },
  {
    group: 'negative',
    name: 'A cannot do a physical DELETE on an area',
    run: async (t) => {
      const id = await areaOwnedBy(t, A)
      await t.asA(() =>
        t.denied(DENIED, 'delete from public.areas where id = $1', [id]),
      )
    },
  },
  {
    group: 'negative',
    name: "A cannot hang its area under B's area",
    run: async (t) => {
      const theirs = await areaOwnedBy(t, B)
      await t.asA(() =>
        // Not a policy refusing it: there is no row (theirs, A) to point at,
        // so the composite key has nothing to satisfy.
        t.denied(
          FOREIGN_KEY,
          'insert into public.areas (name, parent_id) values ($1, $2)',
          ['mine, their parent', theirs],
        ),
      )
    },
  },
  {
    group: 'negative',
    name: "A cannot put its item in B's area",
    run: async (t) => {
      const theirs = await areaOwnedBy(t, B)
      const id = await rowOwnedBy(t, A)
      await t.asA(() =>
        t.denied(FOREIGN_KEY, 'update public.items set area_id = $1 where id = $2', [
          theirs,
          id,
        ]),
      )
    },
  },

  // ── Positive ────────────────────────────────────────────────────────────
  {
    group: 'positive',
    name: 'A builds its own tree, three deep, and puts an item in the leaf',
    run: (t) =>
      t.asA(async () => {
        const business = await t.q(
          "insert into public.areas (name) values ('Business') returning id, version",
        )
        t.require(business.rows[0].version === 1, 'the stamp did not write version 1')

        const employed = await t.q(
          "insert into public.areas (name, parent_id) values ('Self-employed', $1) returning id",
          [business.rows[0].id],
        )
        const delivery = await t.q(
          "insert into public.areas (name, parent_id) values ('MultiApp Delivery', $1) returning id",
          [employed.rows[0].id],
        )

        const item = await t.q(
          "insert into public.items (title) values ('a shift') returning id",
        )
        const moved = await t.q(
          'update public.items set area_id = $1 where id = $2 returning area_id',
          [delivery.rows[0].id, item.rows[0].id],
        )
        t.require(moved.rowCount === 1, `affected ${moved.rowCount} rows, expected 1`)
        t.require(
          moved.rows[0].area_id === delivery.rows[0].id,
          'the item did not land in the leaf area',
        )
      }),
  },
  {
    group: 'positive',
    name: 'A soft-deletes an area, and the stamp moves the version on',
    run: async (t) => {
      const id = await areaOwnedBy(t, A)
      await t.asA(async () => {
        const gone = await t.q(
          'update public.areas set deleted_at = now() where id = $1 returning version, deleted_at',
          [id],
        )
        t.require(gone.rows[0].version === 2, 'the version did not grow')
        t.require(gone.rows[0].deleted_at !== null, 'deleted_at stayed empty')
      })
    },
  },

  // ── Constraints ─────────────────────────────────────────────────────────
  {
    group: 'constraint',
    name: 'an area named nothing but spaces is refused',
    run: (t) =>
      t.asA(async () => {
        for (const name of ['', '   ', '\t\n']) {
          await t.denied(CONSTRAINT, 'insert into public.areas (name) values ($1)', [
            name,
          ])
        }
      }),
  },
  {
    group: 'constraint',
    name: 'an area cannot be its own ancestor, one hop or three',
    run: (t) =>
      t.asA(async () => {
        const top = await t.q(
          "insert into public.areas (name) values ('Business') returning id",
        )
        const business = top.rows[0].id
        const middle = await t.q(
          "insert into public.areas (name, parent_id) values ('Self-employed', $1) returning id",
          [business],
        )
        const leaf = await t.q(
          "insert into public.areas (name, parent_id) values ('MultiApp Delivery', $1) returning id",
          [middle.rows[0].id],
        )

        // One hop: the check constraint sees it without leaving the row.
        await t.denied(
          CONSTRAINT,
          'update public.areas set parent_id = $1 where id = $1',
          [business],
        )
        // Three hops: only walking the chain finds this one.
        await t.denied(
          CONSTRAINT,
          'update public.areas set parent_id = $1 where id = $2',
          [leaf.rows[0].id, business],
        )
      }),
  },
]
