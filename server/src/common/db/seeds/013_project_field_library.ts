import type { Knex } from 'knex'
import { v4 as uuid } from 'uuid'

const F: Array<{ code: string; name: string; type: string; cat: string; opts?: string }> = [
  { code: 'project_name', name: '项目名称', type: 'text', cat: '项目基础信息' },
  { code: 'project_no', name: '项目编号', type: 'text', cat: '项目基础信息' },
  { code: 'project_type', name: '项目类型', type: 'select', cat: '项目基础信息', opts: JSON.stringify(['集中式光伏布点', '光储联合', '分布式光伏']) },
  { code: 'build_location', name: '建设地点', type: 'text', cat: '项目基础信息' },
  { code: 'build_nature', name: '建设性质', type: 'select', cat: '项目基础信息', opts: JSON.stringify(['新建', '扩建', '改建']) },
  { code: 'capacity_mwp', name: '装机容量(MWp)', type: 'number', cat: '项目基础信息' },
  { code: 'land_type', name: '土地性质', type: 'select', cat: '项目基础信息', opts: JSON.stringify(['未利用地', '农用地', '建设用地', '林地', '草地', '水域']) },
  { code: 'target_substation', name: '拟接入变电站', type: 'text', cat: '项目基础信息' },
  { code: 'grid_voltage', name: '并网电压等级', type: 'select', cat: '项目基础信息', opts: JSON.stringify(['10kV', '35kV', '110kV', '220kV']) },
  { code: 'grid_mode', name: '上网模式', type: 'select', cat: '项目基础信息', opts: JSON.stringify(['全额上网', '自发自用余电上网', '全部自用']) },
  { code: 'owner_info', name: '业主单位信息', type: 'text', cat: '项目基础信息' },
  { code: 'access_approval_status', name: '接入批复状态', type: 'select', cat: '规划阶段信息', opts: JSON.stringify(['已取得', '办理中', '未办理']) },
  { code: 'access_approval_no', name: '接入批复文号', type: 'text', cat: '规划阶段信息' },
  { code: 'land_compliance', name: '土地合规性', type: 'select', cat: '规划阶段信息', opts: JSON.stringify(['合规', '待完善', '不合规']) },
  { code: 'filing_status', name: '备案状态', type: 'select', cat: '规划阶段信息', opts: JSON.stringify(['已备案', '备案中', '未备案']) },
  { code: 'filing_no', name: '备案文号', type: 'text', cat: '规划阶段信息' },
  { code: 'feasibility_stage', name: '可研及设计阶段', type: 'select', cat: '规划阶段信息', opts: JSON.stringify(['未启动', '可研编制中', '可研完成', '初设完成', '施工图完成']) },
  { code: 'planned_start_date', name: '计划开工时间', type: 'date', cat: '规划阶段信息' },
  { code: 'planned_grid_date', name: '计划并网时间', type: 'date', cat: '规划阶段信息' },
  { code: 'estimated_investment', name: '估算总投资', type: 'number', cat: '规划阶段信息' },
  { code: 'actual_start_date', name: '实际开工时间', type: 'date', cat: '并网进度' },
  { code: 'construction_progress', name: '整体建设进度', type: 'select', cat: '并网进度', opts: JSON.stringify(['未开工', '场平施工', '基础施工', '设备安装', '线路施工', '调试中', '已完工']) },
  { code: 'grid_acceptance_status', name: '并网验收申请状态', type: 'select', cat: '并网进度', opts: JSON.stringify(['未申请', '已申请', '验收中', '验收通过', '验收不通过']) },
  { code: 'contract_status', name: '调度/购售电合同签订情况', type: 'select', cat: '并网进度', opts: JSON.stringify(['未签订', '签订中', '已签订']) },
  { code: 'actual_grid_date', name: '实际并网时间', type: 'date', cat: '并网进度' },
  { code: 'full_capacity_date', name: '全容量并网时间', type: 'date', cat: '并网进度' },
  { code: 'operation_status', name: '运行状态', type: 'select', cat: '并网进度', opts: JSON.stringify(['在建', '并网调试', '正常运行', '停运检修', '报废']) },
]

export async function seed(knex: Knex): Promise<void> {
  await knex('project_field_library').del()
  await knex('project_field_library').insert(F.map((f) => ({
    id: uuid(), field_code: f.code, field_name: f.name, field_type: f.type,
    field_options: f.opts || null, category: f.cat, created_at: new Date().toISOString(),
  })))
}
