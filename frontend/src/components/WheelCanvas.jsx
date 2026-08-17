import React, { useRef, useEffect } from 'react'
import { STAT_RANGES, COLORS } from '../utils/constants'

// weightModifiers: array 10 phần tử, nhân vào weight từng slice (thấp→cao)
export function buildSlices(stat, weightModifiers = null) {
  const [min, max] = STAT_RANGES[stat]
  const count = 10
  const step = (max - min) / (count - 1)
  const values = Array.from({ length: count }, (_, i) => Math.round(min + i * step))
  const baseWeights = values.map(v => Math.max(0.25, (1 - (v - min) / (max - min)) * 1.8 + 0.25))
  const weights = weightModifiers
    ? baseWeights.map((w, i) => Math.max(0.05, w * (weightModifiers[i] ?? 1.0)))
    : baseWeights
  const totalW = weights.reduce((a, b) => a + b, 0)
  let cumulative = 0
  return values.map((v, i) => {
    const start = cumulative * Math.PI * 2
    cumulative += weights[i] / totalW
    return { val: v, start, end: cumulative * Math.PI * 2, color: COLORS[i % COLORS.length] }
  })
}

export function buildClassSlices(classes) {
  const count = classes.length
  const anglePerSlice = (Math.PI * 2) / count
  return classes.map((c, i) => ({
    val: c.id,
    label: c.name,
    start: i * anglePerSlice,
    end: (i + 1) * anglePerSlice,
    color: c.color,
  }))
}

function drawWheel(ctx, slices, angle, formatLabel) {
  const cx = 240, cy = 240, r = 224
  ctx.clearRect(0, 0, 480, 480)
  slices.forEach(s => {
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, s.start + angle, s.end + angle)
    ctx.closePath()
    ctx.fillStyle = s.color
    ctx.fill()
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 1.5
    ctx.stroke()

    const mid = (s.start + s.end) / 2 + angle
    const tx = cx + Math.cos(mid) * r * 0.66
    const ty = cy + Math.sin(mid) * r * 0.66
    ctx.save()
    ctx.translate(tx, ty)
    ctx.rotate(mid)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(formatLabel ? formatLabel(s) : s.val, 0, 0)
    ctx.restore()
  })
  ctx.beginPath()
  ctx.arc(cx, cy, 26, 0, Math.PI * 2)
  ctx.fillStyle = '#1a1d27'
  ctx.fill()
  ctx.strokeStyle = '#3d4560'
  ctx.lineWidth = 2
  ctx.stroke()
}

// slices: nếu truyền vào thì dùng luôn (class wheel), không thì tự build từ stat
export default function WheelCanvas({ stat, spinning, onResult, weightModifiers, slices: slicesProp, formatLabel }) {
  const canvasRef = useRef(null)
  const stateRef = useRef({ angle: 0, vel: 0, slices: [], raf: null })

  useEffect(() => {
    const slices = slicesProp ?? buildSlices(stat, weightModifiers)
    stateRef.current.slices = slices
    const ctx = canvasRef.current.getContext('2d')
    drawWheel(ctx, slices, stateRef.current.angle, formatLabel)
  }, [stat, weightModifiers, slicesProp, formatLabel])

  useEffect(() => {
    if (!spinning) return
    const ref = stateRef.current
    ref.vel = 0.28 + Math.random() * 0.22
    const ctx = canvasRef.current.getContext('2d')

    function animate() {
      ref.angle += ref.vel
      ref.vel *= 0.992
      drawWheel(ctx, ref.slices, ref.angle, formatLabel)
      if (ref.vel > 0.0015) {
        ref.raf = requestAnimationFrame(animate)
      } else {
        const norm = ((Math.PI * 2 - ref.angle % (Math.PI * 2)) % (Math.PI * 2))
        const hit = ref.slices.find(s => {
          const start = s.start % (Math.PI * 2)
          let end = s.end % (Math.PI * 2)
          if (end < start) end += Math.PI * 2
          const n = norm < start ? norm + Math.PI * 2 : norm
          return n >= start && n < end
        }) || ref.slices[0]
        onResult(hit.val)
      }
    }
    ref.raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(ref.raf)
  }, [spinning, stat, slicesProp, formatLabel])

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas ref={canvasRef} width={480} height={480} style={{ borderRadius: '50%', border: '3px solid var(--border2)' }} />
      <div style={{
        position: 'absolute', top: '50%', right: -14, transform: 'translateY(-50%)',
        width: 0, height: 0,
        borderTop: '10px solid transparent', borderBottom: '10px solid transparent',
        borderRight: '18px solid var(--red)'
      }} />
    </div>
  )
}