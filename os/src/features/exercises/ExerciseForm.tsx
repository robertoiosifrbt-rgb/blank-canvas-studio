import { useState } from 'react'
import { DEFAULT_CATEGORIES, DIFFICULTIES, type Exercise, type ExerciseDetails, type FieldType } from './types'

interface ExerciseFormProps {
  exercises: Exercise[]
  fieldTypes: FieldType[]
  onAddFieldType: (label: string, unit: string) => FieldType | null
  onRemoveFieldType: (id: string) => boolean
  initial?: Exercise
  submitLabel: string
  onSubmit: (name: string, fields: string[], details: ExerciseDetails) => boolean
  onCancel?: () => void
}

const emptyDetails: ExerciseDetails = { category: '', difficulty: '', equipment: '', primaryMuscles: '', secondaryMuscles: '', instructions: '' }

export function ExerciseForm({ exercises, fieldTypes, onAddFieldType, onRemoveFieldType, initial, submitLabel, onSubmit, onCancel }: ExerciseFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [details, setDetails] = useState<ExerciseDetails>(initial ? { category: initial.category, difficulty: initial.difficulty, equipment: initial.equipment, primaryMuscles: initial.primaryMuscles, secondaryMuscles: initial.secondaryMuscles, instructions: initial.instructions } : emptyDetails)
  const [fields, setFields] = useState<string[]>(initial?.fields ?? [])
  const [addingField, setAddingField] = useState(false)
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldUnit, setNewFieldUnit] = useState('')
  const [error, setError] = useState<string | null>(null)
  const formId = initial?.id ?? 'new'
  const categorySuggestions = [...new Set([...DEFAULT_CATEGORIES, ...exercises.map((e) => e.category).filter(Boolean)])]

  function updateDetail(key: keyof ExerciseDetails, value: string) { setDetails((prev) => ({ ...prev, [key]: value })) }
  function toggleField(id: string) { setFields((prev) => prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]) }
  function handleRemoveField(id: string, label: string) {
    const usedBy = exercises.filter((exercise) => exercise.fields.includes(id)).length
    const message = `Remove "${label}" from Tracks?\n\nThis removes it from future exercise tracking${usedBy ? ` and from ${usedBy} existing ${usedBy === 1 ? 'exercise' : 'exercises'}` : ''}. Values already saved in workout history will stay readable.`
    if (!window.confirm(message)) return
    if (onRemoveFieldType(id)) {
      const updatedFields = fields.filter((f) => f !== id)
      setFields(updatedFields)
      if (initial) {
        onSubmit(name, updatedFields, details)
      }
    }
  }
  function handleAddFieldType() {
    if (!newFieldLabel.trim()) return
    const created = onAddFieldType(newFieldLabel.trim(), newFieldUnit.trim())
    if (!created) { setError('Could not save the new type — see the message above.'); return }
    setError(null); setFields((prev) => [...prev, created.id]); setNewFieldLabel(''); setNewFieldUnit(''); setAddingField(false)
  }
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault(); if (!name.trim() || fields.length === 0) return
    if (!onSubmit(name.trim(), fields, details)) { setError('Could not save this exercise — see the message above. Your entries are still here.'); return }
    setError(null); if (!initial) { setName(''); setDetails(emptyDetails); setFields([]) }
  }

  return <form className="exercise-editor-form" onSubmit={handleSubmit}>
    <section className="exercise-form-section">
      <div className="exercise-form-section-heading"><span>Basics</span><small>Name and classification</small></div>
      <div className="exercise-form-grid">
        <div className="field field-wide"><label htmlFor={`exercise-name-${formId}`}>Name</label><input id={`exercise-name-${formId}`} value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="field"><label htmlFor={`exercise-category-${formId}`}>Category</label><input id={`exercise-category-${formId}`} list={`exercise-categories-${formId}`} value={details.category} onChange={(e) => updateDetail('category', e.target.value)} placeholder="e.g. Chest, Back, Cardio" /><datalist id={`exercise-categories-${formId}`}>{categorySuggestions.map((c) => <option key={c} value={c} />)}</datalist></div>
        <div className="field"><label htmlFor={`exercise-difficulty-${formId}`}>Difficulty</label><select id={`exercise-difficulty-${formId}`} value={details.difficulty} onChange={(e) => updateDetail('difficulty', e.target.value)}><option value="">—</option>{DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
        <div className="field field-wide"><label htmlFor={`exercise-equipment-${formId}`}>Equipment</label><input id={`exercise-equipment-${formId}`} value={details.equipment} onChange={(e) => updateDetail('equipment', e.target.value)} placeholder="e.g. Barbell, Dumbbell" /></div>
      </div>
    </section>

    <section className="exercise-form-section">
      <div className="exercise-form-section-heading"><span>Muscles</span><small>What this exercise trains</small></div>
      <div className="exercise-form-grid">
        <div className="field"><label htmlFor={`exercise-primary-muscles-${formId}`}>Primary muscles</label><input id={`exercise-primary-muscles-${formId}`} value={details.primaryMuscles} onChange={(e) => updateDetail('primaryMuscles', e.target.value)} /></div>
        <div className="field"><label htmlFor={`exercise-secondary-muscles-${formId}`}>Secondary muscles</label><input id={`exercise-secondary-muscles-${formId}`} value={details.secondaryMuscles} onChange={(e) => updateDetail('secondaryMuscles', e.target.value)} /></div>
        <div className="field field-wide"><label htmlFor={`exercise-instructions-${formId}`}>Instructions</label><textarea id={`exercise-instructions-${formId}`} value={details.instructions} onChange={(e) => updateDetail('instructions', e.target.value)} rows={3} /></div>
      </div>
    </section>

    <section className="exercise-form-section track-section">
      <div className="exercise-form-section-heading"><span>Tracks</span><small>Choose exactly what you want to log</small></div>
      <div className="track-selector">{fieldTypes.map(({ id, label, unit }) => <div className={`track-option ${fields.includes(id) ? 'track-option-selected' : ''}`} key={id}><label><input aria-label={label} type="checkbox" checked={fields.includes(id)} onChange={() => toggleField(id)} /><span aria-hidden="true"><strong>{label}</strong>{unit && <small>{unit}</small>}</span></label><button type="button" className="track-delete" aria-label={`Remove ${label} from Tracks`} title={`Remove ${label}`} onClick={() => handleRemoveField(id, label)}>×</button></div>)}</div>
      <button type="button" className="add-track-button" aria-label="+ Add" onClick={() => setAddingField(true)}>+ Add custom track</button>
      {addingField && <div className="new-field-row"><input aria-label="Track name" placeholder="Name (e.g. Incline)" value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} /><input aria-label="Track unit" placeholder="Unit (optional, e.g. %)" value={newFieldUnit} onChange={(e) => setNewFieldUnit(e.target.value)} /><button type="button" onClick={handleAddFieldType}>Save</button><button type="button" onClick={() => setAddingField(false)}>Cancel</button></div>}
    </section>

    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="submit" disabled={fields.length === 0}>{submitLabel}</button>{onCancel && <button type="button" onClick={onCancel}>Cancel</button>}</div>
  </form>
}
