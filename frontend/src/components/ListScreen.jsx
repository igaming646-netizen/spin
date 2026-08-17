import React, { useState, useRef } from 'react'
import { STAT_ORDER, STAT_LABELS, STAT_ICONS, CLASSES, SKILLS, EQUIPMENT, isComplete } from '../utils/constants'
import AvatarCropper from './AvatarCropper'
import styles from './ListScreen.module.css'

export default function ListScreen({ chars, onBack, onGoSpin, onDelete, onUpdate, onReroll, onRerollEquipCount, onRerollEquip, onRerollSkillCount, onRerollSkill, onFight }) {
  const [selected, setSelected] = useState([])
  const [modal, setModal] = useState(null)
  const [modalView, setModalView] = useState('menu')
  const [editName, setEditName] = useState('')
  const [multiCheck, setMultiCheck] = useState({})
  const [skillMultiCheck, setSkillMultiCheck] = useState({})
  const [equipMultiCheck, setEquipMultiCheck] = useState({})
  const [randomizing, setRandomizing] = useState(false)
  const [flashIds, setFlashIds] = useState([])
  const randomTimerRef = useRef(null)
  const avatarFileRef = useRef()

  function toggleSelect(id) {
    if (randomizing) return
    const c = chars.find(x => x.id === id)
    if (!c || !isComplete(c)) return
    if (selected.includes(id)) setSelected(prev => prev.filter(x => x !== id))
    else if (selected.length < 2) setSelected(prev => [...prev, id])
  }

  function randomPick() {
    const ready = chars.filter(isComplete)
    if (ready.length < 3 || randomizing) return
    setRandomizing(true)
    setSelected([])

    let speed = 80
    let elapsed = 0
    const totalDuration = 1800

    function tick() {
      const shuffled = [...ready].sort(() => Math.random() - 0.5)
      const pick = [shuffled[0].id, shuffled[1].id]
      setFlashIds(pick)
      elapsed += speed

      if (elapsed >= totalDuration) {
        setSelected(pick)
        setFlashIds([])
        setRandomizing(false)
        return
      }
      speed = Math.min(280, speed + 18)
      randomTimerRef.current = setTimeout(tick, speed)
    }
    tick()
  }

  React.useEffect(() => () => clearTimeout(randomTimerRef.current), [])

  const [cropSrc, setCropSrc] = useState(null)

  function saveAvatar(dataUrl) {
    const updated = { ...modal, avatar: dataUrl }
    onUpdate(modal.id, updated)
    setModal(updated)
  }

  function uploadAvatar(e) {
    const f = e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = ev => setCropSrc(ev.target.result)
    reader.readAsDataURL(f)
    e.target.value = ''
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
    saveAvatar(dataUrl)
    setCropSrc(null)
  }

  function removeAvatar() {
    const updated = { ...modal, avatar: null }
    onUpdate(modal.id, updated)
    setModal(updated)
  }

  function openModal(c) {
    setModal(c)
    setEditName(c.name || '')
    setModalView('menu')
    setMultiCheck({})
    setSkillMultiCheck({})
    setEquipMultiCheck({})
  }

  function closeModal() { setModal(null) }

  function saveName() {
    const name = editName.trim() || 'Chiến binh'
    const updated = { ...modal, name }
    onUpdate(modal.id, updated)
    setModal(updated)
  }

  function doDelete() {
    onDelete(modal.id)
    setSelected(prev => prev.filter(x => x !== modal.id))
    closeModal()
  }

  function doRerollOne(stat) {
    onReroll(modal, [stat])
    closeModal()
  }

  function doRerollMulti() {
    const stats = Object.keys(multiCheck).filter(k => multiCheck[k])
    if (!stats.length) return
    onReroll(modal, stats)
    closeModal()
  }

  function doRerollEquipCount() {
    onRerollEquipCount(modal)
    closeModal()
  }

  function doRerollEquipOne(index) {
    onRerollEquip(modal, [index])
    closeModal()
  }

  function doRerollEquipMulti() {
    const indices = Object.keys(equipMultiCheck).filter(k => equipMultiCheck[k]).map(Number)
    if (!indices.length) return
    onRerollEquip(modal, indices)
    closeModal()
  }

  function doRerollSkillCount() {
    onRerollSkillCount(modal)
    closeModal()
  }

  function doRerollSkillOne(index) {
    onRerollSkill(modal, [index])
    closeModal()
  }

  function doRerollSkillMulti() {
    const indices = Object.keys(skillMultiCheck).filter(k => skillMultiCheck[k]).map(Number)
    if (!indices.length) return
    onRerollSkill(modal, indices)
    closeModal()
  }

  const readySelected = selected.filter(id => {
    const c = chars.find(x => x.id === id)
    return c && isComplete(c)
  })

  return (
    <div className={styles.screen}>
      {cropSrc && (
        <AvatarCropper
          imageSrc={cropSrc}
          onConfirm={confirmCrop}
          onCancel={() => setCropSrc(null)}
        />
      )}
      {/* Char Modal */}
      {modal && (
        <div className={styles.overlay} onClick={closeModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>{modal.name || 'Vô danh'}</div>

            {modalView === 'menu' && (
              <>
                <div className={styles.nameRow}>
                  <input
                    className={styles.nameInput}
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Tên nhân vật..."
                  />
                  <button className={styles.saveNameBtn} onClick={saveName}>Lưu</button>
                </div>
                <div
                  className={styles.avatarEdit}
                  onClick={() => avatarFileRef.current.click()}
                  onPaste={pasteAvatar}
                  tabIndex={0}
                >
                  {modal.avatar
                    ? <img src={modal.avatar} className={styles.avatarEditImg} alt="avatar" />
                    : <div className={styles.avatarEditPlaceholder}>
                        <span style={{fontSize:20}}>📷</span>
                        <span>Bấm hoặc dán ảnh</span>
                      </div>
                  }
                </div>
                <input ref={avatarFileRef} type="file" accept="image/*" style={{display:'none'}} onChange={uploadAvatar} />
                {modal.avatar && (
                  <button className={`${styles.modalBtn} ${styles.cancel}`} onClick={removeAvatar}>🗑 Xóa ảnh đại diện</button>
                )}
                <button className={styles.modalBtn} onClick={() => setModalView('reroll-menu')}>🎲 Quay lại chỉ số</button>
                {'equipCount' in modal && modal.equipCount != null && (
                  <button className={styles.modalBtn} onClick={() => setModalView('reroll-equip-menu')}>🛡️ Quay lại trang bị</button>
                )}
                {!('equipCount' in modal) && (
                  <button className={styles.modalBtn} onClick={doRerollEquipCount}>🛡️ Roll trang bị</button>
                )}
                {'skillCount' in modal && modal.skillCount != null && (
                  <button className={styles.modalBtn} onClick={() => setModalView('reroll-skill-menu')}>✨ Quay lại kỹ năng</button>
                )}
                {!('skillCount' in modal) && (
                  <button className={styles.modalBtn} onClick={doRerollSkillCount}>🎰 Roll kỹ năng</button>
                )}
                <button className={`${styles.modalBtn} ${styles.danger}`} onClick={doDelete}>🗑 Xóa nhân vật</button>
                <button className={`${styles.modalBtn} ${styles.cancel}`} onClick={closeModal}>Đóng</button>
              </>
            )}

            {modalView === 'reroll-menu' && (
              <>
                <div className={styles.modalSub}>Chọn kiểu quay lại:</div>
                <button className={styles.modalBtn} onClick={() => setModalView('reroll-one')}>Quay lại 1 chỉ số</button>
                <button className={styles.modalBtn} onClick={() => setModalView('reroll-multi')}>Quay lại nhiều chỉ số</button>
                <button className={`${styles.modalBtn} ${styles.cancel}`} onClick={() => setModalView('menu')}>← Quay lại</button>
              </>
            )}

            {modalView === 'reroll-equip-menu' && (
              <>
                <div className={styles.modalSub}>Chọn kiểu quay lại:</div>
                <button className={styles.modalBtn} onClick={doRerollEquipCount}>🎲 Quay lại số lượng trang bị</button>
                <button className={styles.modalBtn} onClick={() => setModalView('reroll-equip-pick')}>🛡️ Quay lại trang bị cụ thể</button>
                <button className={`${styles.modalBtn} ${styles.cancel}`} onClick={() => setModalView('menu')}>← Quay lại</button>
              </>
            )}

            {modalView === 'reroll-equip-pick' && (
              <>
                <div className={styles.modalSub}>Chọn trang bị để quay lại:</div>
                {(modal.equipment || []).map((equipId, i) => {
                  const equip = EQUIPMENT[equipId]
                  return (
                    <label key={i} className={styles.checkRow} style={{ color: equip.color, marginBottom: 4 }}>
                      <input
                        type="checkbox"
                        checked={!!equipMultiCheck[i]}
                        onChange={e => setEquipMultiCheck(prev => ({ ...prev, [i]: e.target.checked }))}
                      />
                      {equip.name}
                    </label>
                  )
                })}
                {(modal.equipment || []).length < modal.equipCount && (
                  <div className={styles.modalSub} style={{ marginTop: 4 }}>
                    (Nhân vật đang quay dở, còn {modal.equipCount - (modal.equipment || []).length} trang bị chưa quay)
                  </div>
                )}
                <button className={styles.modalBtn} onClick={doRerollEquipMulti} style={{ marginTop: 8 }}>✅ Xác nhận quay lại</button>
                <button className={`${styles.modalBtn} ${styles.cancel}`} onClick={() => setModalView('reroll-equip-menu')}>← Quay lại</button>
              </>
            )}

            {modalView === 'reroll-skill-menu' && (
              <>
                <div className={styles.modalSub}>Chọn kiểu quay lại:</div>
                <button className={styles.modalBtn} onClick={doRerollSkillCount}>🎲 Quay lại số lượng kỹ năng</button>
                <button className={styles.modalBtn} onClick={() => setModalView('reroll-skill-pick')}>✨ Quay lại kỹ năng cụ thể</button>
                <button className={`${styles.modalBtn} ${styles.cancel}`} onClick={() => setModalView('menu')}>← Quay lại</button>
              </>
            )}

            {modalView === 'reroll-skill-pick' && (
              <>
                <div className={styles.modalSub}>Chọn kỹ năng để quay lại:</div>
                {(modal.skills || []).map((skillId, i) => {
                  const skill = SKILLS[skillId]
                  return (
                    <label key={i} className={styles.checkRow} style={{ color: skill.color, marginBottom: 4 }}>
                      <input
                        type="checkbox"
                        checked={!!skillMultiCheck[i]}
                        onChange={e => setSkillMultiCheck(prev => ({ ...prev, [i]: e.target.checked }))}
                      />
                      {skill.name}
                    </label>
                  )
                })}
                {(modal.skills || []).length < modal.skillCount && (
                  <div className={styles.modalSub} style={{ marginTop: 4 }}>
                    (Nhân vật đang quay dở, còn {modal.skillCount - (modal.skills || []).length} kỹ năng chưa quay)
                  </div>
                )}
                <button className={styles.modalBtn} onClick={doRerollSkillMulti} style={{ marginTop: 8 }}>✅ Xác nhận quay lại</button>
                <button className={`${styles.modalBtn} ${styles.cancel}`} onClick={() => setModalView('reroll-skill-menu')}>← Quay lại</button>
              </>
            )}

            {modalView === 'reroll-one' && (
              <>
                <div className={styles.modalSub}>Chọn chỉ số:</div>
                {modal.class && CLASSES[modal.class] && (() => {
                  const cls = CLASSES[modal.class]
                  const key = cls.classStatKey
                  const unit = key === 'dodge' ? '%' : key === 'castTime' ? 's' : '/s'
                  return (
                    <button className={styles.modalBtn} style={{ borderColor: cls.color }} onClick={() => doRerollOne(key)}>
                      {cls.name} ({key})
                      <span className={styles.curVal}>({modal.stats[key] != null ? modal.stats[key] + unit : '?'})</span>
                    </button>
                  )
                })()}
                {STAT_ORDER.map(s => (
                  <button key={s} className={styles.modalBtn} onClick={() => doRerollOne(s)}>
                    {STAT_ICONS[s]} {STAT_LABELS[s]}
                    <span className={styles.curVal}>
                      ({modal.stats[s] != null ? ((s === 'def' || s === 'crit') ? modal.stats[s] + '%' : modal.stats[s]) : '?'})
                    </span>
                  </button>
                ))}
                <button className={`${styles.modalBtn} ${styles.cancel}`} onClick={() => setModalView('reroll-menu')}>← Quay lại</button>
              </>
            )}

            {modalView === 'reroll-multi' && (
              <>
                <div className={styles.modalSub}>Tích chọn các chỉ số:</div>
                <div className={styles.checkList}>
                  {modal.class && CLASSES[modal.class] && (() => {
                    const cls = CLASSES[modal.class]
                    const key = cls.classStatKey
                    return (
                      <label className={styles.checkRow} style={{ color: cls.color }}>
                        <input
                          type="checkbox"
                          checked={!!multiCheck[key]}
                          onChange={e => setMultiCheck(prev => ({ ...prev, [key]: e.target.checked }))}
                        />
                        {cls.name} ({key})
                      </label>
                    )
                  })()}
                  {STAT_ORDER.map(s => (
                    <label key={s} className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={!!multiCheck[s]}
                        onChange={e => setMultiCheck(prev => ({ ...prev, [s]: e.target.checked }))}
                      />
                      {STAT_ICONS[s]} {STAT_LABELS[s]}
                    </label>
                  ))}
                </div>
                <button className={styles.modalBtn} onClick={doRerollMulti}>✅ Xác nhận</button>
                <button className={`${styles.modalBtn} ${styles.cancel}`} onClick={() => setModalView('reroll-menu')}>← Quay lại</button>
              </>
            )}
          </div>
        </div>
      )}

      <div className={styles.topbar}>
        <button className={styles.backBtn} onClick={onBack}>← Trang chủ</button>
        <div className={styles.title}>Danh sách chiến binh</div>
        <button
          className={styles.randomBtn}
          onClick={randomPick}
          disabled={randomizing || chars.filter(isComplete).length < 3}
          title="Random 2 nhân vật"
        >
          🎲
        </button>
        <button className={styles.newBtn} onClick={onGoSpin}>+ Tạo</button>
      </div>

      {chars.length === 0 ? (
        <div className={styles.empty}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚔️</div>
          <div>Chưa có chiến binh nào. Hãy tạo nhân vật đầu tiên!</div>
        </div>
      ) : (
        <div className={styles.grid}>
          {chars.map(c => {
            const complete = isComplete(c)
            const isSelected = selected.includes(c.id)
            const selIdx = selected.indexOf(c.id)
            const isFlashing = flashIds.includes(c.id)
            return (
              <div
                key={c.id}
                className={[styles.card, isSelected ? styles.selectedCard : '', isFlashing ? styles.flashCard : ''].join(' ')}
                onClick={() => toggleSelect(c.id)}
              >
                <div className={styles.cardAvatar}>
                  {c.avatar
                    ? <img src={c.avatar} className={styles.avatarImg} alt="" />
                    : <div className={styles.avatarFallback} style={{ background: c.color }} />
                  }
                  {isSelected && <div className={styles.selBadge}>{selIdx + 1}</div>}
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardName}>
                    {c.name || 'Vô danh'}
                    {c.class && CLASSES[c.class] && (
                      <span className={styles.classBadge} style={{ color: CLASSES[c.class].color }}>
                        {CLASSES[c.class].name}
                      </span>
                    )}
                    {!complete && <span className={styles.incompleteBadge}>chưa xong</span>}
                  </div>
                  <div className={styles.cardStats}>
                    {STAT_ORDER.map(s => (
                      <div key={s} className={styles.cs}>
                        {STAT_LABELS[s].slice(0, 3)}: <span>{c.stats[s] != null ? ((s === 'def' || s === 'crit') ? c.stats[s] + '%' : c.stats[s]) : '?'}</span>
                      </div>
                    ))}
                  </div>
                  {c.equipment && c.equipment.length > 0 && (
                    <div className={styles.cardSkills}>
                      {c.equipment.map((equipId, i) => {
                        const equip = EQUIPMENT[equipId]
                        return (
                          <span key={i} className={styles.skillChip} style={{ color: equip.color, borderColor: equip.color }} title={equip.desc}>
                            {equip.name}
                          </span>
                        )
                      })}
                    </div>
                  )}
                  {c.skills && c.skills.length > 0 && (
                    <div className={styles.cardSkills}>
                      {c.skills.map((skillId, i) => {
                        const skill = SKILLS[skillId]
                        return (
                          <span key={i} className={styles.skillChip} style={{ color: skill.color, borderColor: skill.color }} title={skill.name}>
                            {skill.name}
                          </span>
                        )
                      })}
                      {c.grantedSkills && c.grantedSkills.map((skillId, i) => {
                        const skill = SKILLS[skillId]
                        return (
                          <span key={'g'+i} className={styles.skillChip} style={{ color: skill.color, borderColor: skill.color, opacity: 0.75 }} title={skill.name + ' (từ trang bị)'}>
                            {skill.name} ★
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className={styles.cardFooter} onClick={e => { e.stopPropagation(); openModal(c) }}>
                  ⚙ Tùy chỉnh
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className={styles.footer}>
        <div className={styles.hint}>
          {randomizing && '🎲 Đang random...'}
          {!randomizing && selected.length === 0 && 'Bấm vào nhân vật để chọn (cần 2 nhân vật)'}
          {!randomizing && selected.length === 1 && 'Chọn thêm 1 nhân vật nữa'}
          {!randomizing && selected.length === 2 && '⚔️ Sẵn sàng chiến đấu!'}
        </div>
        <button
          className={styles.fightBtn}
          disabled={readySelected.length !== 2}
          onClick={() => onFight(readySelected)}
        >
          ⚔️ Chiến đấu!
        </button>
      </div>
    </div>
  )
}