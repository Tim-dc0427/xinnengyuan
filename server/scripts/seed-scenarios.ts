import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

const db = new Database('data.db')
const now = new Date().toISOString()
const uid = 'seed-user'

function mkScenario(name: string, type: string, desc: string, tags: string[], status: string, condition: string, aps: any[], rules: any[]) {
  const id = randomUUID()
  const config = JSON.stringify({ accessPoints: aps, controlRules: rules, dataSource: { type: 'realtime', dataTypes: ['pv_output', 'load', 'voltage'] }, topology: { nodes: [], edges: [] } })
  const ctrl = JSON.stringify(rules)
  const tagsStr = JSON.stringify(tags)

  db.prepare(`INSERT INTO interactive_scenarios (id, name, type, description, config, control_logic, tags, status, scenario_condition, version_limit, created_by, created_at, updated_at, updated_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, name, type, desc, config, ctrl, tagsStr, status, condition, 10, uid, now, now, uid
  )
  db.prepare(`INSERT INTO scenario_versions (id, scenario_id, version_number, config_snapshot, control_logic_snapshot, name, type, tags, description, status, changelog, created_by, created_at)
    VALUES (?,?,1,?,?,?,?,?,?,?,?,?,?)`).run(
    randomUUID(), id, config, ctrl, name, type, tagsStr, desc, status, '初始创建', uid, now
  )
  return id
}

// 1. 工业园区夏季高峰
mkScenario('余杭工业园区夏季高峰', 'industrial_park',
  '模拟余杭区夏季工作日高峰负荷时段，光伏高发叠加工业满负荷运行，储能削峰填谷',
  ['夏季','高峰负荷','工业'], 'active', 'peak_load',
  [
    { nodeType:'SOURCE', nodeId:'NODE_SOURCE_01', nodeName:'仓前光伏电站', connectedCapacity:50000, voltageLevel:110, params:{outputUpperLimit:95,outputLowerLimit:10,powerFactor:0.95,regulationDelay:30} },
    { nodeType:'GRID', nodeId:'NODE_GRID_01', nodeName:'仓前变(220kV)', connectedCapacity:0, voltageLevel:220, params:{tapRegulation:true,reactiveCompensation:true} },
    { nodeType:'LOAD', nodeId:'NODE_LOAD_01', nodeName:'余杭工业负荷', connectedCapacity:35000, voltageLevel:110, params:{peakClippingRate:15,valleyFillingRate:12,interruptibleLoadRatio:5,loadCurveType:'typical_industrial',loadCurveValues:''} },
    { nodeType:'STORAGE', nodeId:'NODE_STORAGE_01', nodeName:'余杭储能站', connectedCapacity:10000, voltageLevel:110, params:{chargeSchedule:'00:00-06:00',dischargeSchedule:'10:00-12:00,18:00-21:00',socUpper:90,socLower:20,ratedPowerKw:5000,ratedCapacityKwh:10000} },
  ],
  [
    { name:'光伏超发储能充电', condition:'光伏出力 > 80% 且 SOC < 90%', action:'启动储能充电', priority:1 },
    { name:'峰时储能放电', condition:'时段=10:00-12:00 且 SOC > 20%', action:'储能放电削峰', priority:2 },
  ]
)

// 2. 居民小区冬季供暖
mkScenario('萧山居民小区冬季供暖', 'residential',
  '萧山区居民小区冬季供暖高峰，热泵负荷集中，光伏出力偏低，储能保障供电可靠性',
  ['冬季','供暖','居民'], 'active', 'peak_load',
  [
    { nodeType:'SOURCE', nodeId:'NODE_SOURCE_02', nodeName:'花木光伏电站', connectedCapacity:30000, voltageLevel:110, params:{outputUpperLimit:90,outputLowerLimit:5,powerFactor:0.95,regulationDelay:30} },
    { nodeType:'GRID', nodeId:'NODE_GRID_02', nodeName:'花木变(220kV)', connectedCapacity:0, voltageLevel:220, params:{tapRegulation:true,reactiveCompensation:true} },
    { nodeType:'LOAD', nodeId:'NODE_LOAD_02', nodeName:'萧山居民负荷', connectedCapacity:28000, voltageLevel:110, params:{peakClippingRate:10,valleyFillingRate:8,interruptibleLoadRatio:3,loadCurveType:'typical_residential',loadCurveValues:''} },
    { nodeType:'STORAGE', nodeId:'NODE_STORAGE_02', nodeName:'萧山储能站', connectedCapacity:8000, voltageLevel:110, params:{chargeSchedule:'23:00-06:00',dischargeSchedule:'17:00-21:00',socUpper:95,socLower:15,ratedPowerKw:4000,ratedCapacityKwh:8000} },
  ],
  [
    { name:'晚间供暖储能支撑', condition:'时段=17:00-21:00 且 负荷 > 80%', action:'储能放电', priority:1 },
  ]
)

// 3. 光伏高发消纳
mkScenario('钱塘光伏高发消纳场景', 'industrial_park',
  '钱塘区春秋季光伏高发时段，光伏出力接近满发，检验电网消纳能力和反向潮流控制',
  ['光伏高发','消纳','春秋季'], 'active', 'solar_high',
  [
    { nodeType:'SOURCE', nodeId:'NODE_SOURCE_03', nodeName:'义蓬光伏电站', connectedCapacity:80000, voltageLevel:220, params:{outputUpperLimit:100,outputLowerLimit:10,powerFactor:0.98,regulationDelay:15} },
    { nodeType:'GRID', nodeId:'NODE_GRID_03', nodeName:'义蓬变(220kV)', connectedCapacity:0, voltageLevel:220, params:{tapRegulation:true,reactiveCompensation:true} },
    { nodeType:'LOAD', nodeId:'NODE_LOAD_03', nodeName:'钱塘工业负荷', connectedCapacity:40000, voltageLevel:220, params:{peakClippingRate:20,valleyFillingRate:15,interruptibleLoadRatio:8,loadCurveType:'typical_industrial',loadCurveValues:''} },
  ],
  [
    { name:'反向潮流限制', condition:'光伏出力 > 本地负荷 120%', action:'降光伏出力至100%负荷', priority:1 },
    { name:'电压越限调控', condition:'母线电压 > 1.05pu', action:'调节无功补偿', priority:2 },
  ]
)

// 4. 线路检修N-1
mkScenario('临安线路检修N-1场景', 'custom',
  '临安区220kV线路检修停运，检验N-1条件下电网供电可靠性和转供能力',
  ['N-1','检修','可靠性'], 'draft', 'maintenance',
  [
    { nodeType:'SOURCE', nodeId:'NODE_SOURCE_04', nodeName:'临安光伏电站', connectedCapacity:20000, voltageLevel:110, params:{outputUpperLimit:95,outputLowerLimit:10,powerFactor:0.95,regulationDelay:30} },
    { nodeType:'GRID', nodeId:'NODE_GRID_04', nodeName:'方圆变(220kV)', connectedCapacity:0, voltageLevel:220, params:{tapRegulation:true,reactiveCompensation:true} },
    { nodeType:'LOAD', nodeId:'NODE_LOAD_04', nodeName:'临安综合负荷', connectedCapacity:15000, voltageLevel:110, params:{peakClippingRate:12,valleyFillingRate:10,interruptibleLoadRatio:10,loadCurveType:'typical_commercial',loadCurveValues:''} },
    { nodeType:'STORAGE', nodeId:'NODE_STORAGE_03', nodeName:'临安储能站', connectedCapacity:5000, voltageLevel:110, params:{chargeSchedule:'02:00-06:00',dischargeSchedule:'08:00-22:00',socUpper:90,socLower:25,ratedPowerKw:2500,ratedCapacityKwh:5000} },
  ],
  [
    { name:'N-1转供', condition:'主变或线路跳闸', action:'自动切换至备用联络线', priority:1 },
    { name:'负荷紧急控制', condition:'转供后仍过载', action:'启动可中断负荷', priority:2 },
  ]
)

// 5. 极端天气应急
mkScenario('滨江商业综合体极端天气', 'commercial',
  '滨江区台风极端天气场景，光伏出力骤降，商业负荷维持，储能应急备电',
  ['极端天气','台风','应急'], 'draft', 'extreme_weather',
  [
    { nodeType:'SOURCE', nodeId:'NODE_SOURCE_05', nodeName:'滨江光伏电站', connectedCapacity:15000, voltageLevel:110, params:{outputUpperLimit:80,outputLowerLimit:0,powerFactor:0.95,regulationDelay:60} },
    { nodeType:'GRID', nodeId:'NODE_GRID_05', nodeName:'滨江变(220kV)', connectedCapacity:0, voltageLevel:220, params:{tapRegulation:true,reactiveCompensation:true} },
    { nodeType:'LOAD', nodeId:'NODE_LOAD_05', nodeName:'滨江商业负荷', connectedCapacity:25000, voltageLevel:110, params:{peakClippingRate:25,valleyFillingRate:5,interruptibleLoadRatio:15,loadCurveType:'typical_commercial',loadCurveValues:''} },
    { nodeType:'STORAGE', nodeId:'NODE_STORAGE_04', nodeName:'滨江储能站', connectedCapacity:12000, voltageLevel:110, params:{chargeSchedule:'全天候应急',dischargeSchedule:'电网故障时触发',socUpper:100,socLower:40,ratedPowerKw:6000,ratedCapacityKwh:12000} },
  ],
  [
    { name:'极端天气应急备电', condition:'电网频率<49.5Hz 或 主网断电', action:'储能切换孤岛模式供电', priority:1 },
    { name:'负荷优先级切除', condition:'储能SOC < 50%', action:'按优先级切除非关键负荷', priority:2 },
  ]
)

console.log('已创建 5 条互动场景')
db.close()
