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
    { id: uuid(), type_id: typePvGrid, field_code: 'project_name', field_name: '项目名称', field_type: 'text', is_required: 0, sort_order: 1, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'capacity_mwp', field_name: '装机容量(MWp)', field_type: 'number', is_required: 0, sort_order: 2, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'land_type', field_name: '土地性质', field_type: 'select', field_options: JSON.stringify(['未利用地', '农用地', '建设用地', '林地', '草地']), is_required: 0, sort_order: 3, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'grid_voltage', field_name: '并网电压等级', field_type: 'select', field_options: JSON.stringify(['35kV', '110kV', '220kV']), is_required: 0, sort_order: 4, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'target_substation', field_name: '拟接入变电站', field_type: 'text', is_required: 0, sort_order: 5, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'access_approval_status', field_name: '接入批复状态', field_type: 'select', field_options: JSON.stringify(['已取得', '办理中', '未办理']), is_required: 0, sort_order: 6, category: '规划阶段信息', created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'filing_status', field_name: '备案状态', field_type: 'select', field_options: JSON.stringify(['已备案', '备案中', '未备案']), is_required: 0, sort_order: 7, category: '规划阶段信息', created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'planned_grid_date', field_name: '计划并网时间', field_type: 'date', is_required: 0, sort_order: 8, category: '规划阶段信息', created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'construction_progress', field_name: '整体建设进度', field_type: 'select', field_options: JSON.stringify(['未开工', '场平施工', '基础施工', '设备安装', '线路施工', '调试中', '已完工']), is_required: 0, sort_order: 9, category: '并网进度', created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'operation_status', field_name: '运行状态', field_type: 'select', field_options: JSON.stringify(['在建', '并网调试', '正常运行', '停运检修', '报废']), is_required: 0, sort_order: 10, category: '并网进度', created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'annual_irradiance', field_name: '年均辐照度(kWh/㎡·年)', field_type: 'number', is_required: 0, sort_order: 11, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'sunshine_hours', field_name: '年日照小时数(h)', field_type: 'number', is_required: 0, sort_order: 12, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'solar_grade', field_name: '太阳能资源等级', field_type: 'select', field_options: JSON.stringify(['A', 'B', 'C']), is_required: 0, sort_order: 13, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'unit_cost', field_name: '单位造价(元/W)', field_type: 'number', is_required: 0, sort_order: 14, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'payback_years', field_name: '投资回收期(年)', field_type: 'number', is_required: 0, sort_order: 15, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'irr_pct', field_name: '内部收益率(%)', field_type: 'number', is_required: 0, sort_order: 16, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'env_sensitivity', field_name: '环保敏感性', field_type: 'select', field_options: JSON.stringify(['不敏感', '一般', '敏感']), is_required: 0, sort_order: 17, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'geohazard_risk', field_name: '地质灾害风险', field_type: 'select', field_options: JSON.stringify(['低', '中', '高']), is_required: 0, sort_order: 18, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'short_circuit_capacity_mva', field_name: '接入点短路容量(MVA)', field_type: 'number', is_required: 0, sort_order: 19, category: '规划阶段信息', created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'transmission_distance_km', field_name: '接入距离(km)', field_type: 'number', is_required: 0, sort_order: 20, category: '规划阶段信息', created_at: now },
    { id: uuid(), type_id: typePvGrid, field_code: 'corridor_available', field_name: '线路走廊可用性', field_type: 'select', field_options: JSON.stringify(['可用', '受限', '不可用']), is_required: 0, sort_order: 21, category: '规划阶段信息', created_at: now },
  ])

  // 光储联合字段
  await knex('project_type_fields').insert([
    { id: uuid(), type_id: typePvStorage, field_code: 'project_name', field_name: '项目名称', field_type: 'text', is_required: 0, sort_order: 1, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'capacity_mwp', field_name: '装机容量(MWp)', field_type: 'number', is_required: 0, sort_order: 2, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'grid_voltage', field_name: '并网电压等级', field_type: 'select', field_options: JSON.stringify(['10kV', '35kV', '110kV']), is_required: 0, sort_order: 3, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'target_substation', field_name: '拟接入变电站', field_type: 'text', is_required: 0, sort_order: 4, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'access_approval_status', field_name: '接入批复状态', field_type: 'select', field_options: JSON.stringify(['已取得', '办理中', '未办理']), is_required: 0, sort_order: 5, category: '规划阶段信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'filing_status', field_name: '备案状态', field_type: 'select', field_options: JSON.stringify(['已备案', '备案中', '未备案']), is_required: 0, sort_order: 6, category: '规划阶段信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'planned_grid_date', field_name: '计划并网时间', field_type: 'date', is_required: 0, sort_order: 7, category: '规划阶段信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'construction_progress', field_name: '整体建设进度', field_type: 'select', field_options: JSON.stringify(['未开工', '场平施工', '基础施工', '设备安装', '线路施工', '调试中', '已完工']), is_required: 0, sort_order: 8, category: '并网进度', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'operation_status', field_name: '运行状态', field_type: 'select', field_options: JSON.stringify(['在建', '并网调试', '正常运行', '停运检修', '报废']), is_required: 0, sort_order: 9, category: '并网进度', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'land_type', field_name: '土地性质', field_type: 'select', field_options: JSON.stringify(['未利用地', '农用地', '建设用地', '林地', '草地']), is_required: 0, sort_order: 10, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'annual_irradiance', field_name: '年均辐照度(kWh/㎡·年)', field_type: 'number', is_required: 0, sort_order: 11, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'sunshine_hours', field_name: '年日照小时数(h)', field_type: 'number', is_required: 0, sort_order: 12, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'solar_grade', field_name: '太阳能资源等级', field_type: 'select', field_options: JSON.stringify(['A', 'B', 'C']), is_required: 0, sort_order: 13, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'unit_cost', field_name: '单位造价(元/W)', field_type: 'number', is_required: 0, sort_order: 14, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'payback_years', field_name: '投资回收期(年)', field_type: 'number', is_required: 0, sort_order: 15, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'irr_pct', field_name: '内部收益率(%)', field_type: 'number', is_required: 0, sort_order: 16, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'env_sensitivity', field_name: '环保敏感性', field_type: 'select', field_options: JSON.stringify(['不敏感', '一般', '敏感']), is_required: 0, sort_order: 17, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'geohazard_risk', field_name: '地质灾害风险', field_type: 'select', field_options: JSON.stringify(['低', '中', '高']), is_required: 0, sort_order: 18, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'short_circuit_capacity_mva', field_name: '接入点短路容量(MVA)', field_type: 'number', is_required: 0, sort_order: 19, category: '规划阶段信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'transmission_distance_km', field_name: '接入距离(km)', field_type: 'number', is_required: 0, sort_order: 20, category: '规划阶段信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'corridor_available', field_name: '线路走廊可用性', field_type: 'select', field_options: JSON.stringify(['可用', '受限', '不可用']), is_required: 0, sort_order: 21, category: '规划阶段信息', created_at: now },
  ])

  // 分布式光伏字段
  await knex('project_type_fields').insert([
    { id: uuid(), type_id: typePvDistributed, field_code: 'project_name', field_name: '项目名称', field_type: 'text', is_required: 0, sort_order: 1, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'capacity_mwp', field_name: '装机容量(MWp)', field_type: 'number', is_required: 0, sort_order: 2, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'build_location', field_name: '建设地点', field_type: 'text', is_required: 0, sort_order: 3, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'owner_info', field_name: '业主单位信息', field_type: 'text', is_required: 0, sort_order: 4, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'filing_status', field_name: '备案状态', field_type: 'select', field_options: JSON.stringify(['已备案', '备案中', '未备案']), is_required: 0, sort_order: 5, category: '规划阶段信息', created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'filing_no', field_name: '备案文号', field_type: 'text', is_required: 0, sort_order: 6, category: '规划阶段信息', created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'planned_start_date', field_name: '计划开工时间', field_type: 'date', is_required: 0, sort_order: 7, category: '规划阶段信息', created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'planned_grid_date', field_name: '计划并网时间', field_type: 'date', is_required: 0, sort_order: 8, category: '规划阶段信息', created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'construction_progress', field_name: '整体建设进度', field_type: 'select', field_options: JSON.stringify(['未开工', '场平施工', '基础施工', '设备安装', '线路施工', '调试中', '已完工']), is_required: 0, sort_order: 9, category: '并网进度', created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'operation_status', field_name: '运行状态', field_type: 'select', field_options: JSON.stringify(['在建', '并网调试', '正常运行', '停运检修', '报废']), is_required: 0, sort_order: 10, category: '并网进度', created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'land_type', field_name: '土地性质', field_type: 'select', field_options: JSON.stringify(['未利用地', '农用地', '建设用地', '林地', '草地']), is_required: 0, sort_order: 11, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'grid_voltage', field_name: '并网电压等级', field_type: 'select', field_options: JSON.stringify(['220V', '380V', '10kV']), is_required: 0, sort_order: 12, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'annual_irradiance', field_name: '年均辐照度(kWh/㎡·年)', field_type: 'number', is_required: 0, sort_order: 13, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'sunshine_hours', field_name: '年日照小时数(h)', field_type: 'number', is_required: 0, sort_order: 14, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'solar_grade', field_name: '太阳能资源等级', field_type: 'select', field_options: JSON.stringify(['A', 'B', 'C']), is_required: 0, sort_order: 15, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'unit_cost', field_name: '单位造价(元/W)', field_type: 'number', is_required: 0, sort_order: 16, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'payback_years', field_name: '投资回收期(年)', field_type: 'number', is_required: 0, sort_order: 17, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'irr_pct', field_name: '内部收益率(%)', field_type: 'number', is_required: 0, sort_order: 18, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'env_sensitivity', field_name: '环保敏感性', field_type: 'select', field_options: JSON.stringify(['不敏感', '一般', '敏感']), is_required: 0, sort_order: 19, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'geohazard_risk', field_name: '地质灾害风险', field_type: 'select', field_options: JSON.stringify(['低', '中', '高']), is_required: 0, sort_order: 20, category: '项目基础信息', created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'transmission_distance_km', field_name: '接入距离(km)', field_type: 'number', is_required: 0, sort_order: 21, category: '规划阶段信息', created_at: now },
    { id: uuid(), type_id: typePvDistributed, field_code: 'corridor_available', field_name: '线路走廊可用性', field_type: 'select', field_options: JSON.stringify(['可用', '受限', '不可用']), is_required: 0, sort_order: 22, category: '规划阶段信息', created_at: now },
  ])
}
