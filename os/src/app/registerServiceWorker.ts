export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return

  // Registration happens after load so first render/workout startup is never
  // blocked by PWA plumbing. The worker itself does not call skipWaiting, so a
  // newly deployed version cannot take control in the middle of an active app.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    }).catch(() => {
      // Offline support is optional. A registration failure must never make the
      // core workout logger unusable.
    })
  })
}
