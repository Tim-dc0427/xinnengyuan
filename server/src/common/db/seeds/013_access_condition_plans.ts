import type { Knex } from 'knex'
import { v4 as uuid } from 'uuid'

export async function seed(knex: Knex): Promise<void> {
  await knex('access_condition_plans').del()

  const now = new Date().toISOString()

  const normalPlan = [
    { code: 'annual_irradiance', label: '年均辐照度', unit: 'kWh/㎡·年', enabled: true, op: '>=', threshold: 1500, category: '光伏资源' },
    { code: 'sunshine_hours', label: '年日照小时数', unit: 'h', enabled: true, op: '>=', threshold: 1300, category: '光伏资源' },
    { code: 'solar_grade', label: '资源等级', unit: '', enabled: false, op: 'in', threshold: 'A,B', category: '光伏资源' },
    { code: 'voltage_kv', label: '并网电压等级', unit: 'kV', enabled: true, op: '>=', threshold: 35, category: '电网条件' },
    { code: 'short_circuit_capacity_mva', label: '短路容量', unit: 'MVA', enabled: true, op: '>=', threshold: 100, category: '电网条件' },
    { code: 'corridor_available', label: '走廊可用性', unit: '', enabled: true, op: '==', threshold: '可用', category: '电网条件' },
    { code: 'transmission_line_length_km', label: '接入距离', unit: 'km', enabled: true, op: '<=', threshold: 10, category: '电网条件' },
    { code: 'unit_cost', label: '单位造价', unit: '元/W', enabled: true, op: '<=', threshold: 4.5, category: '投资条件' },
    { code: 'payback_years', label: '投资回收期', unit: '年', enabled: false, op: '<=', threshold: 8, category: '投资条件' },
    { code: 'irr_pct', label: '内部收益率', unit: '%', enabled: false, op: '>=', threshold: 8, category: '投资条件' },
    { code: 'land_type', label: '土地性质', unit: '', enabled: true, op: 'in', threshold: '未利用地,建设用地,草地', category: '环境条件' },
    { code: 'env_sensitivity', label: '环保敏感性', unit: '', enabled: true, op: '!=', threshold: '敏感', category: '环境条件' },
    { code: 'geohazard_risk', label: '地质灾害风险', unit: '', enabled: false, op: '!=', threshold: '高', category: '环境条件' },
  ]

  const premiumPlan = [
    { code: 'annual_irradiance', label: '年均辐照度', unit: 'kWh/㎡·年', enabled: true, op: '>=', threshold: 1600, category: '光伏资源' },
    { code: 'sunshine_hours', label: '年日照小时数', unit: 'h', enabled: true, op: '>=', threshold: 1400, category: '光伏资源' },
    { code: 'solar_grade', label: '资源等级', unit: '', enabled: true, op: 'in', threshold: 'A,B', category: '光伏资源' },
    { code: 'voltage_kv', label: '并网电压等级', unit: 'kV', enabled: true, op: '>=', threshold: 110, category: '电网条件' },
    { code: 'short_circuit_capacity_mva', label: '短路容量', unit: 'MVA', enabled: true, op: '>=', threshold: 200, category: '电网条件' },
    { code: 'corridor_available', label: '走廊可用性', unit: '', enabled: true, op: '==', threshold: '可用', category: '电网条件' },
    { code: 'transmission_line_length_km', label: '接入距离', unit: 'km', enabled: true, op: '<=', threshold: 5, category: '电网条件' },
    { code: 'unit_cost', label: '单位造价', unit: '元/W', enabled: true, op: '<=', threshold: 4.0, category: '投资条件' },
    { code: 'payback_years', label: '投资回收期', unit: '年', enabled: false, op: '<=', threshold: 6, category: '投资条件' },
    { code: 'irr_pct', label: '内部收益率', unit: '%', enabled: true, op: '>=', threshold: 10, category: '投资条件' },
    { code: 'land_type', label: '土地性质', unit: '', enabled: true, op: 'in', threshold: '未利用地,建设用地', category: '环境条件' },
    { code: 'env_sensitivity', label: '环保敏感性', unit: '', enabled: true, op: '==', threshold: '不敏感', category: '环境条件' },
    { code: 'geohazard_risk', label: '地质灾害风险', unit: '', enabled: true, op: '==', threshold: '低', category: '环境条件' },
  ]

  await knex('access_condition_plans').insert([
    { id: uuid(), name: '常规筛选方案', plan_type: 'normal', conditions: JSON.stringify(normalPlan), created_at: now },
    { id: uuid(), name: '优质资源筛选方案', plan_type: 'premium', conditions: JSON.stringify(premiumPlan), created_at: now },
  ])
}
