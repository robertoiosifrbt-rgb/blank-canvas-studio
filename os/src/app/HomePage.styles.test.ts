import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * Home's styling lived in two files at once, and the quick action tiles paid
 * for it: index.css set `flex-direction: column`, redesign.css set only
 * `display: flex`, so the column survived and every icon sat above its label
 * instead of beside it. Nothing failed — the app just looked wrong.
 *
 * This locks the fix in place. Each screen gets the same guard as its stage
 * lands; widen HOME_CLASSES, or copy the test, rather than dropping it.
 */

const HOME_STYLESHEET = 'src/app/HomePage.css'

const HOME_CLASSES = [
  'target-home',
  'target-home-header',
  'hello-wave',
  'icon-button',
  'target-card',
  'home-block',
  'target-section-title',
  'weekly-progress-layout',
  'weekly-metrics',
  'progress-ring',
  'progress-ring-bg',
  'progress-ring-fill',
  'progress-ring-text',
  'today-workout-card',
  'today-workout-name',
  'today-workout-meta',
  'coral-action',
  'button-icon',
  'target-quick-grid',
  'recent-workout-list',
  'recent-workout-row',
  'recent-workout-icon',
  'recent-workout-volume',
  'recent-workout-done',
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

describe('Home stylesheet ownership', () => {
  it.each(HOME_CLASSES)('%s is styled only in HomePage.css', (cssClass) => {
    expect(filesStyling(cssClass)).toEqual([HOME_STYLESHEET])
  })

  it('needs no !important, now that nothing competes with it', () => {
    // Comments are stripped first: this file explains the rule in prose, and
    // the prose naturally contains the word.
    const declarations = readFileSync(HOME_STYLESHEET, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

    expect(declarations).not.toContain('!important')
  })

  /*
   * The tiles are a row: icon, then label. Written down because the bug was
   * silent — the layout was wrong but nothing about it was invalid.
   */
  it('lays the quick action tiles out as a row', () => {
    const css = readFileSync(HOME_STYLESHEET, 'utf8')
    const rule = css.match(/\.target-quick-grid button \{([^}]*)\}/)

    expect(rule?.[1]).toContain('flex-direction: row')
    expect(rule?.[1]).not.toContain('flex-direction: column')
  })
})
