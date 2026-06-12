import { v4 as uuid } from 'uuid'
import type { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  await knex('storage_entities').del()
  await knex('load_entities').del()

  const buses = await knex('grid_buses').select('id', 'name', 'voltage_level', 'zone', 'longitude', 'latitude')
  const busMap: Record<string, any> = {}
  for (const b of buses) {
    const bus = b as any
    busMap[bus.name] = bus.id
  }

  const now = new Date().toISOString()

  // ==================== 负荷实体 ====================
  interface LoadDef {
    name: string; loadType: string; busName: string
    peakLoadKw: number; annualConsumptionMwh: number
    zone: string; voltageLevel: string
    longitude: number; latitude: number; address: string
  }

  const loadDefs: LoadDef[] = [
    {
      name: '钱塘区临江工业园负荷',
      loadType: 'INDUSTRIAL',
      busName: '义蓬变',
      peakLoadKw: 80000,
      annualConsumptionMwh: 350000,
      zone: '钱塘区',
      voltageLevel: '220kV',
      longitude: 120.57,
      latitude: 30.28,
      address: '杭州市钱塘区临江街道',
    },
    {
      name: '钱塘区临江高科园东区负荷',
      loadType: 'INDUSTRIAL',
      busName: '临江变',
      peakLoadKw: 120000,
      annualConsumptionMwh: 520000,
      zone: '钱塘区',
      voltageLevel: '220kV',
      longitude: 120.65,
      latitude: 30.26,
      address: '杭州市钱塘区临江高科园东区',
    },
    {
      name: '钱塘区临江高科园西区负荷',
      loadType: 'INDUSTRIAL',
      busName: '新湾变',
      peakLoadKw: 160000,
      annualConsumptionMwh: 700000,
      zone: '钱塘区',
      voltageLevel: '220kV',
      longitude: 120.62,
      latitude: 30.29,
      address: '杭州市钱塘区临江高科园西区',
    },
    {
      name: '余杭区未来科技城负荷',
      loadType: 'COMMERCIAL',
      busName: '仓前变',
      peakLoadKw: 45000,
      annualConsumptionMwh: 180000,
      zone: '余杭区',
      voltageLevel: '220kV',
      longitude: 120.02,
      latitude: 30.28,
      address: '杭州市余杭区未来科技城',
    },
    {
      name: '萧山区居民负荷聚合',
      loadType: 'RESIDENTIAL',
      busName: '花木变',
      peakLoadKw: 30000,
      annualConsumptionMwh: 120000,
      zone: '萧山区',
      voltageLevel: '220kV',
      longitude: 120.26,
      latitude: 30.18,
      address: '杭州市萧山区',
    },
    {
      name: '临安区农业灌溉负荷',
      loadType: 'AGRICULTURAL',
      busName: '锦城变',
      peakLoadKw: 5000,
      annualConsumptionMwh: 8000,
      zone: '临安区',
      voltageLevel: '110kV',
      longitude: 119.72,
      latitude: 30.23,
      address: '杭州市临安区',
    },
    {
      name: '滨江区市政照明负荷',
      loadType: 'MUNICIPAL',
      busName: '滨江变',
      peakLoadKw: 8000,
      annualConsumptionMwh: 15000,
      zone: '滨江区',
      voltageLevel: '220kV',
      longitude: 120.20,
      latitude: 30.21,
      address: '杭州市滨江区',
    },
  ]

  const insertedLoads: any[] = []
  for (const def of loadDefs) {
    const busId = busMap[def.busName]
    if (!busId) {
      console.log(`  ⚠ Bus "${def.busName}" not found, skipping load ${def.name}`)
      continue
    }
    insertedLoads.push({
      id: uuid(),
      name: def.name,
      load_type: def.loadType,
      bus_id: busId,
      voltage_level: def.voltageLevel,
      peak_load_kw: def.peakLoadKw,
      annual_consumption_mwh: def.annualConsumptionMwh,
      zone: def.zone,
      address: def.address,
      longitude: def.longitude,
      latitude: def.latitude,
      status: 'active',
      created_at: now,
    })
  }

  if (insertedLoads.length > 0) {
    await knex('load_entities').insert(insertedLoads)
    for (const l of insertedLoads) {
      console.log(`  ✓ 负荷: ${l.name} (${l.peak_load_kw}kW)`)
    }
  }

  // ==================== 储能实体 ====================
  interface StorageDef {
    name: string; storageType: string; busName: string
    ratedPowerKw: number; ratedCapacityKwh: number; efficiencyPct: number
    chargeMode: string; zone: string; voltageLevel: string
    longitude: number; latitude: number
  }

  const storageDefs: StorageDef[] = [
    {
      name: '钱塘储能站一期',
      storageType: 'BATTERY',
      busName: '义蓬变',
      ratedPowerKw: 50000,
      ratedCapacityKwh: 200000,
      efficiencyPct: 92,
      chargeMode: 'PEAK_SHAVING',
      zone: '钱塘区',
      voltageLevel: '220kV',
      longitude: 120.56,
      latitude: 30.27,
    },
    {
      name: '钱塘储能站二期',
      storageType: 'BATTERY',
      busName: '临江变',
      ratedPowerKw: 40000,
      ratedCapacityKwh: 80000,
      efficiencyPct: 93,
      chargeMode: 'PEAK_SHAVING',
      zone: '钱塘区',
      voltageLevel: '220kV',
      longitude: 120.66,
      latitude: 30.25,
    },
    {
      name: '钱塘储能站三期',
      storageType: 'BATTERY',
      busName: '新湾变',
      ratedPowerKw: 55000,
      ratedCapacityKwh: 110000,
      efficiencyPct: 93,
      chargeMode: 'PEAK_SHAVING',
      zone: '钱塘区',
      voltageLevel: '220kV',
      longitude: 120.63,
      latitude: 30.30,
    },
    {
      name: '余杭储能站',
      storageType: 'BATTERY',
      busName: '仓前变',
      ratedPowerKw: 30000,
      ratedCapacityKwh: 100000,
      efficiencyPct: 90,
      chargeMode: 'FREQ_REGULATION',
      zone: '余杭区',
      voltageLevel: '220kV',
      longitude: 120.03,
      latitude: 30.29,
    },
    {
      name: '临安抽水蓄能站',
      storageType: 'PUMPED_HYDRO',
      busName: '锦城变',
      ratedPowerKw: 100000,
      ratedCapacityKwh: 800000,
      efficiencyPct: 78,
      chargeMode: 'ARBITRAGE',
      zone: '临安区',
      voltageLevel: '110kV',
      longitude: 119.70,
      latitude: 30.24,
    },
    {
      name: '建德储能站',
      storageType: 'BATTERY',
      busName: '寿昌变',
      ratedPowerKw: 15000,
      ratedCapacityKwh: 30000,
      efficiencyPct: 91,
      chargeMode: 'PEAK_SHAVING',
      zone: '建德市',
      voltageLevel: '110kV',
      longitude: 119.28,
      latitude: 29.48,
    },
    {
      name: '临安东储能站',
      storageType: 'BATTERY',
      busName: '科创变',
      ratedPowerKw: 4000,
      ratedCapacityKwh: 8000,
      efficiencyPct: 90,
      chargeMode: 'PEAK_SHAVING',
      zone: '临安区',
      voltageLevel: '110kV',
      longitude: 119.56,
      latitude: 30.33,
    },
    {
      name: '萧山南阳储能站',
      storageType: 'BATTERY',
      busName: '建设四路开闭所',
      ratedPowerKw: 5000,
      ratedCapacityKwh: 10000,
      efficiencyPct: 90,
      chargeMode: 'PEAK_SHAVING',
      zone: '萧山区',
      voltageLevel: '10kV',
      longitude: 120.44,
      latitude: 30.24,
    },
    {
      name: '余杭径山储能站',
      storageType: 'BATTERY',
      busName: '文一西路开闭所',
      ratedPowerKw: 1000,
      ratedCapacityKwh: 2000,
      efficiencyPct: 89,
      chargeMode: 'PEAK_SHAVING',
      zone: '余杭区',
      voltageLevel: '10kV',
      longitude: 119.86,
      latitude: 30.36,
    },
    {
      name: '富阳渔山储能站',
      storageType: 'BATTERY',
      busName: '富春路开闭所',
      ratedPowerKw: 3000,
      ratedCapacityKwh: 6000,
      efficiencyPct: 90,
      chargeMode: 'PEAK_SHAVING',
      zone: '富阳区',
      voltageLevel: '10kV',
      longitude: 120.04,
      latitude: 30.04,
    },
  ]

  const insertedStorages: any[] = []
  for (const def of storageDefs) {
    const busId = busMap[def.busName]
    if (!busId) {
      console.log(`  ⚠ Bus "${def.busName}" not found, skipping storage ${def.name}`)
      continue
    }
    insertedStorages.push({
      id: uuid(),
      name: def.name,
      storage_type: def.storageType,
      bus_id: busId,
      rated_power_kw: def.ratedPowerKw,
      rated_capacity_kwh: def.ratedCapacityKwh,
      efficiency_pct: def.efficiencyPct,
      charge_mode: def.chargeMode,
      voltage_level: def.voltageLevel,
      zone: def.zone,
      longitude: def.longitude,
      latitude: def.latitude,
      status: 'active',
      created_at: now,
    })
  }

  if (insertedStorages.length > 0) {
    await knex('storage_entities').insert(insertedStorages)
    for (const s of insertedStorages) {
      console.log(`  ✓ 储能: ${s.name} (${s.rated_power_kw}kW/${s.rated_capacity_kwh}kWh)`)
    }
  }

  // ==================== 接入关系：负荷→母线、储能→母线 ====================
  const connAttrs: any[] = []

  for (const l of insertedLoads) {
    connAttrs.push({
      id: uuid(),
      source_node_type: 'LOAD',
      source_node_id: l.id,
      target_node_type: 'GRID',
      target_node_id: l.bus_id,
      flow_direction: 'REVERSE',
      max_capacity_kw: l.peak_load_kw,
      control_logic: JSON.stringify({ mode: 'demand_response', description: `${l.name} 接入控制` }),
      status: 'active',
      created_at: now,
    })
  }

  for (const s of insertedStorages) {
    connAttrs.push({
      id: uuid(),
      source_node_type: 'STORAGE',
      source_node_id: s.id,
      target_node_type: 'GRID',
      target_node_id: s.bus_id,
      flow_direction: 'BIDIRECTIONAL',
      max_capacity_kw: s.rated_power_kw,
      control_logic: JSON.stringify({ mode: s.charge_mode?.toLowerCase() || 'peak_shaving', description: `${s.name} 充放电控制` }),
      status: 'active',
      created_at: now,
    })
  }

  if (connAttrs.length > 0) {
    await knex('resource_connection_attrs').insert(connAttrs)
    console.log(`  ✓ ${connAttrs.length} connection attrs created (loads + storages)`)
  }
}
