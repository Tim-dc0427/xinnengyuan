import { v4 as uuid } from 'uuid'
import type { Knex } from 'knex'

const VOLTAGE_ISSUE_TYPES = ['骤升', '骤降', '波动', '偏差']
const STATUSES = ['已处理', '已处理', '已处理', '处理中', '待处理']

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randDate(start: string, end: string): string {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  return new Date(s + Math.random() * (e - s)).toISOString().slice(0, 19).replace('T', ' ')
}

const ISSUE_TEMPLATES: Record<string, string[]> = {
  '制造业': [
    '电压骤降导致生产线设备突然停机',
    '电压波动引起数控机床加工精度偏差',
    '电压骤升烧毁变频器控制模块',
    '电压不稳定导致自动化产线频繁重启',
    '电压偏差造成电机过载保护动作',
    '电压波动影响焊接机器人焊接质量',
    '电压骤降导致注塑机液压系统异常',
    '电压波动引起流水线传感器信号失真',
  ],
  '商业': [
    '电压波动导致商场中央空调控制系统故障',
    '电压骤降造成数据机房UPS切换失败',
    '电压不稳定引起精密仪器测量数据异常',
    '电压偏差导致LED大屏显示花屏',
    '电压波动影响电梯控制系统正常运行',
    '电压骤升导致办公设备电源模块损坏',
    '电压波动引起安防监控系统频繁重启',
    '电压偏差影响收银系统正常使用',
  ],
  '居民': [
    '电压不稳导致家用电器频繁损坏',
    '电压骤升烧毁电视机电源板',
    '电压波动引起空调压缩机异常停机',
    '电压偏差导致电热水器加热效率低',
    '电压波动影响冰箱压缩机寿命',
    '电压骤降导致电饭煲无法正常煮饭',
    '电压不稳造成照明灯具频繁闪烁',
    '电压波动引起电表计量异常',
  ],
  '农业': [
    '电压偏低影响灌溉水泵正常出水',
    '电压波动导致温室大棚温控系统异常',
    '电压偏差造成饲料加工设备效率下降',
    '电压骤降引起畜禽舍通风设备停机',
    '电压不稳定影响水产养殖增氧设备',
    '电压波动导致农产品冷藏库温度波动',
    '电压偏低影响农业大棚补光系统',
    '电压骤升烧毁灌溉控制器',
  ],
}

export async function seed(knex: Knex): Promise<void> {
  await knex('complaint_tickets').del()

  // 从 complaint_stats 取汇总数据
  const stats = await knex('complaint_stats')
    .join('solar_pv_stations', 'solar_pv_stations.id', 'complaint_stats.station_id')
    .select(
      'complaint_stats.id as cs_id',
      'complaint_stats.station_id',
      'complaint_stats.industry',
      'complaint_stats.complaints',
      'complaint_stats.loss_estimate_wan',
    )

  const records: any[] = []
  let ticketSeq = 0

  for (const s of stats as any[]) {
    // 每个聚合记录生成 min(complaints, 3) 条代表性工单
    const ticketCount = Math.min(s.complaints, 3)
    const lossPerTicket = s.loss_estimate_wan / s.complaints

    for (let i = 0; i < ticketCount; i++) {
      ticketSeq++
      const isVoltage = Math.random() < 0.8 ? 1 : 0
      const issueType = isVoltage ? pick(VOLTAGE_ISSUE_TYPES) : ''
      const templates = ISSUE_TEMPLATES[s.industry] || ['电压问题影响正常用电']
      const desc = isVoltage ? pick(templates) : '非电力原因投诉（电费/服务）'

      records.push({
        id: uuid(),
        ticket_no: `WO-2026-${String(ticketSeq).padStart(4, '0')}`,
        station_id: s.station_id,
        industry: s.industry,
        issue_desc: desc,
        is_voltage_related: isVoltage,
        voltage_issue_type: issueType,
        loss_estimate_wan: +(lossPerTicket * (0.6 + Math.random() * 0.8)).toFixed(2),
        status: pick(STATUSES),
        reported_at: randDate('2026-01-01', '2026-06-02'),
        created_at: new Date().toISOString(),
      })
    }
  }

  await knex('complaint_tickets').insert(records)

  const voltageCount = records.filter(r => r.is_voltage_related).length
  console.log(`  ✓ ${records.length} 条投诉工单（${voltageCount} 条电压波动相关）`)
}
