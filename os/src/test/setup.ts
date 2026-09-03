import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// jsdom does not implement the object-URL API that the photo gallery uses to
// display Blobs. These stand-ins let the gallery render; they are an
// environment gap, not app behaviour under test.
if (typeof URL.createObjectURL !== 'function') {
  let counter = 0
  URL.createObjectURL = () => `blob:test/${(counter += 1)}`
  URL.revokeObjectURL = () => {}
}

// Every test starts from empty storage so one test's saved data cannot make
// another one pass.
beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})
