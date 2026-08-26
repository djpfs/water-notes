export function hapticLight() {
  try {
    navigator.vibrate?.(12)
  } catch {
    /* ignore */
  }
}

export function hapticSuccess() {
  try {
    navigator.vibrate?.([18, 40, 28])
  } catch {
    /* ignore */
  }
}

function beep(freq: number, duration: number, gain = 0.04, type: OscillatorType = 'sine') {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return
  const ctx = new Ctx()
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
  osc.onended = () => void ctx.close()
}

export function soundSip() {
  try {
    beep(660, 0.08, 0.035, 'triangle')
  } catch {
    /* ignore */
  }
}

export function soundGoal() {
  try {
    beep(523, 0.1, 0.04, 'sine')
    window.setTimeout(() => beep(784, 0.16, 0.045, 'sine'), 110)
  } catch {
    /* ignore */
  }
}
