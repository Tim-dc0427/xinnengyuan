import { v4 as uuid } from 'uuid'
import type { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  await knex('outage_events').del()

  const stations = await knex('solar_pv_stations').select('id', 'station_name')
  const smap = new Map(stations.map((s: any) => [s.station_name, s.id]))

  function fmt(y: number, m: number, d: number, h: number, min: number) {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`
  }
  function endT(y: number, m: number, d: number, h: number, min: number, dur: number) {
    const dt = new Date(y, m - 1, d, h, min + dur)
    return fmt(dt.getFullYear(), dt.getMonth() + 1, dt.getDate(), dt.getHours(), dt.getMinutes())
  }

  // 参照国家能源局2024年报：光伏非计划停运 0.03次/台年
  // 大部分新电站（投运<3年）零停电，老电站和不可抗力事件才有
  const events = [
    // 舒能（2015投运，最老，设备老化导致3次故障）
    { sn: '舒能渔光互补光伏项目',        st: [2020,7,15,14,30], dur: 480, cause: '变压器绝缘老化', desc: '1#主变绝缘老化局部放电超标，保护跳闸全站停电8小时。切换备用变后恢复。' },
    { sn: '舒能渔光互补光伏项目',        st: [2022,11,3,9,15],  dur: 240, cause: '变压器过载',     desc: '冷却系统故障绕组温度过高，保护越级跳闸停电4小时。' },
    { sn: '舒能渔光互补光伏项目',        st: [2024,5,20,16,0],  dur: 120, cause: '变压器绝缘老化', desc: '套管密封损坏油泄漏，紧急停运2小时抢修。' },
    // 华洋（2024投运，雷击不可抗力）
    { sn: '华洋山地光伏电站',            st: [2025,3,10,15,45], dur: 360, cause: '架空线短路',     desc: '雷击导致绝缘子闪络线路跳闸，停电6小时。' },
    // 青山（2024投运，逆变器偶发故障）
    { sn: '临安青山集中式光伏电站',      st: [2025,9,22,11,0],  dur: 120, cause: '逆变器故障',     desc: '逆变器IGBT模块过流损坏，单阵区停电2小时。' },
    // 太湖源（2024投运，接线松动小故障）
    { sn: '临安太湖源集中式光伏电站',    st: [2026,1,8,8,20],   dur: 45,  cause: '保护装置误动',   desc: '接线端子松动接触电阻增大，保护误动停电45分钟。' },
  ]

  const records = events.map(e => ({
    id: uuid(),
    station_id: smap.get(e.sn) || stations[0].id,
    start_time: fmt(e.st[0], e.st[1], e.st[2], e.st[3], e.st[4]),
    end_time: endT(e.st[0], e.st[1], e.st[2], e.st[3], e.st[4], e.dur),
    duration_minutes: e.dur,
    cause: e.cause,
    description: e.desc,
    created_at: new Date().toISOString(),
  }))

  await knex('outage_events').insert(records)
  console.log(`  ✓ ${records.length} 条停电事件（参照0.03次/台年基准）`)
}
