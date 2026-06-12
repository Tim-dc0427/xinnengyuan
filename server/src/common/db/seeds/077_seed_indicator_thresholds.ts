import type { Knex } from 'knex'
import { v4 as uuid } from 'uuid'

interface ThresholdDef {
  indicatorName: string
  indicatorLabel: string
  warningThreshold: number
  criticalThreshold: number
  unit: string
  voltageLevel: string | null
  region: string | null
}

const defaults: ThresholdDef[] = [
  // ==================== 电压偏差 ====================
  { indicatorName: 'voltage_deviation', indicatorLabel: '电压偏差', warningThreshold: 3, criticalThreshold: 5, unit: '%', voltageLevel: '220kV', region: null },
  { indicatorName: 'voltage_deviation', indicatorLabel: '电压偏差', warningThreshold: 5, criticalThreshold: 7, unit: '%', voltageLevel: '110kV', region: null },
  { indicatorName: 'voltage_deviation', indicatorLabel: '电压偏差', warningThreshold: 7, criticalThreshold: 10, unit: '%', voltageLevel: '10kV', region: null },
  // ==================== 三相不平衡度 ====================
  { indicatorName: 'three_phase_imbalance', indicatorLabel: '三相不平衡度', warningThreshold: 2, criticalThreshold: 4, unit: '%', voltageLevel: '220kV', region: null },
  { indicatorName: 'three_phase_imbalance', indicatorLabel: '三相不平衡度', warningThreshold: 3, criticalThreshold: 5, unit: '%', voltageLevel: '110kV', region: null },
  { indicatorName: 'three_phase_imbalance', indicatorLabel: '三相不平衡度', warningThreshold: 4, criticalThreshold: 8, unit: '%', voltageLevel: '10kV', region: null },
  // ==================== 设备负载率 ====================
  { indicatorName: 'equipment_load_rate', indicatorLabel: '设备负载率', warningThreshold: 80, criticalThreshold: 95, unit: '%', voltageLevel: '220kV', region: null },
  { indicatorName: 'equipment_load_rate', indicatorLabel: '设备负载率', warningThreshold: 85, criticalThreshold: 100, unit: '%', voltageLevel: '110kV', region: null },
  { indicatorName: 'equipment_load_rate', indicatorLabel: '设备负载率', warningThreshold: 90, criticalThreshold: 110, unit: '%', voltageLevel: '10kV', region: null },
  // ==================== 频率偏差 ====================
  { indicatorName: 'frequency_deviation', indicatorLabel: '频率偏差', warningThreshold: 0.2, criticalThreshold: 0.5, unit: 'Hz', voltageLevel: '220kV', region: null },
  { indicatorName: 'frequency_deviation', indicatorLabel: '频率偏差', warningThreshold: 0.5, criticalThreshold: 1.0, unit: 'Hz', voltageLevel: '110kV', region: null },
  { indicatorName: 'frequency_deviation', indicatorLabel: '频率偏差', warningThreshold: 0.5, criticalThreshold: 1.0, unit: 'Hz', voltageLevel: '10kV', region: null },
]

export async function seed(knex: Knex): Promise<void> {
  await knex('indicator_thresholds').where('is_custom', 0).del()

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const rows = defaults.map((d) => ({
    id: uuid(),
    indicator_name: d.indicatorName,
    indicator_label: d.indicatorLabel,
    warning_threshold: d.warningThreshold,
    critical_threshold: d.criticalThreshold,
    unit: d.unit,
    voltage_level: d.voltageLevel,
    region: d.region,
    enabled: 1,
    is_custom: 0,
    created_at: now,
    updated_at: now,
  }))

  await knex('indicator_thresholds').insert(rows)
}
