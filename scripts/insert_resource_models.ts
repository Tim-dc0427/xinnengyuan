import Database from 'better-sqlite3'
import { v4 as uuid } from 'uuid'
import path from 'path'

const dbPath = path.join(__dirname, '..', 'server', 'data.db')
const db = new Database(dbPath)

const now = new Date().toISOString()
const adminId = db.prepare("SELECT id FROM users LIMIT 1").get() as any
const createdBy = adminId?.id || '00000000-0000-0000-0000-000000000001'

// 查已有类型
const existing = db.prepare("SELECT model_type, COUNT(*) as cnt FROM resource_models GROUP BY model_type").all() as any[]
console.log('现有模型:', existing)

const toInsert: any[] = []

if (!existing.find((e: any) => e.model_type === 'PV_ABSORPTION')) {
  toInsert.push(
    {
      id: uuid(), model_name: '钱塘大型消纳模型',
      model_type: 'PV_ABSORPTION', version: 1, is_active: 1,
      station_id: null,
      description: '钱塘区围垦区大型渔光互补消纳模型，N-1安全校核开，保障性收购优先级',
      model_parameters: JSON.stringify({
        physicalCharacteristics: { installedCapacityMw: 550, gridVoltageKv: 220, inverterPowerKw: 550000 },
        controlStrategy: { activePowerLimitMw: 500, curtailmentPriority: 'guaranteed', nMinus1Enabled: true },
        interfaceParameters: { loadProfile: Array.from({ length: 24 }, (_, h) => ({ time: `${String(h).padStart(2, '0')}:00`, loadMw: 350 + 180 * Math.sin(Math.PI * (h - 6) / 12) * (h >= 6 && h <= 18 ? 1 : 0) })), minThermalOutputMw: 200, transmissionLimitMw: 520 },
      }),
      created_by: createdBy, created_at: now, updated_at: now,
    },
    {
      id: uuid(), model_name: '余杭中型消纳模型',
      model_type: 'PV_ABSORPTION', version: 1, is_active: 1,
      station_id: null,
      description: '余杭区中型光伏消纳模型，N-1校核关，市场化平价优先级',
      model_parameters: JSON.stringify({
        physicalCharacteristics: { installedCapacityMw: 150, gridVoltageKv: 110, inverterPowerKw: 150000 },
        controlStrategy: { activePowerLimitMw: 140, curtailmentPriority: 'market', nMinus1Enabled: false },
        interfaceParameters: { loadProfile: Array.from({ length: 24 }, (_, h) => ({ time: `${String(h).padStart(2, '0')}:00`, loadMw: 80 + 60 * Math.sin(Math.PI * (h - 6) / 12) * (h >= 6 && h <= 18 ? 1 : 0) })), minThermalOutputMw: 100, transmissionLimitMw: 160 },
      }),
      created_by: createdBy, created_at: now, updated_at: now,
    },
    {
      id: uuid(), model_name: '建德山地消纳模型',
      model_type: 'PV_ABSORPTION', version: 1, is_active: 1,
      station_id: null,
      description: '建德市山地光伏消纳模型，竞价优先级，断面输送限额较低',
      model_parameters: JSON.stringify({
        physicalCharacteristics: { installedCapacityMw: 155, gridVoltageKv: 110, inverterPowerKw: 155000 },
        controlStrategy: { activePowerLimitMw: 120, curtailmentPriority: 'competitive', nMinus1Enabled: true },
        interfaceParameters: { loadProfile: Array.from({ length: 24 }, (_, h) => ({ time: `${String(h).padStart(2, '0')}:00`, loadMw: 45 + 35 * Math.sin(Math.PI * (h - 5) / 14) * (h >= 5 && h <= 19 ? 1 : 0) })), minThermalOutputMw: 50, transmissionLimitMw: 110 },
      }),
      created_by: createdBy, created_at: now, updated_at: now,
    },
  )
}

if (!existing.find((e: any) => e.model_type === 'PV_OUTPUT')) {
  toInsert.push(
    {
      id: uuid(), model_name: '单晶硅PERC标准出力模型',
      model_type: 'PV_OUTPUT', version: 1, is_active: 1,
      station_id: null,
      description: '单晶硅PERC组件，扰动观察法MPPT，气象数据接口开启，Modbus协议',
      model_parameters: JSON.stringify({
        physicalCharacteristics: { ratedPowerKw: 550, panelType: 'monocrystalline', tempCoefficientPct: -0.35 },
        controlStrategy: { mpptAlgorithm: 'pno', powerLimitEnabled: false, rampRateLimitKwMin: 10 },
        interfaceParameters: { weatherApiEnabled: true, inverterProtocol: 'modbus', forecastFormat: 'json' },
      }),
      created_by: createdBy, created_at: now, updated_at: now,
    },
    {
      id: uuid(), model_name: '双面双玻高效出力模型',
      model_type: 'PV_OUTPUT', version: 1, is_active: 1,
      station_id: null,
      description: '双面双玻N型组件，电导增量法MPPT，功率限制开启，IEC 61850协议',
      model_parameters: JSON.stringify({
        physicalCharacteristics: { ratedPowerKw: 580, panelType: 'monocrystalline', tempCoefficientPct: -0.29 },
        controlStrategy: { mpptAlgorithm: 'incCond', powerLimitEnabled: true, rampRateLimitKwMin: 15 },
        interfaceParameters: { weatherApiEnabled: true, inverterProtocol: 'iec61850', forecastFormat: 'json' },
      }),
      created_by: createdBy, created_at: now, updated_at: now,
    },
    {
      id: uuid(), model_name: '薄膜低辐照出力模型',
      model_type: 'PV_OUTPUT', version: 1, is_active: 1,
      station_id: null,
      description: '薄膜组件弱光特性模型，恒压法MPPT，低爬坡限制，RS485协议',
      model_parameters: JSON.stringify({
        physicalCharacteristics: { ratedPowerKw: 450, panelType: 'thinFilm', tempCoefficientPct: -0.21 },
        controlStrategy: { mpptAlgorithm: 'constantVoltage', powerLimitEnabled: false, rampRateLimitKwMin: 5 },
        interfaceParameters: { weatherApiEnabled: false, inverterProtocol: 'rs485', forecastFormat: 'csv' },
      }),
      created_by: createdBy, created_at: now, updated_at: now,
    },
  )
}

if (toInsert.length > 0) {
  const insert = db.prepare(`INSERT INTO resource_models (id, model_name, model_type, model_parameters, station_id, description, version, is_active, created_by, created_at, updated_at) VALUES (@id, @model_name, @model_type, @model_parameters, @station_id, @description, @version, @is_active, @created_by, @created_at, @updated_at)`)
  const tx = db.transaction(() => { toInsert.forEach(r => insert.run(r)) })
  tx()
  console.log(`✓ 插入 ${toInsert.length} 条模型数据`)
} else {
  console.log('数据已存在，无需插入')
}

// 验证
const after = db.prepare("SELECT model_type, COUNT(*) as cnt FROM resource_models GROUP BY model_type").all()
console.log('数据库现状:', after)
db.close()
