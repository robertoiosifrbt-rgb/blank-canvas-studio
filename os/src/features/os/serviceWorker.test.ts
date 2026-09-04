import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/* Un abonament fără handler în service worker nu dă nicio eroare nicăieri:
   telefonul se abonează, serverul trimite, și pur și simplu nu apare nimic.
   De aia e verificat aici, nu lăsat pe seama unei încercări pe telefon. */
const sw = readFileSync('public/sw.js', 'utf8')
const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as {
  icons: Array<{ src: string }>
}

describe('service worker-ul', () => {
  it('afișează notificările primite', () => {
    expect(sw).toContain("addEventListener('push'")
    expect(sw).toContain('showNotification')
  })

  it('deschide aplicația când apeși pe notificare', () => {
    expect(sw).toContain("addEventListener('notificationclick'")
  })

  it('folosește o iconiță care există în manifest', () => {
    const used = [...sw.matchAll(/(?:icon|badge):\s*'([^']+)'/g)].map(m => m[1])
    expect(used.length).toBeGreaterThan(0)
    for (const src of used) expect(manifest.icons.map(i => i.src)).toContain(src)
  })
})
