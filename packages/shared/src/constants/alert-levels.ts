export const ALERT_LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN',
  CRITICAL: 'CRITICAL',
  EMERGENCY: 'EMERGENCY',
} as const

export const ALERT_LEVEL_CONFIG = {
  INFO: { label: '信息', color: '#909399', priority: 0 },
  WARN: { label: '警告', color: '#E6A23C', priority: 1 },
  CRITICAL: { label: '严重', color: '#F56C6C', priority: 2 },
  EMERGENCY: { label: '紧急', color: '#FF0000', priority: 3 },
} as const

export const DEFAULT_VOLTAGE_THRESHOLD = 5 // 5% 电压波动阈值
export const DEFAULT_IMBALANCE_THRESHOLD = 2 // 2% 三相不平衡度阈值
