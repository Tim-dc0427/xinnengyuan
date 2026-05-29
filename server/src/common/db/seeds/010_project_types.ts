import type { Knex } from 'knex'
import { v4 as uuid } from 'uuid'

export async function seed(knex: Knex): Promise<void> {
  await knex('project_type_fields').del()
  await knex('project_types').del()

  const now = new Date().toISOString()

  // ==================== 项目类型定义 ====================
  const typePvGrid = uuid()
  const typePvStorage = uuid()
  const typePvDistributed = uuid()

  await knex('project_types').insert([
    { id: typePvGrid, name: '集中式光伏布点', code: 'PV_GRID_CONNECTION', description: '大型集中式光伏电站并网项目，接入35kV及以上电网', sort_order: 1, created_at: now },
    { id: typePvStorage, name: '光储联合', code: 'PV_STORAGE', description: '光伏+储能联合项目，包含光伏电站和配套储能系统', sort_order: 2, created_at: now },
    { id: typePvDistributed, name: '分布式光伏', code: 'PV_DISTRIBUTED', description: '屋顶分布式光伏项目，接入10kV及以下配电网', sort_order: 3, created_at: now },
  ])

  // ==================== 项目类型自定义字段 ====================
  // 集中式光伏布点字段
  await knex('project_type_fields').insert([
    { id: uuid(), type_id: typePvGrid, field_code: 'capacity_kw', field_name: '装机容量(kW)', field_type: 'number', is_required: 1, sort_order: 1, created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'voltage_level', field_name: '并网电压等级(kV)', field_type: 'select', field_options: JSON.stringify(['35', '110', '220', '330', '500']), is_required: 1, sort_order: 2, created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'land_type', field_name: '土地性质', field_type: 'select', field_options: JSON.stringify(['未利用地', '农用地', '建设用地', '林地', '草地']), is_required: 1, sort_order: 3, created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'land_area_mu', field_name: '用地面积(亩)', field_type: 'number', is_required: 0, sort_order: 4, created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'annual_irradiance', field_name: '年均辐照度(kWh/㎡·年)', field_type: 'number', is_required: 1, sort_order: 5, created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'access_point_scale', field_name: '接入点规模(MVA)', field_type: 'number', is_required: 0, sort_order: 6, created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'conn_line_length_km', field_name: '并网线路长度(km)', field_type: 'number', is_required: 0, sort_order: 7, created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'pv_module_type', field_name: '光伏组件类型', field_type: 'select', field_options: JSON.stringify(['单晶硅', '多晶硅', '薄膜', '双面组件']), is_required: 0, sort_order: 8, created_at: now },
  ])

  // 光储联合字段
  await knex('project_type_fields').insert([
    { id: uuid(), type_id: typePvStorage, field_code: 'pv_capacity_kw', field_name: '光伏装机容量(kW)', field_type: 'number', is_required: 1, sort_order: 1, created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'storage_capacity_kwh', field_name: '储能容量(kWh)', field_type: 'number', is_required: 1, sort_order: 2, created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'storage_power_kw', field_name: '储能功率(kW)', field_type: 'number', is_required: 1, sort_order: 3, created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'voltage_level', field_name: '并网电压等级(kV)', field_type: 'select', field_options: JSON.stringify(['10', '35', '110']), is_required: 1, sort_order: 4, created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'storage_type', field_name: '储能类型', field_type: 'select', field_options: JSON.stringify(['磷酸铁锂', '钠离子', '液流', '铅酸']), is_required: 1, sort_order: 5, created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'charge_discharge_hours', field_name: '充放电时长(h)', field_type: 'number', is_required: 0, sort_order: 6, created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'application_scenario', field_name: '应用场景', field_type: 'select', field_options: JSON.stringify(['削峰填谷', '调频辅助', '备用电源', '微电网']), is_required: 0, sort_order: 7, created_at: now },
  ])

  // 分布式光伏字段
  await knex('project_type_fields').insert([
    { id: uuid(), type_id: typePvDistributed, field_code: 'capacity_kw', field_name: '装机容量(kW)', field_type: 'number', is_required: 1, sort_order: 1, created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'voltage_level', field_name: '接入电压等级(V)', field_type: 'select', field_options: JSON.stringify(['220', '380', '10000']), is_required: 1, sort_order: 2, created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'roof_area_sqm', field_name: '屋顶面积(㎡)', field_type: 'number', is_required: 1, sort_order: 3, created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'owner_type', field_name: '业主类型', field_type: 'select', field_options: JSON.stringify(['工商业', '户用', '公共机构', '农业']), is_required: 1, sort_order: 4, created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'conn_mode', field_name: '并网模式', field_type: 'select', field_options: JSON.stringify(['全额上网', '自发自用余电上网', '全部自用']), is_required: 1, sort_order: 5, created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'roof_structure', field_name: '屋顶结构', field_type: 'select', field_options: JSON.stringify(['混凝土', '彩钢瓦', '钢结构']), is_required: 0, sort_order: 6, created_at: now },
  ])
}
