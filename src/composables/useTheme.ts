import { onMounted, onUnmounted, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import type { ThemeMode } from '@/types'

function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(mode: ThemeMode) {
  const dark = resolveDark(mode)
  document.documentElement.classList.toggle('dark', dark)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    const bar = getComputedStyle(document.documentElement)
      .getPropertyValue('--wn-status-bar')
      .trim()
    meta.setAttribute('content', bar || (dark ? '#1e2529' : '#eef3f4'))
  }
}

export function useTheme() {
  const store = useAppStore()
  let media: MediaQueryList | undefined

  const onSystemChange = () => {
    if (store.theme === 'system') applyTheme('system')
  }

  onMounted(() => {
    applyTheme(store.theme)
    media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', onSystemChange)
  })

  onUnmounted(() => {
    media?.removeEventListener('change', onSystemChange)
  })

  watch(
    () => store.theme,
    (mode) => applyTheme(mode),
    { immediate: true },
  )
}
