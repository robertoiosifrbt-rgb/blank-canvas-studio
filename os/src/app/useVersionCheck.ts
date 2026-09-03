import { useEffect, useState } from 'react'

const CHECK_INTERVAL_MS = 60_000

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    async function check() {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}version.txt`, { cache: 'no-store' })
        if (!response.ok) return
        const latestVersion = (await response.text()).trim()
        if (latestVersion && latestVersion !== __APP_VERSION__) {
          setUpdateAvailable(true)
        }
      } catch {
        // Network hiccup or offline — ignore, we'll check again later.
      }
    }

    check()
    const interval = setInterval(check, CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return updateAvailable
}
