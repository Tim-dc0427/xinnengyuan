import type { Knex } from 'knex'
import { v4 as uuid } from 'uuid'

export async function seed(knex: Knex): Promise<void> {
  // Clear planning tables
  await knex('equipment_lifecycle_records').del()
  await knex('equipment_ledger').del()
  await knex('cost_comparison_records').del()
  await knex('unit_cost_params').del()
  await knex('absorption_plans').del()
  await knex('candidate_points').del()
  await knex('constraint_rules').del()
  await knex('pv_cost_library').del()
  await knex('pv_stations').del()

  // PV Stations
  await knex('pv_stations').insert([
    { id: 'pv-seed-1', name: '阳光集中式光伏电站A', capacity_kw: 50000, panel_type: 'mono-si', rated_voltage_kv: 110, longitude: 116.4, latitude: 39.9, land_type: 'desert', land_area_mu: 1500, electrical_params: JSON.stringify({ efficiency: 20.5, temperature_coefficient: -0.35 }), equipment_list: JSON.stringify([{ equipmentType: 'pv_module', modelNumber: 'HC-550W', quantity: 91000, unitPrice: 1800 }]), status: 'operating', plan_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'pv-seed-2', name: '绿能光伏电站B', capacity_kw: 30000, panel_type: 'poly-si', rated_voltage_kv: 35, longitude: 117.0, latitude: 36.7, land_type: 'agricultural', land_area_mu: 800, electrical_params: JSON.stringify({ efficiency: 18.2, temperature_coefficient: -0.40 }), equipment_list: JSON.stringify([{ equipmentType: 'pv_module', modelNumber: 'T-660W', quantity: 46000, unitPrice: 2100 }]), status: 'construction', plan_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'pv-seed-3', name: '远景光伏电站C', capacity_kw: 80000, panel_type: 'thin-film', rated_voltage_kv: 220, longitude: 115.8, latitude: 38.9, land_type: 'gobi', land_area_mu: 2500, electrical_params: JSON.stringify({ efficiency: 16.8, temperature_coefficient: -0.30 }), equipment_list: JSON.stringify([{ equipmentType: 'pv_module', modelNumber: 'TF-500W', quantity: 160000, unitPrice: 1500 }]), status: 'planning', plan_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ])

  const now = new Date().toISOString()

  // ==================== Equipment Ledger Seed Data ====================

  // Station A: 阳光集中式光伏电站A (50MW, 已并网运行)
  await knex('equipment_ledger').insert([
    {
      id: uuid(), station_id: 'pv-seed-1', equipment_type: 'pv_module',
      equipment_code: 'PV-SEA-001', model_number: 'HC-550W', manufacturer: '隆基绿能',
      equipment_type_label: '光伏组件', quantity: 91000,
      rated_params: JSON.stringify({ peakPower: 550, efficiency: 21.5, voc: 49.6, vmp: 41.8, isc: 13.9, imp: 13.2, cellCount: 144, cellType: 'mono-si', dimensions: '2279×1134×35mm', weight: 32.5, tempCoefficient: -0.35, warrantyYears: 25 }),
      install_date: '2025-12-10', status: 'operating', location_desc: 'A区-1#~9#方阵',
      created_at: now, updated_at: now,
    },
    {
      id: uuid(), station_id: 'pv-seed-1', equipment_type: 'pv_module',
      equipment_code: 'PV-SEA-002', model_number: 'LR5-72HTH-550M', manufacturer: '隆基绿能',
      equipment_type_label: '光伏组件', quantity: 45000,
      rated_params: JSON.stringify({ peakPower: 550, efficiency: 21.8, voc: 50.1, vmp: 42.3, isc: 13.8, imp: 13.0, cellCount: 144, cellType: 'mono-si', dimensions: '2256×1133×30mm', weight: 31.8, tempCoefficient: -0.34, warrantyYears: 30 }),
      install_date: '2026-01-15', status: 'operating', location_desc: 'B区-1#~4#方阵',
      created_at: now, updated_at: now,
    },
    {
      id: uuid(), station_id: 'pv-seed-1', equipment_type: 'inverter',
      equipment_code: 'INV-SEA-001', model_number: 'SG-250HV', manufacturer: '华为数字能源',
      equipment_type_label: '逆变器', quantity: 200,
      rated_params: JSON.stringify({ ratedPower: 250, maxDcVoltage: 1500, minDcVoltage: 200, mpptCount: 10, mpptVoltageRange: '200-1000', acOutputVoltage: 800, ratedOutputCurrent: 180, maxEfficiency: 99.0, euroEfficiency: 98.7, protectionLevel: 'IP66', coolingMethod: 'forced_air', noiseLevel: 65 }),
      install_date: '2025-12-20', status: 'operating', location_desc: 'A区逆变器房#1~#10',
      created_at: now, updated_at: now,
    },
    {
      id: uuid(), station_id: 'pv-seed-1', equipment_type: 'transformer',
      equipment_code: 'TF-SEA-001', model_number: 'S11-2500/35', manufacturer: '特变电工',
      equipment_type_label: '变压器', quantity: 25,
      rated_params: JSON.stringify({ ratedCapacity: 2500, primaryVoltage: 35, secondaryVoltage: 0.8, connectionGroup: 'Dyn11', noLoadLoss: 2750, loadLoss: 21500, impedanceVoltage: 6.5, noLoadCurrent: 0.8, coolingMethod: 'on', insulationLevel: 'F', weight: 6800 }),
      install_date: '2025-11-20', status: 'operating', location_desc: '1#~25#箱变基础',
      created_at: now, updated_at: now,
    },
    {
      id: uuid(), station_id: 'pv-seed-1', equipment_type: 'cable',
      equipment_code: 'CBL-SEA-001', model_number: 'PV1-F-1×4', manufacturer: '远东电缆',
      equipment_type_label: '电缆', quantity: 500000, unit_price: 4.5,
      rated_params: JSON.stringify({ conductorMaterial: 'copper', conductorSection: 4, cableType: 'single_core', ratedVoltage: 0.6, currentCapacity: 55, insulationMaterial: 'xlpe', outerDiameter: 6.2, weightPerMeter: 0.08, minBendingRadius: 75, flameRetardant: 'C' }),
      install_date: '2025-10-15', status: 'operating', location_desc: '组件阵列间直流线缆',
      created_at: now, updated_at: now,
    },
    {
      id: uuid(), station_id: 'pv-seed-1', equipment_type: 'cable',
      equipment_code: 'CBL-SEA-002', model_number: 'YJV22-8.7/15-3×300', manufacturer: '远东电缆',
      equipment_type_label: '电缆', quantity: 8500, unit_price: 680,
      rated_params: JSON.stringify({ conductorMaterial: 'copper', conductorSection: 300, cableType: 'three_core', ratedVoltage: 8.7, currentCapacity: 610, insulationMaterial: 'xlpe', outerDiameter: 82.5, weightPerMeter: 12.5, minBendingRadius: 990, flameRetardant: 'C' }),
      install_date: '2025-10-20', status: 'operating', location_desc: '集电线路-箱变至升压站',
      created_at: now, updated_at: now,
    },
    {
      id: uuid(), station_id: 'pv-seed-1', equipment_type: 'switchgear',
      equipment_code: 'SWG-SEA-001', model_number: 'KYN28A-12', manufacturer: '正泰电器',
      equipment_type_label: '开关柜', quantity: 15,
      rated_params: JSON.stringify({ ratedVoltage: 12, ratedCurrent: 1250, shortCircuitBreaking: 31.5, shortCircuitMaking: 80, peakWithstandCurrent: 80, operationMode: 'drawer', insulationMedium: 'air', protectionLevel: 'IP4X', cabinetType: 'kyn', numberOfCircuits: 6 }),
      install_date: '2025-11-05', status: 'operating', location_desc: '升压站10kV开关室',
      created_at: now, updated_at: now,
    },
    {
      id: uuid(), station_id: 'pv-seed-1', equipment_type: 'switchgear',
      equipment_code: 'SWG-SEA-002', model_number: 'GGD-2000A', manufacturer: '正泰电器',
      equipment_type_label: '开关柜', quantity: 8,
      rated_params: JSON.stringify({ ratedVoltage: 0.4, ratedCurrent: 2000, shortCircuitBreaking: 50, shortCircuitMaking: 105, peakWithstandCurrent: 105, operationMode: 'fixed', insulationMedium: 'air', protectionLevel: 'IP3X', cabinetType: 'ggd', numberOfCircuits: 4 }),
      install_date: '2025-11-10', status: 'operating', location_desc: '站用配电室',
      created_at: now, updated_at: now,
    },
  ])

  // Station B: 绿能光伏电站B (30MW, 建设中)
  await knex('equipment_ledger').insert([
    {
      id: uuid(), station_id: 'pv-seed-2', equipment_type: 'pv_module',
      equipment_code: 'PV-SEB-001', model_number: 'Vertex T-660W', manufacturer: '天合光能',
      equipment_type_label: '光伏组件', quantity: 46000,
      rated_params: JSON.stringify({ peakPower: 660, efficiency: 22.3, voc: 50.2, vmp: 42.5, isc: 16.8, imp: 15.5, cellCount: 132, cellType: 'bifacial', dimensions: '2384×1303×35mm', weight: 38.7, tempCoefficient: -0.32, warrantyYears: 30 }),
      install_date: '2026-03-01', status: 'installed', location_desc: '1#~5#方阵(已安装)',
      created_at: now, updated_at: now,
    },
    {
      id: uuid(), station_id: 'pv-seed-2', equipment_type: 'inverter',
      equipment_code: 'INV-SEB-001', model_number: 'SG-110CX', manufacturer: '阳光电源',
      equipment_type_label: '逆变器', quantity: 120,
      rated_params: JSON.stringify({ ratedPower: 110, maxDcVoltage: 1100, minDcVoltage: 180, mpptCount: 6, mpptVoltageRange: '180-950', acOutputVoltage: 400, ratedOutputCurrent: 160, maxEfficiency: 98.7, euroEfficiency: 98.4, protectionLevel: 'IP65', coolingMethod: 'forced_air', noiseLevel: 58 }),
      install_date: null, status: 'installed', location_desc: '逆变器房(待调试)',
      created_at: now, updated_at: now,
    },
    {
      id: uuid(), station_id: 'pv-seed-2', equipment_type: 'transformer',
      equipment_code: 'TF-SEB-001', model_number: 'S13-2000/35', manufacturer: '许继电气',
      equipment_type_label: '变压器', quantity: 15,
      rated_params: JSON.stringify({ ratedCapacity: 2000, primaryVoltage: 35, secondaryVoltage: 0.4, connectionGroup: 'Dyn11', noLoadLoss: 2150, loadLoss: 18500, impedanceVoltage: 6.0, noLoadCurrent: 0.6, coolingMethod: 'on', insulationLevel: 'F', weight: 5500 }),
      install_date: '2026-03-10', status: 'installed', location_desc: '1#~15#箱变基础',
      created_at: now, updated_at: now,
    },
    {
      id: uuid(), station_id: 'pv-seed-2', equipment_type: 'cable',
      equipment_code: 'CBL-SEB-001', model_number: 'ZC-YJV-8.7/15-3×240', manufacturer: '中天科技',
      equipment_type_label: '电缆', quantity: 12000, unit_price: 520,
      rated_params: JSON.stringify({ conductorMaterial: 'copper', conductorSection: 240, cableType: 'three_core', ratedVoltage: 8.7, currentCapacity: 510, insulationMaterial: 'xlpe', outerDiameter: 75.2, weightPerMeter: 10.8, minBendingRadius: 900, flameRetardant: 'C' }),
      install_date: '2026-02-20', status: 'installed', location_desc: '集电线路(已敷设)',
      created_at: now, updated_at: now,
    },
    {
      id: uuid(), station_id: 'pv-seed-2', equipment_type: 'switchgear',
      equipment_code: 'SWG-SEB-001', model_number: 'KYN28-12', manufacturer: '正泰电器',
      equipment_type_label: '开关柜', quantity: 6,
      rated_params: JSON.stringify({ ratedVoltage: 12, ratedCurrent: 630, shortCircuitBreaking: 25, shortCircuitMaking: 63, peakWithstandCurrent: 63, operationMode: 'drawer', insulationMedium: 'air', protectionLevel: 'IP4X', cabinetType: 'kyn', numberOfCircuits: 4 }),
      install_date: null, status: 'installed', location_desc: '35kV开关站(安装中)',
      created_at: now, updated_at: now,
    },
  ])

  // Station C: 远景光伏电站C (80MW, 规划中)
  await knex('equipment_ledger').insert([
    {
      id: uuid(), station_id: 'pv-seed-3', equipment_type: 'pv_module',
      equipment_code: 'PV-SEC-001', model_number: 'JKM-600M', manufacturer: '晶科能源',
      equipment_type_label: '光伏组件', quantity: 160000,
      rated_params: JSON.stringify({ peakPower: 600, efficiency: 22.8, voc: 51.2, vmp: 42.8, isc: 14.5, imp: 14.0, cellCount: 156, cellType: 'hjt', dimensions: '2384×1303×35mm', weight: 36.5, tempCoefficient: -0.31, warrantyYears: 30 }),
      install_date: null, status: 'installed', location_desc: '物资仓库(已到货)',
      created_at: now, updated_at: now,
    },
    {
      id: uuid(), station_id: 'pv-seed-3', equipment_type: 'inverter',
      equipment_code: 'PV-SEC-001', model_number: 'SUN2000-300KTL', manufacturer: '华为数字能源',
      equipment_type_label: '逆变器', quantity: 240,
      rated_params: JSON.stringify({ ratedPower: 300, maxDcVoltage: 1500, minDcVoltage: 200, mpptCount: 12, mpptVoltageRange: '200-1300', acOutputVoltage: 800, ratedOutputCurrent: 216, maxEfficiency: 99.1, euroEfficiency: 98.9, protectionLevel: 'IP66', coolingMethod: 'liquid', noiseLevel: 68 }),
      install_date: null, status: 'installed', location_desc: '物资仓库(待安装)',
      created_at: now, updated_at: now,
    },
    {
      id: uuid(), station_id: 'pv-seed-3', equipment_type: 'transformer',
      equipment_code: 'PV-SEC-001', model_number: 'SZ18-5000/220', manufacturer: '中国西电',
      equipment_type_label: '变压器', quantity: 1,
      rated_params: JSON.stringify({ ratedCapacity: 5000, primaryVoltage: 220, secondaryVoltage: 35, connectionGroup: 'YNd11', noLoadLoss: 4200, loadLoss: 32000, impedanceVoltage: 8.0, noLoadCurrent: 0.5, coolingMethod: 'of', insulationLevel: 'H', weight: 25000 }),
      install_date: null, status: 'installed', location_desc: '升压站(基础施工中)',
      created_at: now, updated_at: now,
    },
  ])

  // ==================== PV Cost Library (unchanged) ====================
  await knex('pv_cost_library').insert([
    { id: 'cl-seed-1', model_name: '高效单晶组件HC-550W', model_type: 'pv_module', manufacturer: '隆基绿能', unit_cost_per_kw: 1800, rated_power_kw: 0.55, efficiency_pct: 21.5, lifespan_years: 30, technical_params: JSON.stringify({ voc: 49.6, isc: 13.9, vmp: 41.8, imp: 13.2 }), remark: '主流高效型号，适用于大型地面电站', created_at: new Date().toISOString() },
    { id: 'cl-seed-2', model_name: '组串式逆变器SG-250KW', model_type: 'inverter', manufacturer: '华为数字能源', unit_cost_per_kw: 350, rated_power_kw: 250, efficiency_pct: 98.5, lifespan_years: 15, technical_params: JSON.stringify({ mpptVoltageRange: '200-1000', maxInputCurrent: 30, protectionLevel: 'IP65' }), remark: '智能运维支持', created_at: new Date().toISOString() },
    { id: 'cl-seed-3', model_name: '双面双玻组件T-660W', model_type: 'pv_module', manufacturer: '天合光能', unit_cost_per_kw: 2100, rated_power_kw: 0.66, efficiency_pct: 22.3, lifespan_years: 30, technical_params: JSON.stringify({ voc: 50.2, isc: 16.8, bifaciality: 80 }), remark: '高发电量，双面增益', created_at: new Date().toISOString() },
    { id: 'cl-seed-4', model_name: '箱式变压器S11-2000', model_type: 'transformer', manufacturer: '特变电工', unit_cost_per_kw: 120, rated_power_kw: 2000, efficiency_pct: 99.0, lifespan_years: 25, technical_params: JSON.stringify({ voltageRatio: '10/0.4', connectionGroup: 'Dyn11', impedancePct: 6.0 }), remark: '升压并网', created_at: new Date().toISOString() },
    { id: 'cl-seed-5', model_name: '光伏电缆PV1-F 4mm²', model_type: 'cable', manufacturer: '远东电缆', unit_cost_per_kw: 45, rated_power_kw: 0, efficiency_pct: 0, lifespan_years: 25, technical_params: JSON.stringify({ crossSection: 4, ratedVoltage: '0.6/1kV', temperatureRange: '-40~90' }), remark: '耐候光伏专用电缆', created_at: new Date().toISOString() },
  ])

  // Constraint Rules
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
