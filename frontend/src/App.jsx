import React, { useState, useEffect } from 'react'
import { useChars } from './hooks/useChars'
import HomeScreen from './components/HomeScreen'
import SpinScreen from './components/SpinScreen'
import ListScreen from './components/ListScreen'
import BattleScreen from './components/BattleScreen'
import { uid, randColor, EQUIPMENT } from './utils/constants'

function newSpinState() {
  return { id: uid(), name: '', color: randColor(), avatar: null, stats: {}, currentStatIdx: 0, class: null, equipCount: null, equipment: [], bonusSkillRoll: 0, grantedSkills: [], skillCount: null, skills: [] }
}

export default function App() {
  const { chars, loading, upsertChar, updateChar, deleteChar } = useChars()
  const [screen, setScreen] = useState('home')       // 'home' | 'spin' | 'list' | 'battle'
  const [battleIds, setBattleIds] = useState(null)   // [id1, id2]
  const [spinState, setSpinState] = useState(newSpinState)
  const [pendingSpin, setPendingSpin] = useState(null) // saved when pressing back mid-spin

  function goSpin() {
    if (pendingSpin) { setSpinState(pendingSpin); setPendingSpin(null) }
    setScreen('spin')
  }

  function spinBack() {
    // Save current spin progress if any stats rolled
    const hasProgress = !!spinState.class || Object.keys(spinState.stats).length > 0 || spinState.name
    if (hasProgress) setPendingSpin({ ...spinState })
    setScreen('home')
  }

  function onSpinSaved(savedChar) {
    upsertChar(savedChar)
    setSpinState(newSpinState())
  }

  function startBattle(ids) {
    setBattleIds(ids)
    setScreen('battle')
  }

  async function goReroll(char, stats) {
    const newStats = { ...char.stats }
    stats.forEach(s => delete newStats[s])
    const firstMissing = ['hp','atk','spd','def','crit'].findIndex(s => newStats[s] == null)
    const updated = { ...char, stats: newStats, pending: true }
    await updateChar(char.id, updated)
    setSpinState({ ...updated, currentStatIdx: Math.max(0, firstMissing), isReroll: true })
    setPendingSpin(null)
    setScreen('spin')
  }

  // Quay lại số lượng trang bị — reset cả equipCount lẫn equipment (đồng thời reset bonus/granted từ trang bị cũ)
  async function goRerollEquipCount(char) {
    const updated = { ...char, equipCount: null, equipment: [], bonusSkillRoll: 0, grantedSkills: [], pending: true }
    await updateChar(char.id, updated)
    setSpinState({ ...updated, isReroll: true })
    setPendingSpin(null)
    setScreen('spin')
  }

  // Quay lại 1 hoặc nhiều trang bị cụ thể theo index — giữ nguyên equipCount, chỉ xóa trang bị được chọn.
  // Vì mỗi trang bị có thể mang theo bonusSkillRoll/grantedSkills, phải tính lại toàn bộ 2 field này từ trang bị còn lại.
  async function goRerollEquip(char, indices) {
    const newEquipment = char.equipment.filter((_, i) => !indices.includes(i))
    let bonusSkillRoll = 0, grantedSkills = []
    newEquipment.forEach(id => {
      const eq = EQUIPMENT[id]
      if (!eq) return
      if (eq.extraSkillRoll) bonusSkillRoll += eq.extraSkillRoll
      if (eq.grantsSkill) grantedSkills.push(eq.grantsSkill)
    })
    const updated = { ...char, equipment: newEquipment, bonusSkillRoll, grantedSkills, pending: true }
    await updateChar(char.id, updated)
    setSpinState({ ...updated, isReroll: true })
    setPendingSpin(null)
    setScreen('spin')
  }

  // Quay lại số lượng kỹ năng — reset cả skillCount lẫn skills (vì skills phụ thuộc số lượng)
  async function goRerollSkillCount(char) {
    const updated = { ...char, skillCount: null, skills: [], pending: true }
    await updateChar(char.id, updated)
    setSpinState({ ...updated, isReroll: true })
    setPendingSpin(null)
    setScreen('spin')
  }

  // Quay lại 1 hoặc nhiều kỹ năng cụ thể theo index — giữ nguyên skillCount, chỉ xóa các skill được chọn
  async function goRerollSkill(char, indices) {
    const newSkills = char.skills.filter((_, i) => !indices.includes(i))
    const updated = { ...char, skills: newSkills, pending: true }
    await updateChar(char.id, updated)
    setSpinState({ ...updated, isReroll: true })
    setPendingSpin(null)
    setScreen('spin')
  }

  const battleC1 = screen === 'battle' && battleIds ? chars.find(c => c.id === battleIds[0]) : null
  const battleC2 = screen === 'battle' && battleIds ? chars.find(c => c.id === battleIds[1]) : null

  useEffect(() => {
    if (screen === 'battle' && battleIds && (!battleC1 || !battleC2)) {
      setScreen('list')
    }
  }, [screen, battleIds, battleC1, battleC2])

  if (loading) return <div style={{ color: 'var(--text2)', textAlign: 'center', padding: '4rem' }}>Đang tải...</div>

  return (
    <>
      {screen === 'home' && (
        <HomeScreen
          charCount={chars.length}
          hasPending={!!pendingSpin}
          onGoList={() => setScreen('list')}
          onGoSpin={goSpin}
        />
      )}
      {screen === 'spin' && (
        <SpinScreen
          spinState={spinState}
          setSpinState={setSpinState}
          onBack={spinBack}
          onSaved={onSpinSaved}
          onGoList={() => setScreen('list')}
          onNewChar={() => setSpinState(newSpinState())}
        />
      )}
      {screen === 'list' && (
        <ListScreen
          chars={chars}
          onBack={() => setScreen('home')}
          onGoSpin={goSpin}
          onDelete={deleteChar}
          onUpdate={updateChar}
          onReroll={goReroll}
          onRerollEquipCount={goRerollEquipCount}
          onRerollEquip={goRerollEquip}
          onRerollSkillCount={goRerollSkillCount}
          onRerollSkill={goRerollSkill}
          onFight={startBattle}
        />
      )}
      {screen === 'battle' && battleC1 && battleC2 && (
        <BattleScreen
          c1={battleC1}
          c2={battleC2}
          onGoList={() => setScreen('list')}
          onGoHome={() => setScreen('home')}
        />
      )}
    </>
  )
}
