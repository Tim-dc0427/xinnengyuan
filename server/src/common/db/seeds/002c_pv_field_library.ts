import type { Knex } from 'knex'
import { v4 as uuid } from 'uuid'

type Category = '基础信息' | '电气参数' | '地理坐标' | '土地属性' | '设备台账'

const F: Array<{ code: string; name: string; type: string; cat: Category; opts?: string }> = [
  // ==================== 一、基础信息 ====================
  { code: 'station_code', name: '电站唯一编码', type: 'text', cat: '基础信息' },
  { code: 'station_name', name: '电站名称', type: 'text', cat: '基础信息' },
  { code: 'project_no', name: '项目立项编号', type: 'text', cat: '基础信息' },
  { code: 'project_status', name: '项目状态', type: 'select', cat: '基础信息', opts: JSON.stringify(['在建', '并网运行', '停运检修', '报废', '暂缓建设']) },
  { code: 'owner_company', name: '业主单位', type: 'text', cat: '基础信息' },
  { code: 'operate_company', name: '运维单位', type: 'text', cat: '基础信息' },
  { code: 'area_adm', name: '所属行政区域', type: 'text', cat: '基础信息' },
  { code: 'grid_connect_time', name: '并网时间', type: 'date', cat: '基础信息' },
  { code: 'run_time', name: '投运时间', type: 'date', cat: '基础信息' },

  // ==================== 二、电气参数 ====================
  { code: 'total_capacity', name: '总装机容量(MWp)', type: 'number', cat: '电气参数' },
  { code: 'grid_voltage', name: '并网电压等级', type: 'select', cat: '电气参数', opts: JSON.stringify(['10kV', '35kV', '110kV', '220kV']) },
  { code: 'grid_mode', name: '并网方式', type: 'select', cat: '电气参数', opts: JSON.stringify(['单点并网', '多点并网', '专线并网']) },
  { code: 'grid_point_name', name: '并网点名称', type: 'text', cat: '电气参数' },
  { code: 'grid_point_no', name: '并网点编号', type: 'text', cat: '电气参数' },
  { code: 'substation_name', name: '所属送出变电站', type: 'text', cat: '电气参数' },
  { code: 'dispatch_type', name: '电网调度归属', type: 'select', cat: '电气参数', opts: JSON.stringify(['地市调度', '省级调度']) },
  { code: 'line_no', name: '送出线路编号', type: 'text', cat: '电气参数' },
  { code: 'use_hour', name: '等效利用小时数(h)', type: 'number', cat: '电气参数' },
  { code: 'theory_power', name: '理论年发电量(kWh)', type: 'number', cat: '电气参数' },
  { code: 'reactive_cap', name: '无功补偿容量(Mvar)', type: 'number', cat: '电气参数' },
  { code: 'energy_storage', name: '配套储能配置', type: 'select', cat: '电气参数', opts: JSON.stringify(['无储能', '配储能']) },
  { code: 'storage_param', name: '储能额定容量(MW/MWh)', type: 'text', cat: '电气参数' },
  { code: 'circuit_mode', name: '系统接线方式', type: 'select', cat: '电气参数', opts: JSON.stringify(['放射式', '环网式']) },
  { code: 'power_factor', name: '额定功率因数', type: 'number', cat: '电气参数' },
  { code: 'storage_capacity_kwh', name: '储能容量(kWh)', type: 'number', cat: '电气参数' },
  { code: 'storage_power_kw', name: '储能功率(kW)', type: 'number', cat: '电气参数' },
  { code: 'storage_type', name: '储能类型', type: 'select', cat: '电气参数', opts: JSON.stringify(['磷酸铁锂', '钠离子', '液流', '铅酸']) },
  { code: 'charge_discharge_hours', name: '充放电时长(h)', type: 'number', cat: '电气参数' },
  { code: 'application_scenario', name: '应用场景', type: 'select', cat: '电气参数', opts: JSON.stringify(['削峰填谷', '调频辅助', '备用电源', '微电网']) },
  { code: 'conn_mode', name: '并网模式', type: 'select', cat: '电气参数', opts: JSON.stringify(['全额上网', '自发自用余电上网', '全部自用']) },
  { code: 'owner_type', name: '业主类型', type: 'select', cat: '电气参数', opts: JSON.stringify(['工商业', '户用', '公共机构', '农业']) },

  // ==================== 三、地理坐标 ====================
  { code: 'geo_coordinate', name: '坐标系类型', type: 'select', cat: '地理坐标', opts: JSON.stringify(['WGS84', 'GCJ02', '北京54', '西安80']) },
  { code: 'center_lon', name: '电站中心点经度', type: 'number', cat: '地理坐标' },
  { code: 'center_lat', name: '电站中心点纬度', type: 'number', cat: '地理坐标' },
  { code: 'terrain_type', name: '地形类型', type: 'select', cat: '地理坐标', opts: JSON.stringify(['平原', '丘陵', '山地', '滩涂', '水面', '戈壁']) },
  { code: 'altitude', name: '海拔高度(m)', type: 'number', cat: '地理坐标' },
  { code: 'border_point', name: '地块四至坐标', type: 'text', cat: '地理坐标' },
  { code: 'array_angle', name: '方阵平均倾角(°)', type: 'number', cat: '地理坐标' },
  { code: 'array_azimuth', name: '方阵方位角', type: 'select', cat: '地理坐标', opts: JSON.stringify(['朝南', '朝东南', '朝西南', '朝北']) },
  { code: 'radiation', name: '年均太阳辐照量(MJ/㎡)', type: 'number', cat: '地理坐标' },
  { code: 'crop_type', name: '种植/养殖类型', type: 'select', cat: '地理坐标', opts: JSON.stringify(['蔬菜大棚', '牧草', '中草药', '水产养殖', '食用菌']) },
  { code: 'panel_height_m', name: '组件离地高度(m)', type: 'number', cat: '地理坐标' },
  { code: 'light_transmittance_pct', name: '透光率(%)', type: 'number', cat: '地理坐标' },
  { code: 'irrigation_type', name: '灌溉方式', type: 'select', cat: '地理坐标', opts: JSON.stringify(['滴灌', '喷灌', '漫灌', '无']) },
  { code: 'water_body_type', name: '水体类型', type: 'select', cat: '地理坐标', opts: JSON.stringify(['水库', '湖泊', '鱼塘', '采煤沉陷区', '工业水池']) },
  { code: 'water_area_mu', name: '水域面积(亩)', type: 'number', cat: '地理坐标' },
  { code: 'water_depth_m', name: '水深(m)', type: 'number', cat: '地理坐标' },
  { code: 'floating_platform_type', name: '浮体平台类型', type: 'select', cat: '地理坐标', opts: JSON.stringify(['HDPE浮体', '钢浮筒', '混凝土浮台']) },
  { code: 'anchoring_type', name: '锚固方式', type: 'select', cat: '地理坐标', opts: JSON.stringify(['岸边锚固', '水下锚固', '桩基固定']) },
  { code: 'corrosion_protection_level', name: '防腐等级', type: 'select', cat: '地理坐标', opts: JSON.stringify(['C3', 'C4', 'C5', 'CX']) },

  // ==================== 四、土地属性 ====================
  { code: 'total_land_area', name: '总用地面积(亩)', type: 'number', cat: '土地属性' },
  { code: 'land_type_main', name: '用地大类', type: 'select', cat: '土地属性', opts: JSON.stringify(['农用地', '建设用地', '未利用地', '水域', '林地']) },
  { code: 'land_type_sub', name: '用地细分类型', type: 'select', cat: '土地属性', opts: JSON.stringify(['旱地', '荒坡', '鱼塘', '滩涂', '戈壁', '林地', '一般农田']) },
  { code: 'land_owner', name: '土地权属方', type: 'select', cat: '土地属性', opts: JSON.stringify(['国有', '村集体', '个人']) },
  { code: 'land_transfer_mode', name: '土地流转方式', type: 'select', cat: '土地属性', opts: JSON.stringify(['租赁', '承包', '划拨', '出让']) },
  { code: 'is_basic_farmland', name: '是否占用基本农田', type: 'select', cat: '土地属性', opts: JSON.stringify(['是', '否']) },
  { code: 'is_ecology_line', name: '是否触碰生态红线', type: 'select', cat: '土地属性', opts: JSON.stringify(['是', '否']) },
  { code: 'land_start_date', name: '流转开始日期', type: 'date', cat: '土地属性' },
  { code: 'land_end_date', name: '流转结束日期', type: 'date', cat: '土地属性' },
  { code: 'land_rent', name: '年土地租金(元/亩)', type: 'number', cat: '土地属性' },
  { code: 'land_contract_no', name: '土地合同编号', type: 'text', cat: '土地属性' },
  { code: 'forest_approval', name: '林地使用审批', type: 'select', cat: '土地属性', opts: JSON.stringify(['无需审批', '已审批', '待审批']) },
  { code: 'land_approval_no', name: '用地预审编号', type: 'text', cat: '土地属性' },
  { code: 'water_conservation_no', name: '水土保持批复编号', type: 'text', cat: '土地属性' },
  { code: 'land_reclaim', name: '到期土地复垦要求', type: 'select', cat: '土地属性', opts: JSON.stringify(['无需复垦', '按标准复垦', '原地恢复植被']) },

  // ==================== 五、设备台账 ====================
  { code: 'module_model', name: '光伏组件型号', type: 'text', cat: '设备台账' },
  { code: 'module_power', name: '单块组件功率(Wp)', type: 'number', cat: '设备台账' },
  { code: 'module_total', name: '组件总数量', type: 'number', cat: '设备台账' },
  { code: 'module_factory', name: '组件生产厂家', type: 'text', cat: '设备台账' },
  { code: 'inverter_type', name: '逆变器类型', type: 'select', cat: '设备台账', opts: JSON.stringify(['组串式逆变器', '集中式逆变器']) },
  { code: 'inverter_model', name: '逆变器型号', type: 'text', cat: '设备台账' },
  { code: 'inverter_single_power', name: '单台逆变器功率(kW)', type: 'number', cat: '设备台账' },
  { code: 'inverter_total', name: '逆变器总台数', type: 'number', cat: '设备台账' },
  { code: 'box_transformer_num', name: '箱式变压器台数', type: 'number', cat: '设备台账' },
  { code: 'box_transformer_cap', name: '单台箱变容量(kVA)', type: 'number', cat: '设备台账' },
  { code: 'box_transformer_model', name: '箱变型号', type: 'text', cat: '设备台账' },
  { code: 'line_loop_num', name: '集电线路回路数', type: 'number', cat: '设备台账' },
  { code: 'line_model', name: '集电线路型号', type: 'text', cat: '设备台账' },
  { code: 'main_transformer', name: '升压站主变配置', type: 'text', cat: '设备台账' },
  { code: 'roof_area_sqm', name: '屋顶面积(㎡)', type: 'number', cat: '设备台账' },
  { code: 'roof_structure', name: '屋顶结构', type: 'select', cat: '设备台账', opts: JSON.stringify(['混凝土', '彩钢瓦', '钢结构']) },
  { code: 'building_age_years', name: '建筑年限(年)', type: 'number', cat: '设备台账' },
]

export async function seed(knex: Knex): Promise<void> {
  await knex('pv_field_library').del()

  const now = new Date().toISOString()

  await knex('pv_field_library').insert(
    F.map((f) => ({
      id: uuid(),
      field_code: f.code,
      field_name: f.name,
      field_type: f.type,
      field_options: f.opts || null,
      category: f.cat,
      created_at: now,
    })),
  )
}
