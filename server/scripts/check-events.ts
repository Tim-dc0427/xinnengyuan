import Database from 'better-sqlite3'
const db = new Database('data.db')
const events = db.prepare(`SELECT id, timestamp, unit, is_violation FROM simulation_metrics WHERE metric_type='strategy_event' ORDER BY timestamp DESC LIMIT 5`).all()
console.log(JSON.stringify(events, null, 2))
const sims = db.prepare('SELECT id, status FROM scenario_simulations LIMIT 3').all()
console.log('模拟:', JSON.stringify(sims))
db.close()
