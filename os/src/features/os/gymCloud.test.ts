import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GYM_SLOT } from './cloud'

const drawers = new Map<string, unknown>()

vi.mock('./cloud', async () => {
  const actual = await vi.importActual<typeof import('./cloud')>('./cloud')
  return {
    ...actual,
    loadRemote: vi.fn((slot: string) => Promise.resolve(drawers.get(slot) ?? null)),
    saveRemote: vi.fn((value: unknown, slot: string) => {
      drawers.set(slot, value)
      return Promise.resolve()
    }),
  }
})

const { asSnapshot, biggestKey, localSnapshot, pullGym, pushGym, watchGym } =
  await import('./gymCloud')
const { writeJson } = await import('../../shared/storage')

describe('sincronizarea datelor de la sală', () => {
  beforeEach(() => {
    localStorage.clear()
    drawers.clear()
    vi.useRealTimers()
  })

  it('ia din stocare doar cheile sălii', () => {
    localStorage.setItem('gym-app:workout-sessions', '[1]')
    localStorage.setItem('roberto-os-v1', '{}')
    localStorage.setItem('pushDeviceToken', 'abc')
    expect(localSnapshot()).toEqual({ 'gym-app:workout-sessions': '[1]' })
  })

  it('nu urcă copiile de siguranță ale datelor corupte', () => {
    localStorage.setItem('gym-app:units', '{"weight":"kg"}')
    localStorage.setItem('gym-app:units:corrupt', 'gunoi')
    expect(Object.keys(localSnapshot())).toEqual(['gym-app:units'])
  })

  it('urcă ce e pe device când sertarul din cloud e gol', async () => {
    localStorage.setItem('gym-app:exercises', '["squat"]')
    const result = await pullGym()
    expect(result.applied).toBeNull()
    expect(drawers.get(GYM_SLOT)).toEqual({ 'gym-app:exercises': '["squat"]' })
  })

  it('pune peste ce e local ce vine din cloud', async () => {
    localStorage.setItem('gym-app:exercises', '["vechi"]')
    drawers.set(GYM_SLOT, { 'gym-app:exercises': '["nou"]' })
    const result = await pullGym()
    expect(result.applied).toBe(1)
    expect(localStorage.getItem('gym-app:exercises')).toBe('["nou"]')
  })

  it('propagă ștergerile făcute pe alt device', async () => {
    localStorage.setItem('gym-app:exercises', '["squat"]')
    localStorage.setItem('gym-app:workout-plans', '["push"]')
    drawers.set(GYM_SLOT, { 'gym-app:exercises': '["squat"]' })
    await pullGym()
    expect(localStorage.getItem('gym-app:workout-plans')).toBeNull()
  })

  it('nu se atinge de datele OS-ului când aplică sertarul sălii', async () => {
    localStorage.setItem('roberto-os-v1', '{"goals":{}}')
    drawers.set(GYM_SLOT, { 'gym-app:units': '{}' })
    await pullGym()
    expect(localStorage.getItem('roberto-os-v1')).toBe('{"goals":{}}')
  })

  it('ignoră ce vine din cloud și nu arată a date de sală', () => {
    expect(asSnapshot(null)).toBeNull()
    expect(asSnapshot(['a'])).toBeNull()
    expect(asSnapshot({ 'roberto-os-v1': 'x', 'gym-app:units': '{}' })).toEqual({
      'gym-app:units': '{}',
    })
  })

  it('nu cade dacă cloud-ul nu răspunde, ci spune de ce', async () => {
    const cloud = await import('./cloud')
    vi.mocked(cloud.loadRemote).mockRejectedValueOnce(new Error('fără internet'))
    const result = await pullGym()
    expect(result.error).toBe('fără internet')
  })

  it('refuză să urce peste limită și spune care cheie ocupă cel mai mult', async () => {
    localStorage.setItem('gym-app:profile', 'x'.repeat(800_000))
    localStorage.setItem('gym-app:units', '{}')
    await expect(pushGym()).rejects.toThrow(/gym-app:profile/)
    expect(drawers.has(GYM_SLOT)).toBe(false)
  })

  it('numește cheia cea mai mare', () => {
    expect(biggestKey({ a: 'xx', b: 'xxxx' })).toBe('b')
  })

  it('urcă o singură dată după mai multe scrieri apropiate', async () => {
    vi.useFakeTimers()
    const cloud = await import('./cloud')
    vi.mocked(cloud.saveRemote).mockClear()
    const stop = watchGym(() => {})
    writeJson('gym-app:workout-sessions', [1])
    writeJson('gym-app:workout-sessions', [1, 2])
    writeJson('gym-app:workout-sessions', [1, 2, 3])
    expect(cloud.saveRemote).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1_500)
    expect(cloud.saveRemote).toHaveBeenCalledTimes(1)
    stop()
  })

  it('nu urcă scrierile care nu sunt ale sălii', async () => {
    vi.useFakeTimers()
    const cloud = await import('./cloud')
    vi.mocked(cloud.saveRemote).mockClear()
    const stop = watchGym(() => {})
    writeJson('roberto-os-v1', { goals: {} })
    await vi.advanceTimersByTimeAsync(1_500)
    expect(cloud.saveRemote).not.toHaveBeenCalled()
    stop()
  })

  it('nu urcă înapoi ce tocmai a coborât din cloud', async () => {
    vi.useFakeTimers()
    const cloud = await import('./cloud')
    drawers.set(GYM_SLOT, { 'gym-app:units': '{"weight":"kg"}' })
    const stop = watchGym(() => {})
    vi.mocked(cloud.saveRemote).mockClear()
    await pullGym()
    await vi.advanceTimersByTimeAsync(1_500)
    expect(cloud.saveRemote).not.toHaveBeenCalled()
    stop()
  })
})
