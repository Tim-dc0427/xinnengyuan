import { v4 as uuid } from 'uuid'
import type { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  await knex('outage_events').del()

  const stations = await knex('solar_pv_stations').select('id', 'station_name')
  const smap = new Map(stations.map((s: any) => [s.station_name, s.id]))

  function fmt(y: number, m: number, d: number, h: number, min: number, sec: number = 0) {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  function endTime(y: number, m: number, d: number, h: number, min: number, durSec: number) {
    const dt = new Date(y, m - 1, d, h, min, 0)
    dt.setSeconds(dt.getSeconds() + durSec)
    return fmt(dt.getFullYear(), dt.getMonth() + 1, dt.getDate(), dt.getHours(), dt.getMinutes(), dt.getSeconds())
  }

  // 杭州配电网供电可靠率 > 99.986%（2023年公开数据），户均停电 < 1.23 小时/年
  // 城区 < 5 分钟/年，农村山区 < 2 小时/年
  // 新投运光伏站（2022+）几乎零持续停电，仅老站和极端天气有短暂事件
  const events: Array<{ sn: string; st: [number,number,number,number,number]; sec: number; cause: string; desc: string }> = [
    // ===== 历史事件（2020-2024，超出默认日期范围，仅作长期对比参考） =====
    // 舒能（2015投运，唯一有较长时间历史故障的老站）
    { sn: '舒能渔光互补光伏项目',        st: [2020,7,15,14,30], sec: 2700, cause: '变压器绝缘老化', desc: '1#主变套管局部放电超标，切换备用变停电45分钟。' },
    { sn: '舒能渔光互补光伏项目',        st: [2022,11,3,9,15],  sec: 1500, cause: '变压器过载',     desc: '冷却风扇故障绕组温度高，降负荷运行停电25分钟。' },

    // ===== 2025-2026 实际停电（杭州配网高可靠性，重合闸成功率>90%，瞬停为主） =====
    // 舒能（百兆瓦老站，CT端子松动导致保护误动，远动遥控复归）
    { sn: '舒能渔光互补光伏项目',        st: [2025,8,12,14,20], sec: 120, cause: 'CT/PT断线',     desc: 'CT二次端子松动采样异常触发保护闭锁，调度遥控复归，停电120秒。' },
    // 华洋（山地雷击闪络，重合闸成功，用户感知<2秒）
    { sn: '华洋山地光伏电站',            st: [2025,6,28,16,10], sec: 2,   cause: '架空线短路',     desc: '雷击绝缘子闪络跳闸，重合闸成功瞬停2秒。' },
    // 青山（逆变器通讯超时自动重启，单阵区瞬时离线）
    { sn: '临安青山集中式光伏电站',      st: [2025,9,22,11,0],  sec: 45,  cause: '逆变器通讯中断', desc: '通讯板卡接触不良逆变器离线，自动重连恢复，停电45秒。' },
    // 渔山（架空地线刮碰，备自投切换成功）
    { sn: '渔山山地光伏电站',            st: [2026,1,15,10,30], sec: 8,   cause: '外力破坏',       desc: '施工刮碰架空地线，#2进线跳闸，备自投切换停电8秒。' },
    // 径山（鸟害污闪，重合闸成功）
    { sn: '径山镇农光互补光伏电站',      st: [2025,4,8,6,30],   sec: 1,   cause: '绝缘子污闪',     desc: '鸟粪污闪单相接地，重合闸成功瞬停1秒。' },
    // 太湖源（电压暂降，逆变器低穿恢复，自动重并网）
    { sn: '临安太湖源集中式光伏电站',    st: [2026,2,20,15,45], sec: 90,  cause: '电压/频率越限解列', desc: '110kV母线电压暂降至78%触发低穿，逆变器自动重并网，停电90秒。' },
  ]

  const records = events.map(e => ({
    id: uuid(),
    station_id: smap.get(e.sn) || stations[0].id,
    start_time: fmt(e.st[0], e.st[1], e.st[2], e.st[3], e.st[4]),
    end_time: endTime(e.st[0], e.st[1], e.st[2], e.st[3], e.st[4], e.sec),
    duration_seconds: e.sec,
    cause: e.cause,
    description: e.desc,
    created_at: new Date().toISOString(),
  }))

  await knex('outage_events').insert(records)
  console.log(`  ✓ ${records.length} 条停电事件（秒级精度）`)
}
