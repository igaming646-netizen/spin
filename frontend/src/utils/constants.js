export const STAT_ORDER = ['hp', 'atk', 'spd', 'def', 'crit']
export const STAT_LABELS = { hp: 'Sinh lực', atk: 'Tấn công', spd: 'Tốc độ', def: 'Phòng thủ', crit: 'Tỉ lệ chí mạng' }
export const STAT_ICONS = { hp: 'HP', atk: 'ATK', spd: 'SPD', def: 'DEF', crit: 'CRT' }
export const STAT_RANGES = { hp: [1650, 3000], atk: [55, 100], spd: [2, 10], def: [5, 50], crit: [10, 100] }
export const DEFAULT_CRIT_DAMAGE = 100 // % sát thương tăng thêm khi chí mạng (cố định)

// Class-specific stat ranges
export const CLASS_STAT_RANGES = {
  paladin:   { regen: [1, 10] },       // % HP tối đa hồi mỗi 4.5 giây
  caster:    { castTime: [1, 10] },    // giây giữa các lần cast
  rider:     { dodge: [30, 75] },      // % né tránh
  archer:    { arrowCount: [1, 10] },  // số mũi tên mỗi salvo
  berserker: { rage: [2, 20] },        // % sát thương tăng thêm mỗi 10% máu mất
  assassin:  { execThreshold: [12, 30] }, // % HP địch để kết liễu ngay
  saber:     { dashMult: [110, 200] },    // % sát thương khi lao vào địch
  tanker:    { reflectPct: [100, 190] },  // % sát thương phản lại khi có khiên
}
export const CLASS_STAT_LABELS = {
  paladin:   { regen: 'Hồi phục' },
  caster:    { castTime: 'Thời gian cast' },
  rider:     { dodge: 'Né tránh' },
  archer:    { arrowCount: 'Số mũi tên' },
  berserker: { rage: 'Cuồng nộ' },
  assassin:  { execThreshold: 'Kết liễu' },
  saber:     { dashMult: 'Hệ số chém' },
  tanker:    { reflectPct: 'Phản sát thương' },
}
export const CLASS_STAT_ICONS = {
  paladin:   { regen: 'REG' },
  caster:    { castTime: 'CST' },
  rider:     { dodge: 'DDG' },
  archer:    { arrowCount: 'ARR' },
  berserker: { rage: 'RGE' },
  assassin:  { execThreshold: 'EXC' },
  saber:     { dashMult: 'DSH' },
  tanker:    { reflectPct: 'RFL' },
}

export const CLASSES = {
  paladin: {
    id: 'paladin',
    name: 'Paladin',
    icon: 'PLD',
    desc: 'Sinh lực và phòng thủ rất cao. Tấn công và tốc độ dưới trung bình.',
    color: '#2980b9',
    classStatKey: 'regen',
    weightModifiers: {
      hp:  [0.3, 0.4, 0.6, 0.8, 1.0, 1.3, 1.6, 2.0, 2.3, 2.6],
      atk: [1.8, 1.6, 1.4, 1.2, 1.1, 1.0, 0.9, 0.8, 0.7, 0.6],
      spd: [2.0, 1.8, 1.6, 1.4, 1.2, 1.0, 0.9, 0.8, 0.7, 0.6],
      def: [0.3, 0.4, 0.6, 0.8, 1.0, 1.3, 1.6, 2.0, 2.3, 2.6],
      crit: [2.2, 2.0, 1.8, 1.5, 1.2, 1.0, 0.8, 0.6, 0.4, 0.3],
    }
  },
  caster: {
    id: 'caster',
    name: 'Caster',
    icon: 'CAS',
    desc: 'Tấn công cực cao. Sinh lực và phòng thủ thấp. Tốc độ trung bình.',
    color: '#9b59b6',
    classStatKey: 'castTime',
    weightModifiers: {
      hp:  [2.2, 2.0, 1.8, 1.5, 1.2, 1.0, 0.8, 0.6, 0.4, 0.3],
      atk: [0.3, 0.4, 0.6, 0.8, 1.0, 1.2, 1.5, 1.8, 2.0, 2.2],
      spd: [0.8, 0.9, 1.0, 1.1, 1.2, 1.2, 1.1, 1.0, 0.9, 0.8],
      def: [2.2, 2.0, 1.8, 1.5, 1.2, 1.0, 0.8, 0.6, 0.4, 0.3],
      crit: [2.2, 2.0, 1.8, 1.5, 1.2, 1.0, 0.8, 0.6, 0.4, 0.3],
    }
  },
  rider: {
    id: 'rider',
    name: 'Rider',
    icon: 'RDR',
    desc: 'Tốc độ vượt trội. Tấn công khá. Sinh lực và phòng thủ thấp.',
    color: '#1abc9c',
    classStatKey: 'dodge',
    weightModifiers: {
      hp:  [2.0, 1.8, 1.5, 1.2, 1.0, 0.8, 0.6, 0.5, 0.4, 0.3],
      atk: [0.5, 0.7, 0.9, 1.1, 1.3, 1.5, 1.5, 1.3, 1.1, 0.9],
      spd: [0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.3, 1.6, 2.0, 2.4],
      def: [2.0, 1.8, 1.5, 1.2, 1.0, 0.8, 0.6, 0.5, 0.4, 0.3],
      crit: [2.2, 2.0, 1.8, 1.5, 1.2, 1.0, 0.8, 0.6, 0.4, 0.3],
    }
  },
  archer: {
    id: 'archer',
    name: 'Archer',
    icon: 'ARC',
    desc: 'Tấn công xa và tốc độ tốt. Sinh lực và phòng thủ trung bình thấp.',
    color: '#f39c12',
    classStatKey: 'arrowCount',
    weightModifiers: {
      hp:  [1.6, 1.5, 1.3, 1.2, 1.0, 0.9, 0.8, 0.6, 0.5, 0.4],
      atk: [0.6, 0.7, 0.9, 1.0, 1.2, 1.3, 1.3, 1.2, 1.0, 0.9],
      spd: [0.6, 0.7, 0.9, 1.0, 1.2, 1.3, 1.4, 1.3, 1.1, 1.0],
      def: [1.6, 1.5, 1.3, 1.2, 1.0, 0.9, 0.8, 0.6, 0.5, 0.4],
      crit: [2.2, 2.0, 1.8, 1.5, 1.2, 1.0, 0.8, 0.6, 0.4, 0.3],
    }
  },
  berserker: {
    id: 'berserker',
    name: 'Berserker',
    icon: 'BSK',
    desc: 'Sinh lực cao, phòng thủ thấp. Tấn công và tốc độ trung bình. Càng mất máu càng mạnh.',
    color: '#c0392b',
    classStatKey: 'rage',
    weightModifiers: {
      hp:  [0.4, 0.5, 0.6, 0.8, 1.0, 1.2, 1.5, 1.8, 2.1, 2.4],
      atk: [1.5, 1.4, 1.2, 1.1, 1.0, 1.0, 0.9, 0.8, 0.7, 0.6],
      spd: [1.4, 1.3, 1.2, 1.1, 1.0, 1.0, 0.9, 0.8, 0.7, 0.6],
      def: [2.0, 1.8, 1.5, 1.3, 1.0, 0.8, 0.6, 0.5, 0.4, 0.3],
      crit: [2.2, 2.0, 1.8, 1.5, 1.2, 1.0, 0.8, 0.6, 0.4, 0.3],
    }
  },
  assassin: {
    id: 'assassin',
    name: 'Assassin',
    icon: 'ASN',
    desc: 'Tốc độ và tấn công rất cao. Sinh lực và phòng thủ thấp. Kết liễu địch khi máu thấp.',
    color: '#2c3e50',
    classStatKey: 'execThreshold',
    weightModifiers: {
      hp:  [2.2, 2.0, 1.8, 1.5, 1.2, 1.0, 0.7, 0.5, 0.4, 0.3],
      atk: [0.3, 0.4, 0.5, 0.7, 0.9, 1.1, 1.4, 1.7, 2.0, 2.2],
      spd: [0.3, 0.4, 0.5, 0.7, 0.9, 1.1, 1.4, 1.7, 2.0, 2.2],
      def: [2.2, 2.0, 1.8, 1.5, 1.2, 1.0, 0.7, 0.5, 0.4, 0.3],
      crit: [0.3, 0.4, 0.5, 0.7, 0.9, 1.1, 1.4, 1.7, 2.0, 2.2],
    }
  },
  saber: {
    id: 'saber',
    name: 'Saber',
    icon: 'SBR',
    desc: 'Tất cả chỉ số cân bằng. Mỗi 4.5s lao vào địch chém với sát thương tăng cường.',
    color: '#e67e22',
    classStatKey: 'dashMult',
    weightModifiers: {
      hp:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      atk: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      spd: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      def: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      crit: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    }
  },
  tanker: {
    id: 'tanker',
    name: 'Tanker',
    icon: 'TNK',
    desc: 'Sinh lực và phòng thủ cực cao. Tấn công, tốc độ và chí mạng thấp. Mỗi 7s nhận khiên phản sát thương.',
    color: '#7f8c8d',
    classStatKey: 'reflectPct',
    weightModifiers: {
      hp:  [0.3, 0.4, 0.5, 0.7, 0.9, 1.1, 1.4, 1.7, 2.0, 2.2],
      atk: [2.2, 2.0, 1.8, 1.5, 1.2, 1.0, 0.7, 0.5, 0.4, 0.3],
      spd: [2.2, 2.0, 1.8, 1.5, 1.2, 1.0, 0.7, 0.5, 0.4, 0.3],
      def: [0.3, 0.4, 0.5, 0.7, 0.9, 1.1, 1.4, 1.7, 2.0, 2.2],
      crit: [2.2, 2.0, 1.8, 1.5, 1.2, 1.0, 0.7, 0.5, 0.4, 0.3],
    }
  }
}

export const CLASS_ORDER = Object.keys(CLASSES)
export const COLORS = [
  '#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6',
  '#1abc9c','#e67e22','#e91e63','#00bcd4','#8bc34a'
]

// ── Skill pool (bể kỹ năng dùng chung cho mọi class) ──────────
export const SKILL_COUNT_RANGE = [1, 3] // số lượng kỹ năng nhận được
// Trọng số: 3 hiếm nhất, 1 dễ ra nhất
export const SKILL_COUNT_WEIGHTS = [3.0, 1.6, 0.7] // ứng với giá trị 1, 2, 3

export const SKILLS = {
  heal: {
    id: 'heal', name: 'Hồi máu', icon: 'HP+', color: '#2ecc71',
    desc: 'Hồi 30% máu tối đa mỗi 3 lần va chạm.',
  },
  revive: {
    id: 'revive', name: 'Hồi sinh', icon: 'REV', color: '#f1c40f',
    desc: 'Lần đầu máu về 0 sẽ hồi ngay 70% máu và tăng 100% tấn công. Kích hoạt 1 lần mỗi trận.',
  },
  fireball: {
    id: 'fireball', name: 'Hỏa cầu', icon: 'FIR', color: '#e67e22',
    desc: 'Mỗi 9s bắn 1 hỏa cầu gây 125% sát thương gốc, thiêu đốt địch 4s (50% sát thương hỏa cầu/giây).',
  },
  toxic: {
    id: 'toxic', name: 'Độc', icon: 'TOX', color: '#27ae60',
    desc: 'Mỗi 6s gây độc lên địch: 40% sát thương gốc mỗi giây trong 4s.',
  },
  freeze: {
    id: 'freeze', name: 'Đóng băng', icon: 'FRZ', color: '#3498db',
    desc: 'Mỗi 9s đóng băng địch (100% sát thương gốc), bất động 3s. Gây sát thương trong lúc đó sẽ phá băng, gây thêm 70% sát thương.',
  },
  blind: {
    id: 'blind', name: 'Mù', icon: 'BLD', color: '#95a5a6',
    desc: 'Mỗi 12s gây 265% sát thương gốc và làm mù địch — 2 đòn tấn công tiếp theo của địch bị trượt.',
  },
  lifesteal: {
    id: 'lifesteal', name: 'Hấp huyết', icon: 'LST', color: '#c0392b',
    desc: 'Mỗi lần gây sát thương hồi lại 15% lượng sát thương đó.',
  },
  rage: {
    id: 'rage', name: 'Giận dữ', icon: 'RAG', color: '#d35400',
    desc: 'Mỗi 9s tăng 30% phòng thủ. Đòn đầu tiên địch đánh trúng sau đó sẽ bị thiêu đốt (60% sát thương gốc/giây trong 6s).',
  },
  slash: {
    id: 'slash', name: 'Quét cạnh', icon: 'SLH', color: '#8e44ad',
    desc: 'Mỗi 9s cường hóa đòn tiếp theo, giảm 50% phòng thủ địch (5s, cộng dồn tối đa 2 lần).',
  },
  fury: {
    id: 'fury', name: 'Thịnh nộ', icon: 'FUR', color: '#e74c3c',
    desc: 'Mỗi 6s tăng 50% tấn công trong 4s.',
  },
  berserkerSkill: {
    id: 'berserkerSkill', name: 'Cuồng dã', icon: 'BSK', color: '#7f2d0e',
    desc: 'Tăng vĩnh viễn 200% tấn công và tốc độ.',
  },
  burst: {
    id: 'burst', name: 'Đòn cường hóa', icon: 'BRT', color: '#f39c12',
    desc: 'Mỗi 9s cường hóa đòn tiếp theo: gây 175% sát thương, hồi 40% sát thương gây ra làm máu. Không cộng dồn.',
  },
  blessing: {
    id: 'blessing', name: 'Chúc phúc', icon: 'BLS', color: '#f9e79f',
    desc: 'Mỗi 15s tăng 30% tấn công, giảm 1 nửa thời gian hồi của các kỹ năng khác.',
  },
  cleanse: {
    id: 'cleanse', name: 'Thanh tẩy', icon: 'CLN', color: '#1abc9c',
    desc: 'Mỗi 5s xóa hết debuff (thiêu đốt/độc/đóng băng/mù) và tăng 30% phòng thủ trong 3s.',
  },
  devastatingEnd: {
    id: 'devastatingEnd', name: 'Ngưỡng', icon: 'DEV', color: '#9b59b6',
    desc: 'Lần đầu xuống dưới 50% máu: tăng ngay 300% tấn công, 100% tốc độ. Mỗi debuff đang mang cộng thêm 50% tấn công.',
  },
  explosive: {
    id: 'explosive', name: 'Bùng nổ', icon: 'EXP', color: '#c0392b',
    desc: 'Mỗi 2s gây 50% sát thương gốc cho địch.',
  },
}
export const SKILL_ORDER = Object.keys(SKILLS)

// ── Equipment pool (bể trang bị dùng chung, không phân class) ─
export const EQUIPMENT_COUNT_RANGE = [2, 4] // có thể lên 5 nếu roll trúng "extraEquipRoll"
export const EQUIPMENT_COUNT_WEIGHTS = [2.2, 1.3, 0.7] // 4 hiếm nhất, ứng với giá trị 2, 3, 4

export const EQUIPMENT = {
  // ── Flat stat (8 món: hp/atk/spd/def × 2 mức) ──
  hp_charm_small:  { id: 'hp_charm_small',  name: 'Ngọc hộ mệnh nhỏ', color: '#2ecc71', statBonus: { hp: 150 },  desc: '+150 Sinh lực tối đa.' },
  hp_charm_large:  { id: 'hp_charm_large',  name: 'Ngọc hộ mệnh lớn', color: '#2ecc71', statBonus: { hp: 400 },  desc: '+400 Sinh lực tối đa.' },
  atk_blade_small: { id: 'atk_blade_small', name: 'Lưỡi kiếm rèn thô', color: '#e74c3c', statBonus: { atk: 5 },  desc: '+5 Tấn công.' },
  atk_blade_large: { id: 'atk_blade_large', name: 'Lưỡi kiếm tôi luyện', color: '#e74c3c', statBonus: { atk: 12 }, desc: '+12 Tấn công.' },
  spd_boot_small:  { id: 'spd_boot_small',  name: 'Giày da nhẹ', color: '#3498db', statBonus: { spd: 1 },  desc: '+1 Tốc độ.' },
  spd_boot_large:  { id: 'spd_boot_large',  name: 'Giày gió thần', color: '#3498db', statBonus: { spd: 2 },  desc: '+2 Tốc độ.' },
  def_plate_small: { id: 'def_plate_small', name: 'Giáp lót đơn', color: '#95a5a6', statBonus: { def: 5 },  desc: '+5% Phòng thủ.' },
  def_plate_large: { id: 'def_plate_large', name: 'Giáp lót dày', color: '#95a5a6', statBonus: { def: 12 }, desc: '+12% Phòng thủ.' },

  // ── % stat (8 món: hp/atk/spd/def × 2 mức) ──
  hp_ring_small:   { id: 'hp_ring_small',   name: 'Nhẫn sinh mệnh', color: '#27ae60', statBonusPercent: { hp: 8 },  desc: '+8% Sinh lực tối đa.' },
  hp_ring_large:   { id: 'hp_ring_large',   name: 'Nhẫn trường sinh', color: '#27ae60', statBonusPercent: { hp: 18 }, desc: '+18% Sinh lực tối đa.' },
  atk_gem_small:   { id: 'atk_gem_small',   name: 'Đá cường lực nhỏ', color: '#c0392b', statBonusPercent: { atk: 8 },  desc: '+8% Tấn công.' },
  atk_gem_large:   { id: 'atk_gem_large',   name: 'Đá cường lực lớn', color: '#c0392b', statBonusPercent: { atk: 18 }, desc: '+18% Tấn công.' },
  spd_wing_small:  { id: 'spd_wing_small',  name: 'Lông vũ tốc hành', color: '#2980b9', statBonusPercent: { spd: 10 }, desc: '+10% Tốc độ.' },
  spd_wing_large:  { id: 'spd_wing_large',  name: 'Cánh gió lốc', color: '#2980b9', statBonusPercent: { spd: 20 }, desc: '+20% Tốc độ.' },
  def_shell_small: { id: 'def_shell_small', name: 'Mai rùa nhỏ', color: '#7f8c8d', statBonusPercent: { def: 15 }, desc: '+15% Phòng thủ (nhân thêm vào def hiện có).' },
  def_shell_large: { id: 'def_shell_large', name: 'Mai rùa cổ đại', color: '#7f8c8d', statBonusPercent: { def: 30 }, desc: '+30% Phòng thủ (nhân thêm vào def hiện có).' },

  // ── Crit rate / Crit dmg (2 + 2 món) ──
  crit_lens_small: { id: 'crit_lens_small', name: 'Kính ngắm chuẩn xác', color: '#f39c12', statBonus: { crit: 15 }, desc: '+15% Tỉ lệ chí mạng.' },
  crit_lens_large: { id: 'crit_lens_large', name: 'Con mắt sát thủ', color: '#f39c12', statBonus: { crit: 30 }, desc: '+30% Tỉ lệ chí mạng.' },
  critdmg_edge_small: { id: 'critdmg_edge_small', name: 'Lưỡi dao sắc bén', color: '#d35400', critDamageBonus: 40,  desc: '+40% Sát thương chí mạng.' },
  critdmg_edge_large: { id: 'critdmg_edge_large', name: 'Lưỡi dao tử thần', color: '#d35400', critDamageBonus: 90,  desc: '+90% Sát thương chí mạng.' },

  // ── Xuyên giáp (2 món, buff cố định của người mặc) ──
  pierce_small: { id: 'pierce_small', name: 'Mũi khoan xuyên', color: '#8e44ad', armorPierce: 20, desc: 'Bỏ qua 20% phòng thủ của địch khi tính sát thương.' },
  pierce_large: { id: 'pierce_large', name: 'Ngọn giáo xuyên phá', color: '#8e44ad', armorPierce: 40, desc: 'Bỏ qua 40% phòng thủ của địch khi tính sát thương.' },

  // ── Giảm def địch — debuff áp lên địch từ đầu trận, bị Cleanse xóa (2 món) ──
  sunder_small: { id: 'sunder_small', name: 'Bùa nguyền rạn giáp', color: '#6c3483', enemyDefShred: 15, desc: 'Địch giảm vĩnh viễn 15% phòng thủ (debuff, có thể bị Thanh tẩy xóa).' },
  sunder_large: { id: 'sunder_large', name: 'Bùa nguyền vỡ giáp', color: '#6c3483', enemyDefShred: 30, desc: 'Địch giảm vĩnh viễn 30% phòng thủ (debuff, có thể bị Thanh tẩy xóa).' },

  // ── Tăng sát thương gây ra (2 món, buff cố định của người mặc, khác statBonusPercent.atk) ──
  might_small: { id: 'might_small', name: 'Găng tay sức mạnh', color: '#a04000', dmgDealtBonus: 15, desc: 'Tăng 15% sát thương gây ra (áp dụng sau khi tính ATK, không cộng dồn vào ATK).' },
  might_large: { id: 'might_large', name: 'Găng tay hủy diệt', color: '#a04000', dmgDealtBonus: 30, desc: 'Tăng 30% sát thương gây ra (áp dụng sau khi tính ATK, không cộng dồn vào ATK).' },

  // ── Trọng thương — debuff lên địch, bị Cleanse xóa (2 món) ──
  vulnerable_small: { id: 'vulnerable_small', name: 'Dấu ấn suy nhược', color: '#943126', enemyVulnerable: 15, desc: 'Địch nhận thêm vĩnh viễn 15% sát thương phải chịu (debuff, có thể bị Thanh tẩy xóa).' },
  vulnerable_large: { id: 'vulnerable_large', name: 'Dấu ấn trọng thương', color: '#943126', enemyVulnerable: 30, desc: 'Địch nhận thêm vĩnh viễn 30% sát thương phải chịu (debuff, có thể bị Thanh tẩy xóa).' },

  // ── Hút máu (2 món, buff cố định của người mặc) ──
  vamp_small: { id: 'vamp_small', name: 'Răng nanh khát máu', color: '#78281f', lifestealBonus: 10, desc: 'Hồi thêm 10% sát thương gây ra thành máu.' },
  vamp_large: { id: 'vamp_large', name: 'Trái tim ma cà rồng', color: '#78281f', lifestealBonus: 20, desc: 'Hồi thêm 20% sát thương gây ra thành máu.' },

  // ── Hồi máu mỗi giây (2 flat + 2 %, buff cố định của người mặc, cộng dồn với Paladin regen nếu có) ──
  regen_flat_small: { id: 'regen_flat_small', name: 'Nhựa cây hồi phục', color: '#58d68d', hpRegenFlat: 20, desc: 'Tự động hồi 20 máu mỗi giây.' },
  regen_flat_large: { id: 'regen_flat_large', name: 'Suối nguồn sinh mệnh', color: '#58d68d', hpRegenFlat: 45, desc: 'Tự động hồi 45 máu mỗi giây.' },
  regen_pct_small:  { id: 'regen_pct_small',  name: 'Vòng tái sinh nhỏ', color: '#16a085', hpRegenPercent: 0.8, desc: 'Tự động hồi 0.8% máu tối đa mỗi giây.' },
  regen_pct_large:  { id: 'regen_pct_large',  name: 'Vòng tái sinh lớn', color: '#16a085', hpRegenPercent: 1.8, desc: 'Tự động hồi 1.8% máu tối đa mỗi giây.' },

  // ── Giảm hồi chiêu kỹ năng (CDR, 2 món, passive vĩnh viễn) ──
  cdr_small: { id: 'cdr_small', name: 'Đồng hồ cát rút gọn', color: '#5dade2', cdrBonus: 10, desc: 'Giảm 10% thời gian hồi chiêu của mọi kỹ năng.' },
  cdr_large: { id: 'cdr_large', name: 'Đồng hồ cát nghịch thời', color: '#5dade2', cdrBonus: 20, desc: 'Giảm 20% thời gian hồi chiêu của mọi kỹ năng.' },

  // ── Kháng debuff (Tenacity, 2 món, giảm thời lượng debuff nhận vào) ──
  tenacity_small: { id: 'tenacity_small', name: 'Bùa hộ thân nhỏ', color: '#af7ac5', tenacity: 15, desc: 'Giảm 15% thời gian hiệu lực của mọi debuff nhận vào (độc, thiêu đốt, đóng băng...).' },
  tenacity_large: { id: 'tenacity_large', name: 'Bùa hộ thân lớn', color: '#af7ac5', tenacity: 30, desc: 'Giảm 30% thời gian hiệu lực của mọi debuff nhận vào (độc, thiêu đốt, đóng băng...).' },

  // ── Phản đòn thụ động (Thorns, 2 món, vô hạn lần, khác cơ chế 1-lần/7s của Tanker) ──
  thorns_small: { id: 'thorns_small', name: 'Giáp gai nhỏ', color: '#784212', thorns: 3, desc: 'Phản lại 3% sát thương chuẩn cho mọi đòn nhận vào (không giới hạn số lần).' },
  thorns_large: { id: 'thorns_large', name: 'Giáp gai lớn', color: '#784212', thorns: 7, desc: 'Phản lại 7% sát thương chuẩn cho mọi đòn nhận vào (không giới hạn số lần).' },

  // ── Thu nhỏ hitbox (2 món, giảm bán kính va chạm vật lý) ──
  hitbox_small: { id: 'hitbox_small', name: 'Bùa thu hình nhỏ', color: '#48c9b0', hitboxReduce: 4, desc: 'Giảm 4px bán kính va chạm — khó bị dính đòn hơn khi bounce.' },
  hitbox_large: { id: 'hitbox_large', name: 'Bùa thu hình lớn', color: '#48c9b0', hitboxReduce: 8, desc: 'Giảm 8px bán kính va chạm — khó bị dính đòn hơn khi bounce.' },

  // ── Tăng sát thương từ xa (2 món, chỉ áp dụng classStat/skill gây damage từ xa, không áp cho va chạm) ──
  ranged_small: { id: 'ranged_small', name: 'Ống ngắm tăng lực nhỏ', color: '#f5b041', rangedDmgBonus: 15, desc: 'Tăng 15% sát thương từ các đòn tấn công tầm xa (cast, tên, hỏa cầu, độc...). Không áp dụng cho va chạm.' },
  ranged_large: { id: 'ranged_large', name: 'Ống ngắm tăng lực lớn', color: '#f5b041', rangedDmgBonus: 30, desc: 'Tăng 30% sát thương từ các đòn tấn công tầm xa (cast, tên, hỏa cầu, độc...). Không áp dụng cho va chạm.' },

  // ── Né tránh (2 món, buff cố định của người mặc) ──
  evade_small: { id: 'evade_small', name: 'Áo choàng bóng đêm', color: '#34495e', dodgeBonus: 10, desc: '+10% tỉ lệ né hoàn toàn khi va chạm.' },
  evade_large: { id: 'evade_large', name: 'Áo choàng vô ảnh', color: '#34495e', dodgeBonus: 20, desc: '+20% tỉ lệ né hoàn toàn khi va chạm.' },

  // ── Thêm lượt roll (2 món, mỗi loại 1 món) ──
  extra_skill_scroll: { id: 'extra_skill_scroll', name: 'Cuộn giấy bí thuật', color: '#f1c40f', extraSkillRoll: 1, desc: 'Được quay thêm 1 lượt kỹ năng.' },
  extra_equip_pouch:  { id: 'extra_equip_pouch',  name: 'Túi đồ không đáy', color: '#f1c40f', extraEquipRoll: 1, desc: 'Được quay thêm 1 lượt trang bị.' },

  // ── Trang bị tương ứng 15 skill (grantsSkill, loại skill đó khỏi skill wheel) ──
  relic_heal:       { id: 'relic_heal',       name: 'Bình thánh thủy', color: '#2ecc71', grantsSkill: 'heal',       desc: 'Tự động sở hữu kỹ năng Hồi máu.' },
  relic_revive:     { id: 'relic_revive',     name: 'Phù hồi sinh', color: '#f1c40f', grantsSkill: 'revive',     desc: 'Tự động sở hữu kỹ năng Hồi sinh.' },
  relic_fireball:   { id: 'relic_fireball',   name: 'Đá lửa cổ', color: '#e67e22', grantsSkill: 'fireball',   desc: 'Tự động sở hữu kỹ năng Hỏa cầu.' },
  relic_toxic:      { id: 'relic_toxic',      name: 'Lọ độc dược', color: '#27ae60', grantsSkill: 'toxic',      desc: 'Tự động sở hữu kỹ năng Độc.' },
  relic_freeze:     { id: 'relic_freeze',     name: 'Băng thạch vĩnh cửu', color: '#3498db', grantsSkill: 'freeze',     desc: 'Tự động sở hữu kỹ năng Đóng băng.' },
  relic_blind:      { id: 'relic_blind',      name: 'Mặt nạ sương mù', color: '#95a5a6', grantsSkill: 'blind',      desc: 'Tự động sở hữu kỹ năng Mù.' },
  relic_lifesteal:  { id: 'relic_lifesteal',  name: 'Nanh vuốt hút máu', color: '#c0392b', grantsSkill: 'lifesteal',  desc: 'Tự động sở hữu kỹ năng Hấp huyết.' },
  relic_rage:       { id: 'relic_rage',       name: 'Mặt nạ cuồng nộ', color: '#d35400', grantsSkill: 'rage',       desc: 'Tự động sở hữu kỹ năng Giận dữ.' },
  relic_slash:      { id: 'relic_slash',      name: 'Lưỡi hái xoáy', color: '#8e44ad', grantsSkill: 'slash',      desc: 'Tự động sở hữu kỹ năng Quét cạnh.' },
  relic_fury:       { id: 'relic_fury',       name: 'Huy hiệu thịnh nộ', color: '#e74c3c', grantsSkill: 'fury',       desc: 'Tự động sở hữu kỹ năng Thịnh nộ.' },
  relic_berserker:  { id: 'relic_berserker',  name: 'Trang sức man rợ', color: '#7f2d0e', grantsSkill: 'berserkerSkill', desc: 'Tự động sở hữu kỹ năng Cuồng dã.' },
  relic_burst:      { id: 'relic_burst',      name: 'Ngọc bùng nổ', color: '#f39c12', grantsSkill: 'burst',      desc: 'Tự động sở hữu kỹ năng Đòn cường hóa.' },
  relic_blessing:   { id: 'relic_blessing',   name: 'Thánh giá ánh sáng', color: '#f9e79f', grantsSkill: 'blessing',   desc: 'Tự động sở hữu kỹ năng Chúc phúc.' },
  relic_cleanse:    { id: 'relic_cleanse',    name: 'Chuông thanh tẩy', color: '#1abc9c', grantsSkill: 'cleanse',    desc: 'Tự động sở hữu kỹ năng Thanh tẩy.' },
  relic_devastating:{ id: 'relic_devastating',name: 'Mảnh vỡ định mệnh', color: '#9b59b6', grantsSkill: 'devastatingEnd', desc: 'Tự động sở hữu kỹ năng Ngưỡng.' },
  relic_explosive:  { id: 'relic_explosive',  name: 'Lõi bất ổn', color: '#c0392b', grantsSkill: 'explosive',  desc: 'Tự động sở hữu kỹ năng Bùng nổ.' },
}
export const EQUIPMENT_ORDER = Object.keys(EQUIPMENT)

export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
export function randColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)]
}
export function isComplete(c) {
  const hasAllStats = STAT_ORDER.every(s => c.stats && c.stats[s] != null)
  const hasClass = !('class' in c) || !!c.class
  const cls = c.class ? CLASSES[c.class] : null
  const hasClassStat = !cls || c.stats?.[cls.classStatKey] != null
  // Nhân vật cũ chưa có field equipment/skills coi như hợp lệ (tương thích ngược)
  const hasEquipment = !('equipCount' in c) || (Array.isArray(c.equipment) && c.equipment.length === c.equipCount)
  const hasSkills = !('skillCount' in c) || (Array.isArray(c.skills) && c.skills.length === c.skillCount)
  return hasAllStats && hasClass && hasClassStat && hasEquipment && hasSkills
}

