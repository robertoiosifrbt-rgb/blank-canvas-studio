import { useState, type CSSProperties } from 'react'
import type { Exercise, FieldType } from '../exercises'
import { parseBounded } from '../../shared/numbers'
import { SET_VALUE_BOUNDS, type NewExerciseEntry, type SetValues, type WorkoutEntry } from './types'
import { formatSet } from './formatSet'

interface ExerciseEntryFormProps {
  exercises: Exercise[]
  fieldTypes: FieldType[]
  historyFieldTypes?: FieldType[]
  getLastEntry: (exerciseId: string) => WorkoutEntry | undefined
  initialEntry?: WorkoutEntry
  onAdd?: (entry: NewExerciseEntry) => boolean
  onUpdate?: (entry: NewExerciseEntry) => boolean
  onCancel?: () => void
}

type DraftSet = Record<string, string>
type TrackGridStyle = CSSProperties & { '--track-count': number }
function entrySetsToDraft(entry?: WorkoutEntry): DraftSet[] { if (!entry) return [{}]; return entry.sets.map((set) => Object.fromEntries(Object.entries(set).map(([fieldId, value]) => [fieldId, String(value)]))) }

export function ExerciseEntryForm({ exercises, fieldTypes, historyFieldTypes = fieldTypes, getLastEntry, initialEntry, onAdd, onUpdate, onCancel }: ExerciseEntryFormProps) {
  const editing = Boolean(initialEntry)
  const [exerciseId, setExerciseId] = useState(initialEntry?.exerciseId ?? '')
  const [sets, setSets] = useState<DraftSet[]>(entrySetsToDraft(initialEntry))
  const [error, setError] = useState<string | null>(null)
  const exercise = exercises.find((e) => e.id === exerciseId)
  const lastEntry = !editing && exerciseId ? getLastEntry(exerciseId) : undefined
  const trackGridStyle: TrackGridStyle | undefined = exercise ? { '--track-count': Math.max(exercise.fields.length, 1) } : undefined

  function updateSetField(index: number, fieldId: string, value: string) { setSets((prev) => prev.map((set, i) => { if (i !== index) return set; const next = { ...set }; if (value === '') delete next[fieldId]; else next[fieldId] = value; return next })) }
  function addSetRow() { setSets((prev) => [...prev, {}]) }
  function removeSetRow(index: number) { setSets((prev) => prev.filter((_, i) => i !== index)) }
  function handleExerciseChange(id: string) { setExerciseId(id); if (!editing) setSets([{}]); setError(null) }
  function labelFor(fieldId: string) { return historyFieldTypes.find((f) => f.id === fieldId)?.label ?? fieldId }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault(); if (!exercise) return; setError(null)
    const parsedSets: SetValues[] = []
    for (const [index, draft] of sets.entries()) {
      const set: SetValues = {}
      for (const [fieldId, raw] of Object.entries(draft)) {
        if (raw.trim() === '') continue
        const parsed = parseBounded(raw, `Set ${index + 1} — ${labelFor(fieldId)}`, SET_VALUE_BOUNDS)
        if (!parsed.ok) { setError(parsed.error); return }
        set[fieldId] = parsed.value
      }
      if (Object.keys(set).length > 0) parsedSets.push(set)
    }
    if (parsedSets.length === 0) { setError('Fill in at least one set before saving.'); return }
    const nextEntry: NewExerciseEntry = { exerciseId: exercise.id, exerciseName: exercise.name, sets: parsedSets }
    const saved = editing ? onUpdate?.(nextEntry) : onAdd?.(nextEntry)
    if (!saved) { setError(`Could not ${editing ? 'update' : 'save'} this exercise — see the message above. Your sets are still here.`); return }
    if (editing) { onCancel?.(); return }
    setExerciseId(''); setSets([{}])
  }

  if (exercises.length === 0) return <p className="empty-state">No exercises yet — add one in the Exercises tab first.</p>

  return <form className="exercise-entry-form" onSubmit={handleSubmit}>
    <div className="field field-wide"><label htmlFor={editing ? `exercise-select-${initialEntry?.id}` : 'exercise-select'}>Exercise</label><select id={editing ? `exercise-select-${initialEntry?.id}` : 'exercise-select'} value={exerciseId} onChange={(e) => handleExerciseChange(e.target.value)} required><option value="" disabled>Select exercise</option>{exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
    {lastEntry && <p className="last-log-hint">Last time ({lastEntry.date}): {lastEntry.sets.map((set) => formatSet(set, historyFieldTypes)).join(', ')}</p>}
    {exercise && <div className="sets-list"><div className="sets-header" style={trackGridStyle} aria-hidden="true"><span>Set</span>{exercise.fields.map((fieldId) => { const field = fieldTypes.find((f) => f.id === fieldId); return field ? <span key={fieldId}>{field.label}</span> : null })}<span /></div>{sets.map((set, index) => <div className="set-row" style={trackGridStyle} key={index}><span className="set-number">{index + 1}</span>{exercise.fields.map((fieldId) => { const field = fieldTypes.find((f) => f.id === fieldId); if (!field) return null; return <input key={fieldId} aria-label={`Set ${index + 1} ${field.label}`} inputMode="decimal" type="number" step={0.1} min={SET_VALUE_BOUNDS.min} max={SET_VALUE_BOUNDS.max} placeholder={field.label} value={set[fieldId] ?? ''} onChange={(e) => updateSetField(index, fieldId, e.target.value)} /> })}<button type="button" className="set-remove" onClick={() => removeSetRow(index)} aria-label={`Remove set ${index + 1}`} disabled={sets.length === 1}>×</button></div>)}<button type="button" className="add-set-button" onClick={addSetRow}>+ Add set</button></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="submit" disabled={!exercise}>{editing ? 'Save exercise' : 'Log exercise'}</button>{onCancel && <button type="button" onClick={onCancel}>{editing ? 'Cancel' : 'Done'}</button>}</div>
  </form>
}
