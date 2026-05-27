import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1. 删除旧的 edge_type 列（被 topology_type 替代）
  await knex.schema.alterTable('resource_connection_attrs', (t) => {
    t.dropColumn('edge_type')
  })

  // 2. 连接方式字段
  await knex.schema.alterTable('resource_connection_attrs', (t) => {
    t.text('topology_type').defaultTo('STAR_NETWORK')  // 并联/串联/星形/环网/专线/统一并网点/分区隔离
    t.text('voltage_level_hierarchy')                   // 电气层级：500kV/220kV/110kV/35kV/10kV/0.4kV
    t.text('operation_mode').defaultTo('GRID_CONNECTED') // 联网运行/孤岛运行/可切换
    t.text('intermediate_equipment')                    // 中间设备
    t.text('topology_desc')                              // 连接方式补充说明
  })

  // 3. 功率流方向扩展字段
  await knex.schema.alterTable('resource_connection_attrs', (t) => {
    t.float('forward_power_max_kw')   // 正向有功功率上限
    t.float('reverse_power_max_kw')   // 反向有功功率上限（双向时填写）
    t.text('flow_desc')               // 功率流补充说明
  })

  // 4. 控制逻辑结构化字段
  await knex.schema.alterTable('resource_connection_attrs', (t) => {
    t.text('control_subject')         // 控制主体：就地控制器/区域EMS/省级调度
    t.text('control_type')            // 控制类型：就地保护/出力调节/开关控制/协同联动/需求响应
    t.text('trigger_condition')       // 触发条件
    t.text('execute_action')          // 执行动作：充电/放电/升出力/降出力/分闸/合闸/负荷调节
    t.text('sync_objects')            // 协同对象
    t.text('data_interaction')        // 数据交互项
    t.text('status_sync_rule')        // 状态同步规则
  })
}

export async function down(knex: Knex): Promise<void> {
  const drops = [
    'topology_type', 'voltage_level_hierarchy', 'operation_mode',
    'intermediate_equipment', 'topology_desc',
    'forward_power_max_kw', 'reverse_power_max_kw', 'flow_desc',
    'control_subject', 'control_type', 'trigger_condition',
    'execute_action', 'sync_objects', 'data_interaction', 'status_sync_rule',
  ]
  for (const col of drops) {
    await knex.schema.alterTable('resource_connection_attrs', (t) => {
      t.dropColumn(col)
    })
  }
  // 恢复 edge_type
  await knex.schema.alterTable('resource_connection_attrs', (t) => {
    t.text('edge_type').defaultTo('PHYSICAL')
  })
}
