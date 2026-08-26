let audioCtx: AudioContext | null = null

export type FeedbackPreferences = {
  sound: boolean
  haptic: boolean
}

let feedbackPrefs: FeedbackPreferences = { sound: true, haptic: true }
let reducedMotion = false

export function setFeedbackPreferences(prefs: FeedbackPreferences) {
  feedbackPrefs = prefs
}

export function initFeedbackEnvironment() {
  if (typeof window === 'undefined') return
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion = mq.matches
  mq.addEventListener('change', (event) => {
    reducedMotion = event.matches
  })
}

function feedbackAllowed() {
  return !reducedMotion
}

function getAudioCtx(): AudioContext | null {
  if (audioCtx) return audioCtx
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  audioCtx = new Ctx()
  return audioCtx
}

function beep(
  freq: number,
  duration: number,
  gain = 0.04,
  type: OscillatorType = 'sine',
) {
  const ctx = getAudioCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume()
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.value = gain
  osc.connect(g)
  g.connect(ctx.destination)
  const now = ctx.currentTime
  g.gain.setValueAtTime(gain, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + duration)
  osc.start(now)
  osc.stop(now + duration)
}

function canVibrate() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

export function hapticLight() {
  if (!feedbackAllowed() || !feedbackPrefs.haptic) return
  if (canVibrate()) {
    navigator.vibrate(12)
    return
  }
  if (!feedbackPrefs.sound) return
  try {
    beep(820, 0.028, 0.012, 'triangle')
  } catch {
    /* ignore */
  }
}

export function hapticSuccess() {
  if (!feedbackAllowed() || !feedbackPrefs.haptic) return
  if (canVibrate()) {
    navigator.vibrate([18, 40, 28])
    return
  }
  if (!feedbackPrefs.sound) return
  try {
    beep(660, 0.06, 0.018, 'sine')
    window.setTimeout(() => beep(880, 0.08, 0.02, 'sine'), 70)
  } catch {
    /* ignore */
  }
}

export function tapFeedback(kind: 'light' | 'success' = 'light') {
  if (kind === 'success') hapticSuccess()
  else hapticLight()
}

export function soundSip() {
  if (!feedbackAllowed() || !feedbackPrefs.sound) return
  try {
    beep(660, 0.08, 0.035, 'triangle')
  } catch {
    /* ignore */
  }
}

export function soundGoal() {
  if (!feedbackAllowed() || !feedbackPrefs.sound) return
  try {
    beep(523, 0.1, 0.04, 'sine')
    window.setTimeout(() => beep(784, 0.16, 0.045, 'sine'), 110)
  } catch {
    /* ignore */
  }
}

export function bindTapFeedback(root: Document | HTMLElement = document) {
  const handler = (event: Event) => {
    const target = event.target
    if (!(target instanceof Element)) return

    const el = target.closest<HTMLElement>(
      'button, [role="button"], input[type="button"], input[type="submit"]',
    )
    if (!el) return
    if (
      el.hasAttribute('disabled') ||
      el.getAttribute('aria-disabled') === 'true' ||
      el.closest('[data-haptic="off"]')
    ) {
      return
    }

    const kind = el.getAttribute('data-haptic') === 'success' ? 'success' : 'light'
    tapFeedback(kind)
  }

  root.addEventListener('click', handler, true)
  return () => root.removeEventListener('click', handler, true)
}
