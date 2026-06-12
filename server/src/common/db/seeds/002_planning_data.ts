import type { Knex } from 'knex'
import { v4 as uuid } from 'uuid'

export async function seed(knex: Knex): Promise<void> {
  // 仅清空规划模块自身管理的表
  await knex('equipment_lifecycle_records').del()
  await knex('cost_comparison_records').del()
  await knex('unit_cost_params').del()
  await knex('absorption_plans').del()
  await knex('candidate_points').del()
  await knex('constraint_rules').del()

  const now = new Date().toISOString()

  // ==================== Constraint Rules ====================
  await knex('constraint_rules').insert([
    { id: 'cr-seed-1', rule_name: '最小光照资源', rule_type: 'irradiance', weight: 0.30, enabled: true, params: JSON.stringify({ minAnnualIrradiance: 1300, unit: 'kWh/m²' }), description: '年均日照辐射量不低于1300kWh/m²', plan_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cr-seed-2', rule_name: '并网距离约束', rule_type: 'grid', weight: 0.25, enabled: true, params: JSON.stringify({ maxDistanceKm: 20 }), description: '接入点距最近变电站不超过20km', plan_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cr-seed-3', rule_name: '土地可用性', rule_type: 'land', weight: 0.20, enabled: true, params: JSON.stringify({ minAreaMu: 100, maxSlopeDeg: 15 }), description: '可用土地面积≥100亩，坡度≤15°', plan_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cr-seed-4', rule_name: '环境敏感区避让', rule_type: 'environment', weight: 0.15, enabled: true, params: JSON.stringify({ bufferKm: 2 }), description: '避开自然保护区、水源地等环境敏感区域2km以上', plan_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cr-seed-5', rule_name: '负荷中心距离', rule_type: 'custom', weight: 0.10, enabled: true, params: JSON.stringify({ maxDistanceToLoadKm: 30 }), description: '距负荷中心不超过30km', plan_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ])

  // Candidate Points — 余杭区数据
  await knex('candidate_points').insert([
    { id: 'cp-seed-1', plan_id: null, station_id: null, longitude: 119.83, latitude: 30.37, location_desc: '径山镇南部区块', recommended_capacity_kw: 30000, comprehensive_score: 85, scores: JSON.stringify({ absorption: 82, transmission: 78, economic: 88 }), absorption_capacity_kw: 24000, transmission_line_length_km: 8.5, transmission_cost: 12800000, land_cost: 18000000, constraint_description: '低山丘陵区，光照条件好，土地成本低，距110kV变电站约8.5km', priority: 1, status: 'selected', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cp-seed-2', plan_id: null, station_id: null, longitude: 119.92, latitude: 30.42, location_desc: '瓶窑镇北湖区块', recommended_capacity_kw: 50000, comprehensive_score: 90, scores: JSON.stringify({ absorption: 88, transmission: 85, economic: 92 }), absorption_capacity_kw: 42000, transmission_line_length_km: 6.2, transmission_cost: 9500000, land_cost: 22000000, constraint_description: '北湖草荡周边，地势开阔，距220kV变电站约6km', priority: 2, status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cp-seed-3', plan_id: null, station_id: null, longitude: 120.14, latitude: 30.43, location_desc: '仁和街道工业园区', recommended_capacity_kw: 20000, comprehensive_score: 75, scores: JSON.stringify({ absorption: 70, transmission: 92, economic: 72 }), absorption_capacity_kw: 16000, transmission_line_length_km: 3.0, transmission_cost: 4500000, land_cost: 48000000, constraint_description: '工业屋顶资源丰富，接入条件极佳，但土地/屋顶成本较高', priority: 3, status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cp-seed-4', plan_id: null, station_id: null, longitude: 119.94, latitude: 30.26, location_desc: '余杭街道城西区块', recommended_capacity_kw: 25000, comprehensive_score: 78, scores: JSON.stringify({ absorption: 76, transmission: 82, economic: 76 }), absorption_capacity_kw: 20000, transmission_line_length_km: 4.5, transmission_cost: 6800000, land_cost: 35000000, constraint_description: '城郊结合部，可利用闲置用地，距变电站较近', priority: 4, status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cp-seed-5', plan_id: null, station_id: null, longitude: 119.91, latitude: 30.21, location_desc: '中泰街道南峰区块', recommended_capacity_kw: 35000, comprehensive_score: 82, scores: JSON.stringify({ absorption: 85, transmission: 72, economic: 84 }), absorption_capacity_kw: 28000, transmission_line_length_km: 12.0, transmission_cost: 18000000, land_cost: 15000000, constraint_description: '低丘缓坡地，光照充足，土地成本低，但送出距离较远', priority: 5, status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cp-seed-6', plan_id: null, station_id: null, longitude: 120.05, latitude: 30.40, location_desc: '良渚街道安溪区块', recommended_capacity_kw: 15000, comprehensive_score: 72, scores: JSON.stringify({ absorption: 74, transmission: 80, economic: 68 }), absorption_capacity_kw: 11000, transmission_line_length_km: 7.0, transmission_cost: 10500000, land_cost: 42000000, constraint_description: '靠近良渚遗址保护区，可用地有限，接入条件一般', priority: 6, status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cp-seed-7', plan_id: null, station_id: null, longitude: 120.00, latitude: 30.29, location_desc: '仓前街道高铁新城', recommended_capacity_kw: 10000, comprehensive_score: 65, scores: JSON.stringify({ absorption: 62, transmission: 95, economic: 58 }), absorption_capacity_kw: 7000, transmission_line_length_km: 2.0, transmission_cost: 3000000, land_cost: 60000000, constraint_description: '未来科技城核心区，接入极佳但土地成本极高，适合屋顶分布式', priority: 7, status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cp-seed-8', plan_id: null, station_id: null, longitude: 120.01, latitude: 30.24, location_desc: '闲林街道万景区块', recommended_capacity_kw: 18000, comprehensive_score: 71, scores: JSON.stringify({ absorption: 73, transmission: 76, economic: 70 }), absorption_capacity_kw: 13000, transmission_line_length_km: 9.5, transmission_cost: 14300000, land_cost: 38000000, constraint_description: '近城区丘陵地，光照一般，土地成本中等', priority: 8, status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ])

  // Unit Cost Params
  await knex('unit_cost_params').insert([
    { id: 'uc-seed-1', category: 'equipment', item_name: '光伏组件(单晶硅)', unit_cost: 1800, unit: '元/kW', cost_type: 'per_kw', effective_date: '2026-01-01', remark: '主流市场价', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'uc-seed-2', category: 'equipment', item_name: '组串式逆变器', unit_cost: 350, unit: '元/kW', cost_type: 'per_kw', effective_date: '2026-01-01', remark: '含智能运维系统', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'uc-seed-3', category: 'construction', item_name: '土建安装', unit_cost: 500, unit: '元/kW', cost_type: 'per_kw', effective_date: '2026-01-01', remark: '含基础施工', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'uc-seed-4', category: 'construction', item_name: '电气安装', unit_cost: 100, unit: '元/kW', cost_type: 'per_kw', effective_date: '2026-01-01', remark: '并网接入', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'uc-seed-5', category: 'land', item_name: '土地征用(戈壁)', unit_cost: 1.5, unit: '万元/亩', cost_type: 'per_mu', effective_date: '2026-01-01', remark: '西部地区参考价', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'uc-seed-6', category: 'land', item_name: '土地征用(农用地)', unit_cost: 4.0, unit: '万元/亩', cost_type: 'per_mu', effective_date: '2026-01-01', remark: '需审批', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'uc-seed-7', category: 'other', item_name: '勘察设计费', unit_cost: 120, unit: '元/kW', cost_type: 'per_kw', effective_date: '2026-01-01', remark: '可研+初设', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ])

  // Absorption Plans
  await knex('absorption_plans').insert([
    {
      id: 'ap-seed-1', scheme_id: 'scheme-1', plan_name: '阳光电站A消纳方案', candidate_point_id: 'cp-seed-1',
      storage_config: JSON.stringify({ requiredCapacityKwh: 20000, requiredPowerKw: 10000, storageType: 'lithium', durationHours: 2, estimatedCost: 30000000, layoutPlan: '集中式布置于升压站附近' }),
      reactive_comp_config: JSON.stringify({ compType: 'SVG', requiredCapacityKvar: 8000, targetPowerFactor: 0.95, estimatedCost: 4800000 }),
      line_modification: JSON.stringify({ modificationType: 'upgrade_conductor', currentSpec: 'LGJ-240', targetSpec: 'LGJ-400', lineLengthKm: 12.5, estimatedCost: 12500000, description: '导线截面升级，提升输送容量' }),
      pv_output_profile: JSON.stringify([{ time: '00:00', outputKw: 0 }, { time: '04:00', outputKw: 0 }, { time: '06:00', outputKw: 5000 }, { time: '08:00', outputKw: 25000 }, { time: '10:00', outputKw: 42000 }, { time: '12:00', outputKw: 50000 }, { time: '14:00', outputKw: 45000 }, { time: '16:00', outputKw: 30000 }, { time: '18:00', outputKw: 10000 }, { time: '20:00', outputKw: 0 }, { time: '23:00', outputKw: 0 }]),
      load_profile: JSON.stringify([{ time: '00:00', loadKw: 15000 }, { time: '04:00', loadKw: 12000 }, { time: '06:00', loadKw: 18000 }, { time: '08:00', loadKw: 35000 }, { time: '10:00', loadKw: 42000 }, { time: '12:00', loadKw: 38000 }, { time: '14:00', loadKw: 36000 }, { time: '16:00', loadKw: 40000 }, { time: '18:00', loadKw: 45000 }, { time: '20:00', loadKw: 35000 }, { time: '23:00', loadKw: 20000 }]),
      absorption_capacity_kw: 45000, investment_cost: 47300000, annual_benefit: 18500000,
      parameters: JSON.stringify({ peakShavingRatio: 0.25, selfConsumptionRate: 0.60, curtailmentRate: 0.05 }),
      status: 'completed', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    },
  ])
}
