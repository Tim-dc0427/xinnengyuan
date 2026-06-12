import { ref } from 'vue'
import { fetchThresholds } from '@/api/power-flow'
import type { ThresholdItem } from '@/api/power-flow'

/**
 * 阈值匹配优先级：
 * 1. (indicator, voltageLevel, region) 完全匹配
 * 2. (indicator, voltageLevel, null) 电压等级默认
 * 3. (indicator, null, null) 全局默认
 */
export function useThresholds() {
  const thresholds = ref<ThresholdItem[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      thresholds.value = (await fetchThresholds()).filter(t => t.enabled !== false)
    } catch {
      thresholds.value = []
    } finally {
      loading.value = false
    }
  }

  /** 查找最佳匹配的阈值 */
  function match(indicatorName: string, voltageLevel?: string | null, region?: string | null): ThresholdItem | null {
    const candidates = thresholds.value.filter(t => t.indicatorName === indicatorName)

    // 1. 完全匹配
    let found = candidates.find(t => t.voltageLevel === voltageLevel && t.region === region)
    if (found) return found

    // 2. 电压等级匹配（region 为 null）
    found = candidates.find(t => t.voltageLevel === voltageLevel && !t.region)
    if (found) return found

    // 3. 全局默认（voltageLevel 和 region 均为 null）
    found = candidates.find(t => !t.voltageLevel && !t.region)
    if (found) return found

    // 4. 最宽松：该指标任意一条（兜底）
    return candidates[0] || null
  }

  /** 判断数值的预警状态 */
  function getStatus(indicatorName: string, value: number, voltageLevel?: string | null, region?: string | null): 'normal' | 'warning' | 'critical' {
    const t = match(indicatorName, voltageLevel, region)
    if (!t || !t.enabled) return 'normal'
    if (value >= t.criticalThreshold) return 'critical'
    if (value >= t.warningThreshold) return 'warning'
    return 'normal'
  }

  /** 获取某指标的行样式类名 */
  function rowClass(indicatorName: string, value: number, voltageLevel?: string | null, region?: string | null): string {
    const status = getStatus(indicatorName, value, voltageLevel, region)
    if (status === 'critical') return 'critical-row'
    if (status === 'warning') return 'warning-row'
    return ''
  }

  return { thresholds, loading, load, match, getStatus, rowClass }
}
