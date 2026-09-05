/**
 * The cases for the two settings tables, and for the pinning they feed.
 *
 * The isolation matters here the way it does everywhere. What matters more is
 * that the rates on a shift are the database's to write: if a client can set
 * them, "pinned" means nothing, and a report can be made to say whatever the
 * person reading it wants.
 */

import { A, B, CONSTRAINT, DENIED } from './rls-context.mjs'

const FOREIGN_KEY = '23503'

async function areaOwnedBy(t, owner, name = 'MultiApp Delivery') {
  const { rows } = await t.q(
    'insert into public.areas (owner, name) values ($1, $2) returning id',
    [owner, name],
  )
  return rows[0].id
}

async function shiftIn(t, owner, area) {
  const { rows } = await t.q(
    `insert into public.items (owner, title, kind, state, due, area_id)
     values ($1, 'Shift', 'shift', 'active', current_date, $2) returning id`,
    [owner, area],
  )
  return rows[0].id
}

export const CASES = [
  // ── Negative ────────────────────────────────────────────────────────────
  {
    group: 'negative',
    name: 'an unauthenticated visitor cannot read the reserves or the costs',
    run: (t) =>
      t.asAnon(async () => {
        await t.denied(DENIED, 'select * from public.reserves')
        await t.denied(DENIED, 'select * from public.running_costs')
      }),
  },
  {
    group: 'negative',
    name: "A sees none of B's reserves",
    run: async (t) => {
      await t.q('insert into public.reserves (owner, tax_pct, ni_pct) values ($1, 20, 6)', [B])
      await t.asA(async () => {
        const { rows } = await t.q('select owner from public.reserves')
        t.require(rows.length === 0, `A saw ${rows.length} of B's reserves`)
      })
    },
  },
  {
    group: 'negative',
    name: "A cannot put running costs on B's area",
    run: async (t) => {
      const theirs = await areaOwnedBy(t, B)
      await t.asA(() =>
        t.denied(
          FOREIGN_KEY,
          `insert into public.running_costs (area_id, fuel_per_km, vehicle_per_km)
           values ($1, 0.116, 0.116)`,
          [theirs],
        ),
      )
    },
  },
  {
    group: 'negative',
    name: 'A cannot write the rates pinned on its own shift',
    run: async (t) => {
      const area = await areaOwnedBy(t, A)
      const anchor = await shiftIn(t, A, area)
      await t.q('insert into public.shifts (owner, item_id) values ($1, $2)', [A, anchor])
      await t.asA(async () => {
        for (const column of [
          'rate_tax_pct',
          'rate_ni_pct',
          'rate_fuel_per_km',
          'rate_vehicle_per_km',
        ]) {
          // Pinned means pinned. A client that can set the rate can make a
          // report say anything, which is the one thing a report may not do.
          await t.denied(
            DENIED,
            `update public.shifts set ${column} = 1 where item_id = $1`,
            [anchor],
          )
        }
      })
    },
  },

  // ── Positive ────────────────────────────────────────────────────────────
  {
    group: 'positive',
    name: 'the rates are pinned onto a shift, and a later change does not reach back',
    run: (t) =>
      t.asA(async () => {
        const area = await t.q(
          "insert into public.areas (name) values ('MultiApp Delivery') returning id",
        )
        await t.q('insert into public.reserves (tax_pct, ni_pct) values (20, 6)')
        await t.q(
          `insert into public.running_costs (area_id, fuel_per_km, vehicle_per_km)
           values ($1, 0.116, 0.116)`,
          [area.rows[0].id],
        )

        const anchor = await t.q(
          `insert into public.items (title, kind, state, due, area_id)
           values ('Shift', 'shift', 'active', current_date, $1) returning id`,
          [area.rows[0].id],
        )
        const id = anchor.rows[0].id
        await t.q(
          'insert into public.shifts (item_id, odo_start, odo_end) values ($1, 100000, 100167.4)',
          [id],
        )

        const pinned = await t.q('select * from public.shifts where item_id = $1', [id])
        t.require(Number(pinned.rows[0].rate_tax_pct) === 20, 'the tax rate was not pinned')
        t.require(Number(pinned.rows[0].rate_ni_pct) === 6, 'the NI rate was not pinned')
        t.require(
          Number(pinned.rows[0].rate_fuel_per_km) === 0.116,
          'the fuel cost was not pinned',
        )

        // Change the setting: October must not become a different month.
        await t.q('update public.reserves set tax_pct = 30')
        const after = await t.q('select rate_tax_pct from public.shifts where item_id = $1', [id])
        t.require(
          Number(after.rows[0].rate_tax_pct) === 20,
          `the shift followed the setting to ${after.rows[0].rate_tax_pct}`,
        )
      }),
  },
  {
    group: 'positive',
    name: 'a shift written before the settings existed is pinned by the next write to it',
    run: (t) =>
      t.asA(async () => {
        const area = await t.q(
          "insert into public.areas (name) values ('MultiApp Delivery') returning id",
        )
        const anchor = await t.q(
          `insert into public.items (title, kind, state, due, area_id)
           values ('Shift', 'shift', 'active', current_date, $1) returning id`,
          [area.rows[0].id],
        )
        const id = anchor.rows[0].id
        await t.q('insert into public.shifts (item_id) values ($1)', [id])

        const bare = await t.q('select rate_tax_pct from public.shifts where item_id = $1', [id])
        t.require(bare.rows[0].rate_tax_pct === null, 'it pinned a rate out of nowhere')

        await t.q('insert into public.reserves (tax_pct, ni_pct) values (20, 6)')
        await t.q('update public.shifts set tips = 12.50 where item_id = $1', [id])

        const now = await t.q('select rate_tax_pct from public.shifts where item_id = $1', [id])
        t.require(Number(now.rows[0].rate_tax_pct) === 20, 'the later write did not pin it')
      }),
  },

  // ── Constraints ─────────────────────────────────────────────────────────
  {
    group: 'constraint',
    name: 'the reserves cannot take more than there is, nor less than nothing',
    run: (t) =>
      t.asA(async () => {
        await t.denied(
          CONSTRAINT,
          'insert into public.reserves (tax_pct, ni_pct) values (80, 40)',
        )
        await t.denied(
          CONSTRAINT,
          'insert into public.reserves (tax_pct, ni_pct) values (-1, 6)',
        )
        await t.denied(
          CONSTRAINT,
          'insert into public.reserves (tax_pct, ni_pct) values (20, 101)',
        )
      }),
  },
]
