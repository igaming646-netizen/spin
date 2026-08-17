import React, { useRef, useEffect, useState, useCallback } from 'react'

// Modal crop tròn kiểu TikTok/Facebook — kéo để di chuyển, cuộn/slider để zoom.
// Xuất ảnh vuông (đủ để hiển thị tròn qua border-radius:50%, và tái sử dụng ở mọi nơi khác).
export default function AvatarCropper({ imageSrc, onConfirm, onCancel }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [scale, setScale] = useState(1)
  const [minScale, setMinScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef(null) // { startX, startY, startOffsetX, startOffsetY }

  const SIZE = 320       // canvas hiển thị
  const OUT_SIZE = 480   // ảnh xuất ra (đủ nét cho card + trận đấu)
  const CIRCLE_R = SIZE / 2 - 4

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const s = Math.max(SIZE / img.width, SIZE / img.height)
      setMinScale(s)
      setScale(s)
      setOffset({ x: 0, y: 0 })
      setReady(true)
    }
    img.src = imageSrc
  }, [imageSrc])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, SIZE, SIZE)

    const w = img.width * scale
    const h = img.height * scale
    const x = SIZE / 2 - w / 2 + offset.x
    const y = SIZE / 2 - h / 2 + offset.y

    // Ảnh nền (mờ ngoài vùng crop)
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.drawImage(img, x, y, w, h)
    ctx.restore()

    // Vùng crop tròn — vẽ rõ nét
    ctx.save()
    ctx.beginPath()
    ctx.arc(SIZE / 2, SIZE / 2, CIRCLE_R, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(img, x, y, w, h)
    ctx.restore()

    // Viền vòng crop
    ctx.beginPath()
    ctx.arc(SIZE / 2, SIZE / 2, CIRCLE_R, 0, Math.PI * 2)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2.5
    ctx.stroke()
  }, [scale, offset])

  useEffect(() => { if (ready) draw() }, [ready, draw])

  function clampOffset(nx, ny, s) {
    const img = imgRef.current
    if (!img) return { x: nx, y: ny }
    const w = img.width * s, h = img.height * s
    const maxX = Math.max(0, (w - SIZE) / 2)
    const maxY = Math.max(0, (h - SIZE) / 2)
    return { x: Math.max(-maxX, Math.min(maxX, nx)), y: Math.max(-maxY, Math.min(maxY, ny)) }
  }

  function onPointerDown(e) {
    const p = e.touches ? e.touches[0] : e
    dragRef.current = { startX: p.clientX, startY: p.clientY, startOffsetX: offset.x, startOffsetY: offset.y }
  }
  function onPointerMove(e) {
    if (!dragRef.current) return
    const p = e.touches ? e.touches[0] : e
    const dx = p.clientX - dragRef.current.startX
    const dy = p.clientY - dragRef.current.startY
    setOffset(clampOffset(dragRef.current.startOffsetX + dx, dragRef.current.startOffsetY + dy, scale))
  }
  function onPointerUp() { dragRef.current = null }

  function onWheel(e) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.05 : 0.05
    changeScale(scale + delta)
  }

  function changeScale(newScale) {
    const s = Math.max(minScale, Math.min(minScale * 4, newScale))
    setScale(s)
    setOffset(prev => clampOffset(prev.x, prev.y, s))
  }

  function handleConfirm() {
    const img = imgRef.current
    const out = document.createElement('canvas')
    out.width = OUT_SIZE
    out.height = OUT_SIZE
    const octx = out.getContext('2d')
    const factor = OUT_SIZE / SIZE
    const w = img.width * scale * factor
    const h = img.height * scale * factor
    const x = OUT_SIZE / 2 - w / 2 + offset.x * factor
    const y = OUT_SIZE / 2 - h / 2 + offset.y * factor
    octx.drawImage(img, x, y, w, h)
    onConfirm(out.toDataURL('image/png'))
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, textAlign: 'center' }}>Chỉnh ảnh đại diện</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center', marginBottom: 12 }}>
          Kéo để di chuyển • Cuộn hoặc dùng thanh trượt để zoom
        </div>
        <div
          style={{ width: SIZE, height: SIZE, margin: '0 auto', borderRadius: 12, overflow: 'hidden', background: '#000', cursor: 'grab', touchAction: 'none' }}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
          onWheel={onWheel}
        >
          <canvas ref={canvasRef} width={SIZE} height={SIZE} />
        </div>
        <input
          type="range"
          min={minScale}
          max={minScale * 4}
          step={0.01}
          value={scale}
          onChange={e => changeScale(parseFloat(e.target.value))}
          style={{ width: '100%', marginTop: 14 }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel} style={btnSecondary}>Hủy</button>
          <button onClick={handleConfirm} style={btnPrimary}>Xong</button>
        </div>
      </div>
    </div>
  )
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
}
const modalStyle = {
  background: 'var(--surface2)', borderRadius: 18, padding: 22,
  border: '1.5px solid var(--border2)', width: 360, maxWidth: '92vw',
}
const btnPrimary = {
  flex: 1, padding: '10px', borderRadius: 10, background: 'var(--blue)',
  color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
}
const btnSecondary = {
  flex: 1, padding: '10px', borderRadius: 10, background: 'none',
  border: '1.5px solid var(--border2)', color: 'var(--text)', fontSize: 14, cursor: 'pointer',
}
