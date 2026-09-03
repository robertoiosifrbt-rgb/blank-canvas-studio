import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MeasurementsPage } from './MeasurementsPage'
import { CORRUPT_SUFFIX } from '../../shared/storage'
import { UnitsProvider } from '../../shared/UnitsProvider'

const STORAGE_KEY = 'gym-app:measurements'

function fillWeight(value: string) {
  fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value } })
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Add measurement' }))
}

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')

/*
 * Formularul stă acum în spatele butonului „+ Add Measurements", iar istoricul
 * are propria secțiune. Helper-ul deschide formularul, ca testele de mai jos
 * să rămână despre validare și salvare, nu despre navigare.
 */
function renderForm() {
  render(<MeasurementsPage section="measurements" />)
  fireEvent.click(screen.getByRole('button', { name: '+ Add Measurements' }))
}

const renderHistory = () => render(<MeasurementsPage section="history" />)

describe('MeasurementsPage', () => {
  it('saves a measurement and shows it in the history', () => {
    renderForm()

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-07-15' } })
    fillWeight('82.4')
    fireEvent.change(screen.getByLabelText('Waist (cm)'), { target: { value: '84' } })
    submit()

    expect(stored()).toHaveLength(1)
    expect(stored()[0]).toMatchObject({ date: '2026-07-15', weightKg: 82.4, waistCm: 84 })

    cleanup()
    renderHistory()
    expect(screen.getByRole('table')).toHaveTextContent('82.4')
  })

  it('closes the form after a successful save', () => {
    renderForm()
    fillWeight('82.4')
    submit()

    // Formularul se închide, deci nu mai stă unsprezece câmpuri gol peste
    // cifrele pe care tocmai le-ai salvat.
    expect(screen.queryByLabelText('Weight (kg)')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Add Measurements' })).toBeInTheDocument()
  })

  /*
   * A refused write used to leave the new value on screen as though it had been
   * saved; it only disappeared on the next reload.
   */
  it('reports a refused write and keeps what was typed', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('exceeded', 'QuotaExceededError')
    })
    renderForm()

    fillWeight('82.4')
    submit()

    expect(screen.getByText(/out of storage space/i)).toBeInTheDocument()
    // The value is still in the form, and nothing pretends to be in history.
    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(82.4)
    expect(stored()).toEqual([])

    setItem.mockRestore()
  })

  it('saves successfully on a retry after storage recovers', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    setItem.mockImplementationOnce(() => {
      throw new DOMException('exceeded', 'QuotaExceededError')
    })
    renderForm()

    fillWeight('82.4')
    submit()
    expect(screen.getByText(/out of storage space/i)).toBeInTheDocument()

    submit()

    expect(stored()).toHaveLength(1)
    setItem.mockRestore()
  })

  /*
   * Corrupt JSON in any one key used to throw during the first render and take
   * the page down with it.
   */
  it('still renders when the stored measurements are corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '[{"id":"m1",')

    render(<MeasurementsPage section="measurements" />)

    // The screen title belongs to the Body tab wrapper now, so this checks a
    // heading the page itself owns.
    expect(screen.getByRole('heading', { name: 'Key Measurements' })).toBeInTheDocument()
    expect(screen.getByText(/unreadable/i)).toBeInTheDocument()
    // The unreadable original is preserved rather than thrown away.
    expect(localStorage.getItem(`${STORAGE_KEY}${CORRUPT_SUFFIX}`)).toBe('[{"id":"m1",')
  })

  it('shows the readable entries when only some stored entries are damaged', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'm1', date: '2026-07-15', weightKg: 82.4 },
        { id: 'm2', date: 'not-a-date', weightKg: 80 },
      ]),
    )

    renderHistory()

    expect(screen.getByRole('table')).toHaveTextContent('82.4')
    expect(screen.getByText(/1 saved entry could not be read/i)).toBeInTheDocument()
  })

  it('marks impossible values as invalid in the browser and stores nothing', () => {
    renderForm()

    fillWeight('-5')
    submit()

    expect(screen.getByLabelText('Weight (kg)')).toBeInvalid()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  /*
   * `min`/`max` on the inputs are only enforced by the browser's own submit
   * check. Submitting the form directly is how that check gets bypassed, so the
   * validation in the submit handler has to stand on its own.
   */
  it('refuses impossible values even when the browser check is bypassed', () => {
    renderForm()
    const form = screen.getByRole('button', { name: 'Add measurement' }).closest('form')!

    fillWeight('-5')
    fireEvent.submit(form)

    expect(screen.getByRole('alert')).toHaveTextContent(/Weight \(kg\) must be between 1 and 700/)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('refuses a body fat percentage above 100', () => {
    renderForm()
    const form = screen.getByRole('button', { name: 'Add measurement' }).closest('form')!

    fillWeight('82')
    fireEvent.change(screen.getByLabelText('Body fat (%)'), { target: { value: '150' } })
    fireEvent.submit(form)

    expect(screen.getByRole('alert')).toHaveTextContent(/Body fat \(%\) must be between 0 and 100/)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  /*
   * `Number('')` is 0, so an empty weight would otherwise be stored as a real
   * 0 kg weigh-in. (A number input sanitises away values like `1e999`, so
   * Infinity can only arrive from stored data — covered in types.test.ts.)
   */
  it('refuses an empty weight rather than storing it as zero', () => {
    renderForm()
    const form = screen.getByRole('button', { name: 'Add measurement' }).closest('form')!

    fireEvent.submit(form)

    expect(screen.getByRole('alert')).toHaveTextContent(/Weight \(kg\) is empty/)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('defaults the date to the local calendar day, not the UTC one', () => {
    renderForm()

    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}`

    expect(screen.getByLabelText('Date')).toHaveValue(expected)
  })
})

/*
 * Body Stats: cardul cu ultima măsurătoare și diferența față de cea dinainte.
 * Până acum ecranul avea doar formularul și tabelul de istoric — diferența
 * trebuia calculată în cap, uitându-te de la un rând la altul.
 */
describe('Key Measurements', () => {
  function seed(entries: object[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }

  const row = (name: string) => screen.getByText(name).closest('li')!

  it('shows the latest value with its change since the one before', () => {
    seed([
      { id: 'm1', date: '2026-07-15', weightKg: 80, waistCm: 88 },
      { id: 'm2', date: '2026-08-01', weightKg: 80, waistCm: 86 },
    ])
    render(<MeasurementsPage section="measurements" />)

    expect(row('Waist')).toHaveTextContent('86')
    expect(row('Waist')).toHaveTextContent('−2')
  })

  it('dates the card with the measurement it is showing, written out', () => {
    seed([{ id: 'm1', date: '2026-08-01', weightKg: 80, waistCm: 86 }])
    render(<MeasurementsPage section="measurements" />)

    expect(screen.getByText('1 August 2026')).toBeInTheDocument()
  })

  it('marks the very first measurement instead of inventing a change', () => {
    seed([{ id: 'm1', date: '2026-08-01', weightKg: 80, waistCm: 86 }])
    render(<MeasurementsPage section="measurements" />)

    expect(row('Waist')).toHaveTextContent('first')
  })

  it('says so plainly when a value has not moved', () => {
    seed([
      { id: 'm1', date: '2026-07-15', weightKg: 80, waistCm: 86 },
      { id: 'm2', date: '2026-08-01', weightKg: 80, waistCm: 86 },
    ])
    render(<MeasurementsPage section="measurements" />)

    expect(row('Waist')).toHaveTextContent('no change')
  })

  /*
   * The card reads the newest measurement by date, so logging one you forgot
   * from last month must not replace today's numbers with last month's.
   */
  it('reads the newest measurement by date, not the last one entered', () => {
    seed([
      { id: 'm2', date: '2026-08-01', weightKg: 77 },
      { id: 'm1', date: '2026-06-01', weightKg: 90 },
    ])
    render(<MeasurementsPage section="composition" />)

    expect(row('Weight')).toHaveTextContent('77')
    expect(row('Weight')).not.toHaveTextContent('90')
  })

  it('separates composition from circumferences', () => {
    seed([{ id: 'm1', date: '2026-08-01', weightKg: 77, bodyFatPercent: 19, waistCm: 86 }])

    render(<MeasurementsPage section="composition" />)
    expect(screen.getByText('Body fat')).toBeInTheDocument()
    expect(screen.queryByText('Waist')).not.toBeInTheDocument()

    cleanup()
    render(<MeasurementsPage section="measurements" />)
    expect(screen.getByText('Waist')).toBeInTheDocument()
    expect(screen.queryByText('Body fat')).not.toBeInTheDocument()
  })

  it('invites a first measurement rather than showing an empty card', () => {
    render(<MeasurementsPage section="measurements" />)

    expect(screen.getByText(/No circumferences recorded yet/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Add Measurements' })).toBeInTheDocument()
  })
})

/*
 * Ce se salvează rămâne în kilograme și centimetri, oricare ar fi setarea din
 * Settings. Conversia trăiește la marginea ecranului: la afișare și la citirea
 * din formular. Testele de aici trec prin ecran, nu prin funcțiile de conversie
 * (alea au testele lor în `shared/units.test.ts`) — aici se verifică drumul
 * complet: tastezi în livre, se salvează în kilograme, se citește iar în livre.
 */
describe('MeasurementsPage in imperial units', () => {
  function renderImperial(section: 'measurements' | 'composition' | 'history') {
    localStorage.setItem('gym-app:units', JSON.stringify('imperial'))
    return render(
      <UnitsProvider>
        <MeasurementsPage section={section} />
      </UnitsProvider>,
    )
  }

  it('labels the fields in pounds and inches', () => {
    renderImperial('measurements')
    fireEvent.click(screen.getByRole('button', { name: '+ Add Measurements' }))

    expect(screen.getByLabelText('Weight (lb)')).toBeInTheDocument()
    expect(screen.getByLabelText('Waist (in)')).toBeInTheDocument()
    // Un procent e un procent în orice sistem.
    expect(screen.getByLabelText('Body fat (%)')).toBeInTheDocument()
  })

  it('stores what you typed in pounds as kilograms', () => {
    renderImperial('measurements')
    fireEvent.click(screen.getByRole('button', { name: '+ Add Measurements' }))

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-07-15' } })
    fireEvent.change(screen.getByLabelText('Weight (lb)'), { target: { value: '176.4' } })
    fireEvent.change(screen.getByLabelText('Waist (in)'), { target: { value: '35.4' } })
    submit()

    expect(stored()[0].weightKg).toBeCloseTo(80, 1)
    expect(stored()[0].waistCm).toBeCloseTo(89.9, 1)
  })

  it('shows a stored measurement back in the unit you are using', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'm1', date: '2026-07-15', weightKg: 80 }]))
    renderImperial('composition')

    expect(screen.getByText('176.4')).toBeInTheDocument()
    expect(screen.queryByText('80')).not.toBeInTheDocument()
  })

  /* Diferența e tot o mărime cu unitate: în livre trebuie să fie în livre. */
  it('converts the delta as well as the value', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'm2', date: '2026-08-01', weightKg: 80 },
        { id: 'm1', date: '2026-07-01', weightKg: 81 },
      ]),
    )
    renderImperial('composition')

    // −1 kg e −2.2 lb, nu −1 lb.
    expect(screen.getByText(/2\.2/)).toBeInTheDocument()
  })

  /*
   * Limita afișată trebuie să fie una acceptată: rotunjită în afară, greutatea
   * minimă de 1 kg ar apărea ca 2.2 lb, iar 2.2 lb salvat înapoi e 0.998 kg —
   * sub limită, deci măsurătoarea ar fi aruncată la următoarea citire.
   */
  it('offers bounds that survive the round trip into storage', () => {
    renderImperial('measurements')
    fireEvent.click(screen.getByRole('button', { name: '+ Add Measurements' }))

    const weight = screen.getByLabelText('Weight (lb)')
    expect(weight).toHaveAttribute('min', '2.3')
    expect(weight).toHaveAttribute('max', '1543.2')

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-07-15' } })
    fireEvent.change(weight, { target: { value: '2.3' } })
    submit()

    expect(stored()).toHaveLength(1)
    expect(stored()[0].weightKg).toBeGreaterThanOrEqual(1)
  })
})
