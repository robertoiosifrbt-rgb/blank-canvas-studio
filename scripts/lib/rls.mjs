/**
 * Cazurile testului de RLS.
 *
 * E partea cea mai periculoasă din schemă și singura ale cărei greșeli nu se
 * văd ca un ecran urât, ci ca datele tale citite de altcineva.
 *
 * Negativele nu ajung singure: dacă A n-ar putea face nimic deloc, toate ar
 * trece verzi. De-aia sunt și pozitive.
 */

/** Doi utilizatori, semănați în auth.users înainte de cazuri. */
export const A = '11111111-1111-1111-1111-111111111111'
export const B = '22222222-2222-2222-2222-222222222222'

/** Refuz: privilegiu lipsă sau politică încălcată. */
export const REFUZAT = '42501'
/** Refuz: o constrângere check a tabelului. */
export const CONSTRÂNGERE = '23514'

export class Cădere extends Error {}

/**
 * Uneltele unui caz. Tot ce se întâmplă printr-un context stă într-o
 * tranzacție pe care rulătorul o dă înapoi, deci niciun caz nu lasă urme.
 */
export function contextul(client) {
  let savepointuri = 0

  const context = {
    /** Interogare ca administrator: pregătirea cazului. */
    q: (sql, parametri) => client.query(sql, parametri),

    /** Intră în pielea unui rol, cu identitatea lui. */
    async ca(rol, uid, treabă) {
      if (uid !== null) {
        await client.query('select set_config($1, $2, true)', [
          'request.jwt.claims',
          JSON.stringify({ sub: uid }),
        ])
      }
      await client.query(`set local role ${rol}`)
      try {
        return await treabă()
      } finally {
        await client.query('reset role')
      }
    },

    caAnon: (treabă) => context.ca('anon', null, treabă),
    caA: (treabă) => context.ca('authenticated', A, treabă),

    /**
     * Cere ca o interogare să fie refuzată, cu codul așteptat — nu doar „să
     * dea eroare". Savepoint-ul e obligatoriu: în Postgres prima eroare
     * abandonează tranzacția, iar fără el verificarea următoare ar cădea
     * pentru alt motiv decât cel testat.
     */
    async refuză(cod, sql, parametri) {
      const nume = `s${(savepointuri += 1)}`
      await client.query(`savepoint ${nume}`)
      try {
        await client.query(sql, parametri)
      } catch (eroare) {
        await client.query(`rollback to savepoint ${nume}`)
        if (eroare.code === cod) return
        throw new Cădere(
          `refuzat cu ${eroare.code}, se aștepta ${cod} — ${eroare.message}`,
        )
      }
      await client.query(`rollback to savepoint ${nume}`)
      throw new Cădere(`a trecut, deși trebuia refuzat: ${sql}`)
    },

    cere(condiție, mesaj) {
      if (!condiție) throw new Cădere(mesaj)
    },
  }

  return context
}

/** Un rând al lui A, pus de administrator. Întoarce id-ul. */
async function rândAlLui(t, proprietar) {
  const { rows } = await t.q(
    'insert into public.items (owner, title) values ($1, $2) returning id',
    [proprietar, 'rând de verificare'],
  )
  return rows[0].id
}

export const CAZURI = [
  // ── Negative ────────────────────────────────────────────────────────────
  {
    grup: 'negativ',
    nume: 'neautentificat nu poate citi',
    rulează: (t) =>
      t.caAnon(() => t.refuză(REFUZAT, 'select * from public.items')),
  },
  {
    grup: 'negativ',
    nume: 'neautentificat nu poate scrie',
    rulează: (t) =>
      t.caAnon(() =>
        t.refuză(REFUZAT, "insert into public.items (title) values ('de la anon')"),
      ),
  },
  {
    grup: 'negativ',
    nume: 'A nu vede niciun rând al lui B',
    rulează: async (t) => {
      await rândAlLui(t, B)
      const rezultat = await t.caA(() => t.q('select id from public.items'))
      t.cere(
        rezultat.rowCount === 0,
        `a văzut ${rezultat.rowCount} rânduri care nu sunt ale lui`,
      )
    },
  },
  {
    grup: 'negativ',
    nume: 'A nu poate insera un rând cu owner = B',
    rulează: (t) =>
      t.caA(() =>
        t.refuză(
          REFUZAT,
          'insert into public.items (owner, title) values ($1, $2)',
          [B, 'strecurat'],
        ),
      ),
  },
  {
    grup: 'negativ',
    nume: 'A nu poate muta un rând către B',
    rulează: async (t) => {
      const id = await rândAlLui(t, A)
      await t.caA(() =>
        t.refuză(REFUZAT, 'update public.items set owner = $1 where id = $2', [
          B,
          id,
        ]),
      )
    },
  },
  {
    grup: 'negativ',
    nume: 'A nu poate face DELETE fizic',
    rulează: async (t) => {
      const id = await rândAlLui(t, A)
      await t.caA(() =>
        t.refuză(REFUZAT, 'delete from public.items where id = $1', [id]),
      )
    },
  },
  {
    grup: 'negativ',
    nume: 'A nu poate scrie id, owner, version, created_at sau updated_at',
    rulează: async (t) => {
      const id = await rândAlLui(t, A)
      await t.caA(async () => {
        for (const [coloană, valoare] of [
          ['id', "'33333333-3333-3333-3333-333333333333'"],
          ['owner', `'${B}'`],
          ['version', '99'],
          ['created_at', 'now()'],
          ['updated_at', 'now()'],
        ]) {
          await t.refuză(
            REFUZAT,
            `update public.items set ${coloană} = ${valoare} where id = $1`,
            [id],
          )
        }
      })
    },
  },

  // ── Pozitive: fără ele, cele de sus pot fi verzi și degeaba ─────────────
  {
    grup: 'pozitiv',
    nume: 'A își inserează propriul rând',
    rulează: (t) =>
      t.caA(async () => {
        const { rows } = await t.q(
          "insert into public.items (title) values ('sun la X') returning owner, state, kind, version",
        )
        t.cere(rows[0].owner === A, 'owner-ul implicit nu e A')
        t.cere(rows[0].state === 'inbox', 'starea implicită nu e inbox')
        t.cere(rows[0].kind === null, 'kind nu e null la captură')
        t.cere(rows[0].version === 1, 'versiunea la insert nu e 1')
      }),
  },
  {
    grup: 'pozitiv',
    nume: 'A își citește propriul rând',
    rulează: async (t) => {
      await rândAlLui(t, B)
      await t.caA(async () => {
        await t.q("insert into public.items (title) values ('sun la X')")
        const { rowCount } = await t.q('select id from public.items')
        t.cere(rowCount === 1, `a văzut ${rowCount} rânduri, se aștepta 1`)
      })
    },
  },
  {
    grup: 'pozitiv',
    nume: 'A își modifică propriul rând, și versiunea crește',
    rulează: (t) =>
      t.caA(async () => {
        const { rows } = await t.q(
          "insert into public.items (title) values ('sun la X') returning id",
        )
        const după = await t.q(
          "update public.items set state = 'active', kind = 'task', due = '2026-09-05' where id = $1 returning version, created_at, updated_at",
          [rows[0].id],
        )
        t.cere(după.rows[0].version === 2, `versiunea după update e ${după.rows[0].version}`)
        t.cere(
          după.rows[0].updated_at >= după.rows[0].created_at,
          'updated_at a rămas în urma lui created_at',
        )
      }),
  },
  {
    grup: 'pozitiv',
    nume: 'A face soft-delete pe al lui',
    rulează: (t) =>
      t.caA(async () => {
        const { rows } = await t.q(
          "insert into public.items (title) values ('sun la X') returning id",
        )
        const după = await t.q(
          'update public.items set deleted_at = now() where id = $1 returning deleted_at',
          [rows[0].id],
        )
        t.cere(după.rows[0].deleted_at !== null, 'deleted_at a rămas gol')
      }),
  },

  // ── Constrângerile pe care planul le trece drept impuse de mașină ───────
  {
    grup: 'constrângere',
    nume: 'titlu gol, refuzat',
    rulează: (t) =>
      t.caA(async () => {
        for (const titlu of ['', '   ', '\t\n']) {
          await t.refuză(CONSTRÂNGERE, 'insert into public.items (title) values ($1)', [
            titlu,
          ])
        }
      }),
  },
  {
    grup: 'constrângere',
    nume: 'stare și fel contradictorii, refuzate în ambele sensuri',
    rulează: (t) =>
      t.caA(async () => {
        // În inbox nu există kind.
        await t.refuză(
          CONSTRÂNGERE,
          "insert into public.items (title, state, kind) values ('x', 'inbox', 'task')",
        )
        // Nu ieși din inbox fără kind.
        await t.refuză(
          CONSTRÂNGERE,
          "insert into public.items (title, state) values ('x', 'active')",
        )
      }),
  },
  {
    grup: 'constrângere',
    nume: 'o stare sau un fel care nu există, refuzate',
    rulează: (t) =>
      t.caA(async () => {
        await t.refuză(
          CONSTRÂNGERE,
          "insert into public.items (title, state, kind) values ('x', 'dropped', 'task')",
        )
        await t.refuză(
          CONSTRÂNGERE,
          "insert into public.items (title, state, kind) values ('x', 'active', 'note')",
        )
      }),
  },
]
