/**
 * The harness the RLS cases run on: the two users, the refusal codes, and the
 * context that lets a case step into a role and require a refusal.
 *
 * Separate from the cases themselves because together they crossed the
 * 300-line limit — which only became visible once the structure checker
 * started looking at its own tools instead of just at src/.
 */

/** Two users, seeded into auth.users before the cases run. */
export const A = '11111111-1111-1111-1111-111111111111'
export const B = '22222222-2222-2222-2222-222222222222'

/** Refusal: a missing privilege or a violated policy. */
export const DENIED = '42501'
/** Refusal: one of the table's check constraints. */
export const CONSTRAINT = '23514'

export class Failure extends Error {}

/**
 * A case's tools. Everything that happens through a context sits inside a
 * transaction the runner rolls back, so no case leaves a trace.
 */
export function contextFor(client) {
  let savepoints = 0

  const context = {
    /** A query as the administrator: the case's setup. */
    q: (sql, params) => client.query(sql, params),

    /** Step into a role, with its identity. */
    async as(role, uid, body) {
      if (uid !== null) {
        await client.query('select set_config($1, $2, true)', [
          'request.jwt.claims',
          JSON.stringify({ sub: uid }),
        ])
      }
      await client.query(`set local role ${role}`)
      try {
        return await body()
      } finally {
        await client.query('reset role')
      }
    },

    asAnon: (body) => context.as('anon', null, body),
    asA: (body) => context.as('authenticated', A, body),

    /**
     * Requires a query to be refused, with the expected code — not merely "to
     * throw". The savepoint is mandatory: in PostgreSQL the first error aborts
     * the transaction, and without it the next check would fail for a reason
     * other than the one being tested.
     */
    async denied(code, sql, params) {
      const name = `s${(savepoints += 1)}`
      await client.query(`savepoint ${name}`)
      try {
        await client.query(sql, params)
      } catch (error) {
        await client.query(`rollback to savepoint ${name}`)
        if (error.code === code) return
        throw new Failure(`refused with ${error.code}, expected ${code} — ${error.message}`)
      }
      await client.query(`rollback to savepoint ${name}`)
      throw new Failure(`it went through, though it should have been refused: ${sql}`)
    },

    require(condition, message) {
      if (!condition) throw new Failure(message)
    },
  }

  return context
}

/** A row owned by someone, inserted by the administrator. Returns its id. */
export async function rowOwnedBy(t, owner) {
  const { rows } = await t.q(
    'insert into public.items (owner, title) values ($1, $2) returning id',
    [owner, 'a row for checking'],
  )
  return rows[0].id
}
