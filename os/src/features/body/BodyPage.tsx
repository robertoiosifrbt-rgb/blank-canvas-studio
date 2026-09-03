import { useState } from 'react'
import { PageHeader } from '../../shared/PageHeader'
import { BodyOverview } from '../body-overview/BodyOverview'
import { MeasurementsPage } from '../measurements'
import './BodyPage.css'

/*
 * Cele două ecrane din target care privesc corpul — „Body Overview" (3) și
 * „Body Stats" (7) — trăiesc amândouă sub tab-ul Body. Overview-ul avea deja
 * propriul tab aici; cele trei ale lui Body Stats se alătură pe același rând,
 * în loc să fie un al doilea rând de tab-uri sub primul.
 *
 * Motivul e practic: imbricate, drumul ar fi citit „Body › Measurements ›
 * Measurements". Patru tab-uri pe un rând spun același lucru fără repetiție.
 */
const TABS = [
  { key: 'overview', label: 'Overview', title: 'Body Overview' },
  { key: 'measurements', label: 'Measurements', title: 'Body Measurements' },
  { key: 'composition', label: 'Composition', title: 'Body Composition' },
  { key: 'history', label: 'History', title: 'Measurement History' },
] as const

type BodyTab = (typeof TABS)[number]['key']

export function BodyPage() {
  const [tab, setTab] = useState<BodyTab>('overview')
  const current = TABS.find((t) => t.key === tab) ?? TABS[0]

  return (
    <div className="body-page-wrapper">
      <PageHeader title={current.title} />

      <div className="body-tabs" role="tablist">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            role="tab"
            aria-selected={tab === entry.key}
            className={tab === entry.key ? 'active' : ''}
            onClick={() => setTab(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="body-tab-content">
        {tab === 'overview' ? <BodyOverview /> : <MeasurementsPage section={tab} />}
      </div>
    </div>
  )
}
