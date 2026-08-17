import React, { useState, useRef, useMemo, useCallback } from 'react'
import WheelCanvas, { buildClassSlices } from './WheelCanvas'
import AvatarCropper from './AvatarCropper'
import {
  STAT_ORDER, STAT_LABELS, STAT_ICONS, STAT_RANGES,
  CLASSES, CLASS_ORDER, CLASS_STAT_RANGES, CLASS_STAT_LABELS, CLASS_STAT_ICONS,
  SKILLS, SKILL_ORDER, SKILL_COUNT_RANGE, SKILL_COUNT_WEIGHTS,
  EQUIPMENT, EQUIPMENT_ORDER, EQUIPMENT_COUNT_RANGE, EQUIPMENT_COUNT_WEIGHTS,
  isComplete
} from '../utils/constants'
import styles from './SpinScreen.module.css'

// Flow: class → classStat → hp → atk → spd → def → crit → equipCount → equipment(x N) → skillCount → skill(x N)
// Nhân vật cũ (không có field 'class' từ trước khi có hệ class) bỏ qua toàn bộ phase class/equip/skill
function getPhase(spinState) {
  const isLegacy = !('class' in spinState)
  if (isLegacy) return 'stat'
  if (!spinState.class) return 'class'
  const cls = CLASSES[spinState.class]
  if (spinState.stats[cls.classStatKey] == null) return 'classStat'
  if (STAT_ORDER.some(s => spinState.stats[s] == null)) return 'stat'
  if (spinState.equipCount == null) return 'equipCount'
  const equipment = spinState.equipment || []
  if (equipment.length < spinState.equipCount) return 'equipment'
  if (spinState.skillCount == null) return 'skillCount'
  const skills = spinState.skills || []
  if (skills.length < spinState.skillCount) return 'skill'
  return 'done'
}

export default function SpinScreen({ spinState, setSpinState, onBack, onSaved, onGoList, onNewChar }) {
  const [spinning, setSpinning] = useState(false)
  const [resultPopup, setResultPopup] = useState(null)
  const [classPopup, setClassPopup] = useState(null)
  const [skillPopup, setSkillPopup] = useState(null)
  const [equipPopup, setEquipPopup] = useState(null)
  const [savePopup, setSavePopup] = useState(false)
  const fileRef = useRef()

  const phase = getPhase(spinState)
  const classSlices = useMemo(() => buildClassSlices(CLASS_ORDER.map(id => CLASSES[id])), [])
  const formatClassLabel = useCallback(s => s.label, [])
  const currentClass = spinState.class ? CLASSES[spinState.class] : null
  const cur = STAT_ORDER[spinState.currentStatIdx]
  const weightModifiers = currentClass ? currentClass.weightModifiers[cur] : null
  const allDone = isComplete(spinState)

  // ── Skill count wheel (3 lát: 1, 2, 3 — 3 hiếm nhất) ──────
  const SKILL_WHEEL_COLORS = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#e91e63','#00bcd4','#8bc34a']
  const skillCountSlices = useMemo(() => {
    const [min, max] = SKILL_COUNT_RANGE
    const values = []
    for (let v = min; v <= max; v++) values.push(v)
    const totalW = SKILL_COUNT_WEIGHTS.reduce((a, b) => a + b, 0)
    let cum = 0
    return values.map((v, i) => {
      const start = cum * Math.PI * 2
      cum += SKILL_COUNT_WEIGHTS[i] / totalW
      return { val: v, start, end: cum * Math.PI * 2, color: SKILL_WHEEL_COLORS[i % SKILL_WHEEL_COLORS.length] }
    })
  }, [])
  const formatSkillCountLabel = useCallback(s => s.val, [])

  // ── Equipment count wheel (3 lát: 2, 3, 4 — 4 hiếm nhất) ──
  const equipCountSlices = useMemo(() => {
    const [min, max] = EQUIPMENT_COUNT_RANGE
    const values = []
    for (let v = min; v <= max; v++) values.push(v)
    const totalW = EQUIPMENT_COUNT_WEIGHTS.reduce((a, b) => a + b, 0)
    let cum = 0
    return values.map((v, i) => {
      const start = cum * Math.PI * 2
      cum += EQUIPMENT_COUNT_WEIGHTS[i] / totalW
      return { val: v, start, end: cum * Math.PI * 2, color: SKILL_WHEEL_COLORS[i % SKILL_WHEEL_COLORS.length] }
    })
  }, [])
  const formatEquipCountLabel = useCallback(s => s.val, [])

  // ── Equipment wheel (loại trừ trang bị đã có, giống skill wheel) ──
  const equipSlices = useMemo(() => {
    const already = spinState.equipment || []
    const available = EQUIPMENT_ORDER.filter(id => !already.includes(id))
    const count = available.length
    if (count === 0) return []
    const step = (Math.PI * 2) / count
    return available.map((id, i) => ({
      val: id,
      label: EQUIPMENT[id].name,
      start: i * step,
      end: (i + 1) * step,
      color: SKILL_WHEEL_COLORS[i % SKILL_WHEEL_COLORS.length],
    }))
  }, [spinState.equipment])
  const formatEquipLabel = useCallback(s => EQUIPMENT[s.val].name, [])

  // ── Skill wheel (loại trừ skill đã có VÀ skill được trang bị tự động cấp) ──
  const skillSlices = useMemo(() => {
    const already = [...(spinState.skills || []), ...(spinState.grantedSkills || [])]
    const available = SKILL_ORDER.filter(id => !already.includes(id))
    const count = available.length
    if (count === 0) return []
    const step = (Math.PI * 2) / count
    return available.map((id, i) => ({
      val: id,
      label: SKILLS[id].name,
      start: i * step,
      end: (i + 1) * step,
      color: SKILL_WHEEL_COLORS[i % SKILL_WHEEL_COLORS.length],
    }))
  }, [spinState.skills, spinState.grantedSkills])
  const formatSkillLabel = useCallback(s => SKILLS[s.val].name, [])

  // ── Equipment count phase ────────────────────────────────
  function handleEquipCountResult(val) {
    setSpinning(false)
    setSpinState(prev => ({ ...prev, equipCount: val, equipment: [] }))
  }

  // ── Equipment phase ───────────────────────────────────────
  function handleEquipResult(equipId) {
    setSpinning(false)
    setEquipPopup(equipId)
  }
  function confirmEquip() {
    const equip = EQUIPMENT[equipPopup]
    setSpinState(prev => {
      const next = { ...prev, equipment: [...(prev.equipment || []), equipPopup] }
      // Trang bị cho thêm lượt roll trang bị (tối đa tổng 5)
      if (equip.extraEquipRoll) {
        next.equipCount = Math.min(5, (prev.equipCount || 0) + equip.extraEquipRoll)
      }
      // Trang bị cho thêm lượt roll skill (cộng dồn, áp dụng khi tới phase skillCount)
      if (equip.extraSkillRoll) {
        next.bonusSkillRoll = (prev.bonusSkillRoll || 0) + equip.extraSkillRoll
      }
      // Trang bị tự động cấp thẳng 1 skill (không tốn lượt roll skill, loại luôn khỏi skill wheel)
      if (equip.grantsSkill) {
        next.grantedSkills = [...(prev.grantedSkills || []), equip.grantsSkill]
      }
      return next
    })
    setEquipPopup(null)
  }
  function rerollEquip() { setEquipPopup(null) }

  // ── Skill count phase ──────────────────────────────────────
  function handleSkillCountResult(val) {
    setSpinning(false)
    const bonus = spinState.bonusSkillRoll || 0
    setSpinState(prev => ({ ...prev, skillCount: val + bonus, skills: [] }))
  }

  // ── Skill phase ─────────────────────────────────────────────
  function handleSkillResult(skillId) {
    setSpinning(false)
    setSkillPopup(skillId)
  }
  function confirmSkill() {
    setSpinState(prev => ({ ...prev, skills: [...(prev.skills || []), skillPopup] }))
    setSkillPopup(null)
  }
  function rerollSkill() { setSkillPopup(null) }

  // ── Class phase ──────────────────────────────────────────
  function handleClassResult(classId) {
    setSpinning(false)
    setClassPopup(classId)
  }
  function confirmClass() {
    setSpinState(prev => ({ ...prev, class: classPopup }))
    setClassPopup(null)
  }
  function rerollClass() { setClassPopup(null) }

  // ── Class stat phase ─────────────────────────────────────
  function handleClassStatResult(val) {
    setSpinning(false)
    const cls = CLASSES[spinState.class]
    setResultPopup({ stat: cls.classStatKey, val, isClassStat: true })
  }

  // ── Stat phase ───────────────────────────────────────────
  function handleResult(val) {
    setSpinning(false)
    setResultPopup({ stat: cur, val })
  }

  function handleResultConfirm() {
    const { stat, val } = resultPopup
    const newStats = { ...spinState.stats, [stat]: val }
    // next unrolled basic stat (skip classStat key)
    const nextIdx = STAT_ORDER.findIndex(s => newStats[s] == null)
    setSpinState(prev => ({
      ...prev,
      stats: newStats,
      currentStatIdx: nextIdx >= 0 ? nextIdx : prev.currentStatIdx
    }))
    setResultPopup(null)
  }

  function switchStat(idx) {
    if (spinning) return
    setSpinState(prev => ({ ...prev, currentStatIdx: idx }))
  }
  function resetStat(idx) {
    if (spinning) return
    setSpinState(prev => {
      const ns = { ...prev.stats }
      delete ns[STAT_ORDER[idx]]
      return { ...prev, stats: ns, currentStatIdx: idx }
    })
  }

  const [cropSrc, setCropSrc] = useState(null)

  function uploadAvatar(e) {
    const f = e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = ev => setCropSrc(ev.target.result)
    reader.readAsDataURL(f)
    e.target.value = '' // cho phép chọn lại cùng 1 file lần sau
  }
  function pasteAvatar(e) {
    for (const item of e.clipboardData?.items || []) {
      if (item.type.startsWith('image')) {
        const reader = new FileReader()
        reader.onload = ev => setCropSrc(ev.target.result)
        reader.readAsDataURL(item.getAsFile())
      }
    }
  }
  function confirmCrop(dataUrl) {
    setSpinState(prev => ({ ...prev, avatar: dataUrl }))
    setCropSrc(null)
  }

  function handleSave() {
    const saved = { ...spinState, name: spinState.name || 'Chiến binh', pending: false }
    onSaved(saved)
    setSavePopup(true)
  }

  // Label cho nút confirm popup
  const nextLabel = (() => {
    if (!resultPopup) return ''
    if (resultPopup.isClassStat) return `Tiếp tục → ${STAT_LABELS[STAT_ORDER[0]]}`
    const tmp = { ...spinState.stats, [resultPopup.stat]: resultPopup.val }
    const nextIdx = STAT_ORDER.findIndex(s => tmp[s] == null)
    return nextIdx >= 0 ? `Tiếp tục → ${STAT_LABELS[STAT_ORDER[nextIdx]]}` : 'Tiếp tục → Số lượng trang bị'
  })()

  // Class stat wheel slices (10 lát, trọng số cao dễ ra hơn)
  const classStatSlices = useMemo(() => {
    if (!currentClass) return null
    const key = currentClass.classStatKey
    const [min, max] = CLASS_STAT_RANGES[currentClass.id][key]
    const count = 10
    const step = (max - min) / (count - 1)
    const values = Array.from({ length: 10 }, (_, i) => Math.round(min + i * step))
    // dodge/regen: giá trị cao = tốt → hiếm hơn (norm cao → weight thấp)
    // castTime: giá trị thấp = tốt (cast nhanh) → hiếm hơn (norm thấp → weight thấp)
    const isCastTime = key === 'castTime'
    const baseW = values.map(v => {
      const norm = (v - min) / (max - min)
      const rarity = isCastTime ? norm : (1 - norm)
      return Math.max(0.25, rarity * 0.4 + 0.25)
    })
    const totalW = baseW.reduce((a, b) => a + b, 0)
    let cum = 0
    return values.map((v, i) => {
      const start = cum * Math.PI * 2
      cum += baseW[i] / totalW
      return { val: v, start, end: cum * Math.PI * 2, color: ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#e91e63','#00bcd4','#8bc34a'][i] }
    })
  }, [currentClass])

  const classStatFormatLabel = useCallback(s => {
    if (!currentClass) return s.val
    const key = currentClass.classStatKey
    if (key === 'dodge') return s.val + '%'
    if (key === 'castTime') return s.val + 's'
    if (key === 'arrowCount') return s.val
    if (key === 'rage') return s.val + '%'
    if (key === 'execThreshold') return s.val + '%'
    if (key === 'dashMult') return s.val + '%'
    if (key === 'regen') return s.val + '%'
    if (key === 'reflectPct') return s.val + '%'
    return s.val
  }, [currentClass])

  return (
    <div className={styles.screen}>

      {cropSrc && (
        <AvatarCropper
          imageSrc={cropSrc}
          onConfirm={confirmCrop}
          onCancel={() => setCropSrc(null)}
        />
      )}

      {/* Class confirm popup */}
      {classPopup && (() => {
        const cls = CLASSES[classPopup]
        return (
          <div className={styles.overlay}>
            <div className={styles.popup}>
              <div className={styles.popupTitle} style={{ color: cls.color }}>{cls.name}</div>
              <div className={styles.popupDesc}>{cls.desc}</div>
              <div className={styles.popupBtns}>
                <button className={styles.popupBtn} onClick={confirmClass}>✅ Chọn lớp này</button>
                <button className={`${styles.popupBtn} ${styles.secondary}`} onClick={rerollClass}>🔄 Quay lại</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Skill confirm popup */}
      {skillPopup && (() => {
        const skill = SKILLS[skillPopup]
        return (
          <div className={styles.overlay}>
            <div className={styles.popup}>
              <div className={styles.popupTitle} style={{ color: skill.color }}>{skill.name}</div>
              <div className={styles.popupDesc}>{skill.desc}</div>
              <div className={styles.popupBtns}>
                <button className={styles.popupBtn} onClick={confirmSkill}>✅ Nhận kỹ năng</button>
                <button className={`${styles.popupBtn} ${styles.secondary}`} onClick={rerollSkill}>🔄 Quay lại</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Equipment confirm popup */}
      {equipPopup && (() => {
        const equip = EQUIPMENT[equipPopup]
        return (
          <div className={styles.overlay}>
            <div className={styles.popup}>
              <div className={styles.popupTitle} style={{ color: equip.color }}>{equip.name}</div>
              <div className={styles.popupDesc}>{equip.desc}</div>
              <div className={styles.popupBtns}>
                <button className={styles.popupBtn} onClick={confirmEquip}>✅ Nhận trang bị</button>
                <button className={`${styles.popupBtn} ${styles.secondary}`} onClick={rerollEquip}>🔄 Quay lại</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Stat / ClassStat result popup */}
      {resultPopup && (() => {
        const isCs = resultPopup.isClassStat
        const cls = currentClass
        const icon = isCs ? CLASS_STAT_ICONS[cls.id][cls.classStatKey] : STAT_ICONS[resultPopup.stat]
        const label = isCs ? CLASS_STAT_LABELS[cls.id][cls.classStatKey] : STAT_LABELS[resultPopup.stat]
        const [min, max] = isCs
          ? CLASS_STAT_RANGES[cls.id][cls.classStatKey]
          : STAT_RANGES[resultPopup.stat]
        const unit = isCs
          ? (cls.classStatKey === 'dodge' ? '%' : cls.classStatKey === 'castTime' ? 's' : cls.classStatKey === 'arrowCount' ? ' mũi' : cls.classStatKey === 'rage' ? '%/10%HP' : cls.classStatKey === 'execThreshold' ? '%HP' : cls.classStatKey === 'dashMult' ? '%' : cls.classStatKey === 'regen' ? '%/4.5s' : cls.classStatKey === 'reflectPct' ? '%' : '')
          : ((resultPopup.stat === 'def' || resultPopup.stat === 'crit') ? '%' : '')
        return (
          <div className={styles.overlay}>
            <div className={styles.popup}>
              <div className={styles.popupIcon}>{icon}</div>
              <div className={styles.popupTitle}>{label} đã quay được:</div>
              <div className={styles.popupNum}>{resultPopup.val}{unit}</div>
              <div className={styles.popupRange}>({min}–{max}{unit})</div>
              <button className={styles.popupBtn} onClick={handleResultConfirm}>{nextLabel}</button>
            </div>
          </div>
        )
      })()}

      {/* Save popup */}
      {savePopup && (
        <div className={styles.overlay}>
          <div className={styles.popup}>
            <div className={styles.popupIcon}>✅</div>
            <div className={styles.popupTitle}>Đã lưu nhân vật!</div>
            <div className={styles.popupBtns}>
              <button className={styles.popupBtn} onClick={() => { setSavePopup(false); onNewChar() }}>
                🎰 Quay tiếp (nhân vật mới)
              </button>
              <button className={`${styles.popupBtn} ${styles.secondary}`} onClick={() => { setSavePopup(false); onGoList() }}>
                📋 Đến danh sách
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.topbar}>
        <button className={styles.backBtn} onClick={onBack}>← Quay lại</button>
        <div className={styles.title}>
          {phase === 'class' && '🎰 Quay chức nghiệp'}
          {phase === 'classStat' && `Vòng quay ${CLASS_STAT_LABELS[currentClass?.id]?.[currentClass?.classStatKey]}`}
          {phase === 'stat' && `Vòng quay ${STAT_LABELS[cur]}`}
          {phase === 'equipCount' && '🎲 Quay số lượng trang bị'}
          {phase === 'equipment' && `🛡️ Trang bị ${(spinState.equipment?.length || 0) + 1}/${spinState.equipCount}`}
          {phase === 'skillCount' && '🎲 Quay số lượng kỹ năng'}
          {phase === 'skill' && `✨ Kỹ năng ${(spinState.skills?.length || 0) + 1}/${spinState.skillCount}`}
          {phase === 'done' && 'Hoàn thành!'}
        </div>
        {currentClass && (
          <div className={styles.classBadge} style={{ color: currentClass.color }}>
            {currentClass.name}
          </div>
        )}
      </div>

      <div className={styles.layout}>
        <div className={styles.left}>

          {/* Class wheel */}
          {phase === 'class' && (
            <>
              <div className={styles.classHint}>Quay để chọn chức nghiệp của nhân vật</div>
              <WheelCanvas slices={classSlices} spinning={spinning} onResult={handleClassResult} formatLabel={formatClassLabel} />
              <button className={styles.spinBtn} disabled={spinning} onClick={() => setSpinning(true)}>
                {spinning ? 'Đang quay...' : 'Quay!'}
              </button>
            </>
          )}

          {/* Class stat wheel */}
          {phase === 'classStat' && currentClass && (
            <>
              <div className={styles.classHint}>
                {CLASS_STAT_ICONS[currentClass.id][currentClass.classStatKey]}{' '}
                Chỉ số đặc trưng của {currentClass.name}
              </div>
              <WheelCanvas
                slices={classStatSlices}
                spinning={spinning}
                onResult={handleClassStatResult}
                formatLabel={classStatFormatLabel}
              />
              <button className={styles.spinBtn} disabled={spinning} onClick={() => setSpinning(true)}>
                {spinning ? 'Đang quay...' : 'Quay!'}
              </button>
            </>
          )}

          {/* Basic stat wheel */}
          {phase === 'stat' && (
            <>
              <div className={styles.tabs}>
                {STAT_ORDER.map((s, i) => (
                  <button
                    key={s}
                    className={[styles.tab, spinState.stats[s] != null ? styles.done : '', i === spinState.currentStatIdx ? styles.active : ''].join(' ')}
                    onClick={() => spinState.stats[s] != null ? resetStat(i) : switchStat(i)}
                  >
                    {STAT_LABELS[s]}
                    {spinState.stats[s] != null && (
                      <span className={styles.tabVal}>{(s === 'def' || s === 'crit') ? spinState.stats[s] + '%' : spinState.stats[s]}</span>
                    )}
                  </button>
                ))}
              </div>
              <WheelCanvas stat={cur} spinning={spinning} onResult={handleResult} weightModifiers={weightModifiers} />
              <button
                className={styles.spinBtn}
                disabled={spinning || allDone || spinState.stats[cur] != null}
                onClick={() => setSpinning(true)}
              >
                {spinning ? 'Đang quay...' : 'Quay!'}
              </button>
            </>
          )}

          {/* Equipment count wheel */}
          {phase === 'equipCount' && (
            <>
              <div className={styles.classHint}>Quay để xác định số lượng trang bị nhận được (2–4)</div>
              <WheelCanvas slices={equipCountSlices} spinning={spinning} onResult={handleEquipCountResult} formatLabel={formatEquipCountLabel} />
              <button className={styles.spinBtn} disabled={spinning} onClick={() => setSpinning(true)}>
                {spinning ? 'Đang quay...' : 'Quay!'}
              </button>
            </>
          )}

          {/* Equipment wheel */}
          {phase === 'equipment' && (
            <>
              <div className={styles.classHint}>
                Quay trang bị {(spinState.equipment?.length || 0) + 1}/{spinState.equipCount}
              </div>
              <WheelCanvas slices={equipSlices} spinning={spinning} onResult={handleEquipResult} formatLabel={formatEquipLabel} />
              <button className={styles.spinBtn} disabled={spinning} onClick={() => setSpinning(true)}>
                {spinning ? 'Đang quay...' : 'Quay!'}
              </button>
            </>
          )}

          {/* Skill count wheel */}
          {phase === 'skillCount' && (
            <>
              <div className={styles.classHint}>Quay để xác định số lượng kỹ năng nhận được (1–3)</div>
              <WheelCanvas slices={skillCountSlices} spinning={spinning} onResult={handleSkillCountResult} formatLabel={formatSkillCountLabel} />
              <button className={styles.spinBtn} disabled={spinning} onClick={() => setSpinning(true)}>
                {spinning ? 'Đang quay...' : 'Quay!'}
              </button>
            </>
          )}

          {/* Skill wheel */}
          {phase === 'skill' && (
            <>
              <div className={styles.classHint}>
                Quay kỹ năng {(spinState.skills?.length || 0) + 1}/{spinState.skillCount}
              </div>
              <WheelCanvas slices={skillSlices} spinning={spinning} onResult={handleSkillResult} formatLabel={formatSkillLabel} />
              <button className={styles.spinBtn} disabled={spinning} onClick={() => setSpinning(true)}>
                {spinning ? 'Đang quay...' : 'Quay!'}
              </button>
            </>
          )}
        </div>

        {/* Right: Char info */}
        <div className={styles.right}>
          <input
            className={styles.nameInput}
            value={spinState.name}
            placeholder="Tên nhân vật..."
            onChange={e => setSpinState(prev => ({ ...prev, name: e.target.value }))}
          />
          <div className={styles.avatarBox} onClick={() => fileRef.current.click()} onPaste={pasteAvatar} tabIndex={0}>
            {spinState.avatar
              ? <img src={spinState.avatar} className={styles.avatarImg} alt="avatar" />
              : <><span style={{ fontSize: 24 }}>📷</span><span>Bấm hoặc dán ảnh</span></>
            }
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadAvatar} />

          <div className={styles.statsPanel}>
            {/* Class stat row */}
            {currentClass && (() => {
              const key = currentClass.classStatKey
              const val = spinState.stats[key]
              const unit = key === 'dodge' ? '%' : key === 'castTime' ? 's' : key === 'arrowCount' ? ' mũi' : key === 'rage' ? '%/10%HP' : key === 'execThreshold' ? '%HP' : key === 'dashMult' ? '%' : key === 'reflectPct' ? '%' : '%/4.5s'
              return (
                <div key={key} className={styles.statRow} style={{ borderBottom: '1px solid var(--border)', marginBottom: 4, paddingBottom: 6 }}>
                  <span className={styles.statLabel} style={{ color: currentClass.color }}>
                    {CLASS_STAT_ICONS[currentClass.id][key]} {CLASS_STAT_LABELS[currentClass.id][key]}
                  </span>
                  <span className={val != null ? styles.statVal : styles.statEmpty}>
                    {val != null ? val + unit : '—'}
                  </span>
                </div>
              )
            })()}
            {STAT_ORDER.map(s => (
              <div key={s} className={styles.statRow}>
                <span className={styles.statLabel}>{STAT_ICONS[s]} {STAT_LABELS[s]}</span>
                <span className={spinState.stats[s] != null ? styles.statVal : styles.statEmpty}>
                  {spinState.stats[s] != null ? ((s === 'def' || s === 'crit') ? spinState.stats[s] + '%' : spinState.stats[s]) : '—'}
                </span>
              </div>
            ))}
          </div>

          {/* Equipment list */}
          {spinState.equipCount != null && (
            <div className={styles.statsPanel}>
              <div className={styles.statRow} style={{ borderBottom: 'none', paddingBottom: 2 }}>
                <span className={styles.statLabel}>🎲 Số trang bị</span>
                <span className={styles.statVal}>{spinState.equipCount}</span>
              </div>
              {Array.from({ length: spinState.equipCount }).map((_, i) => {
                const equipId = spinState.equipment?.[i]
                const equip = equipId ? EQUIPMENT[equipId] : null
                return (
                  <div key={i} className={styles.statRow}>
                    <span className={styles.statLabel} style={equip ? { color: equip.color } : {}}>
                      {equip ? equip.name : `Trang bị ${i + 1}`}
                    </span>
                    <span className={equip ? styles.statVal : styles.statEmpty}>{equip ? '✓' : '—'}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Granted skills (tự động cấp từ trang bị, không tốn lượt roll) */}
          {spinState.grantedSkills && spinState.grantedSkills.length > 0 && (
            <div className={styles.statsPanel}>
              <div className={styles.statRow} style={{ borderBottom: 'none', paddingBottom: 2 }}>
                <span className={styles.statLabel}>🎁 Kỹ năng từ trang bị</span>
              </div>
              {spinState.grantedSkills.map((skillId, i) => {
                const skill = SKILLS[skillId]
                return (
                  <div key={i} className={styles.statRow}>
                    <span className={styles.statLabel} style={{ color: skill.color }}>{skill.name}</span>
                    <span className={styles.statVal}>✓</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Skills list */}
          {spinState.skillCount != null && (
            <div className={styles.statsPanel}>
              <div className={styles.statRow} style={{ borderBottom: 'none', paddingBottom: 2 }}>
                <span className={styles.statLabel}>🎲 Số kỹ năng</span>
                <span className={styles.statVal}>{spinState.skillCount}</span>
              </div>
              {Array.from({ length: spinState.skillCount }).map((_, i) => {
                const skillId = spinState.skills?.[i]
                const skill = skillId ? SKILLS[skillId] : null
                return (
                  <div key={i} className={styles.statRow}>
                    <span className={styles.statLabel} style={skill ? { color: skill.color } : {}}>
                      {skill ? skill.name : `Kỹ năng ${i + 1}`}
                    </span>
                    <span className={skill ? styles.statVal : styles.statEmpty}>{skill ? '✓' : '—'}</span>
                  </div>
                )
              })}
            </div>
          )}

          {['stat', 'equipCount', 'equipment', 'skillCount', 'skill', 'done'].includes(phase) && (
            <div className={styles.actions}>
              {allDone && <button className={styles.saveBtn} onClick={handleSave}>💾 Lưu nhân vật</button>}
              {!spinState.isReroll && (
                <button className={styles.deleteBtn} onClick={() => setSpinState(prev => ({
                  ...prev, stats: {}, currentStatIdx: 0, class: null,
                  equipCount: null, equipment: [], bonusSkillRoll: 0, grantedSkills: [],
                  skillCount: null, skills: []
                }))}>
                  🗑 Xóa & làm lại
                </button>
              )}
              <button className={styles.listBtn} onClick={onGoList}>Đến danh sách →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
