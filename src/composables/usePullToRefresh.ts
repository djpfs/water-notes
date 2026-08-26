import { onUnmounted, ref } from 'vue'

type Options = {
  threshold?: number
  maxPull?: number
}

type GestureSource = 'touch' | 'mouse'

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      'button, a, input, select, textarea, label, [role="button"], [contenteditable="true"]',
    ),
  )
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
  let gestureSource: GestureSource | null = null
  let activePointerId: number | null = null
  let target: HTMLElement | null = null

  function atScrollTop() {
    return window.scrollY <= 0
  }

  function canPull() {
    return !refreshing.value && atScrollTop()
  }

  function beginGesture(clientY: number, source: GestureSource) {
    if (gestureSource || !canPull()) return false
    gestureSource = source
    startY = clientY
    pulling = true
    return true
  }

  function moveGesture(clientY: number, preventDefault?: () => void) {
    if (!pulling || refreshing.value || !gestureSource) return

    if (!atScrollTop()) {
      resetGesture()
      return
    }

    const delta = clientY - startY
    if (delta > 0) {
      pullDistance.value = Math.min(delta * 0.5, maxPull)
      if (delta > 4) preventDefault?.()
    } else {
      pullDistance.value = 0
    }
  }

  function resetGesture() {
    pulling = false
    gestureSource = null
    activePointerId = null
    pullDistance.value = 0
  }

  async function finishGesture(source: GestureSource) {
    if (gestureSource !== source) return

    const shouldRefresh = pullDistance.value >= threshold
    pulling = false
    gestureSource = null
    activePointerId = null

    if (shouldRefresh) {
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

  function onTouchStart(event: TouchEvent) {
    if (gestureSource) return
    if (!canPull()) return
    if (isInteractiveTarget(event.target)) return
    beginGesture(event.touches[0]?.clientY ?? 0, 'touch')
  }

  function onTouchMove(event: TouchEvent) {
    if (gestureSource !== 'touch') return
    moveGesture(event.touches[0]?.clientY ?? 0, () => event.preventDefault())
  }

  function onTouchEnd() {
    void finishGesture('touch')
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType !== 'mouse') return
    if (!event.isPrimary || event.button !== 0) return
    if (gestureSource) return
    if (!canPull()) return
    if (isInteractiveTarget(event.target)) return

    if (beginGesture(event.clientY, 'mouse')) {
      activePointerId = event.pointerId
      target?.setPointerCapture(event.pointerId)
    }
  }

  function onPointerMove(event: PointerEvent) {
    if (gestureSource !== 'mouse' || event.pointerId !== activePointerId) return
    moveGesture(event.clientY, () => event.preventDefault())
  }

  async function onPointerUp(event: PointerEvent) {
    if (gestureSource !== 'mouse' || event.pointerId !== activePointerId) return

    if (target?.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId)
    }

    await finishGesture('mouse')
  }

  function bind(el: HTMLElement | null) {
    if (target) unbind()
    if (!el) return
    target = el
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove, { passive: false })
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
  }

  function unbind() {
    if (!target) return
    target.removeEventListener('touchstart', onTouchStart)
    target.removeEventListener('touchmove', onTouchMove)
    target.removeEventListener('touchend', onTouchEnd)
    target.removeEventListener('touchcancel', onTouchEnd)
    target.removeEventListener('pointerdown', onPointerDown)
    target.removeEventListener('pointermove', onPointerMove)
    target.removeEventListener('pointerup', onPointerUp)
    target.removeEventListener('pointercancel', onPointerUp)
    target = null
    resetGesture()
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
