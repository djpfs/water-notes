import { onUnmounted, ref } from 'vue'

type Options = {
  threshold?: number
  maxPull?: number
}

export function usePullToRefresh(
  onRefresh: () => Promise<void>,
  options: Options = {},
) {
  const threshold = options.threshold ?? 72
  const maxPull = options.maxPull ?? threshold * 1.6
  const pullDistance = ref(0)
  const refreshing = ref(false)

  let startY = 0
  let pulling = false
  let target: HTMLElement | null = null

  function canPull() {
    return !refreshing.value && window.scrollY <= 0
  }

  function onTouchStart(event: TouchEvent) {
    if (!canPull()) return
    startY = event.touches[0]?.clientY ?? 0
    pulling = true
  }

  function onTouchMove(event: TouchEvent) {
    if (!pulling || refreshing.value) return
    if (!canPull()) {
      pulling = false
      pullDistance.value = 0
      return
    }

    const delta = (event.touches[0]?.clientY ?? 0) - startY
    if (delta > 0) {
      pullDistance.value = Math.min(delta * 0.5, maxPull)
      if (delta > 8) event.preventDefault()
    } else {
      pullDistance.value = 0
    }
  }

  async function onTouchEnd() {
    if (!pulling) return
    pulling = false

    if (pullDistance.value >= threshold) {
      refreshing.value = true
      pullDistance.value = threshold
      try {
        await onRefresh()
      } finally {
        refreshing.value = false
        pullDistance.value = 0
      }
      return
    }

    pullDistance.value = 0
  }

  function bind(el: HTMLElement | null) {
    if (target) unbind()
    if (!el) return
    target = el
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
  }

  function unbind() {
    if (!target) return
    target.removeEventListener('touchstart', onTouchStart)
    target.removeEventListener('touchmove', onTouchMove)
    target.removeEventListener('touchend', onTouchEnd)
    target.removeEventListener('touchcancel', onTouchEnd)
    target = null
  }

  onUnmounted(unbind)

  return {
    pullDistance,
    refreshing,
    threshold,
    bind,
    unbind,
  }
}
