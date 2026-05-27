import type { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  await knex('feeder_buses').del()
  await knex('feeders').del()

  // 10kV 母线即馈线：查询所有 10kV 母线及其上游 110kV 站
  const buses10kv = await knex('grid_buses')
    .where('voltage_level', '10kV')
    .select('id', 'name', 'zone')
    .orderBy('zone')
    .orderBy('name')

  if (buses10kv.length === 0) {
    console.log('⚠ 未找到 10kV 母线，跳过馈线种子')
    return
  }

  // 查询 110/10 变压器支路，确定每根 10kV 母线的上级变电站
  const transformers = await knex('grid_branches')
    .where('branch_type', 'TRANSFORMER')
    .whereIn('to_bus_id', buses10kv.map(b => b.id))
    .select('from_bus_id', 'to_bus_id')

  // 查询 110kV 母线名称
  const bus110Ids = [...new Set(transformers.map(t => t.from_bus_id))]
  const buses110kv = await knex('grid_buses')
    .whereIn('id', bus110Ids)
    .select('id', 'name')

  const bus110Map = new Map(buses110kv.map(b => [b.id, b.name]))
  const substationMap = new Map<string, string>()
  for (const t of transformers) {
    const name = bus110Map.get(t.from_bus_id) || '未知'
    substationMap.set(t.to_bus_id, name)
  }

  // 生成馈线
  let seq = 0
  for (const bus of buses10kv) {
    seq++
    const feederId = 'FD' + String(seq).padStart(3, '0')
    const substation = substationMap.get(bus.id) || '未知变电站'

    await knex('feeders').insert({
      id: feederId,
      name: `${bus.name}馈线`,
      substation_name: substation,
      voltage_level: '10kV',
      zone: bus.zone,
    })

    await knex('feeder_buses').insert({
      feeder_id: feederId,
      bus_id: bus.id,
    })
  }

  console.log(`✓ 已生成 ${buses10kv.length} 条馈线`)
}
