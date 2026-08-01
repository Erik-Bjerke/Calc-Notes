// Logs the build time on boot so you can confirm which build is actually live
// (e.g. after a deploy). Look for "[numori] build …" in the browser console.
//
// Also installs diagnostic error handlers so uncaught errors (which otherwise
// gray-screen the SPA) are logged with their full message/stack and the Vue
// component that threw — invaluable for tracking down runtime crashes.
export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  console.warn(
    `[numori] build ${config.public.buildTime} · collab ws: ${config.public.collabWsUrl || '(derived from origin)'}`,
  )

  const prev = nuxtApp.vueApp.config.errorHandler
  nuxtApp.vueApp.config.errorHandler = (err, instance, info) => {
    console.error('[numori] Vue error during', info, '→', err?.message, '\n', err?.stack || err)
    if (typeof prev === 'function') prev(err, instance, info)
  }

  window.addEventListener('unhandledrejection', (event) => {
    console.error(
      '[numori] unhandled promise rejection →',
      event.reason?.message,
      '\n',
      event.reason?.stack || event.reason,
    )
  })

  window.addEventListener('error', (event) => {
    console.error('[numori] window error →', event.message, '\n', event.error?.stack || event.error)
  })
})
