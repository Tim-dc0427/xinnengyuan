/** 数据契约：定义每个业务表的目标状态。ensure-data-ready 脚本据此检查并补充缺失数据。 */

export const TARGET_RANGE = {
  start: '2025-08-01',
  end: '2026-08-01', // exclusive
}

export interface TableContract {
  table: string
  timeColumn: string | null
  granularity: '5min' | '15min' | '1h' | '6h' | 'static'
  /** 参考种子文件名，生成函数据此复刻物理模型 */
  sourceSeed: string
  minRecords: number
}

export const CONTRACTS: TableContract[] = [
  { table: 'pv_output_measurements', timeColumn: 'time', granularity: '5min',  sourceSeed: '003c', minRecords: 900_000 },
  { table: 'load_measurements',      timeColumn: 'time', granularity: '15min', sourceSeed: '004',  minRecords: 300_000 },
  { table: 'voltage_measurements',   timeColumn: 'time', granularity: '1h',    sourceSeed: 'none', minRecords: 100_000 },
  { table: 'equipment_temperature',  timeColumn: 'time', granularity: '6h',    sourceSeed: '018',  minRecords: 25_000 },
  { table: 'storage_entities',       timeColumn: null,   granularity: 'static', sourceSeed: '007',  minRecords: 10 },
  { table: 'load_entities',          timeColumn: null,   granularity: 'static', sourceSeed: '007',  minRecords: 5 },
]
