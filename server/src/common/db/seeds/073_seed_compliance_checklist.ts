import type { Knex } from 'knex'
import { v4 as uuid } from 'uuid'

export async function seed(knex: Knex): Promise<void> {
  await knex('project_compliance_results').del()
  await knex('compliance_checklist').del()

  const now = new Date().toISOString()

  const items = [
    {
      id: uuid(),
      code: 'access_location',
      name: '接入位置合规性',
      category: '规划合规',
      description: '验证项目关联电站的经纬度是否在规划接入点有效范围内',
      check_rule: 'field_compare',
      rule_config: JSON.stringify({
        type: 'coordinate_range',
        stationField: 'longitude,latitude',
      }),
      is_enabled: 1,
      sort_order: 1,
      created_at: now,
    },
    {
      id: uuid(),
      code: 'device_param_consistency',
      name: '设备参数一致性',
      category: '设备合规',
      description: '验证项目关联电站的设备参数与项目规划参数是否一致',
      check_rule: 'field_compare',
      rule_config: JSON.stringify({
        type: 'cross_table_compare',
        tables: ['station_model_params', 'projects'],
        fields: [
          { modelField: 'rated_capacity_mw', projectField: 'capacity_kw', tolerance: 0.05 },
          { modelField: 'rated_voltage_kv', projectField: 'custom_fields.grid_voltage', tolerance: 0.1 },
        ],
      }),
      is_enabled: 1,
      sort_order: 2,
      created_at: now,
    },
    {
      id: uuid(),
      code: 'plan_adjustment_approval',
      name: '规划调整审批',
      category: '审批合规',
      description: '检查项目规划调整是否有审批记录',
      check_rule: 'existence',
      rule_config: JSON.stringify({
        type: 'record_exists',
        table: 'plan_adjustments',
        condition: { approval_status: 'approved' },
      }),
      is_enabled: 1,
      sort_order: 3,
      created_at: now,
    },
    {
      id: uuid(),
      code: 'grid_connection_report',
      name: '并网检测报告',
      category: '验收合规',
      description: '检查是否上传了并网检测报告',
      check_rule: 'existence',
      rule_config: JSON.stringify({
        type: 'document_exists',
        doc_type: '并网检测报告',
      }),
      is_enabled: 1,
      sort_order: 4,
      created_at: now,
    },
    {
      id: uuid(),
      code: 'cost_completion',
      name: '决算完成度',
      category: '投资合规',
      description: '检查实际成本与预算是否都已填写且偏差在合理范围',
      check_rule: 'threshold',
      rule_config: JSON.stringify({
        type: 'field_threshold',
        fields: ['actual_cost', 'budget'],
        maxDeviationPct: 20,
      }),
      is_enabled: 1,
      sort_order: 5,
      created_at: now,
    },
    {
      id: uuid(),
      code: 'env_assessment',
      name: '环评审批',
      category: '环境合规',
      description: '检查是否上传了环评报告',
      check_rule: 'existence',
      rule_config: JSON.stringify({
        type: 'document_exists',
        doc_type: '环评报告',
      }),
      is_enabled: 1,
      sort_order: 6,
      created_at: now,
    },
    {
      id: uuid(),
      code: 'land_approval',
      name: '用地审批',
      category: '用地合规',
      description: '检查是否上传了用地审批文件',
      check_rule: 'existence',
      rule_config: JSON.stringify({
        type: 'document_exists',
        doc_type: '用地审批',
      }),
      is_enabled: 1,
      sort_order: 7,
      created_at: now,
    },
    {
      id: uuid(),
      code: 'equipment_acceptance',
      name: '设备安装验收',
      category: '建设合规',
      description: '检查设备生命周期中是否有安装验收记录',
      check_rule: 'existence',
      rule_config: JSON.stringify({
        type: 'lifecycle_event_exists',
        table: 'equipment_lifecycle',
        event_type: 'installation_acceptance',
      }),
      is_enabled: 1,
      sort_order: 8,
      created_at: now,
    },
  ]

  await knex('compliance_checklist').insert(items)
  console.log(`  ✓ ${items.length} 个合规检查项已创建`)
}
