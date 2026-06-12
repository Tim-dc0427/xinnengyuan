import type { Knex } from 'knex'
import { v4 as uuid } from 'uuid'

export async function seed(knex: Knex): Promise<void> {
  await knex('pv_model_type_fields').del()
  await knex('pv_model_types').del()
  await knex('pv_stations').del()

  const now = new Date().toISOString()

  const typeCentralized = uuid()
  const typePvStorage    = uuid()
  const typeDistributed  = uuid()
  const typeAgriPv       = uuid()
  const typeFloatingPv   = uuid()

  await knex('pv_model_types').insert([
    { id: typeCentralized, name: '集中式光伏电站', code: 'CENTRALIZED_PV', description: '大型地面集中式光伏电站，接入35kV及以上电网', sort_order: 1, created_at: now },
    { id: typePvStorage, name: '光储联合电站', code: 'PV_STORAGE', description: '光伏+储能联合电站，含配套储能系统', sort_order: 2, created_at: now },
    { id: typeDistributed, name: '分布式光伏电站', code: 'DISTRIBUTED_PV', description: '屋顶/小型分布式光伏，接入10kV及以下配电网', sort_order: 3, created_at: now },
    { id: typeAgriPv, name: '农光互补电站', code: 'AGRI_PV', description: '光伏与农业种植/养殖结合，实现板上发电、板下种植', sort_order: 4, created_at: now },
    { id: typeFloatingPv, name: '水面光伏电站', code: 'FLOATING_PV', description: '在湖泊、水库、鱼塘等水面建设的光伏电站', sort_order: 5, created_at: now },
  ])

  // ==================== 集中式光伏电站字段 ====================
  // 一、基础信息
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typeCentralized, field_code: 'station_code', field_name: '电站唯一编码', field_type: 'text', is_required: 1, sort_order: 1, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'station_name', field_name: '电站名称', field_type: 'text', is_required: 1, sort_order: 2, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'project_no', field_name: '项目立项编号', field_type: 'text', is_required: 1, sort_order: 3, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'project_status', field_name: '项目状态', field_type: 'select', field_options: JSON.stringify(['在建', '并网运行', '停运检修', '报废', '暂缓建设']), is_required: 1, sort_order: 4, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'owner_company', field_name: '业主单位', field_type: 'text', is_required: 1, sort_order: 5, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'operate_company', field_name: '运维单位', field_type: 'text', is_required: 0, sort_order: 6, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'area_adm', field_name: '所属行政区域', field_type: 'text', is_required: 1, sort_order: 7, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'grid_connect_time', field_name: '并网时间', field_type: 'date', is_required: 0, sort_order: 8, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'run_time', field_name: '投运时间', field_type: 'date', is_required: 0, sort_order: 9, category: '基础信息', created_at: now },
  ])
  // 二、电气参数
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typeCentralized, field_code: 'total_capacity', field_name: '总装机容量(MWp)', field_type: 'number', is_required: 1, sort_order: 10, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'grid_voltage', field_name: '并网电压等级', field_type: 'select', field_options: JSON.stringify(['10kV', '35kV', '110kV', '220kV']), is_required: 1, sort_order: 11, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'grid_mode', field_name: '并网方式', field_type: 'select', field_options: JSON.stringify(['单点并网', '多点并网', '专线并网']), is_required: 1, sort_order: 12, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'grid_point_name', field_name: '并网点名称', field_type: 'text', is_required: 1, sort_order: 13, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'grid_point_no', field_name: '并网点编号', field_type: 'text', is_required: 1, sort_order: 14, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'substation_name', field_name: '所属送出变电站', field_type: 'text', is_required: 1, sort_order: 15, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'dispatch_type', field_name: '电网调度归属', field_type: 'select', field_options: JSON.stringify(['地市调度', '省级调度']), is_required: 0, sort_order: 16, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'line_no', field_name: '送出线路编号', field_type: 'text', is_required: 0, sort_order: 17, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'use_hour', field_name: '等效利用小时数(h)', field_type: 'number', is_required: 0, sort_order: 18, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'theory_power', field_name: '理论年发电量(kWh)', field_type: 'number', is_required: 0, sort_order: 19, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'reactive_cap', field_name: '无功补偿容量(Mvar)', field_type: 'number', is_required: 0, sort_order: 20, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'energy_storage', field_name: '配套储能配置', field_type: 'select', field_options: JSON.stringify(['无储能', '配储能']), is_required: 0, sort_order: 21, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'storage_param', field_name: '储能额定容量(MW/MWh)', field_type: 'text', is_required: 0, sort_order: 22, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'circuit_mode', field_name: '系统接线方式', field_type: 'select', field_options: JSON.stringify(['放射式', '环网式']), is_required: 0, sort_order: 23, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'power_factor', field_name: '额定功率因数', field_type: 'number', is_required: 0, sort_order: 24, category: '电气参数', created_at: now },
  ])
  // 三、地理坐标
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typeCentralized, field_code: 'geo_coordinate', field_name: '坐标系类型', field_type: 'select', field_options: JSON.stringify(['WGS84', 'GCJ02', '北京54', '西安80']), is_required: 1, sort_order: 25, category: '地理坐标', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'center_lon', field_name: '电站中心点经度', field_type: 'number', is_required: 1, sort_order: 26, category: '地理坐标', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'center_lat', field_name: '电站中心点纬度', field_type: 'number', is_required: 1, sort_order: 27, category: '地理坐标', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'terrain_type', field_name: '地形类型', field_type: 'select', field_options: JSON.stringify(['平原', '丘陵', '山地', '滩涂', '水面', '戈壁']), is_required: 1, sort_order: 28, category: '地理坐标', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'altitude', field_name: '海拔高度(m)', field_type: 'number', is_required: 0, sort_order: 29, category: '地理坐标', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'border_point', field_name: '地块四至坐标', field_type: 'text', is_required: 0, sort_order: 30, category: '地理坐标', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'array_angle', field_name: '方阵平均倾角(°)', field_type: 'number', is_required: 0, sort_order: 31, category: '地理坐标', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'array_azimuth', field_name: '方阵方位角', field_type: 'select', field_options: JSON.stringify(['朝南', '朝东南', '朝西南', '朝北']), is_required: 0, sort_order: 32, category: '地理坐标', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'radiation', field_name: '年均太阳辐照量(MJ/㎡)', field_type: 'number', is_required: 0, sort_order: 33, category: '地理坐标', created_at: now },
  ])
  // 四、土地属性
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typeCentralized, field_code: 'total_land_area', field_name: '总用地面积(亩)', field_type: 'number', is_required: 1, sort_order: 34, category: '土地属性', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'land_type_main', field_name: '用地大类', field_type: 'select', field_options: JSON.stringify(['农用地', '建设用地', '未利用地', '水域', '林地']), is_required: 1, sort_order: 35, category: '土地属性', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'land_type_sub', field_name: '用地细分类型', field_type: 'select', field_options: JSON.stringify(['旱地', '荒坡', '鱼塘', '滩涂', '戈壁', '林地', '一般农田']), is_required: 1, sort_order: 36, category: '土地属性', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'land_owner', field_name: '土地权属方', field_type: 'select', field_options: JSON.stringify(['国有', '村集体', '个人']), is_required: 1, sort_order: 37, category: '土地属性', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'land_transfer_mode', field_name: '土地流转方式', field_type: 'select', field_options: JSON.stringify(['租赁', '承包', '划拨', '出让']), is_required: 1, sort_order: 38, category: '土地属性', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'is_basic_farmland', field_name: '是否占用基本农田', field_type: 'select', field_options: JSON.stringify(['是', '否']), is_required: 1, sort_order: 39, category: '土地属性', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'is_ecology_line', field_name: '是否触碰生态红线', field_type: 'select', field_options: JSON.stringify(['是', '否']), is_required: 1, sort_order: 40, category: '土地属性', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'land_start_date', field_name: '流转开始日期', field_type: 'date', is_required: 1, sort_order: 41, category: '土地属性', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'land_end_date', field_name: '流转结束日期', field_type: 'date', is_required: 1, sort_order: 42, category: '土地属性', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'land_rent', field_name: '年土地租金(元/亩)', field_type: 'number', is_required: 0, sort_order: 43, category: '土地属性', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'land_contract_no', field_name: '土地合同编号', field_type: 'text', is_required: 0, sort_order: 44, category: '土地属性', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'forest_approval', field_name: '林地使用审批', field_type: 'select', field_options: JSON.stringify(['无需审批', '已审批', '待审批']), is_required: 0, sort_order: 45, category: '土地属性', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'land_approval_no', field_name: '用地预审编号', field_type: 'text', is_required: 0, sort_order: 46, category: '土地属性', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'water_conservation_no', field_name: '水土保持批复编号', field_type: 'text', is_required: 0, sort_order: 47, category: '土地属性', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'land_reclaim', field_name: '到期土地复垦要求', field_type: 'select', field_options: JSON.stringify(['无需复垦', '按标准复垦', '原地恢复植被']), is_required: 0, sort_order: 48, category: '土地属性', created_at: now },
  ])
  // 五、设备台账
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typeCentralized, field_code: 'module_model', field_name: '光伏组件型号', field_type: 'text', is_required: 1, sort_order: 49, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'module_power', field_name: '单块组件功率(Wp)', field_type: 'number', is_required: 1, sort_order: 50, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'module_total', field_name: '组件总数量', field_type: 'number', is_required: 1, sort_order: 51, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'module_factory', field_name: '组件生产厂家', field_type: 'text', is_required: 0, sort_order: 52, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'inverter_type', field_name: '逆变器类型', field_type: 'select', field_options: JSON.stringify(['组串式逆变器', '集中式逆变器']), is_required: 1, sort_order: 53, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'inverter_model', field_name: '逆变器型号', field_type: 'text', is_required: 1, sort_order: 54, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'inverter_single_power', field_name: '单台逆变器功率(kW)', field_type: 'number', is_required: 1, sort_order: 55, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'inverter_total', field_name: '逆变器总台数', field_type: 'number', is_required: 1, sort_order: 56, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'box_transformer_num', field_name: '箱式变压器台数', field_type: 'number', is_required: 1, sort_order: 57, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'box_transformer_cap', field_name: '单台箱变容量(kVA)', field_type: 'number', is_required: 1, sort_order: 58, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'box_transformer_model', field_name: '箱变型号', field_type: 'text', is_required: 0, sort_order: 59, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'line_loop_num', field_name: '集电线路回路数', field_type: 'number', is_required: 0, sort_order: 60, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'line_model', field_name: '集电线路型号', field_type: 'text', is_required: 0, sort_order: 61, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeCentralized, field_code: 'main_transformer', field_name: '升压站主变配置', field_type: 'text', is_required: 0, sort_order: 62, category: '设备台账', created_at: now },
  ])

  // ==================== 光储联合电站字段 ====================
  // 一、基础信息
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typePvStorage, field_code: 'station_code', field_name: '电站唯一编码', field_type: 'text', is_required: 1, sort_order: 1, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'station_name', field_name: '电站名称', field_type: 'text', is_required: 1, sort_order: 2, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'project_no', field_name: '项目立项编号', field_type: 'text', is_required: 1, sort_order: 3, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'project_status', field_name: '项目状态', field_type: 'select', field_options: JSON.stringify(['在建', '并网运行', '停运检修', '报废', '暂缓建设']), is_required: 1, sort_order: 4, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'owner_company', field_name: '业主单位', field_type: 'text', is_required: 1, sort_order: 5, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'area_adm', field_name: '所属行政区域', field_type: 'text', is_required: 1, sort_order: 6, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'grid_connect_time', field_name: '并网时间', field_type: 'date', is_required: 0, sort_order: 7, category: '基础信息', created_at: now },
  ])
  // 二、电气参数
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typePvStorage, field_code: 'total_capacity', field_name: '光伏装机容量(MWp)', field_type: 'number', is_required: 1, sort_order: 8, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'storage_capacity_kwh', field_name: '储能容量(kWh)', field_type: 'number', is_required: 1, sort_order: 9, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'storage_power_kw', field_name: '储能功率(kW)', field_type: 'number', is_required: 1, sort_order: 10, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'grid_voltage', field_name: '并网电压等级', field_type: 'select', field_options: JSON.stringify(['10kV', '35kV', '110kV']), is_required: 1, sort_order: 11, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'grid_mode', field_name: '并网方式', field_type: 'select', field_options: JSON.stringify(['单点并网', '多点并网', '专线并网']), is_required: 1, sort_order: 12, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'storage_type', field_name: '储能类型', field_type: 'select', field_options: JSON.stringify(['磷酸铁锂', '钠离子', '液流', '铅酸']), is_required: 1, sort_order: 13, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'charge_discharge_hours', field_name: '充放电时长(h)', field_type: 'number', is_required: 0, sort_order: 14, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'application_scenario', field_name: '应用场景', field_type: 'select', field_options: JSON.stringify(['削峰填谷', '调频辅助', '备用电源', '微电网']), is_required: 0, sort_order: 15, category: '电气参数', created_at: now },
  ])
  // 三、地理坐标
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typePvStorage, field_code: 'geo_coordinate', field_name: '坐标系类型', field_type: 'select', field_options: JSON.stringify(['WGS84', 'GCJ02', '北京54', '西安80']), is_required: 1, sort_order: 16, category: '地理坐标', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'center_lon', field_name: '电站中心点经度', field_type: 'number', is_required: 1, sort_order: 17, category: '地理坐标', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'center_lat', field_name: '电站中心点纬度', field_type: 'number', is_required: 1, sort_order: 18, category: '地理坐标', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'terrain_type', field_name: '地形类型', field_type: 'select', field_options: JSON.stringify(['平原', '丘陵', '山地', '滩涂', '水面', '戈壁']), is_required: 1, sort_order: 19, category: '地理坐标', created_at: now },
  ])
  // 四、土地属性
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typePvStorage, field_code: 'total_land_area', field_name: '总用地面积(亩)', field_type: 'number', is_required: 1, sort_order: 20, category: '土地属性', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'land_type_main', field_name: '用地大类', field_type: 'select', field_options: JSON.stringify(['农用地', '建设用地', '未利用地', '水域', '林地']), is_required: 1, sort_order: 21, category: '土地属性', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'land_transfer_mode', field_name: '土地流转方式', field_type: 'select', field_options: JSON.stringify(['租赁', '承包', '划拨', '出让']), is_required: 1, sort_order: 22, category: '土地属性', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'is_ecology_line', field_name: '是否触碰生态红线', field_type: 'select', field_options: JSON.stringify(['是', '否']), is_required: 1, sort_order: 23, category: '土地属性', created_at: now },
  ])
  // 五、设备台账
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typePvStorage, field_code: 'module_model', field_name: '光伏组件型号', field_type: 'text', is_required: 1, sort_order: 24, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'module_power', field_name: '单块组件功率(Wp)', field_type: 'number', is_required: 1, sort_order: 25, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'module_total', field_name: '组件总数量', field_type: 'number', is_required: 1, sort_order: 26, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'inverter_type', field_name: '逆变器类型', field_type: 'select', field_options: JSON.stringify(['组串式逆变器', '集中式逆变器']), is_required: 1, sort_order: 27, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'inverter_model', field_name: '逆变器型号', field_type: 'text', is_required: 1, sort_order: 28, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'inverter_total', field_name: '逆变器总台数', field_type: 'number', is_required: 1, sort_order: 29, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'box_transformer_num', field_name: '箱式变压器台数', field_type: 'number', is_required: 1, sort_order: 30, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typePvStorage, field_code: 'box_transformer_cap', field_name: '单台箱变容量(kVA)', field_type: 'number', is_required: 1, sort_order: 31, category: '设备台账', created_at: now },
  ])

  // ==================== 分布式光伏电站字段 ====================
  // 一、基础信息
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typeDistributed, field_code: 'station_code', field_name: '电站唯一编码', field_type: 'text', is_required: 1, sort_order: 1, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeDistributed, field_code: 'station_name', field_name: '电站名称', field_type: 'text', is_required: 1, sort_order: 2, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeDistributed, field_code: 'project_no', field_name: '项目立项编号', field_type: 'text', is_required: 1, sort_order: 3, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeDistributed, field_code: 'project_status', field_name: '项目状态', field_type: 'select', field_options: JSON.stringify(['在建', '并网运行', '停运检修', '报废', '暂缓建设']), is_required: 1, sort_order: 4, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeDistributed, field_code: 'owner_company', field_name: '业主单位', field_type: 'text', is_required: 1, sort_order: 5, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeDistributed, field_code: 'area_adm', field_name: '所属行政区域', field_type: 'text', is_required: 1, sort_order: 6, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeDistributed, field_code: 'grid_connect_time', field_name: '并网时间', field_type: 'date', is_required: 0, sort_order: 7, category: '基础信息', created_at: now },
  ])
  // 二、电气参数
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typeDistributed, field_code: 'total_capacity', field_name: '装机容量(kW)', field_type: 'number', is_required: 1, sort_order: 8, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeDistributed, field_code: 'grid_voltage', field_name: '接入电压等级(V)', field_type: 'select', field_options: JSON.stringify(['220', '380', '10000']), is_required: 1, sort_order: 9, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeDistributed, field_code: 'conn_mode', field_name: '并网模式', field_type: 'select', field_options: JSON.stringify(['全额上网', '自发自用余电上网', '全部自用']), is_required: 1, sort_order: 10, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeDistributed, field_code: 'owner_type', field_name: '业主类型', field_type: 'select', field_options: JSON.stringify(['工商业', '户用', '公共机构', '农业']), is_required: 1, sort_order: 11, category: '电气参数', created_at: now },
  ])
  // 三、建筑属性
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typeDistributed, field_code: 'geo_coordinate', field_name: '坐标系类型', field_type: 'select', field_options: JSON.stringify(['WGS84', 'GCJ02', '北京54', '西安80']), is_required: 1, sort_order: 12, category: '建筑属性', created_at: now },
    { id: uuid(), type_id: typeDistributed, field_code: 'center_lon', field_name: '电站中心点经度', field_type: 'number', is_required: 1, sort_order: 13, category: '建筑属性', created_at: now },
    { id: uuid(), type_id: typeDistributed, field_code: 'center_lat', field_name: '电站中心点纬度', field_type: 'number', is_required: 1, sort_order: 14, category: '建筑属性', created_at: now },
    { id: uuid(), type_id: typeDistributed, field_code: 'roof_area_sqm', field_name: '屋顶面积(㎡)', field_type: 'number', is_required: 1, sort_order: 15, category: '建筑属性', created_at: now },
    { id: uuid(), type_id: typeDistributed, field_code: 'roof_structure', field_name: '屋顶结构', field_type: 'select', field_options: JSON.stringify(['混凝土', '彩钢瓦', '钢结构']), is_required: 0, sort_order: 16, category: '建筑属性', created_at: now },
    { id: uuid(), type_id: typeDistributed, field_code: 'building_age_years', field_name: '建筑年限(年)', field_type: 'number', is_required: 0, sort_order: 17, category: '建筑属性', created_at: now },
  ])
  // 四、设备台账
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typeDistributed, field_code: 'module_model', field_name: '光伏组件型号', field_type: 'text', is_required: 1, sort_order: 18, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeDistributed, field_code: 'module_power', field_name: '单块组件功率(Wp)', field_type: 'number', is_required: 1, sort_order: 19, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeDistributed, field_code: 'module_total', field_name: '组件总数量', field_type: 'number', is_required: 1, sort_order: 20, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeDistributed, field_code: 'inverter_type', field_name: '逆变器类型', field_type: 'select', field_options: JSON.stringify(['组串式逆变器', '集中式逆变器']), is_required: 1, sort_order: 21, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeDistributed, field_code: 'inverter_model', field_name: '逆变器型号', field_type: 'text', is_required: 1, sort_order: 22, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeDistributed, field_code: 'inverter_total', field_name: '逆变器总台数', field_type: 'number', is_required: 1, sort_order: 23, category: '设备台账', created_at: now },
  ])

  // ==================== 农光互补电站字段 ====================
  // 一、基础信息
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typeAgriPv, field_code: 'station_code', field_name: '电站唯一编码', field_type: 'text', is_required: 1, sort_order: 1, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'station_name', field_name: '电站名称', field_type: 'text', is_required: 1, sort_order: 2, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'project_no', field_name: '项目立项编号', field_type: 'text', is_required: 1, sort_order: 3, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'project_status', field_name: '项目状态', field_type: 'select', field_options: JSON.stringify(['在建', '并网运行', '停运检修', '报废', '暂缓建设']), is_required: 1, sort_order: 4, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'owner_company', field_name: '业主单位', field_type: 'text', is_required: 1, sort_order: 5, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'area_adm', field_name: '所属行政区域', field_type: 'text', is_required: 1, sort_order: 6, category: '基础信息', created_at: now },
  ])
  // 二、电气参数
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typeAgriPv, field_code: 'total_capacity', field_name: '装机容量(MWp)', field_type: 'number', is_required: 1, sort_order: 7, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'grid_voltage', field_name: '并网电压等级', field_type: 'select', field_options: JSON.stringify(['10kV', '35kV', '110kV']), is_required: 1, sort_order: 8, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'grid_mode', field_name: '并网方式', field_type: 'select', field_options: JSON.stringify(['单点并网', '多点并网', '专线并网']), is_required: 1, sort_order: 9, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'crop_type', field_name: '种植/养殖类型', field_type: 'select', field_options: JSON.stringify(['蔬菜大棚', '牧草', '中草药', '水产养殖', '食用菌']), is_required: 1, sort_order: 10, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'panel_height_m', field_name: '组件离地高度(m)', field_type: 'number', is_required: 1, sort_order: 11, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'light_transmittance_pct', field_name: '透光率(%)', field_type: 'number', is_required: 0, sort_order: 12, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'irrigation_type', field_name: '灌溉方式', field_type: 'select', field_options: JSON.stringify(['滴灌', '喷灌', '漫灌', '无']), is_required: 0, sort_order: 13, category: '电气参数', created_at: now },
  ])
  // 三、地理坐标
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typeAgriPv, field_code: 'geo_coordinate', field_name: '坐标系类型', field_type: 'select', field_options: JSON.stringify(['WGS84', 'GCJ02', '北京54', '西安80']), is_required: 1, sort_order: 14, category: '地理坐标', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'center_lon', field_name: '电站中心点经度', field_type: 'number', is_required: 1, sort_order: 15, category: '地理坐标', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'center_lat', field_name: '电站中心点纬度', field_type: 'number', is_required: 1, sort_order: 16, category: '地理坐标', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'terrain_type', field_name: '地形类型', field_type: 'select', field_options: JSON.stringify(['平原', '丘陵', '山地', '滩涂', '水面', '戈壁']), is_required: 1, sort_order: 17, category: '地理坐标', created_at: now },
  ])
  // 四、土地属性
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typeAgriPv, field_code: 'total_land_area', field_name: '总用地面积(亩)', field_type: 'number', is_required: 1, sort_order: 18, category: '土地属性', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'land_type_main', field_name: '用地大类', field_type: 'select', field_options: JSON.stringify(['农用地', '建设用地', '未利用地', '水域', '林地']), is_required: 1, sort_order: 19, category: '土地属性', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'is_basic_farmland', field_name: '是否占用基本农田', field_type: 'select', field_options: JSON.stringify(['是', '否']), is_required: 1, sort_order: 20, category: '土地属性', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'land_transfer_mode', field_name: '土地流转方式', field_type: 'select', field_options: JSON.stringify(['租赁', '承包', '划拨', '出让']), is_required: 1, sort_order: 21, category: '土地属性', created_at: now },
  ])
  // 五、设备台账
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typeAgriPv, field_code: 'module_model', field_name: '光伏组件型号', field_type: 'text', is_required: 1, sort_order: 22, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'module_power', field_name: '单块组件功率(Wp)', field_type: 'number', is_required: 1, sort_order: 23, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'module_total', field_name: '组件总数量', field_type: 'number', is_required: 1, sort_order: 24, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'inverter_type', field_name: '逆变器类型', field_type: 'select', field_options: JSON.stringify(['组串式逆变器', '集中式逆变器']), is_required: 1, sort_order: 25, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'inverter_model', field_name: '逆变器型号', field_type: 'text', is_required: 1, sort_order: 26, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeAgriPv, field_code: 'inverter_total', field_name: '逆变器总台数', field_type: 'number', is_required: 1, sort_order: 27, category: '设备台账', created_at: now },
  ])

  // ==================== 水面光伏电站字段 ====================
  // 一、基础信息
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typeFloatingPv, field_code: 'station_code', field_name: '电站唯一编码', field_type: 'text', is_required: 1, sort_order: 1, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeFloatingPv, field_code: 'station_name', field_name: '电站名称', field_type: 'text', is_required: 1, sort_order: 2, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeFloatingPv, field_code: 'project_no', field_name: '项目立项编号', field_type: 'text', is_required: 1, sort_order: 3, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeFloatingPv, field_code: 'project_status', field_name: '项目状态', field_type: 'select', field_options: JSON.stringify(['在建', '并网运行', '停运检修', '报废', '暂缓建设']), is_required: 1, sort_order: 4, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeFloatingPv, field_code: 'owner_company', field_name: '业主单位', field_type: 'text', is_required: 1, sort_order: 5, category: '基础信息', created_at: now },
    { id: uuid(), type_id: typeFloatingPv, field_code: 'area_adm', field_name: '所属行政区域', field_type: 'text', is_required: 1, sort_order: 6, category: '基础信息', created_at: now },
  ])
  // 二、电气参数
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typeFloatingPv, field_code: 'total_capacity', field_name: '装机容量(MWp)', field_type: 'number', is_required: 1, sort_order: 7, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeFloatingPv, field_code: 'grid_voltage', field_name: '并网电压等级', field_type: 'select', field_options: JSON.stringify(['10kV', '35kV', '110kV']), is_required: 1, sort_order: 8, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeFloatingPv, field_code: 'grid_mode', field_name: '并网方式', field_type: 'select', field_options: JSON.stringify(['单点并网', '多点并网', '专线并网']), is_required: 1, sort_order: 9, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeFloatingPv, field_code: 'water_body_type', field_name: '水体类型', field_type: 'select', field_options: JSON.stringify(['水库', '湖泊', '鱼塘', '采煤沉陷区', '工业水池']), is_required: 1, sort_order: 10, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeFloatingPv, field_code: 'water_area_mu', field_name: '水域面积(亩)', field_type: 'number', is_required: 1, sort_order: 11, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeFloatingPv, field_code: 'water_depth_m', field_name: '水深(m)', field_type: 'number', is_required: 1, sort_order: 12, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeFloatingPv, field_code: 'floating_platform_type', field_name: '浮体平台类型', field_type: 'select', field_options: JSON.stringify(['HDPE浮体', '钢浮筒', '混凝土浮台']), is_required: 1, sort_order: 13, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeFloatingPv, field_code: 'anchoring_type', field_name: '锚固方式', field_type: 'select', field_options: JSON.stringify(['岸边锚固', '水下锚固', '桩基固定']), is_required: 0, sort_order: 14, category: '电气参数', created_at: now },
    { id: uuid(), type_id: typeFloatingPv, field_code: 'corrosion_protection_level', field_name: '防腐等级', field_type: 'select', field_options: JSON.stringify(['C3', 'C4', 'C5', 'CX']), is_required: 0, sort_order: 15, category: '电气参数', created_at: now },
  ])
  // 三、地理坐标
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typeFloatingPv, field_code: 'geo_coordinate', field_name: '坐标系类型', field_type: 'select', field_options: JSON.stringify(['WGS84', 'GCJ02', '北京54', '西安80']), is_required: 1, sort_order: 16, category: '地理坐标', created_at: now },
    { id: uuid(), type_id: typeFloatingPv, field_code: 'center_lon', field_name: '电站中心点经度', field_type: 'number', is_required: 1, sort_order: 17, category: '地理坐标', created_at: now },
    { id: uuid(), type_id: typeFloatingPv, field_code: 'center_lat', field_name: '电站中心点纬度', field_type: 'number', is_required: 1, sort_order: 18, category: '地理坐标', created_at: now },
  ])
  // 四、设备台账
  await knex('pv_model_type_fields').insert([
    { id: uuid(), type_id: typeFloatingPv, field_code: 'module_model', field_name: '光伏组件型号', field_type: 'text', is_required: 1, sort_order: 19, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeFloatingPv, field_code: 'module_power', field_name: '单块组件功率(Wp)', field_type: 'number', is_required: 1, sort_order: 20, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeFloatingPv, field_code: 'module_total', field_name: '组件总数量', field_type: 'number', is_required: 1, sort_order: 21, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeFloatingPv, field_code: 'inverter_type', field_name: '逆变器类型', field_type: 'select', field_options: JSON.stringify(['组串式逆变器', '集中式逆变器']), is_required: 1, sort_order: 22, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeFloatingPv, field_code: 'inverter_model', field_name: '逆变器型号', field_type: 'text', is_required: 1, sort_order: 23, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeFloatingPv, field_code: 'inverter_total', field_name: '逆变器总台数', field_type: 'number', is_required: 1, sort_order: 24, category: '设备台账', created_at: now },
    { id: uuid(), type_id: typeFloatingPv, field_code: 'box_transformer_num', field_name: '箱式变压器台数', field_type: 'number', is_required: 1, sort_order: 25, category: '设备台账', created_at: now },
  ])

  // ==================== 集中式光伏电站示例数据 ====================
  // 模拟用户操作流程：选择"集中式光伏电站"模型类型 → 填写字段表单 → 保存
  await knex('pv_stations').insert([
    {
      id: uuid(), name: '格尔木东出口光伏电站',
      capacity_kw: 200000, panel_type: '', rated_voltage_kv: 220,
      longitude: 94.9286, latitude: 36.4167, land_type: '', land_area_mu: 5200,
      electrical_params: '{}', equipment_list: '[]', status: 'operating', plan_id: null,
      model_type_id: typeCentralized,
      custom_fields: JSON.stringify({
        station_code: 'QH-GEM-2024-001', project_no: 'QH-2024-PV-0038', project_status: '并网运行',
        owner_company: '国能青海新能源有限公司', operate_company: '国能青海运维分公司',
        area_adm: '青海省/海西州/格尔木市', grid_connect_time: '2024-12-28', run_time: '2025-01-15',
        total_capacity: 200, grid_voltage: '220kV', grid_mode: '专线并网',
        grid_point_name: '格尔木东出口汇集站', grid_point_no: 'GEM-220-01', substation_name: '格尔木变220kV',
        dispatch_type: '省级调度', line_no: '格东线#1', use_hour: 1650, theory_power: 330000000,
        reactive_cap: 40, energy_storage: '配储能', storage_param: '40MW/80MWh',
        circuit_mode: '放射式', power_factor: 0.98, geo_coordinate: 'WGS84',
        center_lon: 94.9286, center_lat: 36.4167, terrain_type: '戈壁', altitude: 2820,
        array_angle: 34, array_azimuth: '朝南', radiation: 6800,
        total_land_area: 5200, land_type_main: '未利用地', land_type_sub: '戈壁',
        land_owner: '国有', land_transfer_mode: '划拨', is_basic_farmland: '否', is_ecology_line: '否',
        land_start_date: '2024-03-01', land_end_date: '2049-02-28', land_contract_no: 'QH-GEM-2024-0012',
        forest_approval: '无需审批', land_approval_no: '青自然资预审[2024]0186号',
        water_conservation_no: '青水保批[2024]0092号', land_reclaim: '按标准复垦',
        module_model: 'LR5-72HPH-550M', module_power: 550, module_total: 364000, module_factory: '隆基绿能',
        inverter_type: '组串式逆变器', inverter_model: 'SUN2000-330KTL-H2',
        inverter_single_power: 330, inverter_total: 606, box_transformer_num: 56,
        box_transformer_cap: 3600, box_transformer_model: 'S11-3600/36.5',
        line_loop_num: 14, line_model: 'LGJ-400/35', main_transformer: 'SZ11-200000/220',
      }),
      created_at: now, updated_at: now,
    },
    {
      id: uuid(), name: '哈密石城子光伏产业园电站',
      capacity_kw: 150000, panel_type: '', rated_voltage_kv: 110,
      longitude: 93.4865, latitude: 42.8235, land_type: '', land_area_mu: 4000,
      electrical_params: '{}', equipment_list: '[]', status: 'construction', plan_id: null,
      model_type_id: typeCentralized,
      custom_fields: JSON.stringify({
        station_code: 'XJ-HM-2025-001', project_no: 'XJ-2025-PV-0056', project_status: '在建',
        owner_company: '华电新疆新能源有限公司', area_adm: '新疆维吾尔自治区/哈密市/伊州区',
        total_capacity: 150, grid_voltage: '110kV', grid_mode: '单点并网',
        grid_point_name: '石城子1号汇集站', grid_point_no: 'SCZ-110-01', substation_name: '哈密变110kV',
        dispatch_type: '地市调度', line_no: '石城子线#1', use_hour: 1550, theory_power: 232500000,
        reactive_cap: 30, energy_storage: '配储能', storage_param: '30MW/60MWh',
        circuit_mode: '放射式', power_factor: 0.97, geo_coordinate: 'WGS84',
        center_lon: 93.4865, center_lat: 42.8235, terrain_type: '戈壁', altitude: 760,
        array_angle: 36, array_azimuth: '朝南', radiation: 6400,
        total_land_area: 4000, land_type_main: '未利用地', land_type_sub: '戈壁',
        land_owner: '国有', land_transfer_mode: '出让', is_basic_farmland: '否', is_ecology_line: '否',
        land_start_date: '2025-01-15', land_end_date: '2050-01-14', land_contract_no: 'XJ-HM-2025-0023',
        forest_approval: '无需审批', land_approval_no: '新自然资预审[2025]0034号',
        water_conservation_no: '新水保批[2025]0018号', land_reclaim: '按标准复垦',
        module_model: 'JKM580N-72HL4-V', module_power: 580, module_total: 259000, module_factory: '晶科能源',
        inverter_type: '集中式逆变器', inverter_model: 'SG3125HV-30',
        inverter_single_power: 3125, inverter_total: 48, box_transformer_num: 42,
        box_transformer_cap: 3600, box_transformer_model: 'S11-3600/38.5',
        line_loop_num: 12, line_model: 'LGJ-300/35', main_transformer: 'SZ11-150000/110',
      }),
      created_at: now, updated_at: now,
    },
  ])

  // ==================== 设备综合造价库 ====================
  // 每个模型类型对应一条造价评估数据
  await knex('pv_cost_library').whereNull('model_type_id').del()
  await knex('pv_cost_library').insert([
    { id: uuid(), model_name: '集中式光伏电站综合造价', model_type: 'comprehensive', manufacturer: null, unit_cost_per_kw: 3800, rated_power_kw: 50000, efficiency_pct: null, lifespan_years: 25, technical_params: null, remark: '大型地面电站典型造价', model_type_id: typeCentralized, installed_capacity_kw: 50000, comprehensive_cost: 19000, created_at: now },
    { id: uuid(), model_name: '光储联合电站综合造价', model_type: 'comprehensive', manufacturer: null, unit_cost_per_kw: 5200, rated_power_kw: 100000, efficiency_pct: null, lifespan_years: 25, technical_params: null, remark: '含储能系统配套造价', model_type_id: typePvStorage, installed_capacity_kw: 100000, comprehensive_cost: 52000, created_at: now },
    { id: uuid(), model_name: '分布式光伏电站综合造价', model_type: 'comprehensive', manufacturer: null, unit_cost_per_kw: 3200, rated_power_kw: 500, efficiency_pct: null, lifespan_years: 25, technical_params: null, remark: '工商业屋顶典型造价', model_type_id: typeDistributed, installed_capacity_kw: 500, comprehensive_cost: 160, created_at: now },
    { id: uuid(), model_name: '农光互补电站综合造价', model_type: 'comprehensive', manufacturer: null, unit_cost_per_kw: 4500, rated_power_kw: 20000, efficiency_pct: null, lifespan_years: 25, technical_params: null, remark: '农业大棚+光伏复合造价', model_type_id: typeAgriPv, installed_capacity_kw: 20000, comprehensive_cost: 9000, created_at: now },
    { id: uuid(), model_name: '水面光伏电站综合造价', model_type: 'comprehensive', manufacturer: null, unit_cost_per_kw: 4800, rated_power_kw: 30000, efficiency_pct: null, lifespan_years: 25, technical_params: null, remark: '浮体+锚固系统造价偏高', model_type_id: typeFloatingPv, installed_capacity_kw: 30000, comprehensive_cost: 14400, created_at: now },
  ])
}
