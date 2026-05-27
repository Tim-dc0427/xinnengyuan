import type { Knex } from 'knex'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'

export async function seed(knex: Knex): Promise<void> {
  // Clear all tables in reverse dependency order
  await knex('solar_pv_stations').del()
  await knex('manual_intervention_log').del()
  await knex('execution_evaluations').del()
  await knex('simulation_runs').del()
  await knex('strategies').del()
  await knex('scenario_resources').del()
  await knex('scenarios').del()
  await knex('resource_relationships').del()
  await knex('resource_models').del()
  await knex('output_curve_templates').del()
  await knex('confidence_coefficient_settings').del()
  await knex('data_validation_records').del()
  await knex('batch_calc_groups').del()
  await knex('calc_results').del()
  await knex('calc_tasks').del()
  await knex('project_audit').del()
  await knex('effectiveness_verifications').del()
  await knex('feasibility_assessments').del()
  await knex('access_conditions').del()
  await knex('projects').del()
  await knex('equipment_ledger').del()
  await knex('economic_analyses').del()
  await knex('absorption_schemes').del()
  await knex('site_recommendations').del()
  await knex('plans').del()
  await knex('carbon_emissions').del()
  await knex('alerts').del()
  await knex('voltage_measurements').del()
  await knex('battery_cycle_records').del()
  await knex('equipment_lifecycle').del()
  await knex('equipment').del()
  await knex('pv_output_measurements').del()
  await knex('power_plants').del()
  await knex('audit_logs').del()
  await knex('users').del()
  await knex('roles').del()

  // Roles
  const adminRoleId = uuid()
  const plannerRoleId = uuid()
  const operatorRoleId = uuid()
  const viewerRoleId = uuid()

  await knex('roles').insert([
    { id: adminRoleId, name: 'admin', permissions: '["*"]' },
    { id: plannerRoleId, name: 'planner', permissions: '["read","write","calculate"]' },
    { id: operatorRoleId, name: 'operator', permissions: '["read","calculate"]' },
    { id: viewerRoleId, name: 'viewer', permissions: '["read"]' },
  ])

  // Users
  const passwordHash = await bcrypt.hash('password123', 10)
  await knex('users').insert([
    { id: uuid(), username: 'admin', password_hash: passwordHash, display_name: '系统管理员', role_id: adminRoleId, department: '信息中心' },
    { id: uuid(), username: 'planner', password_hash: passwordHash, display_name: '规划人员', role_id: plannerRoleId, department: '规划部' },
    { id: uuid(), username: 'operator', password_hash: passwordHash, display_name: '运行人员', role_id: operatorRoleId, department: '运检部' },
    { id: uuid(), username: 'viewer', password_hash: passwordHash, display_name: '查看人员', role_id: viewerRoleId, department: '发展部' },
  ])

  // Power plants
  const plantAId = uuid()
  const plantBId = uuid()
  const plantCId = uuid()
  const plantDId = uuid()
  const plantEId = uuid()
  const plantFId = uuid()
  const plantGId = uuid()
  const plantHId = uuid()
  const plantIId = uuid()
  const plantJId = uuid()
  const plantKId = uuid()
  const plantLId = uuid()

  await knex('power_plants').insert([
    { id: plantAId, name: '阳光集中式光伏电站A', plant_type: 'PV', capacity_kw: 50000, installed_date: '2023-06-01', longitude: 120.15, latitude: 30.28, status: 'active' },
    { id: plantBId, name: '绿能集中式光伏电站B', plant_type: 'PV', capacity_kw: 30000, installed_date: '2024-03-15', longitude: 120.20, latitude: 30.32, status: 'active' },
    { id: plantCId, name: '清源储能电站', plant_type: 'STORAGE', capacity_kw: 10000, installed_date: '2024-01-01', longitude: 120.10, latitude: 30.25, status: 'active' },
    { id: plantDId, name: '径山镇宇航梦园渔光互补光伏项目', plant_type: 'PV', capacity_kw: 5440, installed_date: '2026-04-01', longitude: 119.85, latitude: 30.35, status: 'active' },
    { id: plantEId, name: '舒能渔光互补光伏项目', plant_type: 'PV', capacity_kw: 400000, installed_date: '2025-12-01', longitude: 120.58, latitude: 30.28, address: '杭州市钱塘区临江街道', status: 'active' },
    { id: plantFId, name: '嘉达渔光互补光伏项目', plant_type: 'PV', capacity_kw: 350000, installed_date: '2025-12-01', longitude: 120.60, latitude: 30.29, address: '杭州市钱塘区临江街道', status: 'active' },
    { id: plantGId, name: '凌能渔光互补光伏项目', plant_type: 'PV', capacity_kw: 250000, installed_date: '2025-12-01', longitude: 120.55, latitude: 30.27, address: '杭州市钱塘区临江街道', status: 'active' },
    { id: plantHId, name: '华洋山地光伏电站', plant_type: 'PV', capacity_kw: 155000, installed_date: '2024-08-30', longitude: 119.28, latitude: 29.47, address: '杭州市建德市', status: 'active' },
    { id: plantIId, name: '临安青山集中式光伏电站', plant_type: 'PV', capacity_kw: 60000, installed_date: '2024-06-15', longitude: 119.72, latitude: 30.23, address: '杭州市临安区青山湖街道', status: 'active' },
    { id: plantJId, name: '临安太湖源集中式光伏电站', plant_type: 'PV', capacity_kw: 40000, installed_date: '2024-06-15', longitude: 119.55, latitude: 30.32, address: '杭州市临安区太湖源镇', status: 'active' },
    { id: plantKId, name: '萧山南阳集中式光伏电站', plant_type: 'PV', capacity_kw: 50000, installed_date: '2024-09-01', longitude: 120.45, latitude: 30.25, address: '杭州市萧山区南阳街道', status: 'active' },
    { id: plantLId, name: '富阳渔山集中式光伏电站', plant_type: 'PV', capacity_kw: 30000, installed_date: '2024-05-01', longitude: 120.05, latitude: 30.05, address: '杭州市富阳区渔山乡', status: 'active' },
  ])

  // Equipment — 每个电站至少 2~4 台设备，命名反映实际电网业务
  const eqA1Id = uuid()  // plantA 变压器
  const eqA2Id = uuid()  // plantA 逆变器
  const eqB1Id = uuid()  // plantB 变压器
  const eqB2Id = uuid()  // plantB 逆变器
  const eqC1Id = uuid()  // plantC 变压器
  const eqC2Id = uuid()  // plantC 电池组
  const eqC3Id = uuid()  // plantC 电池1
  const eqC4Id = uuid()  // plantC 电池2
  const eqD1Id = uuid()  // plantD 变压器
  const eqD2Id = uuid()  // plantD 逆变器
  const eqE1Id = uuid()  // plantE 变压器1
  const eqE2Id = uuid()  // plantE 变压器2
  const eqE3Id = uuid()  // plantE 电池1
  const eqE4Id = uuid()  // plantE 电池2
  const eqE5Id = uuid()  // plantE PCS1
  const eqE6Id = uuid()  // plantE PCS2
  const eqF1Id = uuid()  // plantF 变压器
  const eqF2Id = uuid()  // plantF 电池
  const eqF3Id = uuid()  // plantF PCS
  const eqG1Id = uuid()  // plantG 变压器
  const eqG2Id = uuid()  // plantG 电池
  const eqG3Id = uuid()  // plantG PCS
  const eqH1Id = uuid()  // plantH 变压器
  const eqH2Id = uuid()  // plantH 电池
  const eqH3Id = uuid()  // plantH PCS
  const eqI1Id = uuid()  // plantI 变压器
  const eqI2Id = uuid()  // plantI 电池
  const eqI3Id = uuid()  // plantI PCS
  const eqJ1Id = uuid()  // plantJ 变压器
  const eqJ2Id = uuid()  // plantJ 电池
  const eqJ3Id = uuid()  // plantJ PCS
  const eqK1Id = uuid()  // plantK 变压器
  const eqK2Id = uuid()  // plantK 电池
  const eqK3Id = uuid()  // plantK PCS
  const eqL1Id = uuid()  // plantL 变压器
  const eqL2Id = uuid()  // plantL 电池
  const eqL3Id = uuid()  // plantL PCS
  // 阳光A 电池 + PCS
  const eqA3Id = uuid()
  const eqA4Id = uuid()
  // 绿能B 电池 + PCS
  const eqB3Id = uuid()
  const eqB4Id = uuid()
  // 径山太小型不配储能

  await knex('equipment').insert([
    // ---- 阳光集中式光伏电站A (50MW) ----
    { id: eqA1Id, plant_id: plantAId, name: '1号主变压器', equipment_type: 'TRANSFORMER', model_number: 'SZ11-50000/110', rated_capacity_kva: 50000, rated_voltage_kv: 110, rated_current_a: 262, installation_date: '2023-06-01', design_life_years: 25, grade: 'A' },
    { id: eqA2Id, plant_id: plantAId, name: '1号逆变器', equipment_type: 'INVERTER', model_number: 'SUN2000-300KTL', rated_capacity_kva: 300, rated_voltage_kv: 800, rated_current_a: 216, installation_date: '2023-06-01', design_life_years: 15, grade: 'B' },
    { id: eqA3Id, plant_id: plantAId, name: '1号电池组', equipment_type: 'BATTERY', model_number: 'LFP-280Ah-20P', rated_capacity_kva: 2500, rated_voltage_kv: 768, rated_current_a: 326, installation_date: '2023-06-01', design_life_years: 12, grade: 'A' },
    { id: eqA4Id, plant_id: plantAId, name: '1号储能变流器', equipment_type: 'INVERTER', model_number: 'PCS-250K', rated_capacity_kva: 250, rated_voltage_kv: 0.8, rated_current_a: 180, installation_date: '2023-06-01', design_life_years: 15, grade: 'A' },
    // ---- 绿能集中式光伏电站B (30MW) ----
    { id: eqB1Id, plant_id: plantBId, name: '1号主变压器', equipment_type: 'TRANSFORMER', model_number: 'SZ11-31500/110', rated_capacity_kva: 31500, rated_voltage_kv: 110, rated_current_a: 165, installation_date: '2024-03-15', design_life_years: 25, grade: 'A' },
    { id: eqB2Id, plant_id: plantBId, name: '1号逆变器', equipment_type: 'INVERTER', model_number: 'SG-110CX', rated_capacity_kva: 110, rated_voltage_kv: 800, rated_current_a: 80, installation_date: '2024-03-15', design_life_years: 15, grade: 'B' },
    { id: eqB3Id, plant_id: plantBId, name: '1号电池组', equipment_type: 'BATTERY', model_number: 'LFP-280Ah-12P', rated_capacity_kva: 1500, rated_voltage_kv: 768, rated_current_a: 195, installation_date: '2024-03-15', design_life_years: 12, grade: 'A' },
    { id: eqB4Id, plant_id: plantBId, name: '1号储能变流器', equipment_type: 'INVERTER', model_number: 'PCS-150K', rated_capacity_kva: 150, rated_voltage_kv: 0.8, rated_current_a: 108, installation_date: '2024-03-15', design_life_years: 15, grade: 'A' },
    // ---- 清源储能电站 (10MW STORAGE) ----
    { id: eqC1Id, plant_id: plantCId, name: '1号主变压器', equipment_type: 'TRANSFORMER', model_number: 'S11-12500/35', rated_capacity_kva: 12500, rated_voltage_kv: 35, rated_current_a: 206, installation_date: '2024-01-01', design_life_years: 25, grade: 'A' },
    { id: eqC2Id, plant_id: plantCId, name: '1号电池组', equipment_type: 'BATTERY', model_number: 'LFP-280Ah-40P', rated_capacity_kva: 5000, rated_voltage_kv: 768, rated_current_a: 651, installation_date: '2024-01-01', design_life_years: 12, grade: 'A' },
    { id: eqC3Id, plant_id: plantCId, name: '2号电池组', equipment_type: 'BATTERY', model_number: 'LFP-280Ah-40P', rated_capacity_kva: 5000, rated_voltage_kv: 768, rated_current_a: 651, installation_date: '2024-01-01', design_life_years: 12, grade: 'B' },
    { id: eqC4Id, plant_id: plantCId, name: '1号储能变流器', equipment_type: 'INVERTER', model_number: 'PCS-500K', rated_capacity_kva: 500, rated_voltage_kv: 0.8, rated_current_a: 361, installation_date: '2024-01-01', design_life_years: 15, grade: 'A' },
    // ---- 径山镇宇航梦园渔光互补 (5.44MW，小型，不配储能) ----
    { id: eqD1Id, plant_id: plantDId, name: '1号箱式变压器', equipment_type: 'TRANSFORMER', model_number: 'S11-6300/35', rated_capacity_kva: 6300, rated_voltage_kv: 35, rated_current_a: 104, installation_date: '2026-04-01', design_life_years: 25, grade: 'A' },
    { id: eqD2Id, plant_id: plantDId, name: '1号逆变器', equipment_type: 'INVERTER', model_number: 'SG-110CX', rated_capacity_kva: 110, rated_voltage_kv: 800, rated_current_a: 80, installation_date: '2026-04-01', design_life_years: 15, grade: 'A' },
    // ---- 舒能渔光互补 (400MW) ----
    { id: eqE1Id, plant_id: plantEId, name: '1号主变压器', equipment_type: 'TRANSFORMER', model_number: 'SZ11-180000/220', rated_capacity_kva: 180000, rated_voltage_kv: 220, rated_current_a: 472, installation_date: '2025-12-01', design_life_years: 25, grade: 'A' },
    { id: eqE2Id, plant_id: plantEId, name: '2号主变压器', equipment_type: 'TRANSFORMER', model_number: 'SZ11-180000/220', rated_capacity_kva: 180000, rated_voltage_kv: 220, rated_current_a: 472, installation_date: '2025-12-01', design_life_years: 25, grade: 'B' },
    { id: eqE3Id, plant_id: plantEId, name: '1号电池组', equipment_type: 'BATTERY', model_number: 'LFP-280Ah-200P', rated_capacity_kva: 20000, rated_voltage_kv: 768, rated_current_a: 2604, installation_date: '2025-12-01', design_life_years: 12, grade: 'A' },
    { id: eqE4Id, plant_id: plantEId, name: '2号电池组', equipment_type: 'BATTERY', model_number: 'LFP-280Ah-200P', rated_capacity_kva: 20000, rated_voltage_kv: 768, rated_current_a: 2604, installation_date: '2025-12-01', design_life_years: 12, grade: 'A' },
    { id: eqE5Id, plant_id: plantEId, name: '1号储能变流器', equipment_type: 'INVERTER', model_number: 'PCS-2000K', rated_capacity_kva: 2000, rated_voltage_kv: 0.8, rated_current_a: 1443, installation_date: '2025-12-01', design_life_years: 15, grade: 'A' },
    { id: eqE6Id, plant_id: plantEId, name: '2号储能变流器', equipment_type: 'INVERTER', model_number: 'PCS-2000K', rated_capacity_kva: 2000, rated_voltage_kv: 0.8, rated_current_a: 1443, installation_date: '2025-12-01', design_life_years: 15, grade: 'A' },
    // ---- 嘉达渔光互补 (350MW) ----
    { id: eqF1Id, plant_id: plantFId, name: '1号主变压器', equipment_type: 'TRANSFORMER', model_number: 'SZ11-150000/220', rated_capacity_kva: 150000, rated_voltage_kv: 220, rated_current_a: 394, installation_date: '2025-12-01', design_life_years: 25, grade: 'A' },
    { id: eqF2Id, plant_id: plantFId, name: '1号电池组', equipment_type: 'BATTERY', model_number: 'LFP-280Ah-160P', rated_capacity_kva: 16000, rated_voltage_kv: 768, rated_current_a: 2083, installation_date: '2025-12-01', design_life_years: 12, grade: 'A' },
    { id: eqF3Id, plant_id: plantFId, name: '1号储能变流器', equipment_type: 'INVERTER', model_number: 'PCS-1600K', rated_capacity_kva: 1600, rated_voltage_kv: 0.8, rated_current_a: 1155, installation_date: '2025-12-01', design_life_years: 15, grade: 'B' },
    // ---- 凌能渔光互补 (250MW) ----
    { id: eqG1Id, plant_id: plantGId, name: '1号主变压器', equipment_type: 'TRANSFORMER', model_number: 'SZ11-120000/220', rated_capacity_kva: 120000, rated_voltage_kv: 220, rated_current_a: 315, installation_date: '2025-12-01', design_life_years: 25, grade: 'A' },
    { id: eqG2Id, plant_id: plantGId, name: '1号电池组', equipment_type: 'BATTERY', model_number: 'LFP-280Ah-120P', rated_capacity_kva: 12000, rated_voltage_kv: 768, rated_current_a: 1563, installation_date: '2025-12-01', design_life_years: 12, grade: 'B' },
    { id: eqG3Id, plant_id: plantGId, name: '1号储能变流器', equipment_type: 'INVERTER', model_number: 'PCS-1200K', rated_capacity_kva: 1200, rated_voltage_kv: 0.8, rated_current_a: 866, installation_date: '2025-12-01', design_life_years: 15, grade: 'C' },
    // ---- 华洋山地光伏 (155MW) ----
    { id: eqH1Id, plant_id: plantHId, name: '1号主变压器', equipment_type: 'TRANSFORMER', model_number: 'SZ11-75000/110', rated_capacity_kva: 75000, rated_voltage_kv: 110, rated_current_a: 394, installation_date: '2024-08-30', design_life_years: 25, grade: 'A' },
    { id: eqH2Id, plant_id: plantHId, name: '1号电池组', equipment_type: 'BATTERY', model_number: 'LFP-280Ah-80P', rated_capacity_kva: 8000, rated_voltage_kv: 768, rated_current_a: 1042, installation_date: '2024-08-30', design_life_years: 12, grade: 'A' },
    { id: eqH3Id, plant_id: plantHId, name: '1号储能变流器', equipment_type: 'INVERTER', model_number: 'PCS-800K', rated_capacity_kva: 800, rated_voltage_kv: 0.8, rated_current_a: 577, installation_date: '2024-08-30', design_life_years: 15, grade: 'A' },
    // ---- 临安青山 (60MW) ----
    { id: eqI1Id, plant_id: plantIId, name: '1号主变压器', equipment_type: 'TRANSFORMER', model_number: 'SZ11-63000/110', rated_capacity_kva: 63000, rated_voltage_kv: 110, rated_current_a: 330, installation_date: '2024-06-15', design_life_years: 25, grade: 'A' },
    { id: eqI2Id, plant_id: plantIId, name: '1号电池组', equipment_type: 'BATTERY', model_number: 'LFP-280Ah-30P', rated_capacity_kva: 3000, rated_voltage_kv: 768, rated_current_a: 391, installation_date: '2024-06-15', design_life_years: 12, grade: 'B' },
    { id: eqI3Id, plant_id: plantIId, name: '1号储能变流器', equipment_type: 'INVERTER', model_number: 'PCS-300K', rated_capacity_kva: 300, rated_voltage_kv: 0.8, rated_current_a: 217, installation_date: '2024-06-15', design_life_years: 15, grade: 'A' },
    // ---- 临安太湖源 (40MW) ----
    { id: eqJ1Id, plant_id: plantJId, name: '1号主变压器', equipment_type: 'TRANSFORMER', model_number: 'SZ11-50000/110', rated_capacity_kva: 50000, rated_voltage_kv: 110, rated_current_a: 262, installation_date: '2024-06-15', design_life_years: 25, grade: 'A' },
    { id: eqJ2Id, plant_id: plantJId, name: '1号电池组', equipment_type: 'BATTERY', model_number: 'LFP-280Ah-20P', rated_capacity_kva: 2000, rated_voltage_kv: 768, rated_current_a: 260, installation_date: '2024-06-15', design_life_years: 12, grade: 'A' },
    { id: eqJ3Id, plant_id: plantJId, name: '1号储能变流器', equipment_type: 'INVERTER', model_number: 'PCS-200K', rated_capacity_kva: 200, rated_voltage_kv: 0.8, rated_current_a: 144, installation_date: '2024-06-15', design_life_years: 15, grade: 'B' },
    // ---- 萧山南阳 (50MW) ----
    { id: eqK1Id, plant_id: plantKId, name: '1号主变压器', equipment_type: 'TRANSFORMER', model_number: 'SZ11-50000/110', rated_capacity_kva: 50000, rated_voltage_kv: 110, rated_current_a: 262, installation_date: '2024-09-01', design_life_years: 25, grade: 'A' },
    { id: eqK2Id, plant_id: plantKId, name: '1号电池组', equipment_type: 'BATTERY', model_number: 'LFP-280Ah-24P', rated_capacity_kva: 2500, rated_voltage_kv: 768, rated_current_a: 326, installation_date: '2024-09-01', design_life_years: 12, grade: 'B' },
    { id: eqK3Id, plant_id: plantKId, name: '1号储能变流器', equipment_type: 'INVERTER', model_number: 'PCS-250K', rated_capacity_kva: 250, rated_voltage_kv: 0.8, rated_current_a: 180, installation_date: '2024-09-01', design_life_years: 15, grade: 'A' },
    // ---- 富阳渔山 (30MW) ----
    { id: eqL1Id, plant_id: plantLId, name: '1号主变压器', equipment_type: 'TRANSFORMER', model_number: 'SZ11-31500/110', rated_capacity_kva: 31500, rated_voltage_kv: 110, rated_current_a: 165, installation_date: '2024-05-01', design_life_years: 25, grade: 'A' },
    { id: eqL2Id, plant_id: plantLId, name: '1号电池组', equipment_type: 'BATTERY', model_number: 'LFP-280Ah-12P', rated_capacity_kva: 1500, rated_voltage_kv: 768, rated_current_a: 195, installation_date: '2024-05-01', design_life_years: 12, grade: 'C' },
    { id: eqL3Id, plant_id: plantLId, name: '1号储能变流器', equipment_type: 'INVERTER', model_number: 'PCS-150K', rated_capacity_kva: 150, rated_voltage_kv: 0.8, rated_current_a: 108, installation_date: '2024-05-01', design_life_years: 15, grade: 'C' },
  ])

  // Equipment lifecycle events
  await knex('equipment_lifecycle').insert([
    // plantA (50MW)
    { id: uuid(), equipment_id: eqA1Id, event_type: 'INSTALL', event_date: '2023-06-01', description: '变压器投运', remaining_life_years: 25 },
    { id: uuid(), equipment_id: eqA2Id, event_type: 'INSTALL', event_date: '2023-06-01', description: '逆变器投运', remaining_life_years: 15 },
    { id: uuid(), equipment_id: eqA2Id, event_type: 'MAINTENANCE', event_date: '2024-03-15', description: 'IGBT 模块检测与除尘', remaining_life_years: 13.5 },
    { id: uuid(), equipment_id: eqA3Id, event_type: 'INSTALL', event_date: '2023-06-01', description: '电池组投运', remaining_life_years: 12 },
    { id: uuid(), equipment_id: eqA4Id, event_type: 'INSTALL', event_date: '2023-06-01', description: '储能变流器投运', remaining_life_years: 15 },
    { id: uuid(), equipment_id: eqA3Id, event_type: 'INSPECTION', event_date: '2025-01-15', description: '电池容量测试 — SOH 95.8%', remaining_life_years: 9 },
    // plantB (30MW)
    { id: uuid(), equipment_id: eqB1Id, event_type: 'INSTALL', event_date: '2024-03-15', description: '变压器投运', remaining_life_years: 25 },
    { id: uuid(), equipment_id: eqB2Id, event_type: 'INSTALL', event_date: '2024-03-15', description: '逆变器投运', remaining_life_years: 15 },
    { id: uuid(), equipment_id: eqB3Id, event_type: 'INSTALL', event_date: '2024-03-15', description: '电池组投运', remaining_life_years: 12 },
    { id: uuid(), equipment_id: eqB4Id, event_type: 'INSTALL', event_date: '2024-03-15', description: '储能变流器投运', remaining_life_years: 15 },
    // plantC 清源储能 (10MW)
    { id: uuid(), equipment_id: eqC1Id, event_type: 'INSTALL', event_date: '2024-01-01', description: '变压器投运', remaining_life_years: 25 },
    { id: uuid(), equipment_id: eqC2Id, event_type: 'INSTALL', event_date: '2024-01-01', description: '1号电池组投运', remaining_life_years: 12 },
    { id: uuid(), equipment_id: eqC3Id, event_type: 'INSTALL', event_date: '2024-01-01', description: '2号电池组投运', remaining_life_years: 12 },
    { id: uuid(), equipment_id: eqC4Id, event_type: 'INSTALL', event_date: '2024-01-01', description: 'PCS 变流器投运', remaining_life_years: 15 },
    { id: uuid(), equipment_id: eqC2Id, event_type: 'INSPECTION', event_date: '2025-03-10', description: '电池容量测试 — SOH 97.2%', remaining_life_years: 10.5 },
    // plantD 径山 (5.44MW，无储能)
    { id: uuid(), equipment_id: eqD1Id, event_type: 'INSTALL', event_date: '2026-04-01', description: '箱式变压器投运', remaining_life_years: 25 },
    { id: uuid(), equipment_id: eqD2Id, event_type: 'INSTALL', event_date: '2026-04-01', description: '逆变器投运', remaining_life_years: 15 },
    // plantE 舒能 (400MW)
    { id: uuid(), equipment_id: eqE1Id, event_type: 'INSTALL', event_date: '2025-12-01', description: '1号主变投运', remaining_life_years: 25 },
    { id: uuid(), equipment_id: eqE2Id, event_type: 'INSTALL', event_date: '2025-12-01', description: '2号主变投运', remaining_life_years: 25 },
    { id: uuid(), equipment_id: eqE3Id, event_type: 'INSTALL', event_date: '2025-12-01', description: '1号电池组投运', remaining_life_years: 12 },
    { id: uuid(), equipment_id: eqE4Id, event_type: 'INSTALL', event_date: '2025-12-01', description: '2号电池组投运', remaining_life_years: 12 },
    { id: uuid(), equipment_id: eqE5Id, event_type: 'INSTALL', event_date: '2025-12-01', description: '1号PCS投运', remaining_life_years: 15 },
    { id: uuid(), equipment_id: eqE6Id, event_type: 'INSTALL', event_date: '2025-12-01', description: '2号PCS投运', remaining_life_years: 15 },
    // plantF 嘉达 (350MW)
    { id: uuid(), equipment_id: eqF1Id, event_type: 'INSTALL', event_date: '2025-12-01', description: '变压器投运', remaining_life_years: 25 },
    { id: uuid(), equipment_id: eqF2Id, event_type: 'INSTALL', event_date: '2025-12-01', description: '电池组投运', remaining_life_years: 12 },
    { id: uuid(), equipment_id: eqF3Id, event_type: 'INSTALL', event_date: '2025-12-01', description: '储能变流器投运', remaining_life_years: 15 },
    // plantG 凌能 (250MW)
    { id: uuid(), equipment_id: eqG1Id, event_type: 'INSTALL', event_date: '2025-12-01', description: '变压器投运', remaining_life_years: 25 },
    { id: uuid(), equipment_id: eqG2Id, event_type: 'INSTALL', event_date: '2025-12-01', description: '电池组投运', remaining_life_years: 12 },
    { id: uuid(), equipment_id: eqG3Id, event_type: 'INSTALL', event_date: '2025-12-01', description: '储能变流器投运', remaining_life_years: 15 },
    { id: uuid(), equipment_id: eqG3Id, event_type: 'MAINTENANCE', event_date: '2026-02-20', description: 'PCS 散热风扇更换', remaining_life_years: 13.5 },
    // plantH 华洋 (155MW)
    { id: uuid(), equipment_id: eqH1Id, event_type: 'INSTALL', event_date: '2024-08-30', description: '变压器投运', remaining_life_years: 25 },
    { id: uuid(), equipment_id: eqH2Id, event_type: 'INSTALL', event_date: '2024-08-30', description: '电池组投运', remaining_life_years: 12 },
    { id: uuid(), equipment_id: eqH3Id, event_type: 'INSTALL', event_date: '2024-08-30', description: '储能变流器投运', remaining_life_years: 15 },
    { id: uuid(), equipment_id: eqH2Id, event_type: 'MAINTENANCE', event_date: '2025-07-20', description: '电池模组均衡维护', remaining_life_years: 10 },
    // plantI 临安青山 (60MW)
    { id: uuid(), equipment_id: eqI1Id, event_type: 'INSTALL', event_date: '2024-06-15', description: '变压器投运', remaining_life_years: 25 },
    { id: uuid(), equipment_id: eqI2Id, event_type: 'INSTALL', event_date: '2024-06-15', description: '电池组投运', remaining_life_years: 12 },
    { id: uuid(), equipment_id: eqI3Id, event_type: 'INSTALL', event_date: '2024-06-15', description: '储能变流器投运', remaining_life_years: 15 },
    // plantJ 临安太湖源 (40MW)
    { id: uuid(), equipment_id: eqJ1Id, event_type: 'INSTALL', event_date: '2024-06-15', description: '变压器投运', remaining_life_years: 25 },
    { id: uuid(), equipment_id: eqJ2Id, event_type: 'INSTALL', event_date: '2024-06-15', description: '电池组投运', remaining_life_years: 12 },
    { id: uuid(), equipment_id: eqJ3Id, event_type: 'INSTALL', event_date: '2024-06-15', description: '储能变流器投运', remaining_life_years: 15 },
    // plantK 萧山南阳 (50MW)
    { id: uuid(), equipment_id: eqK1Id, event_type: 'INSTALL', event_date: '2024-09-01', description: '变压器投运', remaining_life_years: 25 },
    { id: uuid(), equipment_id: eqK2Id, event_type: 'INSTALL', event_date: '2024-09-01', description: '电池组投运', remaining_life_years: 12 },
    { id: uuid(), equipment_id: eqK3Id, event_type: 'INSTALL', event_date: '2024-09-01', description: '储能变流器投运', remaining_life_years: 15 },
    // plantL 富阳渔山 (30MW)
    { id: uuid(), equipment_id: eqL1Id, event_type: 'INSTALL', event_date: '2024-05-01', description: '变压器投运', remaining_life_years: 25 },
    { id: uuid(), equipment_id: eqL2Id, event_type: 'INSTALL', event_date: '2024-05-01', description: '电池组投运', remaining_life_years: 12 },
    { id: uuid(), equipment_id: eqL3Id, event_type: 'INSTALL', event_date: '2024-05-01', description: '储能变流器投运', remaining_life_years: 15 },
    { id: uuid(), equipment_id: eqL2Id, event_type: 'MAINTENANCE', event_date: '2025-09-10', description: '电池组绝缘检测与接线紧固', remaining_life_years: 10 },
  ])

  // ==================== 电池循环记录（模拟24个月运行数据） ====================
  // 电池设备配置: { id, 额定容量kWh, 等级, 投运日期 }
  const batteryConfigs: Array<{ id: string; ratedKwh: number; grade: string; startDate: string }> = [
    { id: eqA3Id, ratedKwh: 2500, grade: 'A', startDate: '2023-06-01' },
    { id: eqB3Id, ratedKwh: 1500, grade: 'A', startDate: '2024-03-15' },
    { id: eqC2Id, ratedKwh: 5000, grade: 'A', startDate: '2024-01-01' },
    { id: eqC3Id, ratedKwh: 5000, grade: 'B', startDate: '2024-01-01' },
    { id: eqE3Id, ratedKwh: 20000, grade: 'A', startDate: '2025-12-01' },
    { id: eqE4Id, ratedKwh: 20000, grade: 'A', startDate: '2025-12-01' },
    { id: eqF2Id, ratedKwh: 16000, grade: 'A', startDate: '2025-12-01' },
    { id: eqG2Id, ratedKwh: 12000, grade: 'B', startDate: '2025-12-01' },
    { id: eqH2Id, ratedKwh: 8000,  grade: 'A', startDate: '2024-08-30' },
    { id: eqI2Id, ratedKwh: 3000,  grade: 'B', startDate: '2024-06-15' },
    { id: eqJ2Id, ratedKwh: 2000,  grade: 'A', startDate: '2024-06-15' },
    { id: eqK2Id, ratedKwh: 2500,  grade: 'B', startDate: '2024-09-01' },
    { id: eqL2Id, ratedKwh: 1500,  grade: 'C', startDate: '2024-05-01' },
  ]

  // 杭州月均温度参考(°C): 1月-12月
  const monthBaseTemp = [5, 7, 12, 18, 23, 27, 31, 30, 26, 20, 14, 8]
  // 月循环基数 = 日均1~2次循环 × 30天，大电站循环更多
  function monthCycles(ratedKwh: number, month: number): number {
    const base = ratedKwh > 10000 ? 45 : ratedKwh > 5000 ? 36 : 28
    // 春秋季充放电更频繁（气温适中），夏冬季略少
    const seasonal = [3,4,5,9,10,11].includes(month) ? 1.1 : 0.9
    return Math.round(base * seasonal * (0.85 + Math.random() * 0.3))
  }

  const cycleRecords: any[] = []
  for (const cfg of batteryConfigs) {
    const start = new Date(cfg.startDate)
    // 生成到当前月份，最多24个月
    const now = new Date()
    const totalMonths = Math.min(24, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1)
    if (totalMonths < 1) continue

    let cumulativeCycles = 0
    let cumulativeEnergy = 0
    // 初始SOH，C级电池起始略低
    let soh = cfg.grade === 'C' ? 97.0 : cfg.grade === 'B' ? 98.5 : 99.5
    // 月衰减率基准，等级不同
    const baseDegradation = cfg.grade === 'C' ? 0.22 : cfg.grade === 'B' ? 0.15 : 0.10

    for (let m = 0; m < totalMonths; m++) {
      const d = new Date(start.getFullYear(), start.getMonth() + m, 1)
      const monthLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const monthIdx = d.getMonth() // 0-11
      const baseTemp = monthBaseTemp[monthIdx]

      const cycles = monthCycles(cfg.ratedKwh, monthIdx)
      const avgDod = 45 + Math.round(Math.random() * 30) // 45-75%
      const avgTemp = baseTemp + (Math.random() * 5 - 2)   // 电池舱温控，波动小
      const maxTemp = avgTemp + 3 + Math.round(Math.random() * 6)
      // 温度加速因子（Arrhenius 简化）：每10°C加倍
      const tempFactor = Math.pow(2, (avgTemp - 25) / 10)
      // 循环衰减 + 日历衰减
      const cycleDeg = cycles * 0.003 * (avgDod / 50) * tempFactor
      const calendarDeg = baseDegradation * tempFactor
      soh -= cycleDeg + calendarDeg
      if (soh < 70) soh = 70 + Math.random() * 2 // 低于70%通常已更换

      cumulativeCycles += cycles
      const monthEnergy = cfg.ratedKwh * cycles * (avgDod / 100) / 1000 // MWh
      cumulativeEnergy += monthEnergy

      cycleRecords.push({
        id: uuid(),
        equipment_id: cfg.id,
        record_month: monthLabel,
        cycle_count: cycles,
        avg_dod_pct: avgDod,
        max_temp_c: Math.round(maxTemp * 10) / 10,
        avg_temp_c: Math.round(avgTemp * 10) / 10,
        soh_pct: Math.round(soh * 10) / 10,
        cumulative_cycles: cumulativeCycles,
        cumulative_energy_mwh: Math.round(cumulativeEnergy * 10) / 10,
        created_at: new Date().toISOString(),
      })
    }
  }
  if (cycleRecords.length) {
    await knex('battery_cycle_records').insert(cycleRecords)
  }

  // 天气场景定义
  const weatherScenarios = [
    { expected: '晴', actual: '晴', confidenceBase: 95 },
    { expected: '晴', actual: '晴', confidenceBase: 92 },
    { expected: '晴', actual: '少云', confidenceBase: 78 },
    { expected: '晴', actual: '晴', confidenceBase: 96 },
    { expected: '多云', actual: '阴', confidenceBase: 65 },
    { expected: '多云', actual: '多云', confidenceBase: 88 },
    { expected: '晴', actual: '晴', confidenceBase: 97 },
    { expected: '晴', actual: '晴', confidenceBase: 94 },
    { expected: '晴', actual: '晴', confidenceBase: 91 },
    { expected: '多云', actual: '多云', confidenceBase: 85 },
    { expected: '晴', actual: '晴', confidenceBase: 93 },
    { expected: '晴', actual: '晴', confidenceBase: 90 },
    { expected: '多云', actual: '多云', confidenceBase: 82 },
    { expected: '晴', actual: '晴', confidenceBase: 95 },
    { expected: '晴', actual: '晴', confidenceBase: 96 },
    { expected: '晴', actual: '晴', confidenceBase: 92 },
    { expected: '晴', actual: '晴', confidenceBase: 89 },
    { expected: '多云', actual: '晴', confidenceBase: 72 },
    { expected: '晴', actual: '晴', confidenceBase: 94 },
    { expected: '晴', actual: '晴', confidenceBase: 91 },
    { expected: '晴', actual: '晴', confidenceBase: 88 },
    { expected: '晴', actual: '晴', confidenceBase: 93 },
    { expected: '晴', actual: '晴', confidenceBase: 95 },
    { expected: '晴', actual: '晴', confidenceBase: 97 },
  ]

  // Sample PV output data
  for (let h = 0; h < 24; h++) {
    const irradiance = h >= 6 && h <= 18 ? Math.sin((h - 6) / 12 * Math.PI) * 900 : 0
    const output = irradiance * (50000 / 1000) * 0.8
    const weather = weatherScenarios[h] || weatherScenarios[0]
    await knex('pv_output_measurements').insert({
      id: uuid(),
      time: `2026-05-18T${String(h).padStart(2, '0')}:00:00Z`,
      plant_id: plantAId,
      active_power_kw: Math.round(output),
      reactive_power_kvar: Math.round(output * 0.1),
      voltage_v: 10.2 + Math.random() * 0.4 - 0.2,
      current_a: Math.round(output / 10.2),
      frequency_hz: 50 + Math.random() * 0.1 - 0.05,
      power_factor: 0.98,
      temperature_c: 25 + Math.sin((h - 12) / 12 * Math.PI) * 10,
      irradiance_wm2: Math.round(irradiance),
      humidity_pct: 50 + Math.cos((h - 12) / 12 * Math.PI) * 20,
      inverter_efficiency: 0.97 + Math.random() * 0.02,
      confidence_pct: weather.confidenceBase + Math.round(Math.random() * 10 - 5),
      expected_weather: weather.expected,
      actual_weather: weather.actual,
    })
  }

  // 给 plantB 再生成一些记录（带部分故意缺失的数据以测试校验）
  const plantBWeather = [
    { expected: '晴', actual: '晴', confidenceBase: 94 },
    { expected: '晴', actual: '晴', confidenceBase: 90 },
    { expected: '多云', actual: '多云', confidenceBase: 66 },
    { expected: '晴', actual: '晴', confidenceBase: 95 },
    { expected: '多云', actual: '多云', confidenceBase: 80 },
    { expected: '晴', actual: '晴', confidenceBase: 92 },
    { expected: '晴', actual: '晴', confidenceBase: 96 },
    { expected: '晴', actual: '阴', confidenceBase: 55 },
    { expected: '多云', actual: '多云', confidenceBase: 71 },
    { expected: '晴', actual: '晴', confidenceBase: 93 },
  ]
  for (let h = 0; h < 10; h++) {
    const w = plantBWeather[h]
    await knex('pv_output_measurements').insert({
      id: uuid(),
      time: `2026-05-18T${String(h + 7).padStart(2, '0')}:00:00Z`,
      plant_id: plantBId,
      active_power_kw: Math.round(30000 * 0.8 * (0.5 + Math.random() * 0.5)),
      reactive_power_kvar: Math.round(30000 * 0.8 * 0.1),
      inverter_efficiency: 0.96 + Math.random() * 0.03,
      confidence_pct: w.confidenceBase + Math.round(Math.random() * 10 - 5),
      expected_weather: w.expected,
      actual_weather: w.actual,
    })
  }

  // Sample voltage measurements
  for (let h = 0; h < 24; h++) {
    await knex('voltage_measurements').insert({
      id: uuid(),
      time: `2026-05-18T${String(h).padStart(2, '0')}:00:00Z`,
      equipment_id: eqA1Id,
      phase_a_v: 10.1 + Math.random() * 0.5 - 0.25,
      phase_b_v: 10.1 + Math.random() * 0.5 - 0.25,
      phase_c_v: 10.1 + Math.random() * 0.5 - 0.25,
      voltage_deviation_pct: Math.random() * 6 - 3,
    })
  }

  const adminUser = await knex('users').where('username', 'admin').select('id').first()
  const adminId = adminUser?.id || 'system'
  const now = new Date().toISOString()

  // Output curve templates
  const ctSunnyId = uuid(); const ctCloudyId = uuid(); const ctRainyId = uuid(); const ctCustomId = uuid()
  await knex('output_curve_templates').insert([
    { id: ctSunnyId, root_id: ctSunnyId, name: '晴天模板', weather_type: 'sunny', is_preset: 1, version: 1, is_active: 1,
      coefficients: JSON.stringify([0,0,0,0,0,0.05,0.15,0.30,0.50,0.70,0.85,0.95,1.0,0.98,0.90,0.75,0.55,0.35,0.15,0.05,0,0,0,0]),
      created_by: adminId, modified_by: adminId, change_summary: '初始创建', created_at: now, updated_at: now },
    { id: ctCloudyId, root_id: ctCloudyId, name: '多云模板', weather_type: 'cloudy', is_preset: 1, version: 1, is_active: 1,
      coefficients: JSON.stringify([0,0,0,0,0,0.02,0.08,0.18,0.35,0.55,0.70,0.80,0.85,0.80,0.70,0.55,0.40,0.25,0.10,0.03,0,0,0,0]),
      created_by: adminId, modified_by: adminId, change_summary: '初始创建', created_at: now, updated_at: now },
    { id: ctRainyId, root_id: ctRainyId, name: '雨天模板', weather_type: 'rainy', is_preset: 1, version: 1, is_active: 1,
      coefficients: JSON.stringify([0,0,0,0,0,0.01,0.04,0.10,0.20,0.35,0.45,0.50,0.52,0.50,0.45,0.35,0.25,0.15,0.08,0.02,0,0,0,0]),
      created_by: adminId, modified_by: adminId, change_summary: '初始创建', created_at: now, updated_at: now },
    { id: ctCustomId, root_id: ctCustomId, name: '通用模板', weather_type: 'custom', is_preset: 1, version: 1, is_active: 1,
      coefficients: JSON.stringify([0,0,0,0,0,0.05,0.15,0.30,0.50,0.70,0.85,0.95,1.0,0.98,0.90,0.75,0.55,0.35,0.15,0.05,0,0,0,0]),
      created_by: adminId, modified_by: adminId, change_summary: '初始创建', created_at: now, updated_at: now },
  ])

  // Confidence coefficient settings
  const csId = uuid()
  await knex('confidence_coefficient_settings').insert([
    { id: csId, root_id: csId, name: '默认置信配置', version: 1, confidence_level: 0.95, distribution_type: 'normal',
      pdf_params: JSON.stringify({ mu: 1.0, sigma: 0.1 }), is_active: 1,
      description: '光伏出力默认置信系数配置', created_by: adminId, modified_by: adminId, change_summary: '初始创建', created_at: now },
  ])


  // Sample alerts
  await knex('alerts').insert([
    { id: uuid(), alert_level: 'WARN', source_type: 'VOLTAGE', source_id: eqA1Id, title: '电压波动超限', message: '14:32并网点A电压波动达5.2%，超过5%阈值' },
    { id: uuid(), alert_level: 'INFO', source_type: 'EQUIPMENT', source_id: eqA2Id, title: '逆变器效率下降', message: '逆变器#1效率从97.5%降至95.8%' },
    { id: uuid(), alert_level: 'WARN', source_type: 'EQUIPMENT', source_id: eqA1Id, title: '设备健康度预警', message: '变压器#1健康度评分降至82分' },
  ])

  // Resource models (4 types)
  await knex('resource_models').insert([
    {
      id: uuid(), model_name: '集中式光伏消纳模型-阳光A站',
      model_type: 'PV_ABSORPTION', version: 1, is_active: 1,
      plant_id: plantAId,
      description: '基于阳光集中式光伏电站A的消纳能力评估模型',
      model_parameters: JSON.stringify({
        physicalCharacteristics: { installedCapacityMw: 50, gridVoltageKv: 110, inverterPowerKw: 500 },
        controlStrategy: { activePowerLimitMw: 45, curtailmentPriority: 'guaranteed', nMinus1Enabled: true },
        interfaceParameters: {
          loadProfile: [
            { time: '00:00', loadMw: 320 }, { time: '01:00', loadMw: 290 }, { time: '02:00', loadMw: 270 }, { time: '03:00', loadMw: 260 },
            { time: '04:00', loadMw: 280 }, { time: '05:00', loadMw: 350 }, { time: '06:00', loadMw: 480 }, { time: '07:00', loadMw: 580 },
            { time: '08:00', loadMw: 650 }, { time: '09:00', loadMw: 700 }, { time: '10:00', loadMw: 720 }, { time: '11:00', loadMw: 680 },
            { time: '12:00', loadMw: 620 }, { time: '13:00', loadMw: 660 }, { time: '14:00', loadMw: 710 }, { time: '15:00', loadMw: 730 },
            { time: '16:00', loadMw: 750 }, { time: '17:00', loadMw: 780 }, { time: '18:00', loadMw: 820 }, { time: '19:00', loadMw: 800 },
            { time: '20:00', loadMw: 740 }, { time: '21:00', loadMw: 650 }, { time: '22:00', loadMw: 520 }, { time: '23:00', loadMw: 400 },
          ],
          minThermalOutputMw: 150,
          transmissionLimitMw: 55,
        },
      }),
      created_by: adminId, created_at: now, updated_at: now,
    },
    {
      id: uuid(), model_name: '光伏出力模型-阳光A站',
      model_type: 'PV_OUTPUT', version: 1, is_active: 1,
      plant_id: plantAId,
      description: '基于单晶硅550W组件的光伏出力模型',
      model_parameters: JSON.stringify({
        physicalCharacteristics: { ratedPowerKw: 50000, panelType: 'monocrystalline', tempCoefficientPct: -0.35 },
        controlStrategy: { mpptAlgorithm: 'pno', powerLimitEnabled: false, rampRateLimitKwMin: 500 },
        interfaceParameters: { weatherApiEnabled: true, inverterProtocol: 'modbus', forecastFormat: 'json' },
      }),
      created_by: adminId, created_at: now, updated_at: now,
    },
    {
      id: uuid(), model_name: '承载力模型-10kV区域',
      model_type: 'CAPACITY', version: 1, is_active: 1,
      plant_id: null,
      description: '10kV配电网区域承载能力评估模型',
      model_parameters: JSON.stringify({
        physicalCharacteristics: { transformerCapacityKva: 50000, lineAmpacityA: 600, nMinus1Enabled: true },
        controlStrategy: { overloadThresholdPct: 120, loadBalancingMode: 'active', demandResponseEnabled: false },
        interfaceParameters: { scadaEnabled: true, loadForecastEnabled: true, topologyFormat: 'cim' },
      }),
      created_by: adminId, created_at: now, updated_at: now,
    },
    {
      id: uuid(), model_name: '储能模型-清源站',
      model_type: 'STORAGE', version: 1, is_active: 1,
      plant_id: plantCId,
      description: '基于清源储能电站的储能调控模型',
      model_parameters: JSON.stringify({
        physicalCharacteristics: { ratedCapacityKwh: 10000, ratedPowerKw: 5000, efficiencyPct: 92 },
        controlStrategy: { chargeMode: 'peakShaving', socLimitPct: 20, gridSupportMode: 'primaryFreq' },
        interfaceParameters: { bmsProtocol: 'can', pcsInterface: 'digital', sohReportFormat: 'json' },
      }),
      created_by: adminId, created_at: now, updated_at: now,
    },
  ])
}
