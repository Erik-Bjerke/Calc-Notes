// Logs the build time on boot so you can confirm which build is actually live
// (e.g. after a deploy). Look for "[numori] build …" in the browser console.
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  // eslint-disable-next-line no-console
  console.log(
    `[numori] build ${config.public.buildTime} · collab ws: ${config.public.collabWsUrl || '(derived from origin)'}`,
  )
})
