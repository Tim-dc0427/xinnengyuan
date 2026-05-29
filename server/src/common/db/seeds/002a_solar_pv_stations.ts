import { v4 as uuid } from 'uuid'
import type { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  await knex('resource_connection_attrs').del()
  await knex('equipment_lifecycle').whereIn('equipment_id', function () {
    this.select('id').from('equipment').whereNotNull('station_id')
  }).del()
  await knex('equipment').whereNotNull('station_id').del()
  await knex('solar_pv_stations').del()

  const buses = await knex('grid_buses').select('id', 'name', 'voltage_level', 'zone')

  const busMap: Record<string, string> = {}
  for (const b of buses) {
    const bus = b as any
    busMap[bus.name] = bus.id
  }

  interface StationDef {
    stationName: string
    busName: string
    capacityMw: number
    panelType: string
    inverterCapacityMw: number
    gridVoltageKv: number
    longitude: number
    latitude: number
    address: string
    installedDate: string
  }

  // 9 个集中式光伏站，覆盖杭州各区县
  const stationDefs: StationDef[] = [
    {
      stationName: '径山镇宇航梦园渔光互补光伏项目',
      busName: '余杭10kV',
      capacityMw: 5.44,
      panelType: '多晶硅450W组件',
      inverterCapacityMw: 5.44,
      gridVoltageKv: 10,
      longitude: 119.85,
      latitude: 30.35,
      address: '杭州市余杭区径山镇',
      installedDate: '2026-04-01',
    },
    {
      stationName: '舒能渔光互补光伏项目',
      busName: '钱塘变220kV',
      capacityMw: 400,
      panelType: '双面双玻540W组件',
      inverterCapacityMw: 400,
      gridVoltageKv: 220,
      longitude: 120.58,
      latitude: 30.28,
      address: '杭州市钱塘区临江街道',
      installedDate: '2025-12-01',
    },
    {
      stationName: '嘉达渔光互补光伏项目',
      busName: '钱塘变220kV',
      capacityMw: 350,
      panelType: '双面双玻540W组件',
      inverterCapacityMw: 350,
      gridVoltageKv: 220,
      longitude: 120.60,
      latitude: 30.29,
      address: '杭州市钱塘区临江街道',
      installedDate: '2025-12-01',
    },
    {
      stationName: '凌能渔光互补光伏项目',
      busName: '钱塘变220kV',
      capacityMw: 250,
      panelType: '双面双玻540W组件',
      inverterCapacityMw: 250,
      gridVoltageKv: 220,
      longitude: 120.55,
      latitude: 30.27,
      address: '杭州市钱塘区临江街道',
      installedDate: '2025-12-01',
    },
    {
      stationName: '华洋山地光伏电站',
      busName: '建德变110kV',
      capacityMw: 155,
      panelType: '单晶硅550W双面组件',
      inverterCapacityMw: 155,
      gridVoltageKv: 110,
      longitude: 119.28,
      latitude: 29.47,
      address: '杭州市建德市',
      installedDate: '2024-08-30',
    },
    {
      stationName: '临安青山集中式光伏电站',
      busName: '临安变110kV',
      capacityMw: 60,
      panelType: '单晶硅450W组件',
      inverterCapacityMw: 60,
      gridVoltageKv: 110,
      longitude: 119.72,
      latitude: 30.23,
      address: '杭州市临安区青山湖街道',
      installedDate: '2024-06-15',
    },
    {
      stationName: '临安太湖源集中式光伏电站',
      busName: '临安东变110kV',
      capacityMw: 40,
      panelType: '单晶硅450W组件',
      inverterCapacityMw: 40,
      gridVoltageKv: 110,
      longitude: 119.55,
      latitude: 30.32,
      address: '杭州市临安区太湖源镇',
      installedDate: '2024-06-15',
    },
    {
      stationName: '萧山南阳集中式光伏电站',
      busName: '萧山10kV',
      capacityMw: 50,
      panelType: '单晶硅540W组件',
      inverterCapacityMw: 50,
      gridVoltageKv: 10,
      longitude: 120.45,
      latitude: 30.25,
      address: '杭州市萧山区南阳街道',
      installedDate: '2024-09-01',
    },
    {
      stationName: '富阳渔山集中式光伏电站',
      busName: '富阳10kV',
      capacityMw: 30,
      panelType: '单晶硅540W组件',
      inverterCapacityMw: 30,
      gridVoltageKv: 10,
      longitude: 120.05,
      latitude: 30.05,
      address: '杭州市富阳区渔山乡',
      installedDate: '2024-05-01',
    },
  ]

  const now = new Date().toISOString()
  const insertedStations: any[] = []

  for (const def of stationDefs) {
    const busId = busMap[def.busName]
    if (!busId) {
      console.log(`  ⚠ Bus "${def.busName}" not found, skipping ${def.stationName}`)
      continue
    }

    insertedStations.push({
      id: uuid(),
      station_name: def.stationName,
      bus_id: busId,
      installed_capacity_mw: def.capacityMw,
      panel_type: def.panelType,
      inverter_capacity_mw: def.inverterCapacityMw,
      grid_connection_voltage_kv: def.gridVoltageKv,
      longitude: def.longitude,
      latitude: def.latitude,
      address: def.address,
      installed_date: def.installedDate,
      status: 'active',
      phase_connection: 'three_phase',
      created_at: now,
    })
  }

  if (insertedStations.length > 0) {
    await knex('solar_pv_stations').insert(insertedStations)

    // 为每个电站插入设备（集中式光伏设备统一由此管理）
    const stationEquipment: any[] = []
    const equipLifecycle: any[] = []

    for (const s of insertedStations) {
      const capMw = s.installed_capacity_mw
      const isLarge = capMw >= 150
      const isMedium = capMw >= 30
      const installDate = s.installed_date || '2024-01-01'

      // 变压器
      let trafoModel: string, trafoKva: number, trafoKv: number
      if (capMw >= 350) {
        trafoModel = 'SZ11-180000/220'; trafoKva = 180000; trafoKv = 220
      } else if (capMw >= 200) {
        trafoModel = 'SZ11-120000/220'; trafoKva = 120000; trafoKv = 220
      } else if (capMw >= 100) {
        trafoModel = 'SZ11-75000/110'; trafoKva = 75000; trafoKv = 110
      } else if (capMw >= 40) {
        trafoModel = 'SZ11-50000/110'; trafoKva = 50000; trafoKv = 110
      } else if (capMw >= 20) {
        trafoModel = 'SZ11-31500/110'; trafoKva = 31500; trafoKv = 110
      } else {
        trafoModel = 'S11-6300/35'; trafoKva = 6300; trafoKv = 35
      }

      const mainTrafoId = uuid()
      stationEquipment.push({
        id: mainTrafoId,
        station_id: s.id,
        name: isLarge ? '1号主变压器' : '1号主变压器',
        equipment_type: 'TRANSFORMER',
        model_number: trafoModel,
        rated_capacity_kva: trafoKva,
        rated_voltage_kv: trafoKv,
        rated_current_a: Math.round(trafoKva / trafoKv * 0.7),
        installation_date: installDate,
        design_life_years: 25,
        grade: 'A',
        status: 'operational',
        created_at: now,
        updated_at: now,
      })
      equipLifecycle.push({
        id: uuid(),
        equipment_id: mainTrafoId,
        event_type: 'INSTALL',
        event_date: installDate,
        description: '变压器投运',
        remaining_life_years: 25,
        created_at: now,
      })

      // 大型电站有第2台主变
      if (isLarge) {
        const trafo2Id = uuid()
        stationEquipment.push({
          id: trafo2Id,
          station_id: s.id,
          name: '2号主变压器',
          equipment_type: 'TRANSFORMER',
          model_number: trafoModel,
          rated_capacity_kva: trafoKva,
          rated_voltage_kv: trafoKv,
          rated_current_a: Math.round(trafoKva / trafoKv * 0.7),
          installation_date: installDate,
          design_life_years: 25,
          grade: 'B',
          status: 'operational',
          created_at: now,
          updated_at: now,
        })
        equipLifecycle.push({
          id: uuid(),
          equipment_id: trafo2Id,
          event_type: 'INSTALL',
          event_date: installDate,
          description: '2号主变投运',
          remaining_life_years: 25,
          created_at: now,
        })
      }

      // 小型站配逆变器
      if (!isLarge) {
        const invId = uuid()
        stationEquipment.push({
          id: invId,
          station_id: s.id,
          name: '1号逆变器',
          equipment_type: 'INVERTER',
          model_number: capMw >= 20 ? 'SG-110CX' : 'SUN2000-300KTL',
          rated_capacity_kva: capMw >= 20 ? 110 : 300,
          rated_voltage_kv: 0.8,
          rated_current_a: capMw >= 20 ? 80 : 216,
          installation_date: installDate,
          design_life_years: 15,
          grade: 'B',
          status: 'operational',
          created_at: now,
          updated_at: now,
        })
        equipLifecycle.push({
          id: uuid(),
          equipment_id: invId,
          event_type: 'INSTALL',
          event_date: installDate,
          description: '逆变器投运',
          remaining_life_years: 15,
          created_at: now,
        })
      }

      // 中型及以上配储能电池 + PCS
      if (isMedium) {
        const battKwh = Math.round(capMw * 50) // 按装机容量5%配储能
        const battKva = Math.round(battKwh / 0.768)

        // 电池组
        const battCount = isLarge ? 2 : 1
        for (let i = 1; i <= battCount; i++) {
          const battId = uuid()
          stationEquipment.push({
            id: battId,
            station_id: s.id,
            name: `${i}号电池组`,
            equipment_type: 'BATTERY',
            model_number: `LFP-280Ah-${Math.round(battKwh / 250)}P`,
            rated_capacity_kva: battKva,
            rated_voltage_kv: 0.768,
            rated_current_a: Math.round(battKva / 0.768),
            installation_date: installDate,
            design_life_years: 12,
            grade: isLarge ? 'A' : i === 1 ? 'A' : 'B',
            status: 'operational',
            created_at: now,
            updated_at: now,
          })
          equipLifecycle.push({
            id: uuid(),
            equipment_id: battId,
            event_type: 'INSTALL',
            event_date: installDate,
            description: `${i}号电池组投运`,
            remaining_life_years: 12,
            created_at: now,
          })
        }

        // PCS
        const pcsCount = isLarge ? 2 : 1
        for (let i = 1; i <= pcsCount; i++) {
          const pcsId = uuid()
          stationEquipment.push({
            id: pcsId,
            station_id: s.id,
            name: `${i}号储能变流器`,
            equipment_type: 'INVERTER',
            model_number: `PCS-${Math.round(battKva / 10)}K`,
            rated_capacity_kva: Math.round(battKva / pcsCount),
            rated_voltage_kv: 0.8,
            rated_current_a: Math.round(battKva / pcsCount / 0.8),
            installation_date: installDate,
            design_life_years: 15,
            grade: isLarge ? 'A' : i === 1 ? 'A' : 'B',
            status: 'operational',
            created_at: now,
            updated_at: now,
          })
          equipLifecycle.push({
            id: uuid(),
            equipment_id: pcsId,
            event_type: 'INSTALL',
            event_date: installDate,
            description: `${i}号PCS投运`,
            remaining_life_years: 15,
            created_at: now,
          })
        }
      }
    }

    await knex('equipment').insert(stationEquipment)
    console.log(`  ✓ ${stationEquipment.length} equipment records for ${insertedStations.length} stations`)

    await knex('equipment_lifecycle').insert(equipLifecycle)
    console.log(`  ✓ ${equipLifecycle.length} lifecycle records`)

    // 为每个光伏电站插入关联属性（resource_connection_attrs）
    const connAttrs = insertedStations.map((s) => ({
      id: uuid(),
      source_node_type: 'SOURCE',
      source_node_id: s.id,
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

    for (const s of insertedStations) {
      const bus = buses.find((b: any) => b.id === s.bus_id) as any
      console.log(`  ✓ ${s.station_name} → ${bus?.name || '?'} (${s.installed_capacity_mw}MW)`)
    }
  }
}
