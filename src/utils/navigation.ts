import type { RouteLocationRaw, Router } from 'vue-router'

const IN_APP_PREFIXES = ['/inicio', '/historico', '/ajustes', '/onboarding', '/meta']

function isInAppPath(path: string | undefined): path is string {
  if (!path) return false
  const base = path.split('?')[0] ?? path
  return IN_APP_PREFIXES.some((prefix) => base === prefix)
}

export function goBackOr(router: Router, fallback: RouteLocationRaw) {
  const back = router.options.history.state?.back as string | undefined
  if (isInAppPath(back) && back !== router.currentRoute.value.fullPath) {
    void router.back()
    return
  }
  void router.push(fallback)
}
