async function applyUpdate() {
  if (!('serviceWorker' in navigator)) {
    location.reload()
    return
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
    const waiting = registration?.waiting

    if (!waiting) {
      location.reload()
      return
    }

    let reloaded = false
    const reloadOnce = () => {
      if (reloaded) return
      reloaded = true
      location.reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', reloadOnce, { once: true })
    waiting.postMessage({ type: 'SKIP_WAITING' })

    // Safari/iOS can occasionally miss controllerchange while the app is
    // foregrounded. Do not leave the user stuck on the old bundle forever.
    window.setTimeout(reloadOnce, 1500)
  } catch {
    location.reload()
  }
}

export function UpdateBanner() {
  return (
    <div className="update-banner">
      <span>A new version is available.</span>
      <button type="button" onClick={() => void applyUpdate()}>
        Reload
      </button>
    </div>
  )
}
