export const PV_PANEL_TYPES = {
  MONOCRYSTALLINE: 'MONOCRYSTALLINE',
  POLYCRYSTALLINE: 'POLYCRYSTALLINE',
  THIN_FILM: 'THIN_FILM',
} as const

export const PV_PANEL_TYPE_LABELS = {
  MONOCRYSTALLINE: '单晶硅',
  POLYCRYSTALLINE: '多晶硅',
  THIN_FILM: '薄膜',
} as const

export const PV_STATION_TYPES = {
  CENTRALIZED: 'CENTRALIZED',
  DISTRIBUTED: 'DISTRIBUTED',
  ROOFTOP: 'ROOFTOP',
} as const

export const PV_STATION_TYPE_LABELS = {
  CENTRALIZED: '集中式',
  DISTRIBUTED: '分布式',
  ROOFTOP: '屋顶式',
} as const

// 国家标准: 10kV电压允许偏差 ±7%
export const VOLTAGE_QUALIFICATION_STANDARD = {
  '10KV': { deviationPct: 7 },
  '35KV': { deviationPct: 5 },
  '110KV': { deviationPct: 3 },
} as const

// 功率因数目标区间
export const POWER_FACTOR_TARGET = { min: 0.95, max: 1.0 }
