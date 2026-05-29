import type { Knex } from 'knex'
import { v4 as uuid } from 'uuid'

export async function seed(knex: Knex): Promise<void> {
  await knex('cost_items').del()

  const now = new Date().toISOString()

  // ==================== 设备成本 - 光伏本体 ====================

  // 一、光伏组件（多型号）
  await knex('cost_items').insert([
    { id: uuid(), item_code: 'PV-M-550', category: 'equipment', sub_category: 'pv_body', equipment_type: '光伏组件', model_spec: '单晶硅光伏组件 550Wp', item_name: '单晶硅光伏组件 550Wp', unit_price: 1.82, cost_unit: '元/Wp', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'PV-M-585', category: 'equipment', sub_category: 'pv_body', equipment_type: '光伏组件', model_spec: '单晶硅光伏组件 585Wp', item_name: '单晶硅光伏组件 585Wp', unit_price: 1.85, cost_unit: '元/Wp', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'PV-M-600', category: 'equipment', sub_category: 'pv_body', equipment_type: '光伏组件', model_spec: '单晶硅光伏组件 600Wp', item_name: '单晶硅光伏组件 600Wp', unit_price: 1.88, cost_unit: '元/Wp', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'PV-M-700', category: 'equipment', sub_category: 'pv_body', equipment_type: '光伏组件', model_spec: '单晶硅光伏组件 700Wp', item_name: '单晶硅光伏组件 700Wp', unit_price: 1.92, cost_unit: '元/Wp', created_at: now, updated_at: now },
  ])

  // 二、逆变器（多规格）
  await knex('cost_items').insert([
    { id: uuid(), item_code: 'PV-INV-196', category: 'equipment', sub_category: 'pv_body', equipment_type: '逆变器', model_spec: '组串式逆变器 196kW', item_name: '组串式逆变器 196kW', unit_price: 520000, cost_unit: '元/台', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'PV-INV-225', category: 'equipment', sub_category: 'pv_body', equipment_type: '逆变器', model_spec: '组串式逆变器 225kW', item_name: '组串式逆变器 225kW', unit_price: 580000, cost_unit: '元/台', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'PV-INV-3125', category: 'equipment', sub_category: 'pv_body', equipment_type: '逆变器', model_spec: '组串式逆变器 3125kW', item_name: '组串式逆变器 3125kW', unit_price: 1350000, cost_unit: '元/台', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'PV-INV-3M', category: 'equipment', sub_category: 'pv_body', equipment_type: '逆变器', model_spec: '集中式逆变器 3.125MW', item_name: '集中式逆变器 3.125MW', unit_price: 1420000, cost_unit: '元/台', created_at: now, updated_at: now },
  ])

  // 四、汇流箱（多规格）
  await knex('cost_items').insert([
    { id: uuid(), item_code: 'PV-BOX-16', category: 'equipment', sub_category: 'pv_body', equipment_type: '汇流箱', model_spec: '直流汇流箱 16回路', item_name: '直流汇流箱 16回路', unit_price: 3200, cost_unit: '元/台', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'PV-BOX-24', category: 'equipment', sub_category: 'pv_body', equipment_type: '汇流箱', model_spec: '直流汇流箱 24回路', item_name: '直流汇流箱 24回路', unit_price: 3800, cost_unit: '元/台', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'PV-BOX-32', category: 'equipment', sub_category: 'pv_body', equipment_type: '汇流箱', model_spec: '直流汇流箱 32回路', item_name: '直流汇流箱 32回路', unit_price: 4500, cost_unit: '元/台', created_at: now, updated_at: now },
  ])

  // ==================== 设备成本 - 输变电项目 ====================

  // 三、箱式变压器（多规格）
  await knex('cost_items').insert([
    { id: uuid(), item_code: 'TD-TR-1000', category: 'equipment', sub_category: 'transmission', equipment_type: '箱式变压器', model_spec: '美式箱变 1000kVA', item_name: '美式箱变 1000kVA', unit_price: 520000, cost_unit: '元/台', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'TD-TR-1250', category: 'equipment', sub_category: 'transmission', equipment_type: '箱式变压器', model_spec: '美式箱变 1250kVA', item_name: '美式箱变 1250kVA', unit_price: 580000, cost_unit: '元/台', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'TD-TR-1600', category: 'equipment', sub_category: 'transmission', equipment_type: '箱式变压器', model_spec: '美式箱变 1600kVA', item_name: '美式箱变 1600kVA', unit_price: 650000, cost_unit: '元/台', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'TD-TR-2000', category: 'equipment', sub_category: 'transmission', equipment_type: '箱式变压器', model_spec: '美式箱变 2000kVA', item_name: '美式箱变 2000kVA', unit_price: 720000, cost_unit: '元/台', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'TD-TR-2500', category: 'equipment', sub_category: 'transmission', equipment_type: '箱式变压器', model_spec: '欧式箱变 2500kVA', item_name: '欧式箱变 2500kVA', unit_price: 780000, cost_unit: '元/台', created_at: now, updated_at: now },
  ])

  // 五、高低压柜及环网设备
  await knex('cost_items').insert([
    { id: uuid(), item_code: 'TD-SW-HV', category: 'equipment', sub_category: 'transmission', equipment_type: '高低压柜及环网设备', model_spec: '高压开关柜 10kV', item_name: '高压开关柜 10kV', unit_price: 185000, cost_unit: '元/面', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'TD-SW-LV', category: 'equipment', sub_category: 'transmission', equipment_type: '高低压柜及环网设备', model_spec: '低压配电柜 0.4kV', item_name: '低压配电柜 0.4kV', unit_price: 98000, cost_unit: '元/面', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'TD-SW-RM', category: 'equipment', sub_category: 'transmission', equipment_type: '高低压柜及环网设备', model_spec: '环网柜 10kV二进四出', item_name: '环网柜 10kV二进四出', unit_price: 260000, cost_unit: '元/台', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'TD-SW-PT', category: 'equipment', sub_category: 'transmission', equipment_type: '高低压柜及环网设备', model_spec: 'PT计量柜 10kV', item_name: 'PT计量柜 10kV', unit_price: 152000, cost_unit: '元/面', created_at: now, updated_at: now },
  ])

  // 六、升压站成套及电气配套设备
  await knex('cost_items').insert([
    { id: uuid(), item_code: 'TD-SUB-220', category: 'equipment', sub_category: 'transmission', equipment_type: '升压站成套及电气配套设备', model_spec: '220kV升压站一次成套设备', item_name: '220kV升压站一次成套设备', unit_price: 48000000, cost_unit: '元/套', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'TD-PROT-RELAY', category: 'equipment', sub_category: 'transmission', equipment_type: '升压站成套及电气配套设备', model_spec: '继电保护测控装置', item_name: '继电保护测控装置', unit_price: 360000, cost_unit: '元/套', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'TD-REACT-1000', category: 'equipment', sub_category: 'transmission', equipment_type: '升压站成套及电气配套设备', model_spec: '无功补偿装置 1000kVar', item_name: '无功补偿装置 1000kVar', unit_price: 680000, cost_unit: '元/套', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'TD-GROUND', category: 'equipment', sub_category: 'transmission', equipment_type: '升压站成套及电气配套设备', model_spec: '接地变及消弧线圈装置', item_name: '接地变及消弧线圈装置', unit_price: 520000, cost_unit: '元/套', created_at: now, updated_at: now },
  ])

  // 七、监控通讯及辅助设备
  await knex('cost_items').insert([
    { id: uuid(), item_code: 'TD-MON-SCADA', category: 'equipment', sub_category: 'transmission', equipment_type: '监控通讯及辅助设备', model_spec: '全站光伏监控运维系统', item_name: '全站光伏监控运维系统', unit_price: 12000000, cost_unit: '元/套', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'TD-COMM-DISP', category: 'equipment', sub_category: 'transmission', equipment_type: '监控通讯及辅助设备', model_spec: '远动通讯调度装置', item_name: '远动通讯调度装置', unit_price: 860000, cost_unit: '元/套', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'TD-WEATHER', category: 'equipment', sub_category: 'transmission', equipment_type: '监控通讯及辅助设备', model_spec: '环境气象监测仪', item_name: '环境气象监测仪', unit_price: 28000, cost_unit: '元/台', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'TD-FIRE', category: 'equipment', sub_category: 'transmission', equipment_type: '监控通讯及辅助设备', model_spec: '消防火灾自动报警系统', item_name: '消防火灾自动报警系统', unit_price: 1600000, cost_unit: '元/套', created_at: now, updated_at: now },
  ])

  // ==================== 设备成本 - 传统火电 ====================
  await knex('cost_items').insert([
    { id: uuid(), item_code: 'COAL-BOILER-001', category: 'equipment', sub_category: 'traditional_coal', equipment_type: '锅炉', model_spec: '超超临界 1000MW', item_name: '超超临界燃煤锅炉 1000MW', unit_price: 4200, cost_unit: '元/kW', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'COAL-TURBINE-001', category: 'equipment', sub_category: 'traditional_coal', equipment_type: '汽轮机', model_spec: '超超临界 1000MW', item_name: '超超临界汽轮发电机组 1000MW', unit_price: 2800, cost_unit: '元/kW', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'COAL-GEN-001', category: 'equipment', sub_category: 'traditional_coal', equipment_type: '发电机', model_spec: '1000MW', item_name: '汽轮发电机 1000MW', unit_price: 1500, cost_unit: '元/kW', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'COAL-DESULFUR-001', category: 'equipment', sub_category: 'traditional_coal', equipment_type: '脱硫脱硝', model_spec: '石灰石-石膏湿法', item_name: '烟气脱硫脱硝系统', unit_price: 380, cost_unit: '元/kW', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'COAL-COOLING-001', category: 'equipment', sub_category: 'traditional_coal', equipment_type: '冷却系统', model_spec: '自然通风冷却塔', item_name: '循环水冷却系统', unit_price: 220, cost_unit: '元/kW', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'COAL-COALYARD-001', category: 'equipment', sub_category: 'traditional_coal', equipment_type: '输煤系统', model_spec: '皮带输送', item_name: '输煤及煤场系统', unit_price: 150, cost_unit: '元/kW', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'COAL-ASH-001', category: 'equipment', sub_category: 'traditional_coal', equipment_type: '灰渣处理', model_spec: '干式除灰', item_name: '灰渣处理系统', unit_price: 120, cost_unit: '元/kW', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'COAL-ELEC-001', category: 'equipment', sub_category: 'traditional_coal', equipment_type: '电气系统', model_spec: '升压站+配电', item_name: '电气系统及升压站', unit_price: 450, cost_unit: '元/kW', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'COAL-DCS-001', category: 'equipment', sub_category: 'traditional_coal', equipment_type: '热工控制', model_spec: 'DCS分散控制', item_name: '热工控制系统 DCS', unit_price: 200, cost_unit: '元/kW', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'COAL-BUILD-001', category: 'equipment', sub_category: 'traditional_coal', equipment_type: '建筑工程', model_spec: '主厂房+烟囱', item_name: '主厂房及烟囱建筑工程', unit_price: 1100, cost_unit: '元/kW', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'COAL-LAND-001', category: 'equipment', sub_category: 'traditional_coal', equipment_type: '土地征用', model_spec: '工业用地', item_name: '土地征用及场地平整', unit_price: 180, cost_unit: '元/kW', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'COAL-OTHER-001', category: 'equipment', sub_category: 'traditional_coal', equipment_type: '其他费用', model_spec: '设计/监理/管理', item_name: '设计监理及项目管理费', unit_price: 500, cost_unit: '元/kW', created_at: now, updated_at: now },
  ])

  // ==================== 工程建设成本 ====================
  await knex('cost_items').insert([
    { id: uuid(), item_code: 'CONS-001', category: 'construction', sub_category: null, equipment_type: null, model_spec: '平原地区', item_name: '场地平整及基础施工', unit_price: 0.18, cost_unit: '元/W', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'CONS-002', category: 'construction', sub_category: null, equipment_type: null, model_spec: '丘陵地区', item_name: '场地平整及基础施工', unit_price: 0.25, cost_unit: '元/W', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'CONS-003', category: 'construction', sub_category: null, equipment_type: null, model_spec: '山地', item_name: '场地平整及基础施工', unit_price: 0.38, cost_unit: '元/W', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'CONS-004', category: 'construction', sub_category: null, equipment_type: null, model_spec: '一般土建', item_name: '组件安装施工', unit_price: 0.08, cost_unit: '元/W', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'CONS-005', category: 'construction', sub_category: null, equipment_type: null, model_spec: '含调试', item_name: '电气安装及调试', unit_price: 0.12, cost_unit: '元/W', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'CONS-006', category: 'construction', sub_category: null, equipment_type: null, model_spec: '35kV及以下', item_name: '并网接入工程', unit_price: 0.10, cost_unit: '元/W', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'CONS-007', category: 'construction', sub_category: null, equipment_type: null, model_spec: '110kV及以上', item_name: '升压站建设', unit_price: 0.20, cost_unit: '元/W', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'CONS-008', category: 'construction', sub_category: null, equipment_type: null, model_spec: null, item_name: '道路及围栏工程', unit_price: 0.05, cost_unit: '元/W', created_at: now, updated_at: now },
  ])

  // ==================== 其他成本 ====================
  await knex('cost_items').insert([
    { id: uuid(), item_code: 'OTH-001', category: 'other', sub_category: null, equipment_type: null, model_spec: null, item_name: '可行性研究及勘察设计费', unit_price: 0.08, cost_unit: '元/W', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'OTH-002', category: 'other', sub_category: null, equipment_type: null, model_spec: null, item_name: '工程监理费', unit_price: 0.03, cost_unit: '元/W', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'OTH-003', category: 'other', sub_category: null, equipment_type: null, model_spec: null, item_name: '项目管理费', unit_price: 0.02, cost_unit: '元/W', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'OTH-004', category: 'other', sub_category: null, equipment_type: null, model_spec: null, item_name: '土地征用及补偿费', unit_price: 1.5, cost_unit: '万元/亩', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'OTH-005', category: 'other', sub_category: null, equipment_type: null, model_spec: null, item_name: '环评及水保费用', unit_price: 0.02, cost_unit: '元/W', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'OTH-006', category: 'other', sub_category: null, equipment_type: null, model_spec: null, item_name: '并网检测及验收费用', unit_price: 0.015, cost_unit: '元/W', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'OTH-007', category: 'other', sub_category: null, equipment_type: null, model_spec: null, item_name: '运维期年度运营费用', unit_price: 0.06, cost_unit: '元/W/年', created_at: now, updated_at: now },
    { id: uuid(), item_code: 'OTH-008', category: 'other', sub_category: null, equipment_type: null, model_spec: null, item_name: '保险费用', unit_price: 0.005, cost_unit: '元/W/年', created_at: now, updated_at: now },
  ])
}
