import { formatVolume } from '@/utils/date'

export type ShareCardInput = {
  nickname: string
  photoUrl: string | null
  dateLabel: string
  consumedMl: number
  goalMl: number
  progress: number
  streak: number
  goalReached: boolean
}

const W = 1080
const H = 1920

const colors = {
  bgA: '#b8d4ef',
  bgB: '#e8f0f8',
  card: '#ffffff',
  ink: '#1a2a38',
  inkSoft: '#5a6478',
  teal: '#1565b8',
  tealDeep: '#0f4d8c',
  tealLight: '#5ea8e8',
  water: '#6ea8d8',
  line: '#dce4ea',
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, colors.bgA)
  bg.addColorStop(0.45, colors.bgB)
  bg.addColorStop(1, '#d4eef2')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  ctx.globalAlpha = 0.3
  for (const b of [
    { x: 100, y: 220, r: 100 },
    { x: 960, y: 340, r: 80 },
    { x: 900, y: 1580, r: 120 },
    { x: 120, y: 1700, r: 70 },
  ]) {
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

async function loadPhoto(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.referrerPolicy = 'no-referrer'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  nickname: string,
  photo: HTMLImageElement | null,
) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
  ctx.clip()
  if (photo) {
    ctx.drawImage(photo, x, y, size, size)
  } else {
    const grad = ctx.createLinearGradient(x, y, x + size, y + size)
    grad.addColorStop(0, colors.tealLight)
    grad.addColorStop(1, colors.teal)
    ctx.fillStyle = grad
    ctx.fillRect(x, y, size, size)
    ctx.fillStyle = '#fff'
    ctx.font = '700 42px Manrope, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      (nickname.trim()[0] ?? '?').toUpperCase(),
      x + size / 2,
      y + size / 2 + 2,
    )
  }
  ctx.restore()

  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
  ctx.stroke()
}

function drawProgressRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  progress: number,
) {
  const line = 32
  ctx.lineCap = 'round'

  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.strokeStyle = colors.line
  ctx.lineWidth = line
  ctx.stroke()

  if (progress <= 0) return

  const start = -Math.PI / 2
  const end = start + Math.PI * 2 * Math.min(1, progress)
  const arcGrad = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy)
  arcGrad.addColorStop(0, colors.water)
  arcGrad.addColorStop(1, colors.teal)

  ctx.beginPath()
  ctx.arc(cx, cy, radius, start, end)
  ctx.strokeStyle = arcGrad
  ctx.lineWidth = line
  ctx.stroke()
}

function drawDrop(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.beginPath()
  ctx.moveTo(0, -18)
  ctx.bezierCurveTo(22, 6, 14, 28, 0, 28)
  ctx.bezierCurveTo(-14, 28, -22, 6, 0, -18)
  ctx.closePath()
  ctx.fillStyle = colors.teal
  ctx.fill()
  ctx.restore()
}

function drawStatPill(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  label: string,
  value: string,
) {
  ctx.font = '600 22px Manrope, system-ui, sans-serif'
  const labelW = ctx.measureText(label).width
  ctx.font = '700 34px Manrope, system-ui, sans-serif'
  const valueW = ctx.measureText(value).width
  const pillW = Math.max(labelW, valueW) + 64
  const pillH = 96
  const px = cx - pillW / 2

  roundRect(ctx, px, y, pillW, pillH, 20)
  ctx.fillStyle = '#f6f9fc'
  ctx.fill()
  ctx.strokeStyle = colors.line
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = colors.inkSoft
  ctx.font = '600 22px Manrope, system-ui, sans-serif'
  ctx.fillText(label, cx, y + 36)

  ctx.fillStyle = colors.ink
  ctx.font = '700 34px Manrope, system-ui, sans-serif'
  ctx.fillText(value, cx, y + 74)
}

export async function renderShareCard(input: ShareCardInput): Promise<Blob> {
  await document.fonts.ready

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não disponível')

  const pct = Math.round(Math.min(100, Math.max(0, input.progress * 100)))
  const photo = input.photoUrl ? await loadPhoto(input.photoUrl) : null
  const remainingMl = Math.max(0, input.goalMl - input.consumedMl)

  drawBackground(ctx)

  const cardX = 64
  const cardY = 140
  const cardW = W - 128
  const cardH = H - 280

  ctx.shadowColor = 'rgba(21, 101, 184, 0.18)'
  ctx.shadowBlur = 48
  ctx.shadowOffsetY = 16
  roundRect(ctx, cardX, cardY, cardW, cardH, 48)
  ctx.fillStyle = colors.card
  ctx.fill()
  ctx.shadowColor = 'transparent'

  const pad = 56
  drawAvatar(ctx, cardX + pad, cardY + pad, 96, input.nickname, photo)

  ctx.textAlign = 'left'
  ctx.fillStyle = colors.inkSoft
  ctx.font = '600 28px Manrope, system-ui, sans-serif'
  ctx.fillText('Hidratação de hoje', cardX + pad + 116, cardY + pad + 28)

  ctx.fillStyle = colors.ink
  ctx.font = '700 48px "Bricolage Grotesque", Manrope, system-ui, sans-serif'
  ctx.fillText(input.nickname || 'Eu', cardX + pad + 116, cardY + pad + 82)

  ctx.fillStyle = colors.inkSoft
  ctx.font = '500 26px Manrope, system-ui, sans-serif'
  ctx.fillText(input.dateLabel, cardX + pad + 116, cardY + pad + 120)

  if (input.streak > 0) {
    const badge = `${input.streak} dia${input.streak === 1 ? '' : 's'} seguidos`
    ctx.font = '700 24px Manrope, system-ui, sans-serif'
    const tw = ctx.measureText(badge).width + 48
    const bx = cardX + cardW - tw - pad
    const by = cardY + pad + 8
    roundRect(ctx, bx, by, tw, 52, 26)
    ctx.fillStyle = '#e6f0fa'
    ctx.fill()
    ctx.fillStyle = colors.tealDeep
    ctx.textAlign = 'center'
    ctx.fillText(badge, bx + tw / 2, by + 34)
    ctx.textAlign = 'left'
  }

  const ringCx = cardX + cardW / 2
  const ringCy = cardY + cardH * 0.46
  drawProgressRing(ctx, ringCx, ringCy, 200, input.progress)

  ctx.textAlign = 'center'
  ctx.fillStyle = colors.ink
  ctx.font = '800 112px "Bricolage Grotesque", Manrope, system-ui, sans-serif'
  ctx.fillText(`${pct}%`, ringCx, ringCy + 28)

  ctx.fillStyle = colors.inkSoft
  ctx.font = '600 34px Manrope, system-ui, sans-serif'
  ctx.fillText(
    `${formatVolume(input.consumedMl)} / ${formatVolume(input.goalMl)}`,
    ringCx,
    ringCy + 88,
  )

  if (input.goalReached) {
    ctx.font = '700 30px Manrope, system-ui, sans-serif'
    ctx.fillStyle = colors.teal
    ctx.fillText('Meta batida ✓', ringCx, ringCy + 132)
  } else if (remainingMl > 0) {
    ctx.font = '600 28px Manrope, system-ui, sans-serif'
    ctx.fillStyle = colors.inkSoft
    ctx.fillText(`Faltam ${formatVolume(remainingMl)}`, ringCx, ringCy + 132)
  }

  const statsY = ringCy + 280
  drawStatPill(ctx, ringCx - 180, statsY, 'Consumido', formatVolume(input.consumedMl))
  drawStatPill(ctx, ringCx + 180, statsY, 'Meta', formatVolume(input.goalMl))

  const footerY = cardY + cardH - pad - 72
  drawDrop(ctx, ringCx, footerY - 28, 1.5)
  ctx.textAlign = 'center'
  ctx.fillStyle = colors.tealDeep
  ctx.font = '800 38px "Bricolage Grotesque", Manrope, system-ui, sans-serif'
  ctx.fillText('Water Notes', ringCx, footerY + 36)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem'))),
      'image/png',
      1,
    )
  })
}
