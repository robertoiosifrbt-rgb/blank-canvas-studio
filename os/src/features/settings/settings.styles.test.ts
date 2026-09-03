import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * Aceeași gardă ca la Home și Exercises, pentru al treilea ecran mutat în modul.
 *
 * Settings își avea regulile în `settings-target.css` (încărcat global din
 * `main.tsx`) plus resturi moarte în `index.css` și `redesign.css`. Testul ăsta
 * blochează întoarcerea la mai multe surse: o regulă nouă pentru ecran se scrie
 * în foaia lui, nu într-un fișier comun de unde ar lovi și alte ecrane.
 */

const SETTINGS_STYLESHEET = 'src/features/settings/settings.css'

const SETTINGS_CLASSES = [
  'settings-page',
  'settings-profile-card',
  'settings-avatar',
  'settings-profile-copy',
  'settings-profile-edit',
  'settings-profile-editor',
  'settings-avatar-actions',
  'settings-editor-actions',
  'settings-save',
  'settings-section',
  'settings-list',
  'settings-row',
  'settings-row-icon',
  'settings-row-button',
  'settings-chevron',
  'settings-status-pill',
  'settings-choice',
  'settings-import-panel',
  'settings-import-warning',
]

function stylesheets(dir = 'src'): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const path = join(dir, item.name)
    if (item.isDirectory()) return stylesheets(path)
    return item.name.endsWith('.css') ? [path] : []
  })
}

/** Files with at least one rule whose selector uses this class. */
function filesStyling(cssClass: string): string[] {
  const selector = new RegExp(`\\.${cssClass}\\b[^{}]*\\{`)
  return stylesheets().filter((file) => selector.test(readFileSync(file, 'utf8')))
}

describe('Settings stylesheet ownership', () => {
  it.each(SETTINGS_CLASSES)('%s is styled only in settings.css', (cssClass) => {
    expect(filesStyling(cssClass)).toEqual([SETTINGS_STYLESHEET])
  })

  /*
   * Foaia se încarcă din `SettingsPage.tsx`, ca la Home și Exercises. Cât timp
   * era importată din `main.tsx`, ajungea în pagină și pentru cine nu deschide
   * niciodată ecranul.
   */
  it('is loaded by the screen, not globally', () => {
    expect(readFileSync('src/features/settings/SettingsPage.tsx', 'utf8')).toContain("import './settings.css'")
    expect(readFileSync('src/main.tsx', 'utf8')).not.toContain('settings')
  })

  /*
   * `.settings-row-button` resetează stilul general de buton ca rândul să arate
   * ca vecinii lui, iar `.settings-choice button` la fel pentru pastile. Restul
   * ecranului n-are nevoie de forță — numărul e aici ca să nu crească pe furiș.
   */
  it('keeps !important down to the two rules that reset button styling', () => {
    const sheet = readFileSync(SETTINGS_STYLESHEET, 'utf8')
    const rules = sheet.split('}').filter((rule) => rule.includes('!important'))

    expect(rules).toHaveLength(3)
    for (const rule of rules) {
      expect(rule).toMatch(/\.settings-row-button|\.settings-choice button/)
    }
  })
})
