import { v4 as uuid } from 'uuid'
import type { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  await knex('resource_connection_attrs').del()
  await knex('solar_pv_stations').del()

  const plants = await knex('power_plants').select('id', 'name', 'capacity_kw', 'longitude', 'latitude')
  const buses = await knex('grid_buses').select('id', 'name', 'voltage_level', 'zone')

  const busMap: Record<string, string> = {}
  for (const b of buses) {
    const bus = b as any
    busMap[bus.name] = bus.id
  }

  interface StationDef {
    stationName: string
    busName: string
    plantName: string
    capacityMw: number
    panelType: string
    inverterCapacityMw: number
    gridVoltageKv: number
    longitude: number
    latitude: number
    address: string
  }

  // 9 个集中式光伏站，覆盖杭州各区县
  const stationDefs: StationDef[] = [
    // 余杭区 (已有)
    {
      stationName: '径山镇宇航梦园渔光互补光伏项目',
      busName: '余杭10kV',
      plantName: '径山镇宇航梦园渔光互补光伏项目',
      capacityMw: 5.44,
      panelType: '多晶硅450W组件',
      inverterCapacityMw: 5.44,
      gridVoltageKv: 10,
      longitude: 119.85,
      latitude: 30.35,
      address: '杭州市余杭区径山镇',
    },
    // 钱塘区临江 — 舒奇蒙集群（3站，同母线）
    {
      stationName: '舒能渔光互补光伏项目',
      busName: '钱塘变220kV',
      plantName: '舒能渔光互补光伏项目',
      capacityMw: 400,
      panelType: '双面双玻540W组件',
      inverterCapacityMw: 400,
      gridVoltageKv: 220,
      longitude: 120.58,
      latitude: 30.28,
      address: '杭州市钱塘区临江街道',
    },
    {
      stationName: '嘉达渔光互补光伏项目',
      busName: '钱塘变220kV',
      plantName: '嘉达渔光互补光伏项目',
      capacityMw: 350,
      panelType: '双面双玻540W组件',
      inverterCapacityMw: 350,
      gridVoltageKv: 220,
      longitude: 120.60,
      latitude: 30.29,
      address: '杭州市钱塘区临江街道',
    },
    {
      stationName: '凌能渔光互补光伏项目',
      busName: '钱塘变220kV',
      plantName: '凌能渔光互补光伏项目',
      capacityMw: 250,
      panelType: '双面双玻540W组件',
      inverterCapacityMw: 250,
      gridVoltageKv: 220,
      longitude: 120.55,
      latitude: 30.27,
      address: '杭州市钱塘区临江街道',
    },
    // 建德市 — 华洋山地光伏
    {
      stationName: '华洋山地光伏电站',
      busName: '建德变110kV',
      plantName: '华洋山地光伏电站',
      capacityMw: 155,
      panelType: '单晶硅550W双面组件',
      inverterCapacityMw: 155,
      gridVoltageKv: 110,
      longitude: 119.28,
      latitude: 29.47,
      address: '杭州市建德市',
    },
    // 临安区 — 青山 + 太湖源
    {
      stationName: '临安青山集中式光伏电站',
      busName: '临安变110kV',
      plantName: '临安青山集中式光伏电站',
      capacityMw: 60,
      panelType: '单晶硅450W组件',
      inverterCapacityMw: 60,
      gridVoltageKv: 110,
      longitude: 119.72,
      latitude: 30.23,
      address: '杭州市临安区青山湖街道',
    },
    {
      stationName: '临安太湖源集中式光伏电站',
      busName: '临安东变110kV',
      plantName: '临安太湖源集中式光伏电站',
      capacityMw: 40,
      panelType: '单晶硅450W组件',
      inverterCapacityMw: 40,
      gridVoltageKv: 110,
      longitude: 119.55,
      latitude: 30.32,
      address: '杭州市临安区太湖源镇',
    },
    // 萧山区
    {
      stationName: '萧山南阳集中式光伏电站',
      busName: '萧山10kV',
      plantName: '萧山南阳集中式光伏电站',
      capacityMw: 50,
      panelType: '单晶硅540W组件',
      inverterCapacityMw: 50,
      gridVoltageKv: 10,
      longitude: 120.45,
      latitude: 30.25,
      address: '杭州市萧山区南阳街道',
    },
    // 富阳区
    {
      stationName: '富阳渔山集中式光伏电站',
      busName: '富阳10kV',
      plantName: '富阳渔山集中式光伏电站',
      capacityMw: 30,
      panelType: '单晶硅540W组件',
      inverterCapacityMw: 30,
      gridVoltageKv: 10,
      longitude: 120.05,
      latitude: 30.05,
      address: '杭州市富阳区渔山乡',
    },
  ]

  const now = new Date().toISOString()
  const insertedStations: any[] = []

  for (const def of stationDefs) {
    const plant = plants.find((p: any) => p.name === def.plantName)
    const busId = busMap[def.busName]
    if (!busId) {
      console.log(`  ⚠ Bus "${def.busName}" not found, skipping ${def.stationName}`)
      continue
    }

    insertedStations.push({
      id: uuid(),
      station_name: def.stationName,
      bus_id: busId,
      plant_id: plant ? (plant as any).id : null,
      installed_capacity_mw: def.capacityMw,
      panel_type: def.panelType,
      inverter_capacity_mw: def.inverterCapacityMw,
      grid_connection_voltage_kv: def.gridVoltageKv,
      longitude: def.longitude,
      latitude: def.latitude,
      address: def.address,
      status: 'active',
      phase_connection: 'three_phase',
      created_at: now,
    })
  }

  if (insertedStations.length > 0) {
    await knex('solar_pv_stations').insert(insertedStations)
    for (const s of insertedStations) {
      const bus = buses.find((b: any) => b.id === s.bus_id) as any
      console.log(`  ✓ ${s.station_name} → ${bus?.name || '?'} (${s.installed_capacity_mw}MW)`)
    }

    // 为每个光伏电站插入关联属性（resource_connection_attrs）
    const connAttrs = insertedStations.map((s, i) => ({
      id: uuid(),
      source_node_type: 'SOURCE',
      source_node_id: s.plant_id,
      target_node_type: 'GRID',
      target_node_id: s.bus_id,
      flow_direction: 'FORWARD',
      max_capacity_kw: s.installed_capacity_mw * 1000,
      control_logic: JSON.stringify({
        mode: 'max_power_tracking',
        pfControl: 'unity',
        antiIslanding: true,
        lvrtEnabled: s.grid_connection_voltage_kv >= 110,
        rampRateLimitKwMin: Math.round(s.installed_capacity_mw * 10),
        description: `${s.station_name} 接入控制策略`,
      }),
      status: 'active',
      created_at: now,
    }))
    await knex('resource_connection_attrs').insert(connAttrs)
    console.log(`  ✓ ${connAttrs.length} connection attrs created`)
  }
}
