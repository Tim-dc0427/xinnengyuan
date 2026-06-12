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
    actualRuntimeHours: number
    prevActualRuntimeHours: number
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
      busName: '径山光伏并网',
      capacityMw: 5.44,
      actualRuntimeHours: 1180,
      prevActualRuntimeHours: 0,
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
      busName: '义蓬光伏并网',
      capacityMw: 100,
      actualRuntimeHours: 1080,
      prevActualRuntimeHours: 1120,
      panelType: '单晶硅PERC 310W组件',
      inverterCapacityMw: 100,
      gridVoltageKv: 220,
      longitude: 120.60,
      latitude: 30.27,
      address: '杭州市钱塘区临江街道围垦区（已投运10年）',
      installedDate: '2015-06-01',
    },
    {
      stationName: '嘉达渔光互补光伏项目',
      busName: '临江光伏并网',
      capacityMw: 400,
      actualRuntimeHours: 1280,
      prevActualRuntimeHours: 0,
      panelType: '双面双玻540W组件',
      inverterCapacityMw: 400,
      gridVoltageKv: 220,
      longitude: 120.62,
      latitude: 30.25,
      address: '杭州市钱塘区临江街道围垦区（2025年底并网）',
      installedDate: '2025-12-01',
    },
    {
      stationName: '凌能渔光互补光伏项目',
      busName: '新湾光伏并网',
      capacityMw: 550,
      actualRuntimeHours: 1300,
      prevActualRuntimeHours: 0,
      panelType: '双面双玻580W组件',
      inverterCapacityMw: 550,
      gridVoltageKv: 220,
      longitude: 120.64,
      latitude: 30.28,
      address: '杭州市钱塘区临江街道围垦区（杭州最大渔光互补项目）',
      installedDate: '2025-12-01',
    },
    {
      stationName: '华洋山地光伏电站',
      busName: '华洋光伏并网',
      capacityMw: 155,
      actualRuntimeHours: 1080,
      prevActualRuntimeHours: 1120,
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
      busName: '青山光伏并网',
      capacityMw: 60,
      actualRuntimeHours: 1150,
      prevActualRuntimeHours: 1160,
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
      busName: '太湖源光伏并网',
      capacityMw: 40,
      actualRuntimeHours: 1120,
      prevActualRuntimeHours: 1100,
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
      busName: '南阳光伏并网',
      capacityMw: 50,
      actualRuntimeHours: 1200,
      prevActualRuntimeHours: 1180,
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
      busName: '渔山光伏并网',
      capacityMw: 30,
      actualRuntimeHours: 1160,
      prevActualRuntimeHours: 1190,
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
      actual_runtime_hours: def.actualRuntimeHours,
      prev_actual_runtime_hours: def.prevActualRuntimeHours,
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

    // 拓扑配置元数据：接线方式 + T接
    const metaByStation: Record<string, { connectionType: string; lineType: string }> = {
      '径山镇宇航梦园渔光互补光伏项目':    { connectionType: 'single', lineType: 'tap' },
      '舒能渔光互补光伏项目':              { connectionType: 'double', lineType: 'dedicated' },
      '嘉达渔光互补光伏项目':              { connectionType: 'double', lineType: 'dedicated' },
      '凌能渔光互补光伏项目':              { connectionType: 'loop',   lineType: 'dedicated' },
      '华洋山地光伏电站':                  { connectionType: 'single', lineType: 'dedicated' },
      '临安青山集中式光伏电站':            { connectionType: 'double', lineType: 'dedicated' },
      '临安太湖源集中式光伏电站':          { connectionType: 'single', lineType: 'tap' },
      '萧山南阳集中式光伏电站':            { connectionType: 'double', lineType: 'dedicated' },
      '富阳渔山集中式光伏电站':            { connectionType: 'single', lineType: 'tap' },
    }
    for (const [name, meta] of Object.entries(metaByStation)) {
      await knex('solar_pv_stations').where('station_name', name).update({ metadata: JSON.stringify(meta) })
    }
    console.log('  ✓ 拓扑配置 metadata 已写入')

    // 为每个电站插入设备（集中式光伏设备统一由此管理）
    const stationEquipment: any[] = []
    const equipLifecycle: any[] = []

    for (const s of insertedStations) {
      // 设备名称加电站简称前缀
      const shortMap: Record<string, string> = { '径山镇': '径山', '舒能': '舒能', '嘉达': '嘉达', '凌能': '凌能', '华洋': '华洋', '青山': '青山', '太湖源': '太湖源', '南阳': '南阳', '渔山': '渔山' }
      let sn = s.station_name; for (const [k, v] of Object.entries(shortMap)) { if (s.station_name.includes(k)) { sn = v; break } }
      const capMw = s.installed_capacity_mw
      const isLarge = capMw >= 150
      const isMedium = capMw >= 30
      const installDate = s.installed_date || '2024-01-01'

      // 变压器及其短路参数（GB/T 6451 / IEC 60076）
      // 选型原则：双主变并列运行，单台容量覆盖 ≥50% 全站峰值视在功率
      // 400MW 光伏站全站峰值视在 ≈421MVA（pf=0.95），单台≥210MVA，取 240MVA
      let trafoModel: string, trafoKva: number, trafoKv: number
      if (capMw >= 450) {
        trafoModel = 'SZ11-300000/220'; trafoKva = 300000; trafoKv = 220
      } else if (capMw >= 350) {
        trafoModel = 'SZ11-240000/220'; trafoKva = 240000; trafoKv = 220
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

      // 根据型号确定短路参数
      const trafoScParams: Record<string, { ukPct: number; ithKa: number; tthS: number; ipeakKa: number }> = {
        'SZ11-300000/220': { ukPct: 14.5, ithKa: 63, tthS: 2, ipeakKa: 160 },
        'SZ11-240000/220': { ukPct: 14.0, ithKa: 50, tthS: 2, ipeakKa: 125 },
        'SZ11-180000/220': { ukPct: 13.5, ithKa: 40, tthS: 2, ipeakKa: 100 },
        'SZ11-120000/220': { ukPct: 13.0, ithKa: 31.5, tthS: 2, ipeakKa: 80 },
        'SZ11-75000/110':  { ukPct: 10.5, ithKa: 25, tthS: 2, ipeakKa: 63 },
        'SZ11-50000/110':  { ukPct: 10.5, ithKa: 20, tthS: 2, ipeakKa: 50 },
        'SZ11-31500/110':  { ukPct: 10.5, ithKa: 16, tthS: 2, ipeakKa: 40 },
        'S11-6300/35':     { ukPct: 7.5, ithKa: 6.3, tthS: 2, ipeakKa: 16 },
      }
      const scp = trafoScParams[trafoModel]

      const mainTrafoId = uuid()
      stationEquipment.push({
        id: mainTrafoId,
        station_id: s.id,
        name: `${sn}-${trafoModel} 主变压器`,
        equipment_type: 'TRANSFORMER',
        model_number: trafoModel,
        rated_capacity_kva: trafoKva,
        rated_voltage_kv: trafoKv,
        rated_current_a: Math.round(trafoKva / trafoKv * 0.7),
        short_circuit_impedance_pct: scp.ukPct,
        rated_thermal_withstand_current_ka: scp.ithKa,
        rated_thermal_duration_s: scp.tthS,
        rated_peak_withstand_current_ka: scp.ipeakKa,
        rated_temp_rise_c: 8,
        installation_date: installDate,
        design_life_years: 25,
        failure_rate: trafoKv >= 220 ? 0.005 : trafoKv >= 110 ? 0.006 : 0.006,
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
          name: `${trafoModel} 主变压器（II段）`,
          equipment_type: 'TRANSFORMER',
          model_number: trafoModel,
          rated_capacity_kva: trafoKva,
          rated_voltage_kv: trafoKv,
          rated_current_a: Math.round(trafoKva / trafoKv * 0.7),
          short_circuit_impedance_pct: scp.ukPct,
          rated_thermal_withstand_current_ka: scp.ithKa,
          rated_thermal_duration_s: scp.tthS,
          rated_peak_withstand_current_ka: scp.ipeakKa,
          installation_date: installDate,
          rated_temp_rise_c: 8,
          design_life_years: 25,
          failure_rate: trafoKv >= 220 ? 0.007 : trafoKv >= 110 ? 0.008 : 0.008,
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
          name: `${sn}-` + (capMw >= 20 ? 'SG-110CX 组串式逆变器' : 'SUN2000-300KTL 组串式逆变器'),
          equipment_type: 'INVERTER',
          model_number: capMw >= 20 ? 'SG-110CX' : 'SUN2000-300KTL',
          rated_capacity_kva: capMw >= 20 ? 110 : 300,
          rated_voltage_kv: 0.8,
          rated_current_a: capMw >= 20 ? 80 : 216,
          rated_temp_rise_c: 6,
          installation_date: installDate,
          design_life_years: 15,
          failure_rate: 0.012,
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
            name: `${sn}-磷酸铁锂储能电池组 ${battKwh}kWh`,
            equipment_type: 'BATTERY',
            model_number: `LFP-280Ah-${Math.round(battKwh / 250)}P`,
            rated_capacity_kva: battKva,
            rated_voltage_kv: 0.768,
            rated_current_a: Math.round(battKva / 0.768),
            rated_temp_rise_c: 5,
            installation_date: installDate,
            design_life_years: 12,
            failure_rate: (isLarge ? 0.005 : i === 1 ? 0.005 : 0.008),
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
            name: `${sn}-PCS-${Math.round(battKva / pcsCount)}K 储能变流器`,
            equipment_type: 'INVERTER',
            model_number: `PCS-${Math.round(battKva / 10)}K`,
            rated_capacity_kva: Math.round(battKva / pcsCount),
            rated_voltage_kv: 0.8,
            rated_current_a: Math.round(battKva / pcsCount / 0.8),
            rated_temp_rise_c: 6,
            installation_date: installDate,
            design_life_years: 15,
            failure_rate: (isLarge ? 0.007 : i === 1 ? 0.007 : 0.012),
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

        // ========== 断路器 / 电缆 / 开关设备 ==========
        const gridKv = s.grid_connection_voltage_kv ?? 10
        const capKw = capMw * 1000
        const lineCurrentA = Math.round(capKw / (Math.sqrt(3) * gridKv * 0.95))
        // 短路电流估算（kA）：Ik = In / 5%，单位为 kA
        const ikKa = +(lineCurrentA / 0.05 / 1000).toFixed(2)

        // 断路器：分断能力故意做差异 — 大站容量足够，中小站可能不足
        const breakingKaMap: Array<{ minMw: number; ka: number }> = [
          { minMw: 300, ka: 63 }, { minMw: 200, ka: 63 },
          { minMw: 100, ka: 40 }, { minMw: 50, ka: 25 },
          { minMw: 0, ka: 16 },
        ]
        const breakingKa = breakingKaMap.find((x) => capMw >= x.minMw)?.ka ?? 16
        const brkGrade = breakingKa > ikKa ? 'A' : breakingKa >= ikKa * 0.85 ? 'B' : 'C'
        const brkRatedKva = Math.round(breakingKa * 1000 * gridKv * Math.sqrt(3))
        const brkId = uuid()
        stationEquipment.push({
          id: brkId, station_id: s.id, name: `${sn}-并网断路器`, equipment_type: 'BREAKER',
          model_number: breakingKa >= 63 ? 'LW-252/63kA' : breakingKa >= 40 ? 'LW-126/40kA' : breakingKa >= 25 ? 'ZN-40.5/25kA' : 'ZN-12/16kA',
          rated_capacity_kva: brkRatedKva, rated_voltage_kv: gridKv, rated_current_a: lineCurrentA,
          rated_temp_rise_c: 4,
          installation_date: installDate, design_life_years: 20,
          failure_rate: brkGrade === 'A' ? 0.003 : brkGrade === 'B' ? 0.004 : 0.006,
          grade: brkGrade, status: 'operational',
          created_at: now, updated_at: now,
        })
        equipLifecycle.push({
          id: uuid(), equipment_id: brkId, event_type: 'INSTALL', event_date: installDate,
          description: '断路器投运', remaining_life_years: 20, created_at: now,
        })

        // 电缆：载流量做差异 — 部分大站电缆偏小引起过载
        const cableAmpFactor = capMw >= 300 ? 0.85 : capMw >= 100 ? 1.0 : 1.3
        const cableAmp = Math.round(lineCurrentA * cableAmpFactor)
        const cableGrade = cableAmpFactor >= 1.3 ? 'A' : cableAmpFactor >= 1.0 ? 'B' : 'C'
        const cableRatedKva = Math.round(cableAmp * gridKv * Math.sqrt(3))
        const cableId = uuid()
        stationEquipment.push({
          id: cableId, station_id: s.id, name: `${sn}-并网电力电缆`, equipment_type: 'CABLE',
          model_number: gridKv >= 110 ? 'YJLW03-630' : 'YJV22-240',
          rated_capacity_kva: cableRatedKva, rated_voltage_kv: gridKv, rated_current_a: cableAmp,
          rated_temp_rise_c: 3,
          installation_date: installDate, design_life_years: 30,
          failure_rate: cableGrade === 'A' ? 0.007 : cableGrade === 'B' ? 0.012 : 0.020,
          grade: cableGrade, status: 'operational',
          created_at: now, updated_at: now,
        })
        equipLifecycle.push({
          id: uuid(), equipment_id: cableId, event_type: 'INSTALL', event_date: installDate,
          description: '电缆敷设投运', remaining_life_years: 30, created_at: now,
        })

        // 开关设备：额定电流做差异 — 大站穿越电流高，开关额定可能偏小
        const switchFactor = capMw >= 300 ? 0.7 : capMw >= 100 ? 1.0 : 1.3
        const switchRatedA = Math.round(lineCurrentA * switchFactor)
        const swGrade = switchFactor >= 1.3 ? 'A' : switchFactor >= 1.0 ? 'B' : 'C'
        const swRatedKva = Math.round(switchRatedA * gridKv * Math.sqrt(3))
        const swId = uuid()

        // 开关柜短路参数（按 KYN 型号 + 等级）
        const swModel = gridKv >= 110 ? 'KYN61-40.5' : 'KYN28-12'
        const swScParams: Record<string, Record<string, { ithKa: number; tthS: number; ipeakKa: number; ibreakKa: number }>> = {
          'KYN61-40.5': {
            A: { ithKa: 31.5, tthS: 4, ipeakKa: 80, ibreakKa: 31.5 },
            B: { ithKa: 25, tthS: 4, ipeakKa: 63, ibreakKa: 25 },
            C: { ithKa: 20, tthS: 4, ipeakKa: 50, ibreakKa: 20 },
          },
          'KYN28-12': {
            A: { ithKa: 31.5, tthS: 4, ipeakKa: 80, ibreakKa: 31.5 },
            B: { ithKa: 25, tthS: 4, ipeakKa: 63, ibreakKa: 25 },
            C: { ithKa: 20, tthS: 4, ipeakKa: 50, ibreakKa: 20 },
          },
        }
        const swSc = swScParams[swModel]?.[swGrade] || swScParams['KYN28-12']['B']

        stationEquipment.push({
          id: swId, station_id: s.id, name: `${sn}-并网开关柜`, equipment_type: 'SWITCH',
          model_number: swModel,
          rated_capacity_kva: swRatedKva, rated_voltage_kv: gridKv, rated_current_a: switchRatedA,
          rated_temp_rise_c: 4,
          short_circuit_impedance_pct: null,
          rated_thermal_withstand_current_ka: swSc.ithKa,
          rated_thermal_duration_s: swSc.tthS,
          rated_peak_withstand_current_ka: swSc.ipeakKa,
          rated_breaking_current_ka: swSc.ibreakKa,
          installation_date: installDate, design_life_years: 20,
          failure_rate: swGrade === 'A' ? 0.003 : swGrade === 'B' ? 0.005 : 0.008,
          grade: swGrade, status: 'operational',
          created_at: now, updated_at: now,
        })
        equipLifecycle.push({
          id: uuid(), equipment_id: swId, event_type: 'INSTALL', event_date: installDate,
          description: '开关柜投运', remaining_life_years: 20, created_at: now,
        })
      }
    }

    await knex('equipment').insert(stationEquipment)
    console.log(`  ✓ ${stationEquipment.length} equipment records for ${insertedStations.length} stations`)

    await knex('equipment_lifecycle').insert(equipLifecycle)
    console.log(`  ✓ ${equipLifecycle.length} lifecycle records`)

    // ========== Equipment Ledger（设备台账动态管理） ==========
    const ledgerTypeMap: Record<string, { type: string; label: string; manufacturer: string }> = {
      TRANSFORMER: { type: 'transformer', label: '变压器', manufacturer: '特变电工' },
      INVERTER: { type: 'inverter', label: '逆变器', manufacturer: '华为数字能源' },
      CABLE: { type: 'cable', label: '电缆', manufacturer: '远东电缆' },
      SWITCH: { type: 'switchgear', label: '开关柜', manufacturer: '正泰电器' },
      BREAKER: { type: 'other', label: '断路器', manufacturer: '正泰电器' },
      BATTERY: { type: 'other', label: '储能电池', manufacturer: '宁德时代' },
    }
    const nowISO = new Date().toISOString()
    const ledgerRows: any[] = []
    let eqCodeSeq = 0
    for (const eq of stationEquipment) {
      const mapped = ledgerTypeMap[eq.equipment_type]
      if (!mapped) continue
      eqCodeSeq++
      ledgerRows.push({
        id: uuid(),
        station_id: eq.station_id,
        plan_id: null,
        equipment_type: mapped.type,
        equipment_type_label: mapped.label,
        equipment_code: `EQ-${String(eqCodeSeq).padStart(4, '0')}`,
        model_number: eq.model_number ?? '',
        manufacturer: mapped.manufacturer,
        rated_params: JSON.stringify({
          '额定容量': eq.rated_capacity_kva != null ? `${eq.rated_capacity_kva} kVA` : null,
          '额定电压': eq.rated_voltage_kv != null ? `${eq.rated_voltage_kv} kV` : null,
          '额定电流': eq.rated_current_a != null ? `${eq.rated_current_a} A` : null,
          '设计寿命': eq.design_life_years != null ? `${eq.design_life_years} 年` : null,
          '等级': eq.grade ?? null,
        }),
        quantity: 1,
        install_date: eq.installation_date ?? '2026-01-01',
        status: eq.status === 'operational' ? 'operating' : 'installed',
        location_desc: eq.name ?? '',
        created_at: nowISO,
        updated_at: nowISO,
      })
    }
    // 按电站补上光伏组件（equipment 表里没存组件，这里单独生成）
    for (const s of insertedStations) {
      const capMw = Number(s.installed_capacity_mw) || 0
      const moduleQty = Math.max(1, Math.round(capMw * 1000 / 0.55))
      eqCodeSeq++
      ledgerRows.push({
        id: uuid(),
        station_id: s.id,
        plan_id: null,
        equipment_type: 'pv_module',
        equipment_type_label: '光伏组件',
        equipment_code: `EQ-${String(eqCodeSeq).padStart(4, '0')}`,
        model_number: 'HC-550W',
        manufacturer: '隆基绿能',
        rated_params: JSON.stringify({ '峰值功率': '550 Wp', '开路电压': '49.6 V', '短路电流': '13.9 A', '转换效率': '21.5%' }),
        quantity: moduleQty,
        install_date: s.installed_date ?? '2026-04-01',
        status: 'operating',
        location_desc: `${s.station_name}场区`,
        created_at: nowISO,
        updated_at: nowISO,
      })
    }
    if (ledgerRows.length > 0) {
      await knex('equipment_ledger').insert(ledgerRows)
      console.log(`  ✓ ${ledgerRows.length} equipment_ledger records`)
    }

    // 注入故障事件（按设备类型+役龄，参照 IEEE 493 / CIGRE TB 793 / 国家能源局2024年报）
    // 故障率量级：逆变器 ≈0.1次/年、电缆≈0.04、变压器≈0.03、断路器≈0.02、开关柜≈0.02、电池≈0.03
    const faultEvents: any[] = []
    for (const eq of stationEquipment) {
      const eqSt = insertedStations.find((s: any) => s.id === eq.station_id)
      if (!eqSt) continue
      const eqName: string = eq.name || ''
      const eqType: string = eq.equipment_type || ''
      const installYr = new Date(eqSt.installed_date || eq.installation_date || '2024-01-01').getFullYear()
      const age = 2026 - installYr

      // 舒能站（2015投运，11年役龄）— 老旧站，多种设备累积故障
      if (eqSt.station_name.includes('舒能')) {
        if (eqType === 'INVERTER' && eqName.includes('逆变器') && !eqName.includes('PCS')) {
          faultEvents.push(
            { id: uuid(), equipment_id: eq.id, event_type: 'FAULT', event_date: '2019-08-15', description: 'IGBT模块过流损坏', remaining_life_years: 10, created_at: now },
            { id: uuid(), equipment_id: eq.id, event_type: 'FAULT', event_date: '2023-06-20', description: '直流侧绝缘阻抗下降', remaining_life_years: 7, created_at: now },
          )
        }
        if (eqName.includes('PCS') && eqName.includes('1')) {
          faultEvents.push(
            { id: uuid(), equipment_id: eq.id, event_type: 'FAULT', event_date: '2022-03-10', description: '交流滤波器电容老化', remaining_life_years: 8, created_at: now },
          )
        }
        if (eqName.includes('PCS') && eqName.includes('2')) {
          faultEvents.push(
            { id: uuid(), equipment_id: eq.id, event_type: 'FAULT', event_date: '2024-11-05', description: 'MPPT控制器失效', remaining_life_years: 5, created_at: now },
          )
        }
        if (eqType === 'CABLE') {
          faultEvents.push(
            { id: uuid(), equipment_id: eq.id, event_type: 'FAULT', event_date: '2021-07-30', description: '电缆接头过热', remaining_life_years: 20, created_at: now },
          )
        }
        if (eqType === 'TRANSFORMER') {
          faultEvents.push(
            { id: uuid(), equipment_id: eq.id, event_type: 'FAULT', event_date: '2020-05-12', description: '冷却系统故障致绕组温度过高', remaining_life_years: 19, created_at: now },
          )
        }
        if (eqType === 'BREAKER') {
          faultEvents.push(
            { id: uuid(), equipment_id: eq.id, event_type: 'FAULT', event_date: '2023-09-18', description: '触头烧蚀导致接触电阻超标', remaining_life_years: 12, created_at: now },
          )
        }
      }

      // 华洋站（2024投运，~2年役龄）— 山地环境，雷击风险
      if (eqSt.station_name.includes('华洋') && eqType === 'BREAKER') {
        faultEvents.push(
          { id: uuid(), equipment_id: eq.id, event_type: 'FAULT', event_date: '2025-07-22', description: '雷击导致绝缘子闪络', remaining_life_years: 18, created_at: now },
        )
      }

      // 青山站（2024投运，~2年役龄）— 逆变器早期故障
      if (eqSt.station_name.includes('青山') && eqType === 'INVERTER' && !eqName.includes('PCS')) {
        faultEvents.push(
          { id: uuid(), equipment_id: eq.id, event_type: 'FAULT', event_date: '2025-09-22', description: 'IGBT模块过流损坏（早期失效）', remaining_life_years: 12, created_at: now },
        )
      }

      // 太湖源站（2024投运，~2年役龄）— 接线工艺问题
      if (eqSt.station_name.includes('太湖源') && eqType === 'SWITCH') {
        faultEvents.push(
          { id: uuid(), equipment_id: eq.id, event_type: 'FAULT', event_date: '2026-01-08', description: '二次回路接线端子松动', remaining_life_years: 14, created_at: now },
        )
      }

      // 渔山站（2024-05投运，~2年役龄）— 潮湿环境电缆问题
      if (eqSt.station_name.includes('渔山') && eqType === 'CABLE') {
        faultEvents.push(
          { id: uuid(), equipment_id: eq.id, event_type: 'FAULT', event_date: '2025-12-15', description: '电缆绝缘受潮导致绝缘电阻下降', remaining_life_years: 26, created_at: now },
        )
      }
    }
    await knex('equipment_lifecycle').insert(faultEvents)
    console.log(`  ✓ ${faultEvents.length} fault events injected for reliability distribution`)

    // 注入 MAINTENANCE 和 INSPECTION 事件
    const maintEvents: any[] = []
    for (const s of insertedStations) {
      const eqs = stationEquipment.filter((e: any) => e.station_id === s.id)
      const installYear = new Date(s.installed_date || '2024-01-01').getFullYear()
      const age2026 = 2026 - installYear
      // 老电站（≥2年）：有年度检修记录
      if (age2026 >= 2) {
        for (const eq of eqs.slice(0, 2)) {
          for (let y = installYear + 1; y <= 2026; y++) {
            maintEvents.push({
              id: uuid(), equipment_id: eq.id, event_type: 'INSPECTION',
              event_date: `${y}-03-15`, description: `${eq.name || '设备'} 年度巡检 — 运行状态正常`,
              remaining_life_years: Math.max(1, eq.design_life_years - (y - installYear)), created_at: now,
            })
          }
        }
        // 老站重点设备有维护记录
        maintEvents.push(
          { id: uuid(), equipment_id: eqs[0].id, event_type: 'MAINTENANCE', event_date: '2025-08-10', description: '变压器油过滤处理，绝缘电阻恢复至额定值95%', remaining_life_years: 18, created_at: now },
          { id: uuid(), equipment_id: eqs[0].id, event_type: 'MAINTENANCE', event_date: '2026-04-05', description: '更换老化密封垫圈，消除轻微渗漏', remaining_life_years: 15, created_at: now },
        )
      }
      // 所有站都有最近一次巡检
      if (installYear < 2026) {
        for (const eq of eqs.slice(0, 1)) {
          maintEvents.push({
            id: uuid(), equipment_id: eq.id, event_type: 'INSPECTION',
            event_date: '2026-04-01', description: `${eq.name || '设备'} 季度巡检 — 各项指标正常`,
            remaining_life_years: Math.max(1, eq.design_life_years - (2026 - installYear)), created_at: now,
          })
        }
      }
    }
    await knex('equipment_lifecycle').insert(maintEvents)
    console.log(`  ✓ ${maintEvents.length} maintenance/inspection events`)

    // 电池循环记录（为设备更换计划生成数据，仅老站/大站产生低SOH）
    const battCycleRecords: any[] = []
    for (const eq of stationEquipment.filter((e: any) => e.equipment_type === 'BATTERY')) {
      const st = insertedStations.find((s: any) => s.id === eq.station_id)
      const isOldStation = st?.station_name?.includes('舒能')
      const isMidStation = st?.station_name?.includes('华洋')
      if (!isOldStation && !isMidStation) continue // 只给老站/中站生成，控制数据量
      const installDate = new Date(st?.installed_date || '2024-01-01')
      const totalMonths = Math.min(20, (2026 - installDate.getFullYear()) * 12 + 6)
      const startSoh = isOldStation ? 99.5 : 99.8
      const monthlyDeg = isOldStation ? 0.85 : 0.35
      let soh = startSoh
      let cyc = 0, ener = 0
      const ratedKwh = Math.round(eq.rated_capacity_kva * 0.768)
      for (let m = 1; m <= totalMonths; m++) {
        const d = new Date(installDate); d.setMonth(d.getMonth() + m)
        if (d.getFullYear() > 2026) break
        const c = Math.round(ratedKwh > 10000 ? 40 : 28 * (0.85 + Math.random() * 0.3))
        cyc += c; ener += c * ratedKwh * 0.8
        soh = +(soh - monthlyDeg * (0.9 + Math.random() * 0.2)).toFixed(1)
        battCycleRecords.push({
          id: uuid(), equipment_id: eq.id,
          record_month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
          cycle_count: c, avg_dod_pct: +(70 + Math.random() * 20).toFixed(1),
          max_temp_c: +(35 + Math.random() * 10).toFixed(1), avg_temp_c: +(22 + (d.getMonth() >= 5 && d.getMonth() <= 7 ? 8 : 0) + (Math.random() - 0.5) * 4).toFixed(1),
          soh_pct: soh, cumulative_cycles: cyc, cumulative_energy_mwh: +(ener / 1000).toFixed(2),
          created_at: now,
        })
      }
    }
    for (let i = 0; i < battCycleRecords.length; i += 20) {
      await knex('battery_cycle_records').insert(battCycleRecords.slice(i, i + 20))
    }
    if (battCycleRecords.length > 0) console.log(`  ✓ ${battCycleRecords.length} battery cycle records`)

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
