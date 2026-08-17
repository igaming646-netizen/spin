import React, { useEffect, useRef, useState, useMemo } from 'react'
import { STAT_ORDER, STAT_LABELS, CLASSES, CLASS_STAT_LABELS, CLASS_STAT_ICONS, CLASS_STAT_RANGES, DEFAULT_CRIT_DAMAGE, SKILLS, EQUIPMENT, uid } from '../utils/constants'
import { api } from '../utils/api'
import styles from './BattleScreen.module.css'

const W = 900, H = 380, R = 26

// Tổng hợp mọi hiệu ứng trang bị của 1 nhân vật thành object phẳng để dùng xuyên suốt trận đấu.
// statBonus/statBonusPercent áp trực tiếp vào effectiveStats; các field khác (armorPierce, thorns...) cộng dồn riêng.
function computeEquipEffects(char) {
  const equipment = char.equipment || [];
  const eff = {
    statBonus: { hp: 0, atk: 0, spd: 0, def: 0, crit: 0 },
    statBonusPercent: { hp: 0, atk: 0, spd: 0, def: 0, crit: 0 },
    critDamageBonus: 0, armorPierce: 0, enemyDefShred: 0, dmgDealtBonus: 0,
    enemyVulnerable: 0, lifestealBonus: 0, dodgeBonus: 0, hpRegenFlat: 0, hpRegenPercent: 0,
    cdrBonus: 0, tenacity: 0, thorns: 0, hitboxReduce: 0, rangedDmgBonus: 0,
  };
  equipment.forEach(id => {
    const eq = EQUIPMENT[id];
    if (!eq) return;
    if (eq.statBonus) Object.keys(eq.statBonus).forEach(k => { eff.statBonus[k] = (eff.statBonus[k] || 0) + eq.statBonus[k]; });
    if (eq.statBonusPercent) Object.keys(eq.statBonusPercent).forEach(k => { eff.statBonusPercent[k] = (eff.statBonusPercent[k] || 0) + eq.statBonusPercent[k]; });
    ['critDamageBonus','armorPierce','enemyDefShred','dmgDealtBonus','enemyVulnerable','lifestealBonus','dodgeBonus','hpRegenFlat','hpRegenPercent','cdrBonus','tenacity','thorns','hitboxReduce','rangedDmgBonus']
      .forEach(k => { if (eq[k]) eff[k] += eq[k]; });
  });
  return eff;
}

// Áp statBonus/statBonusPercent vào 5 stat cơ bản, trả về bản sao stats đã cộng dồn (không đổi object gốc).
// Thứ tự: cộng flat trước, rồi nhân % dựa trên giá trị đã cộng flat.
function applyEquipStats(baseStats, equipEff) {
  const result = { ...baseStats };
  STAT_ORDER.forEach(s => {
    if (result[s] == null) return;
    const flat = equipEff.statBonus[s] || 0;
    const pct = equipEff.statBonusPercent[s] || 0;
    result[s] = Math.round((result[s] + flat) * (1 + pct / 100));
  });
  return result;
}

export default function BattleScreen({ c1: c1Raw, c2: c2Raw, onGoList, onGoHome }) {
  // Áp dụng equipment vào stats ngay từ đầu — mọi nơi trong component dùng c1/c2 đã cộng dồn, không phải bản gốc.
  const equipEff1 = useMemo(() => computeEquipEffects(c1Raw), [c1Raw])
  const equipEff2 = useMemo(() => computeEquipEffects(c2Raw), [c2Raw])
  const c1 = useMemo(() => ({
    ...c1Raw,
    stats: applyEquipStats(c1Raw.stats, equipEff1),
    skills: [...(c1Raw.skills || []), ...(c1Raw.grantedSkills || [])], // gộp skill roll thủ công + skill từ trang bị
  }), [c1Raw, equipEff1])
  const c2 = useMemo(() => ({
    ...c2Raw,
    stats: applyEquipStats(c2Raw.stats, equipEff2),
    skills: [...(c2Raw.skills || []), ...(c2Raw.grantedSkills || [])],
  }), [c2Raw, equipEff2])

  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const rafRef = useRef(null)
  const imgCache = useRef({})
  const [hp1, setHp1] = useState(c1.stats.hp)
  const [hp2, setHp2] = useState(c2.stats.hp)
  const [logs, setLogs] = useState(['⚔️ Trận chiến bắt đầu!'])
  const [winner, setWinner] = useState(null)
  const [showLog, setShowLog] = useState(false)
  const allLogsRef = useRef(['⚔️ Trận chiến bắt đầu!'])

  useEffect(() => {
    const spd1 = c1.stats.spd, spd2 = c2.stats.spd
    const base = 3.2
    const s1 = base * (spd1 / 6), s2 = base * (spd2 / 6)

    const cls1 = c1.class ? CLASSES[c1.class] : null
    const cls2 = c2.class ? CLASSES[c2.class] : null

    function randDir(speed) {
      const a = Math.random() * Math.PI * 2
      return { x: Math.cos(a) * speed, y: Math.sin(a) * speed }
    }

    const now0 = Date.now()

    // ── Skill slot offset: kỹ năng roll trước kích hoạt trước, mỗi kỹ năng lệch 0.1s ──
    // Slot 0 = classStat timer riêng (đã có sẵn), slot 1..N = skills[0..N-1]
    const skills1 = c1.skills || []
    const skills2 = c2.skills || []
    const skillTimers1 = {}
    const skillTimers2 = {}
    skills1.forEach((skillId, i) => { skillTimers1[skillId] = { last: now0 + (i + 1) * 100, triggered: {} } })
    skills2.forEach((skillId, i) => { skillTimers2[skillId] = { last: now0 + (i + 1) * 100, triggered: {} } })

    // Crit rate tràn 100% sẽ chuyển hóa thành crit damage (1% tràn = 2% critDmg)
    const critOverflow1 = Math.max(0, c1.stats.crit - 100)
    const critOverflow2 = Math.max(0, c2.stats.crit - 100)
    const effectiveCritRate1 = Math.min(100, c1.stats.crit)
    const effectiveCritRate2 = Math.min(100, c2.stats.crit)
    const effectiveCritDmg1 = DEFAULT_CRIT_DAMAGE + (equipEff1.critDamageBonus || 0) + critOverflow1 * 2
    const effectiveCritDmg2 = DEFAULT_CRIT_DAMAGE + (equipEff2.critDamageBonus || 0) + critOverflow2 * 2

    const d1 = randDir(s1), d2 = randDir(s2)
    stateRef.current = {
      x1: 60, y1: H / 2, dx1: d1.x, dy1: d1.y,
      x2: W - 60, y2: H / 2, dx2: d2.x, dy2: d2.y,
      hp1: c1.stats.hp, hp2: c2.stats.hp,
      cooldown: 0, hits: [], magicHits: [], arrowHits: [], critHits: [], healGlows: [], dodgeBlurs: [], s1, s2, spd1, spd2,
      // Caster cast timer
      lastCast1: Date.now(), lastCast2: Date.now(),
      // Paladin regen timer (mỗi 4.5 giây hồi 1 lần)
      lastRegen1: Date.now(), lastRegen2: Date.now(),
      // Archer salvo timer (mỗi 3 giây bắn 1 loạt)
      lastSalvo1: Date.now(), lastSalvo2: Date.now(),
      // Saber dash timer + animation
      lastDash1: Date.now(), lastDash2: Date.now(),
      dash1: null, dash2: null, // { fromX, fromY, toX, toY, startT, slashT }
      slashes: [], // { x, y, angle, t }
      // Tanker shield timer (mỗi 7 giây nhận 1 lớp khiên)
      lastShield1: Date.now(), lastShield2: Date.now(),
      hasShield1: false, hasShield2: false,
      shieldGlows: [], shieldBreaks: [],
      // ── Skill system ─────────────────────────────────────────
      skillTimers1, skillTimers2,
      // Debuff permanent từ trang bị: enemyDefShred/enemyVulnerable của bên này áp lên bên kia ngay từ đầu trận.
      // Dùng type riêng 'equipDefShred'/'equipVulnerable' để calcDmgTo đọc, và để Cleanse xóa được (không lẫn với def buff của chính mình).
      buffs1: equipEff2.enemyDefShred || equipEff2.enemyVulnerable
        ? [
            ...(equipEff2.enemyDefShred ? [{ type: 'equipDefShred', value: equipEff2.enemyDefShred, expiresAt: 999999999999 }] : []),
            ...(equipEff2.enemyVulnerable ? [{ type: 'equipVulnerable', value: equipEff2.enemyVulnerable, expiresAt: 999999999999 }] : []),
          ]
        : [],
      buffs2: equipEff1.enemyDefShred || equipEff1.enemyVulnerable
        ? [
            ...(equipEff1.enemyDefShred ? [{ type: 'equipDefShred', value: equipEff1.enemyDefShred, expiresAt: 999999999999 }] : []),
            ...(equipEff1.enemyVulnerable ? [{ type: 'equipVulnerable', value: equipEff1.enemyVulnerable, expiresAt: 999999999999 }] : []),
          ]
        : [],
      // { type, value, expiresAt } — cộng dồn theo type
      dots1: [], dots2: [],     // { type, dmgPerTick, nextTick, expiresAt, color }
      missCount1: 0, missCount2: 0, // Blind: số đòn tiếp theo sẽ trượt
      reviveUsed1: false, reviveUsed2: false,
      devastatingUsed1: false, devastatingUsed2: false,
      collisionCount1: 0, collisionCount2: 0, // Heal: đếm va chạm
      slashStacks1: [], slashStacks2: [], // { expiresAt } tối đa 2
      skillFx: [], // { type, x, y, t } hiệu ứng chung cho skill
      lastEquipRegen1: now0, lastEquipRegen2: now0, // Trang bị: hồi máu mỗi giây
    }

    function addLog(msg) {
      allLogsRef.current = [msg, ...allLogsRef.current]
      setLogs([...allLogsRef.current])
    }

    function calcDmgTo(attacker, defender, attStats, defStats, attackerCurHp, st, attackerIsC1, isRanged = false) {
      const spdBonus = Math.max(0, attStats.spd - defStats.spd) * 5
      let dmg = attStats.atk + spdBonus

      // Berserker: càng mất máu càng mạnh. Bậc đầu kích hoạt dưới 95% HP, mỗi 10% mất thêm 1 bậc, max ở 5% HP
      if (attacker.class === 'berserker' && attackerCurHp != null) {
        const hpPct = (attackerCurHp / attStats.hp) * 100
        if (hpPct < 95) {
          const steps = Math.min(9, Math.floor((95 - hpPct) / 10) + 1)
          dmg *= (1 + (attStats.rage * steps) / 100)
        }
      }

      // Buff ATK% từ skill (Fury, Berserker skill, Devastating End, Blessing, Revive...)
      if (st && attackerIsC1 != null) {
        const atkBuff = getBuffTotal(st, attackerIsC1, 'atk')
        if (atkBuff > 0) dmg *= (1 + atkBuff / 100)
      }

      // Trang bị: tăng sát thương gây ra (dmgDealtBonus) — áp dụng sau ATK buff, trước crit
      const attackerEquipEff = attackerIsC1 ? equipEff1 : equipEff2
      const defenderEquipEff = attackerIsC1 ? equipEff2 : equipEff1
      if (attackerEquipEff.dmgDealtBonus) dmg *= (1 + attackerEquipEff.dmgDealtBonus / 100)
      // Trang bị: sát thương từ xa riêng, chỉ áp khi đòn này là ranged
      if (isRanged && attackerEquipEff.rangedDmgBonus) dmg *= (1 + attackerEquipEff.rangedDmgBonus / 100)

      // Chí mạng: dùng effective crit rate (đã cap 100%, phần tràn đã chuyển thành critDmg lúc khởi tạo trận)
      const critRate = attackerIsC1 ? effectiveCritRate1 : effectiveCritRate2
      const critDmg = attackerIsC1 ? effectiveCritDmg1 : effectiveCritDmg2
      const isCrit = Math.random() * 100 < critRate
      if (isCrit) dmg *= (1 + critDmg / 100)

      // Def hiệu dụng của defender: trừ đi debuff giảm def từ Slash (mỗi tầng -50%, tối đa 2 tầng) + trang bị enemyDefShred permanent
      let effectiveDef = defStats.def
      if (st) {
        const defenderIsC1 = !attackerIsC1
        const slashStacks = (defenderIsC1 ? st.slashStacks1 : st.slashStacks2).filter(s => s.expiresAt > Date.now()).length
        if (slashStacks > 0) effectiveDef = effectiveDef * (1 - Math.min(1, slashStacks * 0.5))
      }
      // Trang bị: giảm def địch vĩnh viễn (debuff, bị Cleanse xóa — xử lý trong applyCleanseShred)
      const defShredActive = st ? getBuffTotal(st, !attackerIsC1, 'equipDefShred') : 0
      if (defShredActive > 0) effectiveDef = effectiveDef * (1 - Math.min(1, defShredActive / 100))
      // Trang bị: xuyên giáp của attacker — bỏ qua thêm % def còn lại của defender
      if (attackerEquipEff.armorPierce) effectiveDef = effectiveDef * (1 - Math.min(1, attackerEquipEff.armorPierce / 100))

      // Buff DEF% (Rage, Cleanse) áp dụng cho defender
      if (st) {
        const defenderIsC1 = !attackerIsC1
        const defBuff = getBuffTotal(st, defenderIsC1, 'def')
        if (defBuff > 0) effectiveDef = Math.min(95, effectiveDef + defBuff)
      }

      let finalDmg = dmg * (1 - effectiveDef / 100)

      // Trang bị: trọng thương (permanent debuff lên defender, bị Cleanse xóa) — tăng % sát thương phải chịu
      const vulnerableActive = st ? getBuffTotal(st, !attackerIsC1, 'equipVulnerable') : 0
      if (vulnerableActive > 0) finalDmg *= (1 + vulnerableActive / 100)

      return { dmg: Math.round(finalDmg), isCrit }
    }

    // Sinh N particle với góc/tốc độ/kích thước ngẫu nhiên, dùng chung cho mọi hiệu ứng có mảnh vỡ/hạt bay
    function seedParticles(count, minSpeed, maxSpeed, sizeMin = 2, sizeMax = 5) {
      return Array.from({ length: count }, () => ({
        angle: Math.random() * Math.PI * 2,
        speed: minSpeed + Math.random() * (maxSpeed - minSpeed),
        size: sizeMin + Math.random() * (sizeMax - sizeMin),
      }))
    }

    function checkWinner(st) {
      // Revive: lần đầu HP về 0, nếu có skill này thì hồi sinh thay vì thua
      if (st.hp1 <= 0 && !st.reviveUsed1 && (c1.skills || []).includes('revive')) {
        st.reviveUsed1 = true
        st.hp1 = Math.round(c1.stats.hp * 0.7)
        setHp1(st.hp1)
        addBuff(st, true, 'atk', 100, 999999999)
        addLog(`✨ ${c1.name} Hồi sinh! Hồi 70% máu, +100% ATK vĩnh viễn`)
        st.skillFx.push({ type: 'revive', x: st.x1, y: st.y1, t: Date.now(), particles: seedParticles(16, 60, 130) })
      }
      if (st.hp2 <= 0 && !st.reviveUsed2 && (c2.skills || []).includes('revive')) {
        st.reviveUsed2 = true
        st.hp2 = Math.round(c2.stats.hp * 0.7)
        setHp2(st.hp2)
        addBuff(st, false, 'atk', 100, 999999999)
        addLog(`✨ ${c2.name} Hồi sinh! Hồi 70% máu, +100% ATK vĩnh viễn`)
        st.skillFx.push({ type: 'revive', x: st.x2, y: st.y2, t: Date.now(), particles: seedParticles(16, 60, 130) })
      }
      if (st.hp1 <= 0 || st.hp2 <= 0) {
        const w = st.hp1 <= 0 && st.hp2 <= 0 ? 'draw' : st.hp1 <= 0 ? c2.id : c1.id
        st.winner = w
        setWinner(w)
        api.saveBattle({ id: uid(), char1_id: c1.id, char2_id: c2.id, winner_id: w === 'draw' ? null : w, logs: allLogsRef.current })
        return true
      }
      return false
    }

    // Áp dụng phản sát thương nếu nạn nhân là Tanker đang có khiên (dùng chung cho mọi nguồn damage)
    function applyReflectIfShielded(st, victimIsC1, dmgAmount) {
      const victim = victimIsC1 ? c1 : c2
      const attacker = victimIsC1 ? c2 : c1
      const victimCls = victimIsC1 ? cls1 : cls2
      const hasShield = victimIsC1 ? st.hasShield1 : st.hasShield2
      if (victimCls?.id !== 'tanker' || !hasShield || dmgAmount <= 0) return

      if (victimIsC1) st.hasShield1 = false
      else st.hasShield2 = false

      const reflectDmg = Math.round(dmgAmount * (victim.stats.reflectPct / 100))
      if (victimIsC1) st.hp2 = Math.max(0, st.hp2 - reflectDmg)
      else st.hp1 = Math.max(0, st.hp1 - reflectDmg)

      addLog(`🔰 ${victim.name} phản lại ${reflectDmg} sát thương chuẩn cho ${attacker.name} (khiên vỡ)`)
      const vx = victimIsC1 ? st.x1 : st.x2
      const vy = victimIsC1 ? st.y1 : st.y2
      st.shieldBreaks = st.shieldBreaks || []
      st.shieldBreaks.push({ x: vx, y: vy, t: Date.now() })
    }

    // Trừ HP nạn nhân rồi áp phản sát thương nếu đủ điều kiện. Trả về HP mới của nạn nhân.
    function applyDamage(st, victimIsC1, dmgAmount, attackerIsC1 = null) {
      if (victimIsC1) st.hp1 = Math.max(0, st.hp1 - dmgAmount)
      else st.hp2 = Math.max(0, st.hp2 - dmgAmount)
      applyReflectIfShielded(st, victimIsC1, dmgAmount)
      applyThorns(st, victimIsC1, dmgAmount)
      if (attackerIsC1 != null) applyLifesteal(st, attackerIsC1, dmgAmount)
      checkAssassinExecute(st, victimIsC1)
      return victimIsC1 ? st.hp1 : st.hp2
    }

    // Trang bị Thorns: phản % sát thương chuẩn cho kẻ tấn công, vô hạn lần (khác cơ chế 1-lần/7s của Tanker shield)
    function applyThorns(st, victimIsC1, dmgAmount) {
      if (dmgAmount <= 0) return
      const victimEquipEff = victimIsC1 ? equipEff1 : equipEff2
      if (!victimEquipEff.thorns) return
      const reflectDmg = Math.round(dmgAmount * (victimEquipEff.thorns / 100))
      if (reflectDmg <= 0) return
      if (victimIsC1) st.hp2 = Math.max(0, st.hp2 - reflectDmg)
      else st.hp1 = Math.max(0, st.hp1 - reflectDmg)
    }

    // Hấp huyết: gộp skill Lifesteal (15% cố định) + trang bị lifestealBonus, hồi máu cho attacker theo dmg đã gây ra
    function applyLifesteal(st, attackerIsC1, dmgDealt) {
      if (dmgDealt <= 0) return
      const attacker = attackerIsC1 ? c1 : c2
      const attackerEquipEff = attackerIsC1 ? equipEff1 : equipEff2
      let pct = 0
      if ((attacker.skills || []).includes('lifesteal')) pct += 15
      if (attackerEquipEff.lifestealBonus) pct += attackerEquipEff.lifestealBonus
      if (pct <= 0) return
      const healAmt = Math.round(dmgDealt * (pct / 100))
      if (attackerIsC1) st.hp1 = Math.min(c1.stats.hp, st.hp1 + healAmt)
      else st.hp2 = Math.min(c2.stats.hp, st.hp2 + healAmt)
    }

    // Assassin: kết liễu nếu nạn nhân rơi xuống dưới ngưỡng % HP sau BẤT KỲ nguồn sát thương nào
    // (va chạm, cast, salvo, dash, DoT...) miễn kẻ tấn công tương ứng có class Assassin.
    function checkAssassinExecute(st, victimIsC1) {
      const victim = victimIsC1 ? c1 : c2
      const attacker = victimIsC1 ? c2 : c1
      const attackerCls = victimIsC1 ? cls2 : cls1
      const victimHp = victimIsC1 ? st.hp1 : st.hp2
      if (attackerCls?.id !== 'assassin' || victimHp <= 0) return
      const pct = (victimHp / victim.stats.hp) * 100
      if (pct < attacker.stats.execThreshold) {
        if (victimIsC1) { st.hp1 = 0; setHp1(0) } else { st.hp2 = 0; setHp2(0) }
        addLog(`💀 ${attacker.name} kết liễu ${victim.name}! (máu dưới ${attacker.stats.execThreshold}%)`)
      }
    }

    // ── Buff/Debuff system (cộng dồn theo type, mỗi buff tự hết hạn độc lập) ──
    function addBuff(st, isC1, type, value, durationMs) {
      const arr = isC1 ? st.buffs1 : st.buffs2
      arr.push({ type, value, expiresAt: Date.now() + durationMs })
    }
    function getBuffTotal(st, isC1, type) {
      const arr = isC1 ? st.buffs1 : st.buffs2
      const now = Date.now()
      return arr.filter(b => b.type === type && b.expiresAt > now).reduce((sum, b) => sum + b.value, 0)
    }
    function cleanExpiredBuffs(st) {
      const now = Date.now()
      st.buffs1 = st.buffs1.filter(b => b.expiresAt > now)
      st.buffs2 = st.buffs2.filter(b => b.expiresAt > now)
    }

    // ── DoT system (nhiều nguồn cùng lúc, mỗi nguồn tick riêng theo giây) ──
    function addDot(st, isC1, type, dmgPerTick, durationMs, color) {
      const arr = isC1 ? st.dots1 : st.dots2
      const victimEquipEff = isC1 ? equipEff1 : equipEff2
      const effectiveDuration = durationMs * (1 - Math.min(0.8, (victimEquipEff.tenacity || 0) / 100))
      arr.push({ type, dmgPerTick, nextTick: Date.now() + 1000, expiresAt: Date.now() + effectiveDuration, color })
    }
    function hasDot(st, isC1, type) {
      const arr = isC1 ? st.dots1 : st.dots2
      return arr.some(d => d.type === type && d.expiresAt > Date.now())
    }
    function clearAllDots(st, isC1) {
      const equipDebuffTypes = ['equipDefShred', 'equipVulnerable']
      if (isC1) {
        st.dots1 = []; st.slashStacks1 = []
        st.buffs1 = st.buffs1.filter(b => !equipDebuffTypes.includes(b.type) && b.type !== 'frozen')
        st.missCount1 = 0
      } else {
        st.dots2 = []; st.slashStacks2 = []
        st.buffs2 = st.buffs2.filter(b => !equipDebuffTypes.includes(b.type) && b.type !== 'frozen')
        st.missCount2 = 0
      }
    }
    function tickDots(st, isC1, victim, victimName) {
      const arr = isC1 ? st.dots1 : st.dots2
      const now = Date.now()
      let totalTick = 0
      arr.forEach(d => {
        if (now >= d.nextTick && d.expiresAt > now) {
          totalTick += d.dmgPerTick
          d.nextTick += 1000
        }
      })
      if (totalTick > 0) {
        applyDamage(st, isC1, totalTick)
        if (isC1) setHp1(st.hp1); else setHp2(st.hp2)
        addLog(`${victimName} nhận ${totalTick} sát thương từ hiệu ứng`)
        if (checkWinner(st)) return true
      }
      if (isC1) st.dots1 = arr.filter(d => d.expiresAt > now)
      else st.dots2 = arr.filter(d => d.expiresAt > now)
      return false
    }

    // Miss chance từ Blind — trả về true nếu đòn này bị trượt (và trừ 1 lượt miss)
    function checkMiss(st, attackerIsC1) {
      const key = attackerIsC1 ? 'missCount1' : 'missCount2'
      if (st[key] > 0) { st[key]--; return true }
      return false
    }

    const REGEN_INTERVAL = 4500
    const SALVO_INTERVAL = 3000
    const DASH_INTERVAL = 4500
    const DASH_DURATION = 250
    const SHIELD_INTERVAL = 7000

    function loop() {
      const st = stateRef.current
      if (!st || st.winner) return
      if (st.cooldown > 0) st.cooldown--

      const now = Date.now()

      // ── Paladin: hồi phục mỗi 4.5 giây (% máu tối đa) ───────
      if (cls1?.id === 'paladin' && st.hp1 > 0 && st.hp1 < c1.stats.hp && now - st.lastRegen1 >= REGEN_INTERVAL) {
        st.lastRegen1 = now
        const before = st.hp1
        const healAmount = Math.round(c1.stats.hp * (c1.stats.regen / 100))
        st.hp1 = Math.min(c1.stats.hp, st.hp1 + healAmount)
        setHp1(st.hp1)
        addLog(`💚 ${c1.name} hồi ${st.hp1 - before} máu`)
        st.healGlows.push({ id: 1, t: now })
      }
      if (cls2?.id === 'paladin' && st.hp2 > 0 && st.hp2 < c2.stats.hp && now - st.lastRegen2 >= REGEN_INTERVAL) {
        st.lastRegen2 = now
        const before = st.hp2
        const healAmount = Math.round(c2.stats.hp * (c2.stats.regen / 100))
        st.hp2 = Math.min(c2.stats.hp, st.hp2 + healAmount)
        setHp2(st.hp2)
        addLog(`💚 ${c2.name} hồi ${st.hp2 - before} máu`)
        st.healGlows.push({ id: 2, t: now })
      }

      // ── Tanker: nhận khiên mỗi 7 giây (không cộng dồn) ──────
      if (cls1?.id === 'tanker' && st.hp1 > 0 && !st.hasShield1 && now - st.lastShield1 >= SHIELD_INTERVAL) {
        st.lastShield1 = now
        st.hasShield1 = true
        addLog(`🔰 ${c1.name} nhận khiên phản sát thương`)
        st.shieldGlows.push({ id: 1, t: now })
      }
      if (cls2?.id === 'tanker' && st.hp2 > 0 && !st.hasShield2 && now - st.lastShield2 >= SHIELD_INTERVAL) {
        st.lastShield2 = now
        st.hasShield2 = true
        addLog(`🔰 ${c2.name} nhận khiên phản sát thương`)
        st.shieldGlows.push({ id: 2, t: now })
      }

      // ══════════════════════════════════════════════════════════
      // SKILL SYSTEM — 15 kỹ năng dùng chung, xử lý cho cả 2 bên
      // ══════════════════════════════════════════════════════════
      function processSkills(isC1) {
        const self = isC1 ? c1 : c2
        const enemy = isC1 ? c2 : c1
        const skills = self.skills || []
        if (!skills.length) return
        let selfHp = isC1 ? st.hp1 : st.hp2
        let enemyHp = isC1 ? st.hp2 : st.hp1
        if (selfHp <= 0 || enemyHp <= 0) return
        const timers = isC1 ? st.skillTimers1 : st.skillTimers2
        const selfX = isC1 ? st.x1 : st.x2, selfY = isC1 ? st.y1 : st.y2
        const enemyX = isC1 ? st.x2 : st.x1, enemyY = isC1 ? st.y2 : st.y1
        const blessingActive = getBuffTotal(st, isC1, 'cdrActive') > 0
        const selfEquipEff = isC1 ? equipEff1 : equipEff2

        for (const skillId of skills) {
          const timer = timers[skillId]
          if (!timer) continue

          if (skillId === 'heal') {
            // Xử lý riêng ở block va chạm (đếm collision), không theo timer thời gian
            continue
          }

          if (skillId === 'revive') {
            // Passive — xử lý trong checkWinner override, không theo timer ở đây
            continue
          }

          if (skillId === 'berserkerSkill') {
            // Passive vĩnh viễn — áp buff 1 lần khi bắt đầu trận nếu chưa có
            if (!timer.applied) {
              timer.applied = true
              addBuff(st, isC1, 'atk', 200, 999999999)
              if (isC1) { st.s1 *= 3; st.dx1 *= 3; st.dy1 *= 3 }
              else { st.s2 *= 3; st.dx2 *= 3; st.dy2 *= 3 }
              addLog(`🐺 ${self.name} kích hoạt Cuồng dã (vĩnh viễn +200% ATK/SPD)`)
            }
            continue
          }

          if (skillId === 'devastatingEnd') {
            // Reactive theo HP — xử lý riêng dưới đây, không theo timer chu kỳ
            continue
          }

          if (skillId === 'cleanse') {
            const interval = 5000
            if (now - timer.last >= interval) {
              timer.last = now
              const hasDotsNow = (isC1 ? st.dots1 : st.dots2).length > 0
              const hasFrozenNow = getBuffTotal(st, isC1, 'frozen') > 0
              const hasBlindNow = (isC1 ? st.missCount1 : st.missCount2) > 0
              const hasSlashNow = (isC1 ? st.slashStacks1 : st.slashStacks2).filter(s => s.expiresAt > now).length > 0
              const hadAnyDebuff = hasDotsNow || hasFrozenNow || hasBlindNow || hasSlashNow
              clearAllDots(st, isC1)
              addBuff(st, isC1, 'def', 30, 3000)
              if (hadAnyDebuff) addLog(`🧼 ${self.name} thanh tẩy debuff, tăng 30% phòng thủ`)
              st.skillFx.push({ type: 'cleanse', x: selfX, y: selfY, t: now })
            }
            continue
          }

          // Các skill còn lại đều theo chu kỳ cố định — tính cooldown (rút ngắn nếu có Chúc phúc)
          const baseInterval = {
            fireball: 9000, toxic: 6000, freeze: 9000, blind: 12000,
            rage: 9000, slash: 9000, fury: 6000, burst: 9000,
            blessing: 15000, explosive: 2000,
          }[skillId]
          if (baseInterval == null) continue
          const cdrMult = (skillId !== 'blessing' && blessingActive ? 0.5 : 1) * (1 - Math.min(0.8, (selfEquipEff.cdrBonus || 0) / 100))
          const interval = baseInterval * cdrMult
          if (now - timer.last < interval) continue
          timer.last = now

          if (skillId === 'lifesteal') continue // passive, xử lý trong applyDamage wrapper riêng

          if (skillId === 'blessing') {
            addBuff(st, isC1, 'atk', 30, 15000)
            addBuff(st, isC1, 'cdrActive', 1, 15000)
            addLog(`🙏 ${self.name} nhận Chúc phúc (+30% ATK, giảm 50% hồi chiêu kỹ năng)`)
            st.skillFx.push({ type: 'blessing', x: selfX, y: selfY, t: now })
            continue
          }

          if (skillId === 'fury') {
            addBuff(st, isC1, 'atk', 50, 4000)
            addLog(`💢 ${self.name} kích hoạt Thịnh nộ (+50% ATK trong 4s)`)
            st.skillFx.push({ type: 'fury', x: selfX, y: selfY, t: now })
            continue
          }

          if (skillId === 'rage') {
            addBuff(st, isC1, 'def', 30, 9999999)
            timer.rageArmed = true // đợi đòn tiếp theo từ địch để gán thiêu đốt
            addLog(`😡 ${self.name} kích hoạt Giận dữ (+30% phòng thủ)`)
            st.skillFx.push({ type: 'rage', x: selfX, y: selfY, t: now })
            continue
          }

          if (skillId === 'slash') {
            timer.slashArmed = true // đòn tiếp theo sẽ giảm def địch
            addLog(`🌀 ${self.name} cường hóa Quét cạnh cho đòn tiếp theo`)
            continue
          }

          if (skillId === 'burst') {
            timer.burstArmed = true
            addLog(`💥 ${self.name} cường hóa Đòn cường hóa cho đòn tiếp theo`)
            continue
          }

          // ── Damage-dealing skills (fireball/toxic/freeze/blind/explosive) ──
          const { dmg, isCrit } = calcDmgTo(self, enemy, self.stats, enemy.stats, selfHp, st, isC1)

          if (skillId === 'fireball') {
            const fbDmg = Math.round(dmg * 1.25)
            applyDamage(st, !isC1, fbDmg, isC1)
            if (isC1) setHp2(st.hp2); else setHp1(st.hp1)
            addDot(st, !isC1, 'burn', Math.round(fbDmg * 0.5), 4000, '#e67e22')
            addLog(`🔥 ${self.name} tung Hỏa cầu gây ${fbDmg} sát thương lên ${enemy.name}, thiêu đốt 4s${isCrit ? ' 💥' : ''}`)
            st.skillFx.push({ type: 'fireball', fromX: selfX, fromY: selfY, toX: enemyX, toY: enemyY, t: now, particles: seedParticles(10, 50, 100, 1.5, 4) })
            if (checkWinner(st)) return
          }
          else if (skillId === 'toxic') {
            addDot(st, !isC1, 'poison', Math.round(dmg * 0.4), 4000, '#27ae60')
            addLog(`☠️ ${self.name} gây Độc lên ${enemy.name} (4s)`)
            st.skillFx.push({ type: 'toxic', x: enemyX, y: enemyY, t: now })
          }
          else if (skillId === 'freeze') {
            applyDamage(st, !isC1, dmg, isC1)
            if (isC1) setHp2(st.hp2); else setHp1(st.hp1)
            const victimEquipEff = isC1 ? equipEff2 : equipEff1
            const freezeDuration = 3000 * (1 - Math.min(0.8, (victimEquipEff.tenacity || 0) / 100))
            addBuff(st, !isC1, 'frozen', 1, freezeDuration)
            timer.freezeVictimHp = isC1 ? 'hp2' : 'hp1'
            timer.freezeExpiresAt = now + freezeDuration
            timer.freezeBonusUsed = false
            addLog(`❄️ ${self.name} đóng băng ${enemy.name} (${dmg} sát thương, bất động ${(freezeDuration/1000).toFixed(1)}s)${isCrit ? ' 💥' : ''}`)
            st.skillFx.push({ type: 'freeze', x: enemyX, y: enemyY, t: now, particles: seedParticles(8, 30, 70, 1.5, 3.5) })
            if (checkWinner(st)) return
          }
          else if (skillId === 'blind') {
            const blindDmg = Math.round(dmg * 2.65)
            applyDamage(st, !isC1, blindDmg, isC1)
            if (isC1) setHp2(st.hp2); else setHp1(st.hp1)
            if (isC1) st.missCount2 = 2; else st.missCount1 = 2
            addLog(`🌫️ ${self.name} gây ${blindDmg} sát thương và làm mù ${enemy.name} (2 đòn tới sẽ trượt)${isCrit ? ' 💥' : ''}`)
            st.skillFx.push({ type: 'blind', x: enemyX, y: enemyY, t: now })
            if (checkWinner(st)) return
          }
          else if (skillId === 'explosive') {
            applyDamage(st, !isC1, dmg, isC1)
            if (isC1) setHp2(st.hp2); else setHp1(st.hp1)
            addLog(`💣 ${self.name} kích nổ gây ${dmg} sát thương lên ${enemy.name}${isCrit ? ' 💥' : ''}`)
            st.skillFx.push({ type: 'explosive', x: enemyX, y: enemyY, t: now, particles: seedParticles(14, 40, 110, 2, 5.5) })
            if (checkWinner(st)) return
          }
        }
      }
      processSkills(true)
      processSkills(false)
      cleanExpiredBuffs(st)

      // ── Devastating End: lần đầu xuống dưới 50% máu ─────────
      function checkDevastating(isC1) {
        const self = isC1 ? c1 : c2
        const skills = self.skills || []
        if (!skills.includes('devastatingEnd')) return
        const usedKey = isC1 ? 'devastatingUsed1' : 'devastatingUsed2'
        if (st[usedKey]) return
        const hp = isC1 ? st.hp1 : st.hp2
        const pct = (hp / self.stats.hp) * 100
        if (pct < 50 && hp > 0) {
          st[usedKey] = true
          const dots = (isC1 ? st.dots1 : st.dots2).length
          const debuffBonus = dots * 50
          addBuff(st, isC1, 'atk', 300 + debuffBonus, 999999999)
          if (isC1) { st.s1 *= 2; st.dx1 *= 2; st.dy1 *= 2 }
          else { st.s2 *= 2; st.dx2 *= 2; st.dy2 *= 2 }
          addLog(`⚡ ${self.name} kích hoạt Ngưỡng! (+${300 + debuffBonus}% ATK, +100% SPD vĩnh viễn)`)
          st.skillFx.push({ type: 'devastating', x: isC1 ? st.x1 : st.x2, y: isC1 ? st.y1 : st.y2, t: now, particles: seedParticles(20, 80, 180, 2, 4.5) })
        }
      }
      checkDevastating(true)
      checkDevastating(false)

      // ── Freeze bất động + phá băng ────────────────────────────
      function checkFrozen(isC1) {
        return getBuffTotal(st, isC1, 'frozen') > 0
      }

      // ── DoT ticks (poison/burn/rage-burn) mỗi giây ────────────
      // Trang bị: hồi máu mỗi giây (flat + %, cộng dồn, độc lập với Paladin regen 4.5s)
      if (now - st.lastEquipRegen1 >= 1000 && st.hp1 > 0) {
        st.lastEquipRegen1 += 1000
        const healAmt = Math.round((equipEff1.hpRegenFlat || 0) + c1.stats.hp * ((equipEff1.hpRegenPercent || 0) / 100))
        if (healAmt > 0) { st.hp1 = Math.min(c1.stats.hp, st.hp1 + healAmt); setHp1(st.hp1) }
      }
      if (now - st.lastEquipRegen2 >= 1000 && st.hp2 > 0) {
        st.lastEquipRegen2 += 1000
        const healAmt = Math.round((equipEff2.hpRegenFlat || 0) + c2.stats.hp * ((equipEff2.hpRegenPercent || 0) / 100))
        if (healAmt > 0) { st.hp2 = Math.min(c2.stats.hp, st.hp2 + healAmt); setHp2(st.hp2) }
      }

      if (tickDots(st, true, c1, c1.name)) { draw(); return }
      if (tickDots(st, false, c2, c2.name)) { draw(); return }

      // ── Caster: cast phép theo timer ─────────────────────────
      if (cls1?.id === 'caster' && st.hp1 > 0 && st.hp2 > 0) {
        const castInterval = c1.stats.castTime * 1000
        if (now - st.lastCast1 >= castInterval) {
          st.lastCast1 = now
          const { dmg, isCrit } = calcDmgTo(c1, c2, c1.stats, c2.stats, st.hp1, st, true)
          applyDamage(st, false, dmg, true)
          setHp1(st.hp1); setHp2(st.hp2)
          st.magicHits.push({ x: st.x2, y: st.y2, t: now, color: '#9b59b6' })
          addLog(`🔮 ${c1.name} tung phép gây ${dmg} sát thương lên ${c2.name}${isCrit ? ' 💥 CHÍ MẠNG!' : ''}`)
          if (checkWinner(st)) { draw(); return }
        }
      }
      if (cls2?.id === 'caster' && st.hp2 > 0 && st.hp1 > 0) {
        const castInterval = c2.stats.castTime * 1000
        if (now - st.lastCast2 >= castInterval) {
          st.lastCast2 = now
          const { dmg, isCrit } = calcDmgTo(c2, c1, c2.stats, c1.stats, st.hp2, st, false)
          applyDamage(st, true, dmg, false)
          setHp1(st.hp1); setHp2(st.hp2)
          st.magicHits.push({ x: st.x1, y: st.y1, t: now, color: '#9b59b6' })
          addLog(`🔮 ${c2.name} tung phép gây ${dmg} sát thương lên ${c1.name}${isCrit ? ' 💥 CHÍ MẠNG!' : ''}`)
          if (checkWinner(st)) { draw(); return }
        }
      }

      // ── Archer: bắn loạt tên mỗi 3 giây ─────────────────────
      if (cls1?.id === 'archer' && st.hp1 > 0 && st.hp2 > 0 && now - st.lastSalvo1 >= SALVO_INTERVAL) {
        st.lastSalvo1 = now
        const count = c1.stats.arrowCount
        let total = 0
        let critCount = 0
        for (let i = 0; i < count; i++) {
          const { dmg, isCrit } = calcDmgTo(c1, c2, c1.stats, c2.stats, st.hp1, st, true)
          const arrowDmg = Math.round(dmg * 0.25)
          total += arrowDmg
          if (isCrit) critCount++
          st.arrowHits.push({ fromX: st.x1, fromY: st.y1, toX: st.x2, toY: st.y2, t: now + i * 35, color: c1.color, isCrit })
        }
        applyDamage(st, false, total, true)
        setHp1(st.hp1); setHp2(st.hp2)
        addLog(`🏹 ${c1.name} bắn ${count} mũi tên, tổng ${total} sát thương lên ${c2.name}${critCount > 0 ? ` (${critCount} 💥 chí mạng)` : ''}`)
        if (checkWinner(st)) { draw(); return }
      }
      if (cls2?.id === 'archer' && st.hp2 > 0 && st.hp1 > 0 && now - st.lastSalvo2 >= SALVO_INTERVAL) {
        st.lastSalvo2 = now
        const count = c2.stats.arrowCount
        let total = 0
        let critCount = 0
        for (let i = 0; i < count; i++) {
          const { dmg, isCrit } = calcDmgTo(c2, c1, c2.stats, c1.stats, st.hp2, st, false)
          const arrowDmg = Math.round(dmg * 0.25)
          total += arrowDmg
          if (isCrit) critCount++
          st.arrowHits.push({ fromX: st.x2, fromY: st.y2, toX: st.x1, toY: st.y1, t: now + i * 35, color: c2.color, isCrit })
        }
        applyDamage(st, true, total, false)
        setHp1(st.hp1); setHp2(st.hp2)
        addLog(`🏹 ${c2.name} bắn ${count} mũi tên, tổng ${total} sát thương lên ${c1.name}${critCount > 0 ? ` (${critCount} 💥 chí mạng)` : ''}`)
        if (checkWinner(st)) { draw(); return }
      }

      // ── Saber: lao vào địch chém mỗi 4.5 giây ─────────────────
      const SLASH_DURATION = 400 // ms hiệu ứng chém

      // Advance dash animations
      if (st.dash1) {
        const progress = Math.min(1, (now - st.dash1.startT) / DASH_DURATION)
        st.x1 = st.dash1.fromX + (st.dash1.toX - st.dash1.fromX) * progress
        st.y1 = st.dash1.fromY + (st.dash1.toY - st.dash1.fromY) * progress
        // Clamp trong arena kể cả lúc đang dash
        st.x1 = Math.max(R, Math.min(W - R, st.x1))
        st.y1 = Math.max(R, Math.min(H - R, st.y1))
        if (progress >= 1 && !st.dash1.slashed) {
          st.dash1.slashed = true
          const { dmg: baseDmg, isCrit } = calcDmgTo(c1, c2, c1.stats, c2.stats, st.hp1, st, true)
          const dmg = Math.round(baseDmg * (c1.stats.dashMult / 100))
          applyDamage(st, false, dmg, true)
          setHp1(st.hp1); setHp2(st.hp2)
          const angle = Math.atan2(st.dash1.toY - st.dash1.fromY, st.dash1.toX - st.dash1.fromX)
          st.slashes.push({ x: st.x1, y: st.y1, angle, t: now, color: c1.color })
          addLog(`⚔️ ${c1.name} lao vào chém ${c2.name} gây ${dmg} sát thương!${isCrit ? ' 💥 CHÍ MẠNG!' : ''}`)
          const d = randDir(st.s1); st.dx1 = -d.x; st.dy1 = -d.y
          if (checkWinner(st)) { draw(); return }
        }
        if (now - st.dash1.startT > DASH_DURATION + 100) st.dash1 = null
      } else if (cls1?.id === 'saber' && st.hp1 > 0 && st.hp2 > 0 && now - st.lastDash1 >= DASH_INTERVAL) {
        st.lastDash1 = now
        const angle = Math.atan2(st.y2 - st.y1, st.x2 - st.x1)
        // Clamp toX/toY trong arena ngay khi tính
        const toX = Math.max(R, Math.min(W - R, st.x2 - Math.cos(angle) * (R * 2 + 4)))
        const toY = Math.max(R, Math.min(H - R, st.y2 - Math.sin(angle) * (R * 2 + 4)))
        st.dash1 = { fromX: st.x1, fromY: st.y1, toX, toY, startT: now, slashed: false }
      }

      if (st.dash2) {
        const progress = Math.min(1, (now - st.dash2.startT) / DASH_DURATION)
        st.x2 = st.dash2.fromX + (st.dash2.toX - st.dash2.fromX) * progress
        st.y2 = st.dash2.fromY + (st.dash2.toY - st.dash2.fromY) * progress
        // Clamp trong arena kể cả lúc đang dash
        st.x2 = Math.max(R, Math.min(W - R, st.x2))
        st.y2 = Math.max(R, Math.min(H - R, st.y2))
        if (progress >= 1 && !st.dash2.slashed) {
          st.dash2.slashed = true
          const { dmg: baseDmg, isCrit } = calcDmgTo(c2, c1, c2.stats, c1.stats, st.hp2, st, false)
          const dmg = Math.round(baseDmg * (c2.stats.dashMult / 100))
          applyDamage(st, true, dmg, false)
          setHp1(st.hp1); setHp2(st.hp2)
          const angle = Math.atan2(st.dash2.toY - st.dash2.fromY, st.dash2.toX - st.dash2.fromX)
          st.slashes.push({ x: st.x2, y: st.y2, angle, t: now, color: c2.color })
          addLog(`⚔️ ${c2.name} lao vào chém ${c1.name} gây ${dmg} sát thương!${isCrit ? ' 💥 CHÍ MẠNG!' : ''}`)
          const d = randDir(st.s2); st.dx2 = -d.x; st.dy2 = -d.y
          if (checkWinner(st)) { draw(); return }
        }
        if (now - st.dash2.startT > DASH_DURATION + 100) st.dash2 = null
      } else if (cls2?.id === 'saber' && st.hp2 > 0 && st.hp1 > 0 && now - st.lastDash2 >= DASH_INTERVAL) {
        st.lastDash2 = now
        const angle = Math.atan2(st.y1 - st.y2, st.x1 - st.x2)
        // Clamp toX/toY trong arena ngay khi tính
        const toX = Math.max(R, Math.min(W - R, st.x1 - Math.cos(angle) * (R * 2 + 4)))
        const toY = Math.max(R, Math.min(H - R, st.y1 - Math.sin(angle) * (R * 2 + 4)))
        st.dash2 = { fromX: st.x2, fromY: st.y2, toX, toY, startT: now, slashed: false }
      }

      // ── Movement (skip nếu đang dash hoặc bị đóng băng) ─────
      if (!st.dash1 && !checkFrozen(true)) { st.x1 += st.dx1; st.y1 += st.dy1 }
      if (!st.dash2 && !checkFrozen(false)) { st.x2 += st.dx2; st.y2 += st.dy2 }

      function bounce1(axis) {
        const d = randDir(st.s1)
        if (axis === 'x') { st.dx1 = Math.sign(st.dx1) * Math.abs(d.x) * -1; st.dy1 = d.y }
        else { st.dx1 = d.x; st.dy1 = Math.sign(st.dy1) * Math.abs(d.y) * -1 }
      }
      function bounce2(axis) {
        const d = randDir(st.s2)
        if (axis === 'x') { st.dx2 = Math.sign(st.dx2) * Math.abs(d.x) * -1; st.dy2 = d.y }
        else { st.dx2 = d.x; st.dy2 = Math.sign(st.dy2) * Math.abs(d.y) * -1 }
      }

      if (st.x1 <= R) { st.x1 = R; bounce1('x') }
      if (st.x1 >= W - R) { st.x1 = W - R; bounce1('x') }
      if (st.y1 <= R) { st.y1 = R; bounce1('y') }
      if (st.y1 >= H - R) { st.y1 = H - R; bounce1('y') }
      if (st.x2 <= R) { st.x2 = R; bounce2('x') }
      if (st.x2 >= W - R) { st.x2 = W - R; bounce2('x') }
      if (st.y2 <= R) { st.y2 = R; bounce2('y') }
      if (st.y2 >= H - R) { st.y2 = H - R; bounce2('y') }

      // ── Collision ──────────────────────────────────────────
      const dist = Math.hypot(st.x1 - st.x2, st.y1 - st.y2)
      const frozen1 = checkFrozen(true), frozen2 = checkFrozen(false)
      const collisionThreshold = (R - (equipEff1.hitboxReduce || 0) / 2) + (R - (equipEff2.hitboxReduce || 0) / 2)
      if (dist < collisionThreshold && st.cooldown === 0 && !st.dash1 && !st.dash2) {
        const overlap = R * 2 - dist
        const nx = (st.x2 - st.x1) / (dist || 1)
        const ny = (st.y2 - st.y1) / (dist || 1)
        st.x1 -= nx * (overlap / 2 + 1)
        st.y1 -= ny * (overlap / 2 + 1)
        st.x2 += nx * (overlap / 2 + 1)
        st.y2 += ny * (overlap / 2 + 1)

        const dvx = st.dx1 - st.dx2, dvy = st.dy1 - st.dy2
        const dot = dvx * nx + dvy * ny
        st.dx1 -= dot * nx; st.dy1 -= dot * ny
        st.dx2 += dot * nx; st.dy2 += dot * ny
        const m1 = Math.hypot(st.dx1, st.dy1) || 1
        const m2 = Math.hypot(st.dx2, st.dy2) || 1
        st.dx1 = (st.dx1 / m1) * st.s1; st.dy1 = (st.dy1 / m1) * st.s1
        st.dx2 = (st.dx2 / m2) * st.s2; st.dy2 = (st.dy2 / m2) * st.s2

        st.cooldown = 35
        st.hits = [{ x: (st.x1 + st.x2) / 2, y: (st.y1 + st.y2) / 2, t: now }]

        // Rider dodge check
        const dodge1 = (cls1?.id === 'rider' ? (c1.stats.dodge / 100) : 0) + (equipEff1.dodgeBonus || 0) / 100
        const dodge2 = (cls2?.id === 'rider' ? (c2.stats.dodge / 100) : 0) + (equipEff2.dodgeBonus || 0) / 100
        const dodged1 = Math.random() < dodge1
        const dodged2 = Math.random() < dodge2

        // Blind miss check — đè lên dodge (bị mù thì trượt trước khi tính né)
        const missed1 = !dodged1 && checkMiss(st, false) // c2 đánh c1, kiểm tra missCount1 (của attacker c2... thực ra check theo attacker)
        const missed2 = !dodged2 && checkMiss(st, true)

        let result1 = (dodged1 || missed1) ? { dmg: 0, isCrit: false } : calcDmgTo(c2, c1, c2.stats, c1.stats, st.hp2, st, false)
        let result2 = (dodged2 || missed2) ? { dmg: 0, isCrit: false } : calcDmgTo(c1, c2, c1.stats, c2.stats, st.hp1, st, true)

        // Slash: nếu người gây sát thương có slashArmed, áp debuff giảm def lên nạn nhân (tối đa 2 tầng, 5s)
        const timers1 = st.skillTimers1, timers2 = st.skillTimers2
        function consumeSlashArmed(attackerTimers, victimIsC1, dmgDealt) {
          if (dmgDealt <= 0) return
          for (const skillId in attackerTimers) {
            if (skillId === 'slash' && attackerTimers[skillId].slashArmed) {
              attackerTimers[skillId].slashArmed = false
              const arr = victimIsC1 ? st.slashStacks1 : st.slashStacks2
              const active = arr.filter(s => s.expiresAt > now)
              if (active.length < 2) active.push({ expiresAt: now + 5000 })
              if (victimIsC1) st.slashStacks1 = active; else st.slashStacks2 = active
              addLog(`🌀 Quét cạnh giảm 50% phòng thủ (${active.length} tầng)`)
            }
          }
        }
        // Burst: nếu attacker có burstArmed, đòn này x1.75 dmg + hồi máu 40% dmg gây ra
        function consumeBurstArmed(attackerTimers, attackerIsC1, result) {
          for (const skillId in attackerTimers) {
            if (skillId === 'burst' && attackerTimers[skillId].burstArmed) {
              attackerTimers[skillId].burstArmed = false
              const boosted = Math.round(result.dmg * 1.75)
              const healAmt = Math.round(boosted * 0.4)
              return { dmg: boosted, heal: healAmt, triggered: true }
            }
          }
          return { dmg: result.dmg, heal: 0, triggered: false }
        }

        const burst2to1 = consumeBurstArmed(timers2, false, result2) // c2 tấn công c1
        const burst1to2 = consumeBurstArmed(timers1, true, result1)  // c1 tấn công c2
        result2 = { ...result2, dmg: burst2to1.dmg }
        result1 = { ...result1, dmg: burst1to2.dmg }

        const dmgTo1 = result1.dmg, dmgTo2 = result2.dmg

        st.hp1 = Math.max(0, st.hp1 - dmgTo1)
        st.hp2 = Math.max(0, st.hp2 - dmgTo2)
        applyReflectIfShielded(st, true, dmgTo1)
        applyReflectIfShielded(st, false, dmgTo2)
        applyThorns(st, true, dmgTo1)
        applyThorns(st, false, dmgTo2)

        // Burst heal cho attacker
        if (burst2to1.triggered && burst2to1.heal > 0) st.hp2 = Math.min(c2.stats.hp, st.hp2 + burst2to1.heal)
        if (burst1to2.triggered && burst1to2.heal > 0) st.hp1 = Math.min(c1.stats.hp, st.hp1 + burst1to2.heal)

        // Lifesteal: attacker hồi 15% sát thương gây ra
        // Hấp huyết (skill + trang bị lifestealBonus) — dùng chung logic với mọi nguồn sát thương khác
        applyLifesteal(st, false, dmgTo1) // c2 tấn công c1
        applyLifesteal(st, true, dmgTo2)  // c1 tấn công c2

        // Slash debuff áp dụng
        consumeSlashArmed(timers2, true, dmgTo1)  // c2 đánh trúng c1
        consumeSlashArmed(timers1, false, dmgTo2) // c1 đánh trúng c2

        // Rage: đòn đầu tiên địch đánh trúng sau khi rage active sẽ bị gán thiêu đốt
        if (dmgTo1 > 0 && timers2.rage?.rageArmed) {
          timers2.rage.rageArmed = false
          addDot(st, true, 'rageBurn', Math.round(result2.dmg * 0.6), 6000, '#d35400')
          addLog(`😡 ${c2.name} thiêu đốt ${c1.name} (Giận dữ)`)
        }
        if (dmgTo2 > 0 && timers1.rage?.rageArmed) {
          timers1.rage.rageArmed = false
          addDot(st, false, 'rageBurn', Math.round(result1.dmg * 0.6), 6000, '#d35400')
          addLog(`😡 ${c1.name} thiêu đốt ${c2.name} (Giận dữ)`)
        }

        // Freeze phá băng: nếu nạn nhân đang đóng băng và bị gây sát thương → +70% sát thương, kết thúc đóng băng sớm
        if (frozen1 && dmgTo1 > 0) {
          const bonus = Math.round(dmgTo1 * 0.7)
          st.hp1 = Math.max(0, st.hp1 - bonus)
          st.buffs1 = st.buffs1.filter(b => b.type !== 'frozen')
          addLog(`❄️ Phá băng ${c1.name}! Gây thêm ${bonus} sát thương`)
        }
        if (frozen2 && dmgTo2 > 0) {
          const bonus = Math.round(dmgTo2 * 0.7)
          st.hp2 = Math.max(0, st.hp2 - bonus)
          st.buffs2 = st.buffs2.filter(b => b.type !== 'frozen')
          addLog(`❄️ Phá băng ${c2.name}! Gây thêm ${bonus} sát thương`)
        }

        setHp1(st.hp1); setHp2(st.hp2)

        // Heal: cứ 3 lần va chạm hồi 30% máu tối đa
        if ((c1.skills || []).includes('heal')) {
          st.collisionCount1++
          if (st.collisionCount1 % 3 === 0 && st.hp1 > 0) {
            const healAmt = Math.round(c1.stats.hp * 0.3)
            st.hp1 = Math.min(c1.stats.hp, st.hp1 + healAmt)
            setHp1(st.hp1)
            addLog(`💗 ${c1.name} hồi ${healAmt} máu (Hồi máu)`)
            st.healGlows.push({ id: 1, t: now })
          }
        }
        if ((c2.skills || []).includes('heal')) {
          st.collisionCount2++
          if (st.collisionCount2 % 3 === 0 && st.hp2 > 0) {
            const healAmt = Math.round(c2.stats.hp * 0.3)
            st.hp2 = Math.min(c2.stats.hp, st.hp2 + healAmt)
            setHp2(st.hp2)
            addLog(`💗 ${c2.name} hồi ${healAmt} máu (Hồi máu)`)
            st.healGlows.push({ id: 2, t: now })
          }
        }

        // Assassin: kết liễu nếu địch xuống dưới ngưỡng sau va chạm (dùng chung logic với mọi nguồn sát thương khác)
        checkAssassinExecute(st, true)
        checkAssassinExecute(st, false)

        if (dodged1) { addLog(`💨 ${c1.name} né tránh! Không nhận sát thương`); st.dodgeBlurs.push({ id: 1, t: now }) }
        else if (missed1) { addLog(`🌫️ ${c2.name} tấn công trượt (Mù)!`) }
        else {
          addLog(`${c1.name} nhận ${dmgTo1} sát thương${result1.isCrit ? ' 💥 CHÍ MẠNG!' : ''}${burst2to1.triggered ? ' (Đòn cường hóa!)' : ''}`)
          if (result1.isCrit) st.critHits.push({ x: st.x1, y: st.y1, t: now, big: cls2?.id === 'assassin' })
        }
        if (dodged2) { addLog(`💨 ${c2.name} né tránh! Không nhận sát thương`); st.dodgeBlurs.push({ id: 2, t: now }) }
        else if (missed2) { addLog(`🌫️ ${c1.name} tấn công trượt (Mù)!`) }
        else {
          addLog(`${c2.name} nhận ${dmgTo2} sát thương${result2.isCrit ? ' 💥 CHÍ MẠNG!' : ''}${burst1to2.triggered ? ' (Đòn cường hóa!)' : ''}`)
          if (result2.isCrit) st.critHits.push({ x: st.x2, y: st.y2, t: now, big: cls1?.id === 'assassin' })
        }

        if (checkWinner(st)) { draw(); return }
      }

      st.x1 = Math.max(R, Math.min(W - R, st.x1))
      st.y1 = Math.max(R, Math.min(H - R, st.y1))
      st.x2 = Math.max(R, Math.min(W - R, st.x2))
      st.y2 = Math.max(R, Math.min(H - R, st.y2))

      draw()
      rafRef.current = requestAnimationFrame(loop)
    }

    function draw() {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const st = stateRef.current
      ctx.clearRect(0, 0, W, H)

      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, W, H)

      ctx.strokeStyle = '#1e2a3a'; ctx.lineWidth = 1; ctx.setLineDash([4, 4])
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke()
      ctx.setLineDash([])

      const now = Date.now()
      // Collision flash
      st.hits = st.hits.filter(h => now - h.t < 500)
      st.hits.forEach(h => {
        const alpha = 1 - (now - h.t) / 500
        ctx.beginPath(); ctx.arc(h.x, h.y, 28, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,200,0,${alpha * 0.35})`; ctx.fill()
        ctx.strokeStyle = `rgba(243,156,18,${alpha})`; ctx.lineWidth = 2; ctx.stroke()
      })
      // Magic flash (Caster) — nổi bật hơn: double ring + rays
      st.magicHits = (st.magicHits || []).filter(h => now - h.t < 700)
      st.magicHits.forEach(h => {
        const alpha = 1 - (now - h.t) / 700
        const pulse = (now - h.t) / 700
        // Outer expanding ring
        ctx.beginPath(); ctx.arc(h.x, h.y, 20 + pulse * 30, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(190,120,255,${alpha * 0.8})`; ctx.lineWidth = 3; ctx.stroke()
        // Inner core flash
        ctx.beginPath(); ctx.arc(h.x, h.y, 34, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(155,89,182,${alpha * 0.5})`; ctx.fill()
        ctx.strokeStyle = `rgba(200,150,255,${alpha})`; ctx.lineWidth = 2.5; ctx.stroke()
        // Radiating rays
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + pulse * 2
          const rx = h.x + Math.cos(ang) * (14 + pulse * 22)
          const ry = h.y + Math.sin(ang) * (14 + pulse * 22)
          ctx.beginPath(); ctx.arc(rx, ry, 3 * (1 - pulse), 0, Math.PI * 2)
          ctx.fillStyle = `rgba(220,180,255,${alpha})`; ctx.fill()
        }
      })
      // Arrow trails (mũi tên bay từ archer sang địch)
      const ARROW_FLIGHT = 280
      st.arrowHits = (st.arrowHits || []).filter(h => now - h.t < ARROW_FLIGHT && now >= h.t)
      st.arrowHits.forEach(h => {
        const progress = (now - h.t) / ARROW_FLIGHT
        const ax = h.fromX + (h.toX - h.fromX) * progress
        const ay = h.fromY + (h.toY - h.fromY) * progress
        const angle = Math.atan2(h.toY - h.fromY, h.toX - h.fromX)
        ctx.save()
        ctx.translate(ax, ay)
        ctx.rotate(angle)
        if (h.isCrit) {
          ctx.shadowColor = '#ffd700'
          ctx.shadowBlur = 8
        }
        ctx.strokeStyle = h.isCrit ? '#ffd700' : h.color
        ctx.lineWidth = h.isCrit ? 3.5 : 2.5
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(8, 0); ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(8, 0); ctx.lineTo(3, -3); ctx.lineTo(3, 3); ctx.closePath()
        ctx.fillStyle = h.isCrit ? '#ffd700' : h.color; ctx.fill()
        ctx.restore()
      })

      // Crit burst (đặc biệt nổi bật cho Assassin)
      st.critHits = (st.critHits || []).filter(h => now - h.t < 450)
      st.critHits.forEach(h => {
        const alpha = 1 - (now - h.t) / 450
        const scale = h.big ? 1.6 : 1
        // Star burst rays
        const rays = h.big ? 8 : 5
        for (let i = 0; i < rays; i++) {
          const ang = (i / rays) * Math.PI * 2
          const len = (18 + (now - h.t) / 8) * scale
          ctx.save()
          ctx.translate(h.x, h.y)
          ctx.rotate(ang)
          ctx.strokeStyle = `rgba(255,215,0,${alpha})`
          ctx.lineWidth = h.big ? 3 : 2
          ctx.beginPath(); ctx.moveTo(6 * scale, 0); ctx.lineTo(len, 0); ctx.stroke()
          ctx.restore()
        }
        ctx.beginPath(); ctx.arc(h.x, h.y, (10 + (now - h.t) / 20) * scale, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255,215,0,${alpha * 0.9})`; ctx.lineWidth = 2; ctx.stroke()
        if (h.big) {
          ctx.font = 'bold 13px sans-serif'
          ctx.fillStyle = `rgba(255,215,0,${alpha})`
          ctx.textAlign = 'center'
          ctx.fillText('CRIT!', h.x, h.y - 32 - (now - h.t) / 12)
        }
      })

      // Heal glow (Tanker) — hào quang xanh lá quanh nhân vật
      st.healGlows = (st.healGlows || []).filter(h => now - h.t < 700)
      st.healGlows.forEach(h => {
        const alpha = 1 - (now - h.t) / 700
        const gx = h.id === 1 ? st.x1 : st.x2
        const gy = h.id === 1 ? st.y1 : st.y2
        const pulse = (now - h.t) / 700
        ctx.beginPath(); ctx.arc(gx, gy, R + 4 + pulse * 14, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(46,204,113,${alpha * 0.9})`; ctx.lineWidth = 3; ctx.stroke()
        ctx.beginPath(); ctx.arc(gx, gy, R + 2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(46,204,113,${alpha * 0.25})`; ctx.fill()
        // Rising sparkles
        for (let i = 0; i < 4; i++) {
          const sAng = (i / 4) * Math.PI * 2
          const sy = gy - pulse * 20 + Math.sin(sAng) * 4
          const sx = gx + Math.cos(sAng) * (R * 0.7)
          ctx.beginPath(); ctx.arc(sx, sy, 2.5 * (1 - pulse), 0, Math.PI * 2)
          ctx.fillStyle = `rgba(120,255,170,${alpha})`; ctx.fill()
        }
      })

      // Berserker aura — hào quang đỏ đậm dần theo mốc máu mất
      function drawBerserkerAura(cls, x, y, curHp, maxHp) {
        if (cls?.id !== 'berserker' || curHp <= 0) return
        const hpPct = (curHp / maxHp) * 100
        if (hpPct >= 95) return
        const steps = Math.min(9, Math.floor((95 - hpPct) / 10) + 1)
        const intensity = steps / 9 // 0..1
        const t = now / 250
        const flicker = 0.75 + Math.sin(t) * 0.25

        // Ring chính, dày hơn khi intensity cao
        ctx.beginPath(); ctx.arc(x, y, R + 3 + intensity * 5, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(192,57,43,${intensity * flicker * 0.9})`
        ctx.lineWidth = 2 + intensity * 3
        ctx.stroke()
        ctx.beginPath(); ctx.arc(x, y, R + 1, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(220,40,30,${intensity * flicker * 0.22})`
        ctx.fill()

        // Ring phụ bên ngoài khi intensity cao (>50%), tạo cảm giác năng lượng tràn ra
        if (intensity > 0.5) {
          const outerPulse = 0.6 + Math.sin(t * 1.7) * 0.4
          ctx.beginPath(); ctx.arc(x, y, R + 8 + intensity * 6 * outerPulse, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(255,90,50,${(intensity - 0.5) * 2 * outerPulse * 0.5})`
          ctx.lineWidth = 1.5
          ctx.stroke()
        }

        // Ember bay lên quanh nhân vật, mật độ tăng theo intensity
        const emberCount = Math.round(intensity * 5)
        for (let i = 0; i < emberCount; i++) {
          const seed = i * 137.5 // góc vàng để phân bố đều
          const emberT = (now / 600 + seed) % 1
          const ang = (seed % 360) * Math.PI / 180
          const ex = x + Math.cos(ang) * (R + 4)
          const ey = y + Math.sin(ang) * (R + 4) - emberT * 22
          const emberAlpha = (1 - emberT) * intensity
          ctx.beginPath(); ctx.arc(ex, ey, 1.8 * (1 - emberT * 0.5), 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,${140 - emberT * 60},60,${emberAlpha})`
          ctx.fill()
        }
      }
      drawBerserkerAura(cls1, st.x1, st.y1, st.hp1, c1.stats.hp)
      drawBerserkerAura(cls2, st.x2, st.y2, st.hp2, c2.stats.hp)

      // Dash trail
      function drawDashTrail(dash, color) {
        if (!dash) return
        const progress = Math.min(1, (now - dash.startT) / DASH_DURATION)
        if (progress <= 0) return
        const cx2 = dash.fromX + (dash.toX - dash.fromX) * progress
        const cy2 = dash.fromY + (dash.toY - dash.fromY) * progress
        const dashAngle = Math.atan2(dash.toY - dash.fromY, dash.toX - dash.fromX)

        // Motion blur trail (nhiều bóng mờ dần)
        const segments = 8
        for (let i = 0; i < segments; i++) {
          const t = i / segments
          const tx = dash.fromX + (cx2 - dash.fromX) * t
          const ty = dash.fromY + (cy2 - dash.fromY) * t
          const trailAlpha = (1 - t) * 0.45 * progress
          ctx.beginPath(); ctx.arc(tx, ty, R * (0.35 + t * 0.45), 0, Math.PI * 2)
          ctx.fillStyle = color + Math.floor(trailAlpha * 255).toString(16).padStart(2, '0')
          ctx.fill()
        }

        // Speed lines song song với hướng lao tới, cho cảm giác tốc độ cao
        for (let i = -1; i <= 1; i++) {
          const perpX = Math.cos(dashAngle + Math.PI / 2) * i * 10
          const perpY = Math.sin(dashAngle + Math.PI / 2) * i * 10
          const lineLen = 30 * progress
          ctx.beginPath()
          ctx.moveTo(cx2 - Math.cos(dashAngle) * lineLen + perpX, cy2 - Math.sin(dashAngle) * lineLen + perpY)
          ctx.lineTo(cx2 + perpX, cy2 + perpY)
          ctx.strokeStyle = color + Math.floor((1 - Math.abs(i) * 0.4) * 150 * progress).toString(16).padStart(2, '0')
          ctx.lineWidth = 2
          ctx.stroke()
        }

        // Impact flash khi dash gần hoàn thành (sắp/đã chạm đích)
        if (progress > 0.85) {
          const impactP = (progress - 0.85) / 0.15
          ctx.beginPath(); ctx.arc(cx2, cy2, R * 0.6 * impactP, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,255,255,${(1 - impactP) * 0.5})`
          ctx.fill()
        }
      }
      drawDashTrail(st.dash1, c1.color)
      drawDashTrail(st.dash2, c2.color)

      // ══════════════════════════════════════════════════════
      // SKILL VISUAL EFFECTS
      // ══════════════════════════════════════════════════════
      st.skillFx = (st.skillFx || []).filter(fx => {
        const life = { fireball: 750, toxic: 1000, freeze: 850, blind: 600, explosive: 750,
          cleanse: 700, blessing: 800, fury: 600, rage: 700, devastating: 1100, revive: 1000 }[fx.type] || 500
        return now - fx.t < life
      })

      st.skillFx.forEach(fx => {
        const life = { fireball: 750, toxic: 1000, freeze: 850, blind: 600, explosive: 750,
          cleanse: 700, blessing: 800, fury: 600, rage: 700, devastating: 1100, revive: 1000 }[fx.type] || 500
        const p = (now - fx.t) / life // 0..1 progress
        const alpha = 1 - p

        if (fx.type === 'fireball') {
          const tSec = (now - fx.t) / 1000
          const travelP = Math.min(1, p * 1.5) // đến đích ở 67% vòng đời
          const bx = fx.fromX + (fx.toX - fx.fromX) * travelP
          const by = fx.fromY + (fx.toY - fx.fromY) * travelP

          // Đuôi lửa để lại phía sau khi đang bay
          if (travelP < 1) {
            for (let i = 1; i <= 4; i++) {
              const trailP = Math.max(0, travelP - i * 0.05)
              const tx = fx.fromX + (fx.toX - fx.fromX) * trailP
              const ty = fx.fromY + (fx.toY - fx.fromY) * trailP
              ctx.beginPath(); ctx.arc(tx, ty, 9 - i * 1.4, 0, Math.PI * 2)
              ctx.fillStyle = `rgba(255,${140 - i * 15},30,${(1 - i * 0.22) * alpha})`
              ctx.fill()
            }
            const flicker = 0.85 + Math.sin(now / 35) * 0.15
            ctx.beginPath(); ctx.arc(bx, by, 12 * flicker, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(255,200,80,${Math.min(1, alpha * 1.6)})`
            ctx.fill()
            ctx.beginPath(); ctx.arc(bx, by, 19 * flicker, 0, Math.PI * 2)
            ctx.strokeStyle = `rgba(255,150,50,${alpha * 0.7})`
            ctx.lineWidth = 2.5
            ctx.stroke()
          } else {
            // Va chạm: bùng nổ + particle văng ra + shockwave 2 lớp
            const impactP = (p - 0.67) / 0.33
            const eased = 1 - Math.pow(1 - Math.min(1, impactP), 2)
            ;[{ maxR: 34, color: '255,180,60' }, { maxR: 24, color: '230,90,30' }].forEach((ring, i) => {
              ctx.beginPath(); ctx.arc(fx.toX, fx.toY, 8 + eased * ring.maxR, 0, Math.PI * 2)
              ctx.strokeStyle = `rgba(${ring.color},${(1 - eased) * alpha})`
              ctx.lineWidth = 3 - i
              ctx.stroke()
            })
            const GRAVITY = 70, DRAG = 2.5
            ;(fx.particles || []).forEach(pt => {
              const decel = Math.exp(-DRAG * tSec)
              const dist = (pt.speed / DRAG) * (1 - decel)
              const px = fx.toX + Math.cos(pt.angle) * dist
              const py = fx.toY + Math.sin(pt.angle) * dist + 0.5 * GRAVITY * tSec * tSec
              const pAlpha = Math.max(0, 1 - impactP * 1.4)
              if (pAlpha <= 0) return
              ctx.beginPath(); ctx.arc(px, py, pt.size * (1 - impactP * 0.4), 0, Math.PI * 2)
              ctx.fillStyle = `rgba(255,${170 - impactP * 90},40,${pAlpha})`
              ctx.fill()
            })
          }
        }
        else if (fx.type === 'toxic') {
          // Bong bóng độc nổi lên với dao động ngang tự nhiên hơn, kích thước lệch nhau
          for (let i = 0; i < 6; i++) {
            const bubbleP = (p * 1.8 + i * 0.16) % 1
            const wobble = Math.sin(i * 2.3 + now / 220) * (10 + i * 2)
            const bx = fx.x + wobble
            const by = fx.y - bubbleP * 34
            const bAlpha = (1 - bubbleP) * alpha
            ctx.beginPath(); ctx.arc(bx, by, (3 + (i % 3)) * (1 - bubbleP * 0.5), 0, Math.PI * 2)
            ctx.fillStyle = `rgba(46,204,113,${bAlpha * 0.85})`
            ctx.fill()
            ctx.beginPath(); ctx.arc(bx, by, (3 + (i % 3)) * (1 - bubbleP * 0.5) + 1.5, 0, Math.PI * 2)
            ctx.strokeStyle = `rgba(120,255,170,${bAlpha * 0.5})`
            ctx.lineWidth = 1
            ctx.stroke()
          }
          // Vũng độc dưới chân, dao động nhẹ theo thời gian còn hiệu lực
          const poolPulse = 0.85 + Math.sin(now / 180) * 0.15
          ctx.beginPath(); ctx.ellipse(fx.x, fx.y + R * 0.6, (R + 8) * poolPulse, (R * 0.4), 0, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(39,174,96,${alpha * 0.22})`
          ctx.fill()
          ctx.beginPath(); ctx.arc(fx.x, fx.y, R + 5, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(39,174,96,${alpha * 0.55})`
          ctx.lineWidth = 2
          ctx.stroke()
        }
        else if (fx.type === 'freeze') {
          const tSec = (now - fx.t) / 1000
          // Đóng băng nhanh: ring băng khép lại trong 20% đầu
          const freezeP = Math.min(1, p / 0.2)
          const freezeEase = 1 - Math.pow(1 - freezeP, 3)
          ctx.beginPath(); ctx.arc(fx.x, fx.y, R + 8 - freezeEase * 4, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(120,200,255,${alpha * 0.9})`
          ctx.lineWidth = 3
          ctx.stroke()
          // Tinh thể lớn bao quanh, dựng lên dần
          const spikes = 6
          for (let i = 0; i < spikes; i++) {
            const ang = (i / spikes) * Math.PI * 2
            const growP = Math.min(1, (p - i * 0.02) / 0.3)
            if (growP <= 0) continue
            const len = (R + 4) * growP
            const ix = fx.x + Math.cos(ang) * len
            const iy = fx.y + Math.sin(ang) * len
            ctx.save(); ctx.translate(ix, iy); ctx.rotate(ang)
            ctx.fillStyle = `rgba(170,225,255,${alpha * 0.95})`
            ctx.beginPath(); ctx.moveTo(-3.5, 0); ctx.lineTo(0, -11 * growP); ctx.lineTo(3.5, 0); ctx.lineTo(0, 3); ctx.closePath()
            ctx.fill()
            ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.6})`; ctx.lineWidth = 0.8; ctx.stroke()
            ctx.restore()
          }
          // Hạt tuyết bay lơ lửng quanh nạn nhân
          ;(fx.particles || []).forEach((pt, i) => {
            const floatY = Math.sin(tSec * 2 + i) * 5
            const px = fx.x + Math.cos(pt.angle + tSec * 0.5) * (R + 10)
            const py = fx.y + Math.sin(pt.angle + tSec * 0.5) * (R + 10) + floatY
            ctx.beginPath(); ctx.arc(px, py, pt.size, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(220,245,255,${alpha * 0.8})`
            ctx.fill()
          })
        }
        else if (fx.type === 'blind') {
          // Vụt sáng trắng ngắn khi gây mù (giật gân, tương phản với sương mù xám)
          if (p < 0.12) {
            ctx.beginPath(); ctx.arc(fx.x, fx.y, R + 15, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(255,255,255,${(1 - p / 0.12) * 0.5})`
            ctx.fill()
          }
          // Sương mù xoáy tròn tỏa ra
          for (let i = 0; i < 4; i++) {
            const ang = (i / 4) * Math.PI * 2 + p * 3 + now / 500
            const dist = R + 6 + p * 22
            const swirl = Math.sin(now / 200 + i) * 4
            ctx.beginPath()
            ctx.arc(fx.x + Math.cos(ang) * dist + swirl, fx.y + Math.sin(ang) * dist, 6 - p * 3, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(189,195,199,${alpha * 0.65})`
            ctx.fill()
          }
          ctx.beginPath(); ctx.arc(fx.x, fx.y, R + 3 + p * 16, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(149,165,166,${alpha * 0.3})`
          ctx.fill()
        }
        else if (fx.type === 'explosive') {
          const tSec = (now - fx.t) / 1000

          if (p < 0.15) {
            const flashA = (1 - p / 0.15)
            ctx.beginPath(); ctx.arc(fx.x, fx.y, 30 * (1 - flashA * 0.3), 0, Math.PI * 2)
            ctx.fillStyle = `rgba(255,255,255,${flashA * 0.9})`
            ctx.fill()
          }

          const rings = [
            { delay: 0,    color: '255,220,150', maxR: 55 },
            { delay: 0.08, color: '255,140,60',  maxR: 42 },
            { delay: 0.16, color: '192,57,43',   maxR: 32 },
          ]
          rings.forEach(ring => {
            const rp = Math.max(0, Math.min(1, (p - ring.delay) / (1 - ring.delay)))
            if (rp <= 0) return
            const eased = 1 - Math.pow(1 - rp, 3)
            const ringAlpha = (1 - rp) * alpha
            ctx.beginPath(); ctx.arc(fx.x, fx.y, 6 + eased * ring.maxR, 0, Math.PI * 2)
            ctx.strokeStyle = `rgba(${ring.color},${ringAlpha})`
            ctx.lineWidth = 3.5 * (1 - rp * 0.6)
            ctx.stroke()
          })

          const coreP = Math.min(1, p * 2.5)
          ctx.beginPath(); ctx.arc(fx.x, fx.y, 10 + coreP * 8, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,150,50,${Math.max(0, 0.5 - p * 0.6)})`
          ctx.fill()

          const GRAVITY = 90, DRAG = 2.2
          ;(fx.particles || []).forEach(pt => {
            const decel = Math.exp(-DRAG * tSec)
            const dist = (pt.speed / DRAG) * (1 - decel)
            const px = fx.x + Math.cos(pt.angle) * dist
            const py = fx.y + Math.sin(pt.angle) * dist + 0.5 * GRAVITY * tSec * tSec
            const particleAlpha = Math.max(0, 1 - p * 1.3)
            if (particleAlpha <= 0) return
            const flick = 0.7 + Math.sin(now / 30 + pt.angle * 10) * 0.3
            ctx.beginPath(); ctx.arc(px, py, pt.size * (1 - p * 0.5) * flick, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(255,${180 - p * 100},${40 - p * 40},${particleAlpha})`
            ctx.fill()
          })

          if (p > 0.5) {
            const smokeP = (p - 0.5) / 0.5
            ctx.beginPath(); ctx.arc(fx.x, fx.y - smokeP * 12, 14 + smokeP * 10, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(80,80,80,${(1 - smokeP) * 0.25})`
            ctx.fill()
          }
        }
        else if (fx.type === 'cleanse') {
          // Vòng sáng kép lan tỏa + hạt sáng bay lên xoắn ốc
          ctx.beginPath(); ctx.arc(fx.x, fx.y, R + 2 + p * 30, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(26,188,156,${(1 - p) * 0.9})`
          ctx.lineWidth = 2.5
          ctx.stroke()
          ctx.beginPath(); ctx.arc(fx.x, fx.y, R + 2 + Math.max(0, p - 0.2) * 30, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(150,255,230,${(1 - p) * 0.6})`
          ctx.lineWidth = 1.5
          ctx.stroke()
          for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2 + p * 4
            const dist = R * 0.5 + p * 24
            const px = fx.x + Math.cos(ang) * dist
            const py = fx.y + Math.sin(ang) * dist - p * 14
            ctx.beginPath(); ctx.arc(px, py, 2.5 * (1 - p), 0, Math.PI * 2)
            ctx.fillStyle = `rgba(200,255,240,${alpha})`
            ctx.fill()
          }
        }
        else if (fx.type === 'blessing') {
          // 4 tia sáng vàng rơi lệch nhau + hào quang nền tỏa nhẹ
          for (let i = 0; i < 4; i++) {
            const off = (i - 1.5) * 10
            const dropP = (p * 1.3 + i * 0.22) % 1
            const dropEase = dropP * dropP // ease-in, rơi nhanh dần
            const startY = fx.y - R - 26
            const endY = fx.y - R + 6
            ctx.beginPath()
            ctx.moveTo(fx.x + off, startY + (endY - startY) * dropEase)
            ctx.lineTo(fx.x + off, startY + (endY - startY) * dropEase + 12)
            const beamAlpha = Math.sin(dropP * Math.PI) // sáng nhất giữa hành trình
            ctx.strokeStyle = `rgba(255,240,180,${beamAlpha * 0.9})`
            ctx.lineWidth = 2.2
            ctx.stroke()
          }
          ctx.beginPath(); ctx.arc(fx.x, fx.y, R + 6 + Math.sin(now / 200) * 2, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(249,231,159,${alpha * 0.75})`
          ctx.lineWidth = 2
          ctx.stroke()
          ctx.beginPath(); ctx.arc(fx.x, fx.y, R + 3, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,245,200,${alpha * 0.15})`
          ctx.fill()
        }
        else if (fx.type === 'fury') {
          // Vòng lửa nhỏ nhấp nháy mạnh + tia lửa bắn ra ngẫu nhiên
          const pulse = 0.8 + Math.sin(now / 80) * 0.2
          ctx.beginPath(); ctx.arc(fx.x, fx.y, (R + 3) * pulse, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(231,76,60,${alpha * 0.9})`
          ctx.lineWidth = 2.5
          ctx.stroke()
          for (let i = 0; i < 3; i++) {
            const ang = (i / 3) * Math.PI * 2 + now / 150
            const dist = R + 6 + Math.sin(now / 60 + i * 2) * 6
            ctx.beginPath()
            ctx.arc(fx.x + Math.cos(ang) * dist, fx.y + Math.sin(ang) * dist, 2.2, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(255,140,60,${alpha * 0.85})`
            ctx.fill()
          }
        }
        else if (fx.type === 'rage') {
          // Hào quang cam đậm ổn định với nhịp đập chậm, khác Fury (rung nhanh)
          const breathe = 1 + Math.sin(now / 250) * 0.06
          ctx.beginPath(); ctx.arc(fx.x, fx.y, (R + 4) * breathe, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(211,84,0,${alpha * 0.85})`
          ctx.lineWidth = 3
          ctx.stroke()
          ctx.beginPath(); ctx.arc(fx.x, fx.y, (R + 4) * breathe + 5, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(230,120,30,${alpha * 0.35})`
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
        else if (fx.type === 'devastating') {
          const tSec = (now - fx.t) / 1000
          // Sóng xung kích 3 lớp ease-out mạnh, biên độ lớn hơn hẳn các skill khác
          const rings = [
            { delay: 0,    maxR: 70, color: '155,89,182' },
            { delay: 0.1,  maxR: 50, color: '190,130,220' },
            { delay: 0.2,  maxR: 34, color: '220,180,255' },
          ]
          rings.forEach(ring => {
            const rp = Math.max(0, Math.min(1, (p - ring.delay) / (1 - ring.delay)))
            if (rp <= 0) return
            const eased = 1 - Math.pow(1 - rp, 2.5)
            ctx.beginPath(); ctx.arc(fx.x, fx.y, R + eased * ring.maxR, 0, Math.PI * 2)
            ctx.strokeStyle = `rgba(${ring.color},${(1 - rp) * alpha})`
            ctx.lineWidth = 4 * (1 - rp * 0.5)
            ctx.stroke()
          })
          // Particle năng lượng bắn thẳng ra ngoài, nhanh và dứt khoát
          const DRAG = 1.6
          ;(fx.particles || []).forEach(pt => {
            const decel = Math.exp(-DRAG * tSec)
            const dist = (pt.speed / DRAG) * (1 - decel)
            const px = fx.x + Math.cos(pt.angle) * dist
            const py = fx.y + Math.sin(pt.angle) * dist
            const pAlpha = Math.max(0, 1 - p * 1.2)
            if (pAlpha <= 0) return
            ctx.save(); ctx.translate(px, py); ctx.rotate(pt.angle)
            ctx.fillStyle = `rgba(200,150,255,${pAlpha})`
            ctx.beginPath(); ctx.ellipse(0, 0, pt.size * 1.8, pt.size * 0.6, 0, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
          })
        }
        else if (fx.type === 'revive') {
          const tSec = (now - fx.t) / 1000
          // Bùng sáng vàng mạnh mẽ: flash trắng-vàng đầu, sau đó tia sáng bắn ra + ring kép
          if (p < 0.2) {
            const flashA = 1 - p / 0.2
            ctx.beginPath(); ctx.arc(fx.x, fx.y, R + 20, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(255,245,200,${flashA * 0.7})`
            ctx.fill()
          }
          ;[R + 40, R + 25].forEach((maxR, i) => {
            const rp = Math.min(1, p * (1 + i * 0.3))
            const eased = 1 - Math.pow(1 - rp, 3)
            ctx.beginPath(); ctx.arc(fx.x, fx.y, R + eased * (maxR - R), 0, Math.PI * 2)
            ctx.strokeStyle = `rgba(241,196,15,${(1 - rp) * alpha})`
            ctx.lineWidth = 3 - i
            ctx.stroke()
          })
          const DRAG = 1.4
          ;(fx.particles || []).forEach(pt => {
            const decel = Math.exp(-DRAG * tSec)
            const dist = (pt.speed / DRAG) * (1 - decel)
            const px = fx.x + Math.cos(pt.angle) * dist
            const py = fx.y + Math.sin(pt.angle) * dist
            const pAlpha = Math.max(0, 1 - p * 1.1)
            if (pAlpha <= 0) return
            const flick = 0.7 + Math.sin(now / 25 + pt.angle * 8) * 0.3
            ctx.beginPath(); ctx.arc(px, py, pt.size * flick, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(255,225,${100 + pt.angle * 20 % 60},${pAlpha})`
            ctx.fill()
          })
        }
      })

      // Armed indicator (Slash/Burst) — hiện liên tục khi đòn tiếp theo được cường hóa
      function drawArmedIndicator(timers, x, y) {
        const slashOn = timers.slash?.slashArmed
        const burstOn = timers.burst?.burstArmed
        if (!slashOn && !burstOn) return
        const pulse = 0.7 + Math.sin(now / 150) * 0.3
        const color = burstOn ? '#f39c12' : '#8e44ad'
        ctx.save()
        ctx.translate(x, y - R - 14)
        ctx.rotate(now / 300)
        // Kim cương xoay thay vì chấm tròn đơn giản, để phân biệt rõ với các glow khác
        ctx.beginPath()
        ctx.moveTo(0, -6 * pulse); ctx.lineTo(5 * pulse, 0); ctx.lineTo(0, 6 * pulse); ctx.lineTo(-5 * pulse, 0)
        ctx.closePath()
        ctx.fillStyle = color
        ctx.globalAlpha = pulse
        ctx.fill()
        ctx.restore()
        ctx.globalAlpha = 1
      }
      drawArmedIndicator(st.skillTimers1, st.x1, st.y1)
      drawArmedIndicator(st.skillTimers2, st.x2, st.y2)

      // Slash effect
      st.slashes = (st.slashes || []).filter(s => now - s.t < 400)
      st.slashes.forEach(s => {
        const alpha = 1 - (now - s.t) / 400
        const len = R * 2.2
        ctx.save()
        ctx.translate(s.x, s.y)
        ctx.rotate(s.angle + Math.PI / 4)
        ctx.globalAlpha = alpha
        // Cross slash lines
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 3
        ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(len, 0); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(0, len); ctx.stroke()
        // Color glow
        ctx.strokeStyle = s.color
        ctx.lineWidth = 6
        ctx.globalAlpha = alpha * 0.4
        ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(len, 0); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(0, len); ctx.stroke()
        ctx.restore()
        ctx.globalAlpha = 1
      })

      // Dodge blur (Rider) — nhoè theo hướng di chuyển khi né thành công
      st.dodgeBlurs = (st.dodgeBlurs || []).filter(b => now - b.t < 350)
      function drawDodgeBlur(blurs, id, x, y, dx, dy, c) {
        const active = blurs.find(b => b.id === id)
        if (!active) return
        const alpha = 1 - (now - active.t) / 350
        const mag = Math.hypot(dx, dy) || 1
        const nx = -dx / mag, ny = -dy / mag
        for (let i = 1; i <= 4; i++) {
          const bx = x + nx * i * 7
          const by = y + ny * i * 7
          const a = alpha * (1 - i / 5) * 0.5
          ctx.beginPath(); ctx.arc(bx, by, R * (1 - i * 0.08), 0, Math.PI * 2)
          ctx.fillStyle = c.color; ctx.globalAlpha = a
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }
      drawDodgeBlur(st.dodgeBlurs, 1, st.x1, st.y1, st.dx1, st.dy1, c1)
      drawDodgeBlur(st.dodgeBlurs, 2, st.x2, st.y2, st.dx2, st.dy2, c2)

      function drawBall(x, y, c, hp) {
        if (hp <= 0) return
        ctx.save()
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2)
        ctx.fillStyle = c.color; ctx.fill()
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke()
        if (c.avatar) {
          if (!imgCache.current[c.id]) {
            const img = new Image(); img.src = c.avatar
            imgCache.current[c.id] = img
          }
          const img = imgCache.current[c.id]
          if (img.complete) { ctx.clip(); ctx.drawImage(img, x - R, y - R, R * 2, R * 2) }
        }
        ctx.restore()
      }

      drawBall(st.x2, st.y2, c2, st.hp2)
      drawBall(st.x1, st.y1, c1, st.hp1)

      // ── Status icons: hiển thị liên tục các debuff đang active phía trên đầu ──
      function drawStatusIcons(x, y, isC1) {
        const dots = isC1 ? st.dots1 : st.dots2
        const frozen = getBuffTotal(st, isC1, 'frozen') > 0
        const missCount = isC1 ? st.missCount1 : st.missCount2
        const icons = []
        // Gom theo type để không lặp icon nếu có nhiều stack cùng loại DoT
        const seenTypes = new Set()
        dots.forEach(d => {
          if (seenTypes.has(d.type)) return
          seenTypes.add(d.type)
          if (d.type === 'burn') icons.push({ kind: 'burn' })
          else if (d.type === 'poison') icons.push({ kind: 'poison' })
          else if (d.type === 'rageBurn') icons.push({ kind: 'burn' }) // dùng chung icon lửa
        })
        if (frozen) icons.push({ kind: 'frozen' })
        if (missCount > 0) icons.push({ kind: 'blind' })
        if (!icons.length) return

        const spacing = 15
        const startX = x - ((icons.length - 1) * spacing) / 2
        const iconY = y - R - 22

        icons.forEach((ic, i) => {
          const ix = startX + i * spacing
          const bob = Math.sin(now / 300 + i) * 1.5 // nhấp nhô nhẹ để dễ nhận biết đang active

          if (ic.kind === 'burn') {
            // Ngọn lửa nhỏ
            const flick = 0.8 + Math.sin(now / 60 + i) * 0.2
            ctx.save(); ctx.translate(ix, iconY + bob)
            ctx.beginPath()
            ctx.moveTo(0, 6 * flick); ctx.quadraticCurveTo(-5, 0, 0, -7 * flick)
            ctx.quadraticCurveTo(5, 0, 0, 6 * flick)
            ctx.fillStyle = '#e67e22'; ctx.fill()
            ctx.beginPath()
            ctx.moveTo(0, 3); ctx.quadraticCurveTo(-2.5, 0, 0, -3.5); ctx.quadraticCurveTo(2.5, 0, 0, 3)
            ctx.fillStyle = '#f9e79f'; ctx.fill()
            ctx.restore()
          }
          else if (ic.kind === 'poison') {
            // Giọt độc
            ctx.save(); ctx.translate(ix, iconY + bob)
            ctx.beginPath()
            ctx.moveTo(0, -7); ctx.quadraticCurveTo(6, 4, 0, 7); ctx.quadraticCurveTo(-6, 4, 0, -7)
            ctx.fillStyle = '#27ae60'; ctx.fill()
            ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.8; ctx.stroke()
            ctx.restore()
          }
          else if (ic.kind === 'frozen') {
            // Bông tuyết
            ctx.save(); ctx.translate(ix, iconY + bob); ctx.rotate(now / 800)
            for (let a = 0; a < 3; a++) {
              ctx.save(); ctx.rotate((a / 3) * Math.PI)
              ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 7); ctx.stroke()
              ctx.strokeStyle = '#aed6f1'; ctx.lineWidth = 1.5
              ctx.stroke()
              ctx.restore()
            }
            ctx.restore()
          }
          else if (ic.kind === 'blind') {
            // Mắt gạch chéo
            ctx.save(); ctx.translate(ix, iconY + bob)
            ctx.beginPath(); ctx.ellipse(0, 0, 6, 3.5, 0, 0, Math.PI * 2)
            ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 1.3; ctx.stroke()
            ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2)
            ctx.fillStyle = '#bdc3c7'; ctx.fill()
            ctx.beginPath(); ctx.moveTo(-6, -5); ctx.lineTo(6, 5)
            ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 1.5; ctx.stroke()
            ctx.restore()
          }

          // Nền tròn mờ phía sau icon để nổi bật hơn trên nền đấu trường tối
          ctx.save()
          ctx.globalCompositeOperation = 'destination-over'
          ctx.beginPath(); ctx.arc(ix, iconY + bob, 8, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(0,0,0,0.4)'
          ctx.fill()
          ctx.restore()
        })
      }
      drawStatusIcons(st.x1, st.y1, true)
      drawStatusIcons(st.x2, st.y2, false)

      // Tanker shield — đè lên nhân vật khi đang có khiên
      function drawShield(x, y, hp, hasShield) {
        if (hp <= 0 || !hasShield) return
        const pulse = 0.85 + Math.sin(now / 280) * 0.15
        ctx.save()

        // Lớp fill mờ nền
        ctx.beginPath(); ctx.arc(x, y, R + 6, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(189,195,199,${0.15 * pulse})`
        ctx.fill()

        // Khung hexagon xoay chậm — trông giống khiên năng lượng hơn vòng tròn trơn
        const sides = 6
        const rot = now / 2000
        ctx.beginPath()
        for (let i = 0; i <= sides; i++) {
          const ang = (i / sides) * Math.PI * 2 + rot
          const hx = x + Math.cos(ang) * (R + 6)
          const hy = y + Math.sin(ang) * (R + 6)
          if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy)
        }
        ctx.closePath()
        ctx.strokeStyle = `rgba(127,140,141,${0.9 * pulse})`
        ctx.lineWidth = 2.5
        ctx.stroke()

        // Vòng tròn trong nhẹ để làm dịu góc cạnh hexagon
        ctx.beginPath(); ctx.arc(x, y, R + 4, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(200,210,211,${0.4 * pulse})`
        ctx.lineWidth = 1
        ctx.stroke()

        // Highlight arc chạy quanh khiên (giữ nguyên, vẫn hiệu quả)
        ctx.beginPath()
        ctx.arc(x, y, R + 6, (now / 500) % (Math.PI * 2), (now / 500) % (Math.PI * 2) + 0.8)
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'
        ctx.lineWidth = 2
        ctx.stroke()

        ctx.restore()
      }
      drawShield(st.x1, st.y1, st.hp1, st.hasShield1)
      drawShield(st.x2, st.y2, st.hp2, st.hasShield2)

      // Shield glow (vừa nhận khiên)
      st.shieldGlows = (st.shieldGlows || []).filter(g => now - g.t < 600)
      st.shieldGlows.forEach(g => {
        const alpha = 1 - (now - g.t) / 600
        const gx = g.id === 1 ? st.x1 : st.x2
        const gy = g.id === 1 ? st.y1 : st.y2
        const pulse = (now - g.t) / 600
        ctx.beginPath(); ctx.arc(gx, gy, R + 5 + pulse * 16, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(200,205,206,${alpha})`; ctx.lineWidth = 3; ctx.stroke()
      })

      // Shield break (khiên vừa vỡ khi phản sát thương)
      st.shieldBreaks = (st.shieldBreaks || []).filter(b => now - b.t < 400)
      st.shieldBreaks.forEach(b => {
        const alpha = 1 - (now - b.t) / 400
        const shards = 6
        for (let i = 0; i < shards; i++) {
          const ang = (i / shards) * Math.PI * 2
          const dist = (now - b.t) / 6
          const sx = b.x + Math.cos(ang) * dist
          const sy = b.y + Math.sin(ang) * dist
          ctx.save()
          ctx.translate(sx, sy)
          ctx.rotate(ang)
          ctx.fillStyle = `rgba(189,195,199,${alpha})`
          ctx.beginPath(); ctx.moveTo(-3, -5); ctx.lineTo(3, -5); ctx.lineTo(0, 5); ctx.closePath()
          ctx.fill()
          ctx.restore()
        }
      })
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  const maxHp1 = c1.stats.hp, maxHp2 = c2.stats.hp
  const pct1 = Math.max(0, hp1 / maxHp1 * 100)
  const pct2 = Math.max(0, hp2 / maxHp2 * 100)
  const hpColor = p => p > 50 ? '#2ecc71' : p > 25 ? '#f39c12' : '#e74c3c'
  const winChar = winner && winner !== 'draw' ? (winner === c1.id ? c1 : c2) : null
  const cls1 = c1.class ? CLASSES[c1.class] : null
  const cls2 = c2.class ? CLASSES[c2.class] : null

  function renderClassStat(c, cls) {
    if (!cls) return null
    const key = cls.classStatKey
    const val = c.stats[key]
    if (val == null) return null
    const unit = key === 'dodge' ? '%' : key === 'castTime' ? 's' : key === 'arrowCount' ? '🏹' : key === 'rage' ? '%/10%HP' : key === 'execThreshold' ? '%HP' : key === 'dashMult' ? '%' : key === 'reflectPct' ? '%' : '%/4.5s'
    return (
      <div className={styles.stat} style={{ color: cls.color }}>
        <span>{CLASS_STAT_ICONS[cls.id][key]}</span>
        <span>{val}{unit}</span>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      {winner && (
        <div className={styles.overlay}>
          {showLog ? (
            <div className={styles.popup}>
              <div className={styles.popupTitle}>📋 Nhật ký chiến đấu</div>
              <div className={styles.logScroll}>
                {allLogsRef.current.map((l, i) => (
                  <div key={i} className={[styles.logEntry, i === 0 ? styles.latest : ''].join(' ')}>{l}</div>
                ))}
              </div>
              <button className={styles.backLogBtn} onClick={() => setShowLog(false)}>← Quay lại</button>
            </div>
          ) : (
            <div className={styles.popup}>
              <div className={styles.winIcon}>{winner === 'draw' ? '🤝' : '🏆'}</div>
              <div className={styles.winLabel}>{winner === 'draw' ? 'Hòa!' : 'Người thắng!'}</div>
              {winChar && <div className={styles.winName}>{winChar.name}</div>}
              <div className={styles.popupBtns}>
                <button className={styles.popupBtn} onClick={onGoList}>📋 Về danh sách</button>
                <button className={`${styles.popupBtn} ${styles.secondary}`} onClick={onGoHome}>🏠 Về trang chủ</button>
                <button className={`${styles.popupBtn} ${styles.secondary}`} onClick={() => setShowLog(true)}>📜 Xem log</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={styles.topbar}>
        <button className={styles.backBtn} onClick={() => { cancelAnimationFrame(rafRef.current); onGoList() }}>← Danh sách</button>
        <div className={styles.title}>⚔️ Đấu trường</div>
      </div>

      <div className={styles.layout}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div className={styles.panelAvatar} style={{ background: c1.color, backgroundImage: c1.avatar ? `url(${c1.avatar})` : 'none', backgroundSize: 'cover' }} />
            <div>
              <div className={styles.panelName}>{c1.name}</div>
              {cls1 && <div className={styles.panelClass} style={{ color: cls1.color }}>{cls1.name}</div>}
            </div>
          </div>
          <div className={styles.hpBar}><div className={styles.hpFill} style={{ width: pct1 + '%', background: hpColor(pct1) }} /></div>
          <div className={styles.hpText}>{hp1}/{maxHp1}</div>
          {renderClassStat(c1, cls1)}
          {STAT_ORDER.map(s => (
            <div key={s} className={styles.stat}>
              <span>{STAT_LABELS[s].slice(0, 3)}</span>
              <span>{(s === 'def' || s === 'crit') ? c1.stats[s] + '%' : c1.stats[s]}</span>
            </div>
          ))}
          {c1.skills && c1.skills.length > 0 && (
            <div className={styles.panelSkills}>
              {c1.skills.map((skillId, i) => {
                const skill = SKILLS[skillId]
                return (
                  <span key={i} className={styles.panelSkillChip} style={{ color: skill.color, borderColor: skill.color }} title={skill.desc}>
                    {skill.name}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        <div className={styles.arenaWrap}>
          <canvas ref={canvasRef} width={W} height={H} className={styles.canvas} />
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead} style={{ flexDirection: 'row-reverse' }}>
            <div className={styles.panelAvatar} style={{ background: c2.color, backgroundImage: c2.avatar ? `url(${c2.avatar})` : 'none', backgroundSize: 'cover' }} />
            <div style={{ textAlign: 'right' }}>
              <div className={styles.panelName}>{c2.name}</div>
              {cls2 && <div className={styles.panelClass} style={{ color: cls2.color }}>{cls2.name}</div>}
            </div>
          </div>
          <div className={styles.hpBar}><div className={styles.hpFill} style={{ width: pct2 + '%', background: hpColor(pct2), marginLeft: 'auto' }} /></div>
          <div className={styles.hpText}>{hp2}/{maxHp2}</div>
          {renderClassStat(c2, cls2)}
          {STAT_ORDER.map(s => (
            <div key={s} className={styles.stat}>
              <span>{STAT_LABELS[s].slice(0, 3)}</span>
              <span>{(s === 'def' || s === 'crit') ? c2.stats[s] + '%' : c2.stats[s]}</span>
            </div>
          ))}
          {c2.skills && c2.skills.length > 0 && (
            <div className={styles.panelSkills} style={{ justifyContent: 'flex-end' }}>
              {c2.skills.map((skillId, i) => {
                const skill = SKILLS[skillId]
                return (
                  <span key={i} className={styles.panelSkillChip} style={{ color: skill.color, borderColor: skill.color }} title={skill.desc}>
                    {skill.name}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className={styles.liveLog}>
        {logs.slice(0, 5).map((l, i) => (
          <div key={i} className={[styles.logEntry, i === 0 ? styles.latest : ''].join(' ')}>{l}</div>
        ))}
      </div>
    </div>
  )
}