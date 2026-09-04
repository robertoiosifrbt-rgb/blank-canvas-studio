// Handing a file to the person using the app. The one thing in the whole plan
// that gives you control depending on nobody.

/** Saves text to a file on the device. */
export function downloadText(name: string, contents: string): void {
  const blob = new Blob([contents], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  // Firefox needs the link in the document before the click counts.
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
