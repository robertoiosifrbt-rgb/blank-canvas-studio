const MAX_DIMENSION = 1280
const JPEG_QUALITY = 0.8

/**
 * `maxDimension` e parametru pentru că avatarul din Settings are nevoie de
 * altceva decât o poză de progres: 1280px stau bine în IndexedDB, dar avatarul
 * se salvează în `localStorage`, unde tot spațiul e câteva megabyte pentru
 * toată aplicația.
 */
export async function resizeImage(file: File, maxDimension = MAX_DIMENSION): Promise<Blob> {
  // Throws for files the browser cannot decode (a HEIC on an old browser, a
  // truncated download). The caller reports which angle failed.
  const bitmap = await createImageBitmap(file)

  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is not supported')
    ctx.drawImage(bitmap, 0, 0, width, height)

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image'))),
        'image/jpeg',
        JPEG_QUALITY,
      )
    })
  } finally {
    // In `finally` so a failed decode or encode still frees the bitmap —
    // phone photos are large enough that leaking a few can crash the tab.
    bitmap.close()
  }
}
