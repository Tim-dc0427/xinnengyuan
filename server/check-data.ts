import { db } from './src/config/database.js'

async function main() {
  try {
    const pv = await db('solar_pv_stations')
    console.log('光伏站数:', pv.length)
    if (pv.length) {
      console.log('示例:', JSON.stringify(pv[0]))
    }

    const gens = await db('grid_generators')
    console.log('发电机数:', gens.length)
    if (gens.length) {
      console.log('发电机示例:', JSON.stringify(gens.slice(0, 3).map((g: any) => ({ busId: g.bus_id, pgMw: g.pg_mw }))))
    }

    const buses = await db('grid_buses')
    console.log('母线数:', buses.length)
    if (buses.length) {
      console.log('母线示例:', JSON.stringify(buses.slice(0, 5).map((b: any) => ({ id: b.id, type: b.bus_type }))))
    }

    const branches = await db('grid_branches')
    console.log('支路数:', branches.length)
    if (branches.length) {
      console.log('支路示例:', JSON.stringify(branches.slice(0, 3).map((b: any) => ({ from: b.from_bus_id, to: b.to_bus_id, r: b.r_pu, x: b.x_pu }))))
    }

    const loads = await db('grid_loads')
    console.log('负荷数:', loads.length)
    if (loads.length) {
      console.log('负荷示例:', JSON.stringify(loads.slice(0, 3).map((l: any) => ({ busId: l.bus_id, pdMw: l.pd_mw }))))
    }
  } catch (e: any) {
    console.error('Error:', e.message)
  }
  await db.destroy()
}

main()
