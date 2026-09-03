import { useState } from 'react'
import { useExercises } from '../exercises/useExercises'
import { useFieldTypes } from '../exercises/useFieldTypes'
import { useWorkoutLog } from '../workout-log/useWorkoutLog'
import { useWorkoutSessions } from '../workout-log/useWorkoutSessions'
import { useWorkoutPlans } from '../workout-plans'
import { useMeasurements } from '../measurements/useMeasurements'
import { getAllPhotoSets } from '../progress-photos/db'
import { useUnits } from '../../shared/unitsContext'
import { useProfile } from './useProfile'
import { serializePhotoSets, type SerializedPhotoSet } from './backupPhotos'

interface ExportData {
  version: string
  exportedAt: string
  exercises: unknown
  fieldTypes: unknown
  sessions: unknown
  entries: unknown
  workoutPlans: unknown
  measurements: unknown
  profile: unknown
  units: unknown
  progressPhotos: SerializedPhotoSet[]
}

function describe(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

export function useDataExport() {
  const { exercises } = useExercises()
  // Backups must include archived tracks too. Old workout entries can still
  // reference them, and exporting only active tracks would lose their labels
  // and units after a restore.
  const { allFieldTypes } = useFieldTypes()
  const { sessions } = useWorkoutSessions()
  const { entries } = useWorkoutLog()
  const { plans: workoutPlans } = useWorkoutPlans()
  const { measurements } = useMeasurements()
  const { profile } = useProfile()
  const { system: units } = useUnits()
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generateExportData(): Promise<ExportData> {
    const storedPhotoSets = await getAllPhotoSets()
    const progressPhotos = await serializePhotoSets(storedPhotoSets as unknown[])
    return {
      version: '1.2',
      exportedAt: new Date().toISOString(),
      exercises,
      fieldTypes: allFieldTypes,
      sessions,
      entries,
      workoutPlans,
      measurements,
      profile,
      units,
      progressPhotos,
    }
  }

  async function downloadAsJson(): Promise<void> {
    setExporting(true)
    setError(null)
    try {
      const data = await generateExportData()
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `gym-app-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (exportError) {
      setError(`Export failed: ${describe(exportError)}`)
    } finally {
      setExporting(false)
    }
  }

  return { generateExportData, downloadAsJson, exporting, error, dismissError: () => setError(null) }
}
