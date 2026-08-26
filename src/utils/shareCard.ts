import { formatTime, formatVolume } from '@/utils/date'

export type ShareCardInput = {
  nickname: string
  photoUrl: string | null
  dateLabel: string
  consumedMl: number
  goalMl: number
  progress: number
  streak: number
  goalReached: boolean
  entries: { ml: number; at: string }[]
}

const W = 1080
const H = 1350

const colors = {
  bgA: '#b8e8ef',
  bgB: '#e8f4f6',
  card: '#ffffff',
  ink: '#1a3238',
  inkSoft: '#5a7278',
  teal: '#0d7377',
  tealDeep: '#095558',
  tealLight: '#5ec4c9',
  water: '#6ec8d8',
  waterDeep: '#3a9eb0',
  line: '#dce8ea',
  amber: '#e8a735',
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

  ctx.globalAlpha = 0.35
  for (const b of [
    { x: 120, y: 180, r: 90 },
    { x: 920, y: 260, r: 70 },
    { x: 880, y: 1100, r: 110 },
    { x: 140, y: 1180, r: 60 },
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
  const line = 28
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

export async function renderShareCard(input: ShareCardInput): Promise<Blob> {
  await document.fonts.ready

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não disponível')

  const pct = Math.round(Math.min(100, Math.max(0, input.progress * 100)))
  const photo = input.photoUrl ? await loadPhoto(input.photoUrl) : null
  const entries = input.entries.slice(0, 8)
  const hidden = Math.max(0, input.entries.length - entries.length)

  drawBackground(ctx)

  // Card principal
  const cardX = 72
  const cardY = 120
  const cardW = W - 144
  const cardH = H - 240
  ctx.shadowColor = 'rgba(13, 115, 119, 0.18)'
  ctx.shadowBlur = 48
  ctx.shadowOffsetY = 16
  roundRect(ctx, cardX, cardY, cardW, cardH, 48)
  ctx.fillStyle = colors.card
  ctx.fill()
  ctx.shadowColor = 'transparent'

  // Header
  drawAvatar(ctx, cardX + 48, cardY + 48, 88, input.nickname, photo)

  ctx.textAlign = 'left'
  ctx.fillStyle = colors.inkSoft
  ctx.font = '600 28px Manrope, system-ui, sans-serif'
  ctx.fillText('Hidratação de hoje', cardX + 160, cardY + 78)

  ctx.fillStyle = colors.ink
  ctx.font = '700 44px "Bricolage Grotesque", Manrope, system-ui, sans-serif'
  ctx.fillText(input.nickname || 'Eu', cardX + 160, cardY + 128)

  ctx.fillStyle = colors.inkSoft
  ctx.font = '500 26px Manrope, system-ui, sans-serif'
  ctx.fillText(input.dateLabel, cardX + 160, cardY + 162)

  if (input.streak > 0) {
    const badge = `${input.streak} dia${input.streak === 1 ? '' : 's'} 🔥`
    ctx.font = '700 24px Manrope, system-ui, sans-serif'
    const tw = ctx.measureText(badge).width + 40
    const bx = cardX + cardW - tw - 40
    const by = cardY + 52
    roundRect(ctx, bx, by, tw, 48, 24)
    ctx.fillStyle = '#e6f7f8'
    ctx.fill()
    ctx.fillStyle = colors.tealDeep
    ctx.textAlign = 'center'
    ctx.fillText(badge, bx + tw / 2, by + 32)
    ctx.textAlign = 'left'
  }

  // Anel de progresso
  const ringCx = cardX + cardW / 2
  const ringCy = cardY + 340
  drawProgressRing(ctx, ringCx, ringCy, 150, input.progress)

  ctx.textAlign = 'center'
  ctx.fillStyle = colors.ink
  ctx.font = '800 96px "Bricolage Grotesque", Manrope, system-ui, sans-serif'
  ctx.fillText(`${pct}%`, ringCx, ringCy + 24)

  ctx.fillStyle = colors.inkSoft
  ctx.font = '600 30px Manrope, system-ui, sans-serif'
  ctx.fillText(
    `${formatVolume(input.consumedMl)} / ${formatVolume(input.goalMl)}`,
    ringCx,
    ringCy + 72,
  )

  if (input.goalReached) {
    ctx.font = '700 26px Manrope, system-ui, sans-serif'
    ctx.fillStyle = colors.teal
    ctx.fillText('Meta batida ✓', ringCx, ringCy + 112)
  }

  // Lista do dia
  const listX = cardX + 48
  const listY = cardY + 530
  const listW = cardW - 96

  ctx.textAlign = 'left'
  ctx.fillStyle = colors.inkSoft
  ctx.font = '700 22px Manrope, system-ui, sans-serif'
  ctx.fillText('REGISTROS DE HOJE', listX, listY)

  roundRect(ctx, listX, listY + 20, listW, 420, 28)
  ctx.fillStyle = '#f6fbfc'
  ctx.fill()
  ctx.strokeStyle = colors.line
  ctx.lineWidth = 2
  ctx.stroke()

  if (entries.length === 0) {
    ctx.textAlign = 'center'
    ctx.fillStyle = colors.inkSoft
    ctx.font = '500 28px Manrope, system-ui, sans-serif'
    ctx.fillText('Nenhum registro ainda', listX + listW / 2, listY + 240)
    ctx.font = '400 24px Manrope, system-ui, sans-serif'
    ctx.fillText('Cada gole conta 💧', listX + listW / 2, listY + 280)
  } else {
    let rowY = listY + 68
    for (const entry of entries) {
      ctx.textAlign = 'left'
      roundRect(ctx, listX + 24, rowY - 28, 100, 44, 12)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.strokeStyle = colors.line
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.fillStyle = colors.inkSoft
      ctx.font = '600 22px Manrope, system-ui, sans-serif'
      ctx.fillText(formatTime(entry.at), listX + 36, rowY)

      ctx.fillStyle = colors.ink
      ctx.font = '700 30px Manrope, system-ui, sans-serif'
      ctx.fillText(formatVolume(entry.ml), listX + 150, rowY)

      ctx.strokeStyle = colors.line
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(listX + 24, rowY + 22)
      ctx.lineTo(listX + listW - 24, rowY + 22)
      ctx.stroke()

      rowY += 52
    }

    if (hidden > 0) {
      ctx.fillStyle = colors.inkSoft
      ctx.font = '600 24px Manrope, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`+ ${hidden} registro${hidden === 1 ? '' : 's'}`, listX + listW / 2, rowY + 8)
    }
  }

  // Footer branding
  drawDrop(ctx, cardX + cardW / 2, cardY + cardH - 88, 1.4)
  ctx.textAlign = 'center'
  ctx.fillStyle = colors.tealDeep
  ctx.font = '800 36px "Bricolage Grotesque", Manrope, system-ui, sans-serif'
  ctx.fillText('Water Notes', cardX + cardW / 2, cardY + cardH - 36)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem'))),
      'image/png',
      1,
    )
  })
}
