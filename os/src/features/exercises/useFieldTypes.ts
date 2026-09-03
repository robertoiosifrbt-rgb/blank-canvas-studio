import { recoverArray } from '../../shared/storage'
import { usePersistedState } from '../../shared/usePersistedState'
import { DEFAULT_FIELD_TYPES, parseFieldType, type FieldType } from './types'

const STORAGE_KEY = 'gym-app:field-types'
const recover = recoverArray(parseFieldType)

export function useFieldTypes() {
  const { value: storedFieldTypes, update, error, dismissError } = usePersistedState<FieldType[]>(STORAGE_KEY, DEFAULT_FIELD_TYPES, recover)
  const fieldTypes = storedFieldTypes.filter((fieldType) => !fieldType.archived)
  const allFieldTypes = storedFieldTypes

  function addFieldType(label: string, unit: string): FieldType | null {
    const fieldType: FieldType = { id: crypto.randomUUID(), label, unit }
    return update((prev) => [...prev, fieldType]) ? fieldType : null
  }

  function removeFieldType(id: string): boolean {
    return update((prev) => prev.map((fieldType) => fieldType.id === id ? { ...fieldType, archived: true } : fieldType))
  }

  function restoreFieldType(id: string): boolean {
    return update((prev) => prev.map((fieldType) => fieldType.id === id ? { ...fieldType, archived: undefined } : fieldType))
  }

  return { fieldTypes, allFieldTypes, addFieldType, removeFieldType, restoreFieldType, error, dismissError }
}
