/**
 * 电网在线计算与分析平台 - 需求规格说明书 Word文档生成脚本
 * 使用 docx 库生成 .docx 格式，输出到用户桌面
 */
const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, PageBreak,
  TableOfContents, ShadingType, convertInchesToTwip
} = require('docx')

// ==================== 辅助函数 ====================

/** 创建标题段落 */
function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ heading: level, children: [new TextRun({ text, bold: true, font: 'Microsoft YaHei' })] })
}

/** 创建正文段落 */
function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, line: 360 },
    ...opts,
    children: [new TextRun({ text, font: 'Microsoft YaHei', size: 21, ...opts })]
  })
}

/** 创建加粗标签+内容段落 */
function fieldPara(label, value) {
  return new Paragraph({
    spacing: { after: 80, line: 360 },
    children: [
      new TextRun({ text: label, bold: true, font: 'Microsoft YaHei', size: 21 }),
      new TextRun({ text: value, font: 'Microsoft YaHei', size: 21 })
    ]
  })
}

/** 创建表格 */
function createTable(headers, rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(h => new TableCell({
      shading: { type: ShadingType.SOLID, color: 'D9D9D9' },
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, font: 'Microsoft YaHei', size: 18 })] })]
    }))
  })
  const dataRows = rows.map(row => new TableRow({
    children: row.map(cell => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: String(cell), font: 'Microsoft YaHei', size: 18 })] })]
    }))
  }))
  return new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } })
}

/** 功能点条目：路由+权限+背景+描述+输入+输出+API+数据表 */
function featureBlock({ title, route, roles, background, description, inputs, outputs, apis, tables }) {
  const children = []
  children.push(heading(title, HeadingLevel.HEADING_3))
  children.push(fieldPara('路由路径：', route))
  children.push(fieldPara('访问权限：', roles))
  children.push(fieldPara('业务背景：', background))

  children.push(new Paragraph({
    spacing: { before: 80, after: 60 },
    children: [new TextRun({ text: '功能描述：', bold: true, font: 'Microsoft YaHei', size: 21 })]
  }))
  if (Array.isArray(description)) {
    description.forEach(d => children.push(para(`  • ${d}`)))
  } else {
    children.push(para(`  ${description}`))
  }

  if (inputs) children.push(fieldPara('输入参数：', Array.isArray(inputs) ? inputs.join('；') : inputs))
  if (outputs) children.push(fieldPara('输出结果：', Array.isArray(outputs) ? outputs.join('；') : outputs))
  if (apis && apis.length) {
    children.push(new Paragraph({
      spacing: { before: 80, after: 60 },
      children: [new TextRun({ text: '关联API：', bold: true, font: 'Microsoft YaHei', size: 21 })]
    }))
    apis.forEach(a => children.push(para(`  ${a}`)))
  }
  if (tables) {
    const tbl = Array.isArray(tables) ? tables.join('、') : tables
    children.push(fieldPara('关联数据表：', tbl))
  }
  children.push(new Paragraph({ spacing: { after: 200 }, children: [] }))
  return children
}

// ==================== 功能模块数据定义 ====================

/** 模块2.1：电网诊断 - 发电情况 */
const module211 = {
  title: '2.1 发电情况',
  features: [
    {
      title: '2.1.1 发电量统计分析',
      route: '/grid-diagnosis/power-generation/stats',
      roles: 'admin、planner、operator、viewer',
      background: '集中式光伏电站的发电量是电网运行的核心指标，运营人员需要掌握各电站的发电量数据，按区域、电压等级、时间维度进行多维度统计分析，为电网调度和运行决策提供数据支撑。',
      description: [
        '按电站、区域（zone）、电压等级（voltageLevel）等多维度筛选查询发电量数据',
        '支持同比（去年同期）和环比（上月）对比分析，自动计算变化率',
        '以柱状图、折线图等图表形式展示发电量趋势，支持按日/月/年粒度切换',
        '展示各电站的实时出力快照数据（最近一条非零功率记录），包含功率方向和是否倒送标记',
        '支持数据导出为Excel格式'
      ],
      inputs: '查询条件：电站名称、所属区域、电压等级、时间范围（起止日期）、统计粒度（日/月/年）',
      outputs: '发电量统计图表（柱状图/折线图）、发电量汇总表、同比/环比变化率、电站出力快照列表',
      apis: [
        'GET /api/v1/grid-diagnosis/pv-output/stats - 发电量统计数据',
        'GET /api/v1/grid-diagnosis/stations - 电站列表',
        'GET /api/v1/grid-diagnosis/stations/snapshot - 电站实时快照'
      ],
      tables: 'solar_pv_stations、pv_output_measurements、grid_buses'
    },
    {
      title: '2.1.2 出力影响因素分析',
      route: '/grid-diagnosis/power-generation/factors',
      roles: 'admin、planner、operator、viewer',
      background: '光伏出力受辐照度、温度、湿度、逆变器效率、设备年限等多种因素影响，量化各因素的影响程度有助于精准预测光伏发电能力，为调度计划和设备维护提供依据。',
      description: [
        '计算各影响因素（辐照度、温度、湿度、逆变器效率、设备使用年限）与光伏出力的Pearson相关系数',
        '以散点图和相关系数矩阵展示各因素与出力的相关性强弱',
        '支持按电站和时间范围筛选分析范围',
        '展示各影响因素的统计摘要（均值、标准差、最大/最小值）'
      ],
      inputs: '查询条件：电站名称（可选，不选则分析全部）、时间范围',
      outputs: '各影响因素Pearson相关系数表、散点图矩阵、统计摘要数据',
      apis: ['GET /api/v1/grid-diagnosis/pv-output/factors - 出力影响因素分析'],
      tables: 'pv_output_measurements（irradiance_wm2、temperature_c、humidity_pct、inverter_efficiency字段）'
    },
    {
      title: '2.1.3 极端场景模拟分析',
      route: '/grid-diagnosis/power-generation/extreme',
      roles: 'admin、planner',
      background: '极端天气（如高温、暴雨）会导致光伏出力大幅波动，影响电网安全稳定运行。需要模拟极端气象条件下的光伏出力变化，评估其对电网的冲击影响。',
      description: [
        '选择极端场景类型（高温场景、暴雨场景），设置气象参数（温度、辐照度等）',
        '系统基于光伏出力模型模拟极端条件下的发电量变化',
        '生成模拟报告，包含出力曲线对比（正常vs极端）、电压波动评估、设备过载风险',
        '支持导出模拟报告为Word或PDF格式'
      ],
      inputs: '极端场景类型（高温/暴雨）、模拟参数（温度值、辐照度值、持续时间）、目标电站',
      outputs: '极端场景模拟结果（出力曲线对比、电压波动数据、设备风险列表）、可导出Word/PDF报告',
      apis: [
        'POST /api/v1/grid-diagnosis/pv-output/simulate-extreme - 执行极端场景模拟',
        'POST /api/v1/grid-diagnosis/pv-output/simulate-extreme/export - 导出模拟报告'
      ],
      tables: 'pv_output_measurements、solar_pv_stations'
    },
    {
      title: '2.1.4 碳排放量统计分析',
      route: '/grid-diagnosis/power-generation/carbon',
      roles: 'admin、planner、operator、viewer',
      background: '光伏发电替代化石能源发电可减少碳排放，量化碳排放减少量是评估光伏项目环境效益的关键依据，也是碳交易和ESG报告的重要数据来源。',
      description: [
        '按电站、时间段查询碳排放统计数据，包含CO₂减排量、节约标煤量、SO₂减排量、NOx减排量',
        '展示碳排放动态变化曲线，支持日/月/年粒度切换',
        '提供累计减排量汇总和趋势预测',
        '支持多电站横向对比分析'
      ],
      inputs: '查询条件：电站名称、时间范围、统计粒度（日/月/年）',
      outputs: '碳排放统计图表、CO₂/标煤/SO₂/NOx减排量汇总表、减排趋势曲线、电站对比图',
      apis: [
        'GET /api/v1/grid-diagnosis/carbon/stats - 碳排放统计',
        'GET /api/v1/grid-diagnosis/carbon/dynamic - 碳排放动态数据'
      ],
      tables: 'carbon_emissions、pv_output_measurements'
    },
    {
      title: '2.1.5 光储联合出力分析',
      route: '/grid-diagnosis/power-generation/joint',
      roles: 'admin、planner、operator、viewer',
      background: '光伏+储能联合运行是提升新能源消纳能力的重要手段，需要分析光储联合出力的时序特性、储能充放电策略对出力的平滑效果，为储能配置优化提供决策支持。',
      description: [
        '展示光伏+储能联合出力时序曲线，分别展示光伏出力、储能充放电功率、联合出力',
        '分析储能对光伏出力波动的平滑效果（波动率对比）',
        '统计储能充放电次数、充放电量、SOC变化范围',
        '支持按日期和电站筛选'
      ],
      inputs: '查询条件：电站名称（含储能配置）、日期范围',
      outputs: '联合出力时序曲线、波动率对比图、储能运行统计表（充放电次数/电量/SOC范围）',
      apis: ['GET /api/v1/grid-diagnosis/joint-output/analysis - 光储联合出力分析'],
      tables: 'pv_output_measurements、storage_entities'
    }
  ]
}

/** 模块2.2：电网诊断 - 网架结构 */
const module212 = {
  title: '2.2 网架结构',
  features: [
    {
      title: '2.2.1 光伏倒送场景判断',
      route: '/grid-diagnosis/grid-structure/backfeed',
      roles: 'admin、planner、operator、viewer',
      background: '光伏出力大于本地负荷时会产生功率倒送，可能导致上级电网电压越限、保护误动等问题。需要快速识别倒送场景并评估其严重程度。',
      description: [
        '根据各电站实时出力和所在馈线负荷数据，判断是否存在功率倒送',
        '计算倒送功率大小和倒送比例（倒送功率/光伏出力×100%）',
        '以拓扑图方式标注倒送节点和潮流方向',
        '按严重程度分级展示倒送告警（轻微/中等/严重）',
        '支持设置倒送检测阈值参数'
      ],
      inputs: '检测条件：目标区域/馈线、检测时间点、倒送阈值（可选）',
      outputs: '倒送检测结果列表（电站名、倒送功率、倒送比例、严重等级）、拓扑标注图',
      apis: ['POST /api/v1/grid-diagnosis/backfeed/detect - 光伏倒送检测'],
      tables: 'pv_output_measurements、grid_loads、grid_branches、grid_buses'
    },
    {
      title: '2.2.2 设备承载力量化计算',
      route: '/grid-diagnosis/grid-structure/capacity',
      roles: 'admin、planner、operator、viewer',
      background: '变压器、线路等电网设备有最大承载容量限制，光伏接入后潮流变化可能导致设备超载。需要实时评估各设备的负载率，识别过载风险。',
      description: [
        '计算各设备（变压器、线路）的当前负载率（实际传输功率/额定容量×100%）',
        '按负载率分级展示：正常（<80%）、预警（80%~95%）、过载（>95%）',
        '以列表和拓扑图两种方式展示设备承载情况',
        '支持按区域、电压等级、设备类型筛选',
        '提供设备负载率历史趋势曲线'
      ],
      inputs: '查询条件：区域、电压等级、设备类型（变压器/线路）',
      outputs: '设备承载力列表（设备名、额定容量、实际负载、负载率、状态）、拓扑着色图、负载率趋势图',
      apis: ['GET /api/v1/grid-diagnosis/equipment/capacity - 设备承载力量化计算'],
      tables: 'grid_branches、grid_buses、grid_loads、grid_generators、equipment'
    },
    {
      title: '2.2.3 设备可靠性评估',
      route: '/grid-diagnosis/grid-structure/reliability',
      roles: 'admin、planner、operator、viewer',
      background: '电网设备的可靠性直接影响供电连续性和安全性，需要基于设备运行数据、故障记录等对设备可靠性进行定量评估。',
      description: [
        '查询指定设备的可靠性指标，包含故障率、平均修复时间（MTTR）、平均无故障时间（MTBF）',
        '展示设备健康度评分和风险等级',
        '列出设备历史故障记录和维护记录',
        '基于可靠性数据给出设备运维建议'
      ],
      inputs: '设备ID',
      outputs: '可靠性评估报告（故障率、MTTR、MTBF、健康度评分、风险等级）、历史故障列表、运维建议',
      apis: ['GET /api/v1/grid-diagnosis/equipment/reliability/:id - 设备可靠性评估'],
      tables: 'equipment、equipment_lifecycle、equipment_lifecycle_records、alerts'
    },
    {
      title: '2.2.4 设备寿命周期管理',
      route: '/grid-diagnosis/grid-structure/lifecycle',
      roles: 'admin、planner、operator、viewer',
      background: '电网设备有设计寿命和使用寿命，需要跟踪设备从投运到退役的全生命周期状态，预测剩余寿命，制定更换计划，避免因设备老化导致的故障和事故。',
      description: [
        '查询设备全生命周期信息：投运日期、设计寿命、已使用年限、剩余寿命预估',
        '基于设备运行数据（温度、负载率、环境条件）进行寿命预测',
        '生成设备更换优先级计划，按剩余寿命和重要性排序',
        '展示设备生命周期事件时间线（安装、维护、大修、故障等）',
        '支持导出设备更换计划'
      ],
      inputs: '设备ID、寿命预测参数（可选：温度系数、负载系数等）',
      outputs: '设备生命周期概览、剩余寿命预测值、更换计划表（按优先级排序）、生命周期事件时间线',
      apis: [
        'GET /api/v1/grid-diagnosis/equipment/lifecycle/:id - 设备生命周期数据',
        'POST /api/v1/grid-diagnosis/equipment/lifecycle/predict - 设备寿命预测',
        'POST /api/v1/grid-diagnosis/equipment/lifecycle/replacement-plan - 生成更换计划'
      ],
      tables: 'equipment、equipment_lifecycle、equipment_lifecycle_records、equipment_temperature'
    }
  ]
}

/** 模块2.3：电网诊断 - 供电质量 */
const module213 = {
  title: '2.3 供电质量',
  features: [
    {
      title: '2.3.1 并网点电压波动监测',
      route: '/grid-diagnosis/power-quality/fluctuation',
      roles: 'admin、planner、operator、viewer',
      background: '光伏出力间歇性和波动性会导致并网点电压波动，超标会影响用户设备正常运行。需要实时监测电压波动情况，及时发现和定位问题。',
      description: [
        '实时监测各并网点的电压波动数据，包含各相电压值（A/B/C相）和电压偏差百分比',
        '以时序曲线展示电压波动趋势，标注电压越限区间',
        '按区域、电压等级、母线筛选监测范围',
        '自动计算电压闪变严重度和总谐波畸变率（THD）',
        '电压波动超限时自动触发告警'
      ],
      inputs: '查询条件：区域、电压等级、母线、时间范围',
      outputs: '电压波动时序曲线、电压偏差统计表、闪变/THD指标、越限告警列表',
      apis: [
        'GET /api/v1/grid-diagnosis/power-quality/voltage-fluctuation - 电压波动监测',
        'GET /api/v1/grid-diagnosis/voltage/fluctuation - 电压波动（旧版）'
      ],
      tables: 'voltage_measurements、grid_buses'
    },
    {
      title: '2.3.2 供电可靠性计算',
      route: '/grid-diagnosis/power-quality/reliability',
      roles: 'admin、planner、operator、viewer',
      background: '供电可靠性是衡量电网服务质量的核心指标，通常用供电可靠率（ASAI）、用户平均停电时间（SAIDI）等指标衡量，是电网规划和改造的重要依据。',
      description: [
        '计算供电可靠性指标：供电可靠率（ASAI）、用户平均停电时间（SAIDI）、用户平均停电频率（SAIFI）',
        '按区域、时间范围统计停电事件和停电时长',
        '展示可靠性指标历史趋势曲线',
        '与国家标准和行业平均水平进行对标分析'
      ],
      inputs: '查询条件：区域、时间范围（通常按年统计）',
      outputs: '供电可靠性指标（ASAI/SAIDI/SAIFI）、停电统计表、趋势曲线、对标分析图',
      apis: ['GET /api/v1/grid-diagnosis/power-quality/reliability - 供电可靠性计算'],
      tables: 'outage_events、grid_buses'
    },
    {
      title: '2.3.3 电压合格率统计',
      route: '/grid-diagnosis/power-quality/qualification',
      roles: 'admin、planner、operator、viewer',
      background: '电压合格率是衡量供电质量的核心指标，需按国标（电压偏差±7%为合格）统计各监测点的电压合格率，作为电网运行考核依据。',
      description: [
        '按监测点、区域、时间范围统计电压合格率',
        '自动判定电压是否合格（基于配置的电压偏差阈值）',
        '以柱状图展示各监测点合格率排名',
        '支持合格率趋势分析（按月/季度/年）',
        '展示不合格明细记录'
      ],
      inputs: '查询条件：区域、监测点、时间范围、合格率阈值（默认±7%）',
      outputs: '电压合格率统计表、合格率排名图、趋势曲线、不合格明细列表',
      apis: ['GET /api/v1/grid-diagnosis/power-quality/qualification-rate - 电压合格率统计'],
      tables: 'voltage_measurements、grid_buses'
    },
    {
      title: '2.3.4 供电质量预警机制',
      route: '/grid-diagnosis/power-quality/alerts',
      roles: 'admin、planner、operator、viewer',
      background: '需要建立供电质量预警机制，当电压偏差、三相不平衡、频率偏差等指标超出阈值时自动生成告警，支持告警的确认和处理流程。',
      description: [
        '展示所有供电质量相关的告警列表，包含告警等级、来源、标题、触发时间',
        '支持按告警等级（严重/警告/提示）、来源类型、时间范围筛选',
        '查看告警详情，包含触发指标、当前值、阈值、关联设备/母线',
        '支持告警确认（acknowledge）操作，记录确认人和确认时间',
        '告警自动关联到具体的质量指标超标事件'
      ],
      inputs: '筛选条件：告警等级、来源类型、时间范围、处理状态',
      outputs: '告警列表（等级/来源/标题/触发时间/处理状态）、告警详情面板',
      apis: [
        'GET /api/v1/grid-diagnosis/alerts - 预警列表',
        'POST /api/v1/grid-diagnosis/alerts/:id/acknowledge - 确认预警'
      ],
      tables: 'alerts'
    },
    {
      title: '2.3.5 历史事件追溯分析',
      route: '/grid-diagnosis/power-quality/event-trace',
      roles: 'admin、planner、operator、viewer',
      background: '当发生供电质量问题时，需要回溯事件发生前后的数据变化，追溯根本原因，形成事件分析报告。',
      description: [
        '通过事件ID追溯完整的事件链：触发指标变化→关联设备状态变化→保护动作→最终影响',
        '展示事件时间线，标注关键时间节点和数据变化',
        '关联展示事件前后的电压、电流、功率等时序数据',
        '支持导出事件分析报告'
      ],
      inputs: '事件ID',
      outputs: '事件时间线、事件前后时序数据图表、关联设备状态变化、事件分析报告',
      apis: ['GET /api/v1/grid-diagnosis/events/:id/trace - 事件追溯'],
      tables: 'alerts、voltage_measurements、pv_output_measurements、audit_logs'
    },
    {
      title: '2.3.6 电压波动影响分析',
      route: '/grid-diagnosis/power-quality/impact',
      roles: 'admin、planner、operator、viewer',
      background: '电压波动会影响接入同一母线的所有设备，需要分析电压波动的波及范围和对关联设备的影响程度，为制定电压调控策略提供依据。',
      description: [
        '分析某母线的电压波动对关联设备的影响程度',
        '展示电压热点分布图，标注电压偏高/偏低区域',
        '统计用户投诉与电压波动的相关性',
        '评估设备受电压波动影响的故障概率',
        '展示设备事件关联分析'
      ],
      inputs: '查询条件：母线/区域、时间范围、分析类型（设备影响/热点分布/投诉关联）',
      outputs: '设备影响分析报告、电压热点分布图、投诉统计图表、设备事件列表',
      apis: [
        'GET /api/v1/grid-diagnosis/power-quality/equipment-impact - 设备影响分析',
        'GET /api/v1/grid-diagnosis/power-quality/hotspot-distribution - 热点分布',
        'GET /api/v1/grid-diagnosis/power-quality/complaint-stats - 投诉统计',
        'GET /api/v1/grid-diagnosis/power-quality/equipment-events - 设备事件'
      ],
      tables: 'voltage_measurements、equipment、complaint_stats、equipment_lifecycle_records'
    }
  ]
}

/** 模块3：配电网规划 */
const module3 = {
  title: '3 配电网规划',
  features: [
    {
      title: '3.1.1 集中式光伏模型集成',
      route: '/planning/distribution/pv-model',
      roles: 'admin、planner',
      background: '不同类型光伏电站（单晶硅、多晶硅、薄膜、双面等）的技术参数差异较大，需要建立标准化的光伏模型类型体系，支持自定义字段扩展，为规划方案提供准确的设备参数基础。',
      description: [
        '管理光伏模型类型（pv_model_types），定义每种模型的名称、编码、描述',
        '为每种模型类型配置自定义字段（fieldCode/fieldName/fieldType/fieldOptions/isRequired），字段支持文本、数字、下拉选项、日期等类型',
        '管理字段库（pv_field_library），支持字段复用和搜索',
        '光伏电站创建时关联模型类型，自动生成对应的参数录入表单',
        '管理光伏造价库（pv_cost_library），按模型类型录入单位造价、效率、寿命等经济参数'
      ],
      inputs: '模型类型信息（名称/编码/描述/排序）、字段定义（字段编码/名称/类型/是否必填/分类）、造价信息（型号/制造商/单位造价/额定功率/效率/寿命）',
      outputs: '模型类型列表、字段配置表单、造价库列表',
      apis: [
        'GET/POST/PUT/DELETE /api/v1/planning/pv-model-types - 光伏模型类型CRUD',
        'GET/POST /api/v1/planning/pv-model-types/:id/fields - 模型类型字段管理',
        'GET/POST/DELETE /api/v1/planning/field-library - 字段库管理',
        'GET/POST /api/v1/planning/pv-cost-library - 造价库管理'
      ],
      tables: 'pv_model_types、pv_model_type_fields、pv_field_library、pv_cost_library、pv_stations'
    },
    {
      title: '3.1.2 布点规划智能推荐',
      route: '/planning/distribution/site-planning',
      roles: 'admin、planner',
      background: '光伏电站选址需要综合考虑太阳能资源、电网接入条件、土地条件、环境影响等多因素。系统基于GIS数据和约束条件，智能推荐最优布点方案。',
      description: [
        '展示潜在站点列表（12个余杭区预设站点），包含经纬度、土地类型、面积等基本信息',
        '配置约束规则（辐照度下限、最大接入距离、土地类型限制、等效小时下限、最大坡度等）',
        '执行空间分析，基于约束条件筛选候选站点',
        '对候选站点进行综合评价（消纳能力评分、送出通道评分、经济性评分），生成综合得分和推荐容量',
        '在地图上可视化展示候选站点分布及评分',
        '管理接入点资源库，包含年辐照度、日照小时、太阳能等级、短路容量、走廊可用性、输电线路长度等属性'
      ],
      inputs: '约束条件（辐照度下限、最大距离、土地类型、等效小时、最大坡度）、目标规划方案ID',
      outputs: '候选站点列表（坐标/推荐容量/综合评分/分项评分）、地图可视化、站点详情',
      apis: [
        'GET /api/v1/planning/potential-sites - 潜在站点列表',
        'GET /api/v1/planning/constraint-rules - 约束规则列表',
        'POST /api/v1/planning/constraint-rules - 保存约束规则',
        'POST /api/v1/planning/spatial-analysis - 空间分析',
        'GET /api/v1/planning/candidate-points - 候选点位',
        'GET /api/v1/planning/evaluate - 综合评价',
        'GET/POST/PUT /api/v1/planning/access-points - 接入点管理'
      ],
      tables: 'constraint_rules、candidate_points、potential_sites、access_point_resources、site_recommendations'
    },
    {
      title: '3.1.3 约束条件配置',
      route: '/planning/distribution/constraint-settings',
      roles: 'admin、planner',
      background: '配电网规划需遵循多项技术约束（电压偏差、设备容量、短路容量、N-1准则等），需要统一管理约束规则，作为规划方案自动校验的依据。',
      description: [
        '管理约束规则列表，每条规则包含名称、类型、权重、启用状态、参数配置',
        '支持多种约束类型：电压偏差约束、设备负载率约束、短路容量约束、N-1安全约束、消纳能力约束、送出通道约束',
        '配置每条约束的阈值参数（如电压偏差上限/下限百分比）',
        '设置约束权重，用于综合评价时的加权计算',
        '约束规则与规划方案关联，不同方案可使用不同约束配置'
      ],
      inputs: '约束规则列表（规则名称/类型/权重/启用状态/参数JSON）',
      outputs: '约束规则配置表、规则启用状态',
      apis: [
        'GET /api/v1/planning/constraint-rules - 约束规则列表',
        'POST /api/v1/planning/constraint-rules - 批量保存约束规则'
      ],
      tables: 'constraint_rules'
    },
    {
      title: '3.1.4 消纳方案智能编制',
      route: '/planning/distribution/absorption-scheme',
      roles: 'admin、planner',
      background: '光伏新能源接入后需要确保发电量能被电网消纳，需要编制消纳方案，包含储能配置、无功补偿、线路改造等配套措施，并进行投资测算。',
      description: [
        '基于候选站点生成消纳方案，自动计算24小时光伏出力曲线和负荷曲线',
        '自动推荐储能配置方案（储能容量、功率、充放电策略）',
        '自动推荐无功补偿配置（补偿容量、安装位置）',
        '评估线路改造需求（是否需要扩容、改造方案描述）',
        '计算消纳方案的预计投资成本和年收益',
        '支持多方案对比（创建变体方案），辅助方案优选',
        '展示消纳方案的可视化对比图表'
      ],
      inputs: '方案参数（候选站点ID、负荷数据、光伏出力预测）、储能配置偏好、无功补偿偏好',
      outputs: '消纳方案详情（24h出力/负荷曲线、储能配置、无功补偿、线路改造、投资测算）、方案对比表',
      apis: [
        'POST /api/v1/planning/absorption-plans - 生成消纳方案',
        'GET /api/v1/planning/absorption-plans/:id - 方案详情',
        'PUT /api/v1/planning/absorption-plans/:id - 更新方案',
        'GET/POST /api/v1/planning/absorption-plans/:id/variants - 方案变体管理'
      ],
      tables: 'absorption_plans、absorption_schemes、candidate_points'
    },
    {
      title: '3.1.5 造价管理与经济性分析',
      route: '/planning/distribution/cost-analysis',
      roles: 'admin、planner',
      background: '配电网规划需要考虑投资经济性，需要建立造价参数库，支持投资计算、造价对比和ROI分析，为投资决策提供量化依据。',
      description: [
        '管理造价参数库（cost_items），按类别（设备/建设/土地/其他）、子类别、设备类型组织',
        '管理单位造价参数（unit_cost_params），包含单价、单位、费用类型等',
        '配置投资方案（investment_plans），关联造价参数配置（investment_config）',
        '执行投资计算，基于配置项和容量计算四类费用（设备费/建设费/土地费/其他费）',
        '支持两个投资方案的造价对比分析',
        '执行ROI分析，计算NPV（净现值）、IRR（内部收益率）、投资回收期、逐年现金流',
        '以图表形式展示投资回报分析结果'
      ],
      inputs: '造价参数（类别/子类别/设备类型/型号规格/项目名称/单价）、投资方案配置、对比方案ID、ROI分析参数（折现率、运营年限）',
      outputs: '投资总额及分项费用表、造价对比图表、ROI分析报告（NPV/IRR/回收期/现金流表）',
      apis: [
        'GET/POST/PUT/DELETE /api/v1/planning/cost-items - 造价参数CRUD',
        'GET /api/v1/planning/unit-cost-params - 单价参数',
        'GET/POST/PUT/DELETE /api/v1/planning/investment-plans - 投资方案CRUD',
        'GET/POST /api/v1/planning/investment-config - 投资配置',
        'POST /api/v1/planning/calculate-investment - 投资计算',
        'POST /api/v1/planning/compare-cost - 造价对比',
        'POST /api/v1/planning/roi-analysis - ROI分析'
      ],
      tables: 'cost_items、unit_cost_params、investment_plans、investment_config、economic_analyses'
    },
    {
      title: '3.1.6 设备台账动态管理',
      route: '/planning/distribution/equipment-ledger',
      roles: 'admin、planner',
      background: '配电网规划中需要对设备进行台账管理，跟踪设备的型号、数量、安装信息、生命周期事件，为规划方案的设备选型和投资估算提供准确依据。',
      description: [
        '按规划方案和光伏电站维度管理设备台账',
        '新增/编辑/删除设备条目，包含设备类型、型号、制造商、额定参数、数量、安装日期等',
        '记录设备生命周期事件（设计/采购/调试/维护），包含事件类型、时间、操作人、描述',
        '查询设备生命周期时间线',
        '支持按电站查询关联设备'
      ],
      inputs: '设备信息（设备类型/型号/制造商/额定参数/数量/安装日期/位置）、生命周期事件（事件类型/时间/操作人/描述）',
      outputs: '设备台账列表、设备生命周期时间线、设备统计汇总',
      apis: [
        'GET /api/v1/planning/equipment-ledger/:planId - 设备台账',
        'GET /api/v1/planning/equipment-by-station/:stationId - 按电站查设备',
        'POST/PUT/DELETE /api/v1/planning/equipment-items - 设备条目CRUD',
        'POST /api/v1/planning/equipment-lifecycle - 创建生命周期记录',
        'GET /api/v1/planning/equipment-lifecycle/:equipmentId - 生命周期记录列表'
      ],
      tables: 'equipment_ledger、equipment_lifecycle_records、pv_stations'
    }
  ]
}

/** 模块4：成果管理 */
const module4 = {
  title: '4 成果管理',
  features: [
    {
      title: '4.1.1 光伏项目类型兼容',
      route: '/achievement/projects/type-mgmt',
      roles: 'admin、planner、operator、viewer',
      background: '光伏项目有多种类型（集中式/分布式/扶贫/领跑者等），不同类型项目的属性字段差异较大，需要建立灵活的项目类型体系，支持自定义字段扩展。',
      description: [
        '管理项目类型（project_types），定义每种类型的名称、编码、描述、排序',
        '为每种项目类型配置自定义字段（fieldCode/fieldName/fieldType/fieldOptions/isRequired），字段支持文本、数字、下拉选项、日期等类型',
        '管理项目字段库（project_field_library），支持字段的搜索和复用',
        '创建项目时根据项目类型自动加载对应的字段表单'
      ],
      inputs: '项目类型信息（名称/编码/描述/排序）、字段定义（字段编码/名称/类型/选项/是否必填/分类）',
      outputs: '项目类型列表、字段配置表单',
      apis: [
        'GET/POST/PUT/DELETE /api/v1/achievement/project-types - 项目类型CRUD',
        'GET /api/v1/achievement/project-types/with-fields - 所有类型+字段',
        'GET/POST /api/v1/achievement/project-types/:id/fields - 类型字段管理',
        'GET/POST/DELETE /api/v1/achievement/project-field-library - 字段库管理'
      ],
      tables: 'project_types、project_type_fields、project_field_library'
    },
    {
      title: '4.1.2 接入条件数字化管理',
      route: '/achievement/projects/access-conditions',
      roles: 'admin、planner、operator、viewer',
      background: '光伏项目并网需要满足多项接入条件，需要将接入条件数字化管理，记录各项条件的满足情况，为项目审批和并网验收提供依据。',
      description: [
        '为项目设置接入条件清单，每条包含条件类型、技术要求、实际值、是否满足',
        '管理条件计划（condition_plans），预设不同类型项目的接入条件模板',
        '管理接入点资源库（access_point_resources），包含详细的地理信息和电网参数',
        '支持接入点资源的批量导入',
        '条件满足/不满足状态一目了然'
      ],
      inputs: '接入条件（条件类型/技术要求/实际值/满足状态）、接入点信息（名称/区域/电压/辐照度/短路容量/线路长度等）',
      outputs: '接入条件清单、条件满足状态总览、接入点资源列表',
      apis: [
        'GET/POST /api/v1/achievement/projects/:id/access-conditions - 接入条件管理',
        'GET/POST/PUT/DELETE /api/v1/achievement/condition-plans - 条件计划CRUD',
        'GET/POST/PUT /api/v1/achievement/access-points - 接入点资源CRUD',
        'POST /api/v1/achievement/access-points/import - 批量导入接入点'
      ],
      tables: 'access_conditions、access_condition_plans、access_point_resources'
    },
    {
      title: '4.1.3 并网可行性综合分析',
      route: '/achievement/projects/feasibility',
      roles: 'admin、planner、operator、viewer',
      background: '光伏项目立项前需要进行全面的可行性评估，从资源条件、电网条件、投资条件、环境条件四个维度综合评分，为项目审批提供决策支持。',
      description: [
        '运行可行性评估，基于加权评分模型计算综合得分',
        '四个评估维度：资源条件（年辐照度、日照小时、太阳能等级，权重25%）、电网条件（电压等级、短路容量、接入距离，权重25%）、投资条件（单位造价、回收期、IRR，权重25%）、环境条件（土地类型、环境敏感性、地质灾害风险，权重25%）',
        '展示各维度得分和综合评分雷达图',
        '关联接入点数据自动填充评估参数',
        '支持重新运行评估和查看历史评估结果'
      ],
      inputs: '项目ID、评估参数（可选：接入点ID可自动填充）',
      outputs: '可行性评估报告（四维度评分、综合得分、评估结论）、雷达图',
      apis: [
        'POST /api/v1/achievement/projects/:id/feasibility - 运行可行性评估',
        'GET /api/v1/achievement/projects/:id/feasibility - 查看可行性结果'
      ],
      tables: 'feasibility_assessments、projects、access_point_resources'
    },
    {
      title: '4.1.4 项目成效验证评估',
      route: '/achievement/projects/effectiveness',
      roles: 'admin、planner、operator、viewer',
      background: '投运后的光伏项目需要定期验证实际运行效果是否达到规划设计目标，通过自动采集运行数据与计划值对比，判断项目是否达标，为后续项目提供经验反馈。',
      description: [
        '管理投运项目（operation_projects），关联实际光伏电站（solar_pv_stations）',
        '记录投运项目的计划指标：计划年发电量、计划等效小时数、计划消纳率、计划电压合格率',
        '创建成效验证记录，系统自动从pv_output_measurements聚合实际运行数据（发电量/等效小时/电压合格率/频率合格率/功率因数合格率/数据完整率）',
        '支持手动修正验证数据，填写修正说明',
        '自动判定是否达标：任一指标偏差>10%则标记为不达标',
        '支持多次验证记录，跟踪长期运行效果'
      ],
      inputs: '投运项目信息（项目编号/名称/电站关联/计划指标/投运日期）、验证周期（起止日期）、手动修正数据（可选）',
      outputs: '成效验证报告（计划vs实际对比、偏差率、达标判定）、验证历史列表',
      apis: [
        'GET/POST/PUT/DELETE /api/v1/achievement/operation-projects - 投运项目CRUD',
        'GET /api/v1/achievement/available-stations - 可选电站',
        'GET/POST /api/v1/achievement/operation-projects/:id/verifications - 成效验证管理',
        'PUT /api/v1/achievement/verifications/:id - 更新验证记录'
      ],
      tables: 'operation_projects、effectiveness_verifications、solar_pv_stations、pv_output_measurements'
    },
    {
      title: '4.1.5 项目留痕与追溯',
      route: '/achievement/projects/trace',
      roles: 'admin、planner、operator、viewer',
      background: '项目管理需要完整的审计追踪，记录项目状态变更、关键操作等历史记录，满足合规要求和内部审计需求。',
      description: [
        '查看项目的历史追溯记录（project_audit），包含操作动作、旧状态、新状态、备注、操作人、操作时间',
        '按时间线展示项目状态变更历史',
        '支持按操作类型和日期筛选追溯记录',
        '项目信息（基本信息、自定义字段、状态等）统一管理',
        '支持项目文档（project_documents）的上传和管理'
      ],
      inputs: '项目ID、筛选条件（操作类型、日期范围）',
      outputs: '项目审计时间线、状态变更记录列表',
      apis: [
        'GET /api/v1/achievement/projects/:id/trace - 历史追溯',
        'GET/POST/PUT /api/v1/achievement/projects - 项目管理',
        'GET/POST/DELETE /api/v1/achievement/projects/:id/documents - 项目文档管理'
      ],
      tables: 'project_audit、projects、project_documents'
    }
  ]
}

/** 模块5.1：潮流分析 - 指标概览 */
const module511 = {
  title: '5.1 指标概览',
  features: [
    {
      title: '5.1.1 综合概览',
      route: '/power-flow/indicators/overview',
      roles: 'admin、planner、operator、viewer',
      background: '需要一站式的电网运行指标总览，展示总网损、三相不平衡度、反向功率检测、节点电压合格率等核心指标，帮助运维人员快速掌握电网整体运行状态。',
      description: [
        '展示综合指标面板：总网损（kW）、三相不平衡度（%）、反向功率标志、节点电压合格率（%）',
        '底层调用牛顿-拉夫逊潮流计算实时求解，计算失败时回退到历史数据',
        '以仪表盘形式展示各项指标的当前值和状态（正常/预警/越限）',
        '支持按区域、电压等级筛选统计范围',
        '指标超限时以颜色区分（绿/黄/红）'
      ],
      inputs: '筛选条件：区域、电压等级',
      outputs: '综合指标仪表盘（网损/不平衡度/反向功率/电压合格率）、指标状态标识',
      apis: ['GET /api/v1/power-flow/indicators - 指标总览'],
      tables: 'calc_results、grid_buses、grid_branches'
    },
    {
      title: '5.1.2 节点电压稳定性',
      route: '/power-flow/indicators/voltage-stability',
      roles: 'admin、planner、operator、viewer',
      background: '节点电压稳定性是电网安全运行的基础，需要评估各母线的电压稳定裕度，识别电压薄弱节点，为无功补偿配置和电压调控提供依据。',
      description: [
        '展示各节点的电压稳定裕度指标',
        '以拓扑图标注各节点电压水平（按电压等级着色）',
        '列出电压裕度最低的节点（薄弱节点排名）',
        '展示节点电压的历史趋势曲线',
        '支持按区域和电压等级筛选'
      ],
      inputs: '筛选条件：区域、电压等级',
      outputs: '节点稳定裕度列表、拓扑着色图、薄弱节点排名、电压趋势图',
      apis: ['GET /api/v1/power-flow/indicators/node-stability - 节点电压稳定性'],
      tables: 'calc_results、grid_buses'
    },
    {
      title: '5.1.3 三相不平衡度',
      route: '/power-flow/indicators/imbalance',
      roles: 'admin、planner、operator、viewer',
      background: '三相不平衡会导致设备发热、损耗增加、保护误动等问题，需要监测各节点的三相不平衡度，及时发现问题。',
      description: [
        '展示各节点的三相电压数据（A/B/C相电压值）',
        '计算并展示三相不平衡度百分比',
        '标注是否与光伏接入关联（光伏单相接入可能导致不平衡）',
        '以柱状图展示不平衡度排名',
        '支持按区域和电压等级筛选'
      ],
      inputs: '筛选条件：区域、电压等级',
      outputs: '三相电压数据表、不平衡度排名图、光伏关联标注',
      apis: ['GET /api/v1/power-flow/indicators/three-phase - 三相不平衡度'],
      tables: 'calc_results、grid_buses、grid_loads'
    },
    {
      title: '5.1.4 阈值配置',
      route: '/power-flow/indicators/thresholds',
      roles: 'admin、planner',
      background: '各项运行指标需要设定合理的阈值用于告警判定，不同区域和电压等级可能需要不同的阈值标准，需要统一管理阈值配置。',
      description: [
        '管理四项系统阈值：电压偏差（预警3%/告警5%）、三相不平衡度（预警1%/告警2%）、设备负载率（预警80%/告警95%）、频率偏差（预警0.2Hz/告警0.5Hz）',
        '支持在线修改阈值，实时生效',
        '修改后所有依赖阈值的判定逻辑自动使用新标准'
      ],
      inputs: '四项阈值配置（预警值/告警值）',
      outputs: '当前阈值配置值、修改确认提示',
      apis: [
        'GET /api/v1/power-flow/thresholds - 获取阈值配置',
        'PUT /api/v1/power-flow/thresholds - 更新阈值配置'
      ],
      tables: 'system_config'
    }
  ]
}

/** 模块5.2：潮流分析 - 数据校验 */
const module512 = {
  title: '5.2 数据校验',
  features: [
    {
      title: '5.2.1 光伏数据完整性校验',
      route: '/power-flow/data-validation/completeness',
      roles: 'admin、planner、operator',
      background: '光伏出力数据的完整性直接影响潮流计算的准确性，需要校验光伏数据的采集完整性，包括时间连续性、置信度、天气匹配度三个维度。',
      description: [
        '三维度校验光伏出力数据：时间连续性（是否存在数据缺失）、置信因素（confidence_pct是否达标）、天气匹配度（expected_weather与actual_weather是否一致）',
        '展示校验结果汇总：检查记录数、通过数、失败数',
        '列出失败记录明细及失败原因',
        '支持按电站和时间范围筛选校验范围'
      ],
      inputs: '校验条件：电站名称、时间范围',
      outputs: '完整性校验报告（通过率、失败明细、失败原因分类）',
      apis: ['POST /api/v1/data-validation/pv-completeness - 光伏数据完整性校验'],
      tables: 'pv_output_measurements、data_validation_records'
    },
    {
      title: '5.2.2 边界条件合理性校验',
      route: '/power-flow/data-validation/boundary',
      roles: 'admin、planner、operator',
      background: '潮流计算的边界条件（负荷功率、电源出力、电压幅值）必须合理，需要与历史同期数据进行3σ异常检测，剔除明显不合理的数据。',
      description: [
        '校验负荷功率、发电机出力、电压幅值等边界条件是否在合理范围',
        '基于历史同期数据进行3σ异常检测（均值±3倍标准差以外的值视为异常）',
        '展示异常数据清单，标注具体偏差值',
        '支持自定义校验阈值和参考周期'
      ],
      inputs: '校验条件：校验类型（负荷/发电机/电压）、时间范围、参考周期（默认上月同期）',
      outputs: '边界合理性校验报告（异常数据列表、偏差值、异常原因）',
      apis: ['POST /api/v1/data-validation/boundary - 边界条件合理性校验'],
      tables: 'grid_loads、grid_generators、voltage_measurements、data_validation_records'
    },
    {
      title: '5.2.3 时序数据一致性校验',
      route: '/power-flow/data-validation/time-sync',
      roles: 'admin、planner、operator',
      background: '潮流计算依赖多个数据源（光伏出力、负荷数据等），需要确保不同数据源的时序数据时间戳对齐、采样频率一致，避免因数据不一致导致的计算误差。',
      description: [
        '校验光伏出力数据（pv_output_measurements）与负荷测量数据（load_measurements）的时间戳对齐情况',
        '比对不同数据源的采样频率是否一致',
        '检测时间戳偏移和缺失的时间点',
        '展示一致性校验报告'
      ],
      inputs: '校验条件：数据源选择（光伏出力/负荷测量）、时间范围',
      outputs: '时序一致性校验报告（时间戳对齐率、采样频率对比、异常时间点列表）',
      apis: ['POST /api/v1/data-validation/time-series - 时序数据一致性校验'],
      tables: 'pv_output_measurements、load_measurements、data_validation_records'
    }
  ]
}

/** 模块5.3：潮流分析 - 在线计算 */
const module513 = {
  title: '5.3 在线计算',
  features: [
    {
      title: '5.3.1 潮流计算支持',
      route: '/power-flow/online/standard',
      roles: 'admin、planner、operator',
      background: '标准潮流计算是电网分析的基础工具，基于牛顿-拉夫逊法求解电网各节点的电压幅值、相角和各支路的功率分布，为电网运行和规划提供基本数据。',
      description: [
        '选择计算场景模式：normal（原始拓扑+原始出力）、fault/N-1（断开指定支路）、solar（接入光伏实测出力）',
        '配置计算参数：选择参与计算的母线、支路、发电机、负荷',
        '提交异步计算任务，系统基于牛顿-拉夫逊法迭代求解',
        '实时展示计算进度（百分比、当前步骤描述、预计剩余时间）',
        '计算完成后展示结果：节点电压汇总（幅值/相角）、支路潮流汇总（有功/无功/损耗）、迭代收敛信息',
        '支持暂停/继续计算任务'
      ],
      inputs: '计算参数：场景模式、母线/支路/发电机/负荷选择、收敛精度、最大迭代次数',
      outputs: '计算结果：节点电压表（幅值/相角）、支路潮流表（P/Q/损耗）、总网损、迭代次数、收敛状态',
      apis: [
        'POST /api/v1/power-flow/calculate/standard - 提交标准潮流计算',
        'GET /api/v1/power-flow/calculate/:taskId/progress - 任务进度',
        'GET /api/v1/power-flow/calculate/:taskId/result - 计算结果',
        'POST /api/v1/power-flow/calculate/:taskId/pause - 暂停任务',
        'POST /api/v1/power-flow/calculate/:taskId/resume - 恢复任务',
        'GET /api/v1/power-flow/grid/buses - 获取母线数据',
        'GET /api/v1/power-flow/grid/branches - 获取支路数据',
        'GET /api/v1/power-flow/grid/generators - 获取发电机数据',
        'GET /api/v1/power-flow/grid/loads - 获取负荷数据'
      ],
      tables: 'calc_tasks、calc_results、calc_checkpoints、grid_buses、grid_branches、grid_generators、grid_loads'
    },
    {
      title: '5.3.2 反向潮流计算支持',
      route: '/power-flow/online/reverse',
      roles: 'admin、planner、operator',
      background: '大规模光伏接入后可能出现反向潮流（功率从低压侧向高压侧流动），需要专用的反向潮流计算来分析功率倒送时的电压分布和设备负载情况。',
      description: [
        '在标准潮流基础上，自动调整PV节点出力进行反向功率映射',
        '分析反向潮流下的电压分布变化',
        '检测反向功率流经的设备和支路',
        '评估反向潮流对设备负载率的影响',
        '输出反向功率检测结果和告警'
      ],
      inputs: '计算参数：场景模式、PV节点选取（自动或手动）、反向功率调整范围',
      outputs: '反向潮流计算结果（反向功率分布、电压变化、反向流经设备列表、影响评估）',
      apis: [
        'POST /api/v1/power-flow/calculate/reverse - 提交反向潮流计算',
        'GET /api/v1/power-flow/calculate/:taskId/progress - 任务进度',
        'GET /api/v1/power-flow/calculate/:taskId/result - 计算结果'
      ],
      tables: 'calc_tasks、calc_results、grid_buses、grid_branches、grid_generators'
    },
    {
      title: '5.3.3 概率潮流计算支持',
      route: '/power-flow/online/probabilistic',
      roles: 'admin、planner、operator',
      background: '光伏出力和负荷的随机波动使得确定性潮流计算结果无法全面反映电网运行风险，需要概率潮流计算来评估电压越限概率和线路过载概率。',
      description: [
        '配置概率模型参数：负荷波动分布（正态分布，均值/标准差）、光伏出力分布（基于光照随机性）',
        '执行Monte Carlo模拟（Box-Muller变换生成随机样本），默认运行指定次数的随机抽样',
        '统计各节点电压的均值、标准差、概率分布',
        '统计各支路功率的均值、标准差、越限概率',
        '展示概率分布直方图和累积概率曲线',
        '输出越限风险评估（电压越限概率、线路过载概率）'
      ],
      inputs: '概率参数：Monte Carlo模拟次数、负荷标准差、光伏出力标准差、置信水平',
      outputs: '概率潮流结果（节点电压均值/标准差/越限概率、支路功率均值/标准差/过载概率、概率分布图）',
      apis: [
        'POST /api/v1/power-flow/calculate/probabilistic - 提交概率潮流计算',
        'GET /api/v1/power-flow/calculate/:taskId/progress - 任务进度',
        'GET /api/v1/power-flow/calculate/:taskId/result - 计算结果'
      ],
      tables: 'calc_tasks、calc_results'
    },
    {
      title: '5.3.4 三相潮流计算支持',
      route: '/power-flow/online/three-phase',
      roles: 'admin、planner、operator',
      background: '配电网中单相光伏接入和单相负荷分布不均会导致三相不平衡，需要三相潮流计算来精确分析各相电压分布和不平衡程度。',
      description: [
        '配置各相负荷/发电分配比例（A/B/C相）',
        '系统对三相分别执行独立的牛顿-拉夫逊求解',
        '通过Fortescue变换计算电压不平衡度（VUF）',
        '展示各相电压幅值/相角、三相不平衡度',
        '支持按节点查看各相详细数据',
        '对比三相与单相等效计算结果的差异'
      ],
      inputs: '计算参数：各相负荷分配比例（Pa/Pb/Pc）、各相发电分配比例、相位数据配置',
      outputs: '三相潮流结果（各相电压/电流、VUF不平衡度、相间对比图）',
      apis: [
        'POST /api/v1/power-flow/calculate/three-phase - 提交三相潮流计算',
        'GET /api/v1/power-flow/phase-data-summary - 相数据汇总',
        'POST /api/v1/power-flow/phase-data/detail - 相数据明细'
      ],
      tables: 'calc_tasks、calc_results、grid_loads'
    },
    {
      title: '5.3.5 异步计算及进度跟踪',
      route: '/power-flow/online/tasks',
      roles: 'admin、planner、operator、viewer',
      background: '潮流计算任务采用异步执行模式，用户提交任务后可查看进度、暂停/恢复任务，需要统一的任务管理界面跟踪所有计算任务的状态。',
      description: [
        '展示所有计算任务列表，包含任务类型、状态、进度百分比、创建时间',
        '实时刷新任务进度（1秒轮询）',
        '支持暂停（pause）和恢复（resume）运行中的任务',
        '查看任务详情：参数配置、进度消息、检查点数据',
        '跳转到对应计算类型的计算结果页面',
        '按状态筛选任务（运行中/已完成/失败/暂停）'
      ],
      inputs: '筛选条件：任务状态、任务类型、时间范围',
      outputs: '任务列表（任务类型/状态/进度/ETA）、任务详情面板、任务操作（暂停/恢复/查看结果）',
      apis: [
        'GET /api/v1/power-flow/tasks - 任务列表',
        'GET /api/v1/power-flow/calculate/:taskId/progress - 任务进度',
        'POST /api/v1/power-flow/calculate/:taskId/pause - 暂停任务',
        'POST /api/v1/power-flow/calculate/:taskId/resume - 恢复任务'
      ],
      tables: 'calc_tasks、calc_checkpoints、calc_results'
    }
  ]
}

/** 模块5.4：潮流分析 - 批量计算 */
const module514 = {
  title: '5.4 批量计算',
  features: [
    {
      title: '5.4.1 参数配置',
      route: '/power-flow/batch/config',
      roles: 'admin、planner',
      background: '当需要进行大量潮流计算（如N-1扫描、负荷增长分析、光伏出力变化分析）时，手动逐个提交效率低下，需要批量参数配置功能。',
      description: [
        '选择批量计算类型：按母线（节点扫描）或按支路（N-1扫描）',
        '选择参与批量计算的母线和支路列表',
        '配置批量模板参数：负荷增长系数（loadGrowthFactor）、光伏出力系数（pvOutputFactor）、时间窗口',
        '设置批量任务的命名规则和执行顺序',
        '提交后系统自动创建批量计算组和对应的子任务'
      ],
      inputs: '批量配置：计算类型、母线/支路选择列表、负荷增长系数、光伏出力系数、时间窗口',
      outputs: '批量计算组创建确认（组ID、子任务数量）',
      apis: [
        'POST /api/v1/power-flow/batch - 提交批量配置',
        'GET /api/v1/power-flow/grid/buses - 获取母线数据',
        'GET /api/v1/power-flow/grid/branches - 获取支路数据'
      ],
      tables: 'batch_calc_groups、batch_group_items、calc_tasks'
    },
    {
      title: '5.4.2 任务监控',
      route: '/power-flow/batch/monitor',
      roles: 'admin、planner',
      background: '批量计算包含大量子任务，需要统一监控视图展示整体进度和各子任务状态，支持批量取消操作。',
      description: [
        '展示批量计算组列表（组名/计算类型/状态/总任务数/已完成/失败/创建时间）',
        '查看批量组详情：子任务列表及各自状态、进度',
        '展示整体完成进度条和预计剩余时间（ETA）',
        '支持取消运行中的批量计算组（级联取消所有子任务）',
        '支持删除已完成的批量组及其所有关联数据'
      ],
      inputs: '筛选条件：批量组状态',
      outputs: '批量组列表、子任务状态详情、整体进度/ETA',
      apis: [
        'GET /api/v1/power-flow/batch - 批量任务列表',
        'GET /api/v1/power-flow/batch/:groupId - 批次详情',
        'GET /api/v1/power-flow/batch/:groupId/status - 批次状态',
        'POST /api/v1/power-flow/batch/:groupId/cancel - 取消批次',
        'DELETE /api/v1/power-flow/batch/:groupId - 删除批次'
      ],
      tables: 'batch_calc_groups、batch_group_items、calc_tasks'
    },
    {
      title: '5.4.3 结果分析',
      route: '/power-flow/batch/results',
      roles: 'admin、planner',
      background: '批量计算完成后需要综合分析大量计算结果，提取关键结论和异常项，支持结果导出。',
      description: [
        '展示批量计算结果的综合分析：区域统计汇总、异常项列表（电压越限/设备过载）、容量排名',
        '按节点或支路维度展示计算结果对比',
        '标注异常项（异常类型、严重程度、当前值、阈值）',
        '支持结果数据导出为CSV格式',
        '支持跳转到单个子任务的详细结果'
      ],
      inputs: '批量组ID',
      outputs: '批量结果综合分析（区域统计/异常项/容量排名）、CSV导出文件',
      apis: [
        'GET /api/v1/power-flow/batch/:groupId/results - 批量计算结果',
        'GET /api/v1/power-flow/batch/:groupId/export - 导出批量结果'
      ],
      tables: 'batch_calc_groups、batch_group_items、calc_results、batch_anomaly_items'
    }
  ]
}

/** 模块5.5：潮流分析 - 计算历史 */
const module515 = {
  title: '5.5 计算历史',
  features: [
    {
      title: '5.5.1 历史记录管理',
      route: '/power-flow/history/management',
      roles: 'admin、planner、operator、viewer',
      background: '所有计算任务需要留痕保存，支持历史查询、结果回溯、参数复用，满足审计和知识积累需求。',
      description: [
        '分页展示所有计算历史记录，包含任务类型、创建时间、状态、创建人',
        '支持按任务类型、日期范围、创建人筛选历史记录',
        '查看历史任务的完整计算结果（节点结果、支路结果、摘要）',
        '复用历史任务的参数配置到新的计算',
        '支持两个历史版本的对比分析（节点电压差异、支路功率差异）',
        '锁定重要历史记录防止被清理',
        '清理过期的未锁定历史记录（管理员）'
      ],
      inputs: '筛选条件：任务类型、日期范围、创建人；操作：锁定/解锁、清理天数',
      outputs: '历史记录分页列表、历史计算详情、版本对比报告、参数复用配置',
      apis: [
        'GET /api/v1/power-flow/history - 历史记录列表',
        'GET /api/v1/power-flow/history/compare - 版本对比',
        'POST /api/v1/power-flow/history/reuse/:id - 复用历史参数',
        'POST /api/v1/power-flow/history/:taskId/lock - 锁定历史',
        'DELETE /api/v1/power-flow/history/:taskId - 删除历史',
        'POST /api/v1/power-flow/history/cleanup - 清理过期历史'
      ],
      tables: 'calc_tasks、calc_results'
    }
  ]
}

/** 模块5.6：潮流分析 - 型号参数 */
const module516 = {
  title: '5.6 型号参数',
  features: [
    {
      title: '5.6.1 参数管理',
      route: '/power-flow/model-params/management',
      roles: 'admin、planner',
      background: '光伏电站的电气参数（额定容量、电压、功率因数、效率、LVRT/HVRT等）和出力曲线模板需要标准化管理，确保潮流计算使用准确的设备参数。',
      description: [
        '管理出力曲线模板（output_curve_templates）：定义不同天气类型（晴天/多云/阴天/雨天）的光伏出力曲线系数',
        '管理置信系数配置（confidence_coefficient_settings）：定义不同置信水平下的概率分布参数',
        '管理电站模型参数（station_model_params）：集中式光伏电站的完整电气参数（额定容量/电压/功率因数/效率/短路比/MPPT算法/功率限制模式/爬坡率/LVRT/HVRT/孤岛保护/设计温度/设计辐照度/湿度/海拔/污染系数）',
        '支持创建、编辑、删除各类型参数',
        '预设模板不可删除'
      ],
      inputs: '曲线模板（名称/天气类型/系数JSON/描述）、置信系数（名称/置信水平/分布类型/PDF参数）、电站模型（额定容量/电压/功率因数/效率/短路比...等17个字段）',
      outputs: '参数列表、参数详情表单',
      apis: [
        'GET/POST/PUT/DELETE /api/v1/power-flow/model-params/curve-templates - 曲线模板CRUD',
        'GET/POST/PUT/DELETE /api/v1/power-flow/model-params/confidence-settings - 置信系数CRUD',
        'GET/POST/PUT /api/v1/power-flow/model-params/station-models - 电站模型CRUD'
      ],
      tables: 'output_curve_templates、confidence_coefficient_settings、station_model_params'
    },
    {
      title: '5.6.2 参数版本控制',
      route: '/power-flow/model-params/versioning',
      roles: 'admin、planner',
      background: '电站参数和模板可能因设备改造、标准更新等原因发生变化，需要版本控制机制追踪参数变更历史，支持版本回滚和对比。',
      description: [
        '查看各类参数（曲线模板/置信系数/电站模型）的版本历史',
        '参数更新时自动创建新版本（version号+1），旧版本标记is_active=0',
        '支持版本回滚：基于目标版本新建版本（由admin执行）',
        '电站模型支持版本对比（逐字段差异展示）',
        '全部参数支持查看所有历史版本（all接口）',
        '电站模型支持导出（选定若干个模型导出数据）'
      ],
      inputs: '参数rootId、回滚目标版本ID、对比版本ID（A和B）',
      outputs: '版本历史列表（版本号/变更摘要/修改人/修改时间）、版本对比差异表、回滚确认',
      apis: [
        'GET /api/v1/power-flow/model-params/curve-templates/all - 全部曲线模板',
        'GET /api/v1/power-flow/model-params/curve-templates/:rootId/versions - 曲线版本历史',
        'POST /api/v1/power-flow/model-params/curve-templates/:id/rollback - 回滚曲线模板',
        'GET /api/v1/power-flow/model-params/confidence-settings/all - 全部置信系数',
        'GET /api/v1/power-flow/model-params/confidence-settings/:rootId/versions - 置信系数版本历史',
        'POST /api/v1/power-flow/model-params/confidence-settings/:id/rollback - 回滚置信系数',
        'GET /api/v1/power-flow/model-params/station-models/all - 全部电站模型',
        'GET /api/v1/power-flow/model-params/station-models/:rootId/versions - 电站模型版本历史',
        'POST /api/v1/power-flow/model-params/station-models/:id/rollback - 回滚电站模型',
        'GET /api/v1/power-flow/model-params/station-models/compare - 版本对比',
        'POST /api/v1/power-flow/model-params/station-models/export - 导出电站模型'
      ],
      tables: 'output_curve_templates、confidence_coefficient_settings、station_model_params'
    }
  ]
}

/** 模块6：资源管理 */
const module6 = {
  title: '6 资源管理',
  features: [
    {
      title: '6.1.1 资源模型构建',
      route: '/resources/hub/models',
      roles: 'admin、planner、operator、viewer',
      background: '电网中的光伏电站、储能设备、负荷等需要建立标准化的资源模型，描述其电气特性和运行参数，为仿真分析和场景编排提供模型基础。',
      description: [
        '管理资源模型（resource_models），包含模型名称、类型（光伏/储能/负荷等）、参数JSON、关联电站',
        '支持模型的新增、编辑、删除（软删除：is_active=false）',
        '模型编辑时自动递增版本号',
        '查看模型的健康度评分和异常列表',
        '查看储能模型的寿命信息（SOH、剩余循环次数、日历寿命、退化率）',
        '管理光伏电站（power_plants）的基本信息、版本历史',
        '支持模型与电站的绑定（一个电站可绑定多个模型）'
      ],
      inputs: '模型信息（名称/类型/参数JSON/描述）、电站信息（名称/类型/容量/安装日期/经纬度/地址/元数据）',
      outputs: '资源模型列表、模型健康度报告、储能寿命报告、电站列表及版本历史',
      apis: [
        'GET/POST/PUT/DELETE /api/v1/resource/models - 资源模型CRUD',
        'GET /api/v1/resource/models/:id/health - 模型健康度',
        'GET /api/v1/resource/models/:id/storage-life - 储能寿命',
        'GET/POST/PUT/DELETE /api/v1/resource/power-plants - 电站CRUD',
        'POST /api/v1/resource/power-plants/batch-import - 批量导入电站',
        'GET /api/v1/resource/power-plants/:id/versions - 电站版本历史',
        'POST /api/v1/resource/power-plants/:id/bind-models - 绑定模型'
      ],
      tables: 'resource_models、power_plants、station_versions、equipment'
    },
    {
      title: '6.1.2 资源维护',
      route: '/resources/hub/maintenance',
      roles: 'admin、planner、operator、viewer',
      background: '电网设备需要定期维护，维护记录是评估设备状态和规划更换的重要依据，需要系统化管理维护记录和设备全生命周期事件。',
      description: [
        '管理设备（equipment）信息：设备类型、型号、制造商、额定容量/电压/电流、安装日期、设计寿命、等级、状态',
        '按电站或独立管理设备列表',
        '查看设备详情，包含生命周期事件和关联电站信息',
        '支持设备的新增、编辑操作'
      ],
      inputs: '设备信息（类型/型号/制造商/额定参数/安装日期/设计寿命/等级/状态）',
      outputs: '设备列表、设备详情（含生命周期事件和关联电站）',
      apis: [
        'GET/POST /api/v1/resource/equipment - 设备列表/新增',
        'GET/PUT /api/v1/resource/equipment/:id - 设备详情/更新'
      ],
      tables: 'equipment、equipment_lifecycle、equipment_lifecycle_records'
    },
    {
      title: '6.1.3 资源关联关系',
      route: '/resources/hub/topology',
      roles: 'admin、planner、operator、viewer',
      background: '光伏电站、母线、负荷、储能等资源之间存在复杂的拓扑连接关系，需要可视化展示光伏电网拓扑结构，支持拓扑关系的增删改查。',
      description: [
        '展示完整的光伏电网拓扑图，包含SOURCE（光伏电站）节点、GRID（母线）节点、LOAD（负荷）节点、STORAGE（储能）节点四类节点',
        '节点按电压等级着色，边按负载率着色',
        '管理拓扑连接属性（connection_attrs）：拓扑类型、电压等级层次、潮流方向、正/反向最大功率、最大容量、控制逻辑等',
        '管理负荷实体（load_entities）：负荷类型、峰值负荷、年用电量、区域等',
        '管理储能实体（storage_entities）：储能类型、额定功率/容量、效率、充放电模式等',
        '支持节点的创建和连接的增删改查',
        '按类型筛选拓扑节点'
      ],
      inputs: '连接属性（源/目标节点、拓扑类型、潮流方向、功率限制、控制逻辑等）、负荷实体信息、储能实体信息',
      outputs: '光伏电网拓扑图（力导向布局）、节点详情抽屉、连接属性列表、负荷/储能实体列表',
      apis: [
        'GET /api/v1/resource/topology - 光伏电网拓扑',
        'GET /api/v1/resource/topology/nodes-by-type/:type - 按类型查节点',
        'POST /api/v1/resource/topology/source-nodes - 创建源节点',
        'POST /api/v1/resource/topology/grid-nodes - 创建电网节点',
        'GET/POST/PUT/DELETE /api/v1/resource/topology/connections - 连接属性CRUD',
        'GET/POST/PUT/DELETE /api/v1/resource/topology/load-entities - 负荷实体CRUD',
        'GET/POST/PUT/DELETE /api/v1/resource/topology/storage-entities - 储能实体CRUD'
      ],
      tables: 'resource_connection_attrs、load_entities、storage_entities、grid_buses、solar_pv_stations'
    }
  ]
}

/** 模块7：场景管理 */
const module7 = {
  title: '7 场景管理',
  features: [
    {
      title: '7.1.1 互动场景管理',
      route: '/resources/scenarios/management',
      roles: 'admin、planner、operator、viewer',
      background: '电网运行中存在多种互动场景（如光储协同、削峰填谷、需求响应等），需要系统化管理这些场景的定义、配置和控制逻辑，支持场景的版本管理和复用。',
      description: [
        '管理互动场景（interactive_scenarios）：场景名称、类型、描述、配置JSON、控制逻辑JSON、标签、状态、场景条件、版本限制',
        '支持场景的新增、编辑、删除、复制（单个/批量）',
        '场景编辑时自动创建版本历史（scenario_versions），保存配置快照',
        '支持版本恢复（回滚到指定历史版本）',
        '场景预览：基于接入点和控制规则估算电压、频率、负载率、消纳率等关键指标',
        '支持按名称、类型、状态、标签、设备、场景条件、日期等多条件筛选',
        '场景数据导出'
      ],
      inputs: '场景信息（名称/类型/描述/配置JSON/控制逻辑JSON/标签/状态/场景条件）、版本限制、选择导出场景ID列表',
      outputs: '场景列表（支持多条件筛选）、场景详情（含配置/控制逻辑）、版本历史列表、场景预览报告（电压/频率/负载率/消纳率/越限/改善建议）',
      apis: [
        'GET/POST/PUT/DELETE /api/v1/scenario/scenarios - 场景CRUD',
        'POST /api/v1/scenario/scenarios/batch-delete - 批量删除',
        'POST /api/v1/scenario/scenarios/:id/copy - 复制场景',
        'POST /api/v1/scenario/scenarios/batch-copy - 批量复制',
        'GET /api/v1/scenario/scenarios/:id/versions - 版本历史',
        'POST /api/v1/scenario/scenarios/:id/restore-version/:vid - 恢复版本',
        'POST /api/v1/scenario/scenarios/preview - 场景预览',
        'POST /api/v1/scenario/scenarios/export - 导出场景'
      ],
      tables: 'interactive_scenarios、scenario_versions'
    },
    {
      title: '7.1.2 互动场景策略管理',
      route: '/resources/scenarios/strategy',
      roles: 'admin、planner、operator',
      background: '每个互动场景需要配置运行策略，定义储能调度、光伏出力调节、负荷控制等规则，支持人工编写和系统自动生成两种方式。',
      description: [
        '管理策略（scenario_strategies）：策略名称、类型、配置JSON、约束JSON、经济目标JSON',
        '支持按场景关联、策略类型、状态筛选策略列表',
        '查看策略详情',
        '支持策略的新增、编辑、删除',
        '自动生成策略：系统基于场景拓扑和峰谷电价表，自动生成12段（每2小时）储能调度指令、光伏调度指令、负荷削峰指令'
      ],
      inputs: '策略信息（名称/类型/配置JSON/约束JSON/经济目标JSON）、关联场景ID、自动生成触发',
      outputs: '策略列表、策略详情（含调度指令）、自动生成策略结果（12段调度计划）',
      apis: [
        'GET/POST/PUT/DELETE /api/v1/scenario/strategies - 策略CRUD',
        'POST /api/v1/scenario/strategies/generate - 自动生成策略'
      ],
      tables: 'scenario_strategies、interactive_scenarios'
    },
    {
      title: '7.1.3 场景模拟与验证',
      route: '/resources/scenarios/simulation',
      roles: 'admin、planner、operator',
      background: '场景策略制定后需要通过时序仿真验证其可行性和效果，模拟光照变化、负荷波动、储能充放电、电压/频率变化等动态过程，验证策略的有效性。',
      description: [
        '启动场景模拟：设置边界条件、时间范围、步长间隔（分钟）、速度倍率',
        '后台异步执行模拟循环（最多1440步），每步模拟：光照→负荷→储能充放电→电压/频率/负载率/消纳率计算',
        '模拟过程中实时展示进度、当前指标值',
        '支持暂停/恢复/停止模拟',
        '运行中支持修改模拟参数（写入paused_params，恢复时生效）',
        '查看模拟结果：各指标时序曲线（电压/频率/负载率/消纳率）、越限汇总',
        '获取模拟实时数据（增量推送：新指标+策略事件+最新快照）',
        '查看运行中的模拟列表'
      ],
      inputs: '边界条件JSON、时间范围JSON（起止时间）、步长间隔（分钟）、速度倍率',
      outputs: '模拟进度/状态、模拟指标时序数据（metrics）、越限事件列表、实时数据增量推送',
      apis: [
        'GET/POST /api/v1/scenario/simulations - 模拟列表/启动模拟',
        'GET /api/v1/scenario/simulations/running - 运行中的模拟',
        'GET /api/v1/scenario/simulations/:id - 模拟详情',
        'PUT /api/v1/scenario/simulations/:id/stop - 停止模拟',
        'PUT /api/v1/scenario/simulations/:id/pause - 暂停模拟',
        'PUT /api/v1/scenario/simulations/:id/resume - 恢复模拟',
        'PUT /api/v1/scenario/simulations/:id/params - 修改模拟参数',
        'GET /api/v1/scenario/simulations/:id/results - 模拟结果',
        'GET /api/v1/scenario/simulations/:id/live - 实时数据'
      ],
      tables: 'scenario_simulations、simulation_metrics、scenario_strategies'
    },
    {
      title: '7.1.4 场景执行效果评估',
      route: '/resources/scenarios/evaluation',
      roles: 'admin、planner、operator、viewer',
      background: '模拟完成后需要对策略执行效果进行综合评估，从安全性、经济性、目标达成度等维度打分，生成评估报告，为策略优化提供依据。',
      description: [
        '查看评估记录列表（关联模拟ID和策略ID）',
        '生成评估报告：系统自动聚合模拟指标，从通过率、安全性（电压/频率合格率）、经济性（总放电收益/净收益/储能损耗成本）、目标达成度四个维度综合评估',
        '评估报告包含：通过率、安全性评估、经济性评估、目标达成详情、经济明细、越限详情、改进建议',
        '支持评估报告导出为Word或PDF格式',
        '查看评估报告详情'
      ],
      inputs: '关联模拟ID',
      outputs: '评估记录列表、评估报告（通过率/安全性/经济性/目标达成/经济明细/越限详情/改进建议）、可导出Word/PDF',
      apis: [
        'GET /api/v1/scenario/evaluations - 评估列表',
        'GET /api/v1/scenario/evaluations/:id - 评估详情',
        'POST /api/v1/scenario/evaluations/generate - 生成评估报告',
        'GET /api/v1/scenario/evaluations/:id/export - 导出评估报告'
      ],
      tables: 'scenario_evaluations、simulation_metrics、scenario_simulations'
    },
    {
      title: '7.1.5 场景策略人工干预',
      route: '/resources/scenarios/intervention',
      roles: 'admin、planner、operator',
      background: '场景模拟运行过程中可能出现需要人工介入的紧急情况（如指标严重越限、设备异常），需要提供人工干预能力，支持紧急停止、暂停、强制控制等操作。',
      description: [
        '查看人工干预记录列表（按场景/操作类型/日期筛选）',
        '创建人工干预：选择场景、模拟、操作类型（emergency_stop紧急停止/pause暂停/force_control强制控制）、操作参数',
        '系统自动记录干预前后的参数快照（params_before/params_after）',
        '干预操作立即生效，影响正在运行的模拟',
        '支持导出干预记录'
      ],
      inputs: '干预信息（场景ID/模拟ID/操作类型/操作参数/原因）',
      outputs: '干预记录列表、干预前后参数对比、导出干预记录',
      apis: [
        'GET /api/v1/scenario/interventions - 干预记录列表',
        'POST /api/v1/scenario/interventions - 创建干预',
        'GET /api/v1/scenario/interventions/export - 导出干预记录'
      ],
      tables: 'scenario_interventions、scenario_simulations'
    }
  ]
}

// ==================== 附录数据 ====================

/** 角色权限矩阵 */
const roleMatrix = {
  headers: ['角色', '电网诊断(发电/网架/供电)', '配电网规划', '成果管理', '潮流-指标概览', '潮流-数据校验', '潮流-在线计算', '潮流-批量计算', '潮流-计算历史', '潮流-型号参数', '资源管理', '场景管理'],
  rows: [
    ['admin（管理员）', '全部', '全部', '全部', '全部', '全部', '全部', '全部', '全部', '全部', '全部', '全部'],
    ['planner（规划员）', '全部', '全部', '全部', '全部', '全部', '全部（除任务跟踪viewer）', '全部', '全部', '全部', '全部', '全部'],
    ['operator（操作员）', '全部（除极端场景）', '不可访问', '查看全部', '查看（除阈值配置）', '全部', '标准/反向/概率/三相计算', '不可访问', '查看', '不可访问', '查看', '部分（策略/模拟/干预）'],
    ['viewer（只读）', '查看（除极端场景）', '不可访问', '查看', '查看（除阈值配置）', '不可访问', '仅任务跟踪', '不可访问', '查看', '不可访问', '查看', '仅场景管理+效果评估']
  ]
}

/** 主要数据表概览 */
const dbTables = {
  headers: ['分类', '表名', '主要字段', '用途'],
  rows: [
    ['系统', 'users', 'username, password_hash, display_name, role_id, department', '用户管理'],
    ['系统', 'roles', 'name, permissions(JSON)', '角色与权限'],
    ['系统', 'audit_logs', 'user_id, action, resource_type, resource_id, old_value, new_value', '审计日志'],
    ['电网拓扑', 'grid_buses', 'name, zone, voltage_level, bus_type, longitude, latitude', '母线数据'],
    ['电网拓扑', 'grid_branches', 'from_bus_id, to_bus_id, zone, branch_type, r, x, b, tap_ratio, ampacity_mva', '支路数据'],
    ['电网拓扑', 'grid_generators', 'bus_id, pg_mw, vg_kv, qmax_mvar, qmin_mvar', '发电机数据'],
    ['电网拓扑', 'grid_loads', 'bus_id, pd_mw, qd_mvar, pd_a/b/c_mw, qd_a/b/c_mvar', '负荷数据'],
    ['电网拓扑', 'feeders', 'name, zone, voltage_level', '馈线'],
    ['电网拓扑', 'feeder_buses', 'feeder_id, bus_id', '馈线-母线关联'],
    ['电网拓扑', 'load_entities', 'name, load_type, bus_id, peak_load_kw, annual_consumption_mwh, zone', '负荷实体'],
    ['电网拓扑', 'storage_entities', 'name, storage_type, bus_id, rated_power_kw, rated_capacity_kwh, efficiency_pct', '储能实体'],
    ['光伏', 'solar_pv_stations', 'station_name, bus_id, installed_capacity_mw, panel_type, longitude, latitude, status', '光伏电站（唯一数据源）'],
    ['光伏', 'pv_output_measurements', 'time, station_id, active_power_kw, reactive_power_kvar, voltage_v, irradiance_wm2, temperature_c, confidence_pct', '光伏出力测量数据'],
    ['光伏', 'station_versions', 'station_id, version, station_name, installed_capacity_mw, status', '电站版本历史'],
    ['光伏', 'station_model_params', 'root_id, model_name, version, rated_capacity_mw, rated_voltage_kv, power_factor, efficiency_pct, short_circuit_ratio, mppt_algorithm, lvrt_enabled, hvrt_enabled', '光伏电站电气模型参数'],
    ['设备', 'equipment', 'station_id, equipment_type, model_number, manufacturer, rated_capacity_kva, rated_voltage_kv, installation_date, design_life_years, status', '设备台账'],
    ['设备', 'equipment_lifecycle', 'equipment_id, event_type, event_date, description, cost, remaining_life_years', '设备生命周期'],
    ['设备', 'equipment_lifecycle_records', 'equipment_id, event_type, event_type_label, event_time, operator, description', '设备生命周期事件记录'],
    ['设备', 'equipment_temperature', 'equipment_id, temperature_c, recorded_at', '设备温度记录'],
    ['计算', 'calc_tasks', 'task_type, status, parameters, progress_pct, progress_message, scene_type, created_by', '计算任务'],
    ['计算', 'calc_results', 'task_id, version, node_results(JSON), branch_results(JSON), summary(JSON), total_loss_kw', '计算结果'],
    ['计算', 'calc_checkpoints', 'task_id, progress_pct, progress_message, checkpoint_data', '计算检查点'],
    ['计算', 'batch_calc_groups', 'group_name, calc_type, selected_bus_ids(JSON), parameter_template(JSON), status, result_summary(JSON)', '批量计算组'],
    ['计算', 'batch_group_items', 'group_id, task_id, item_label, item_type, bus_id, branch_id', '批量子任务'],
    ['模型参数', 'output_curve_templates', 'root_id, name, weather_type, version, is_preset, is_active, coefficients(JSON)', '出力曲线模板（版本控制）'],
    ['模型参数', 'confidence_coefficient_settings', 'root_id, name, version, confidence_level, distribution_type, pdf_params(JSON), is_active', '置信系数配置（版本控制）'],
    ['场景', 'interactive_scenarios', 'name, type, config(JSON), control_logic(JSON), tags(JSON), status, scenario_condition', '互动场景'],
    ['场景', 'scenario_versions', 'scenario_id, version_number, config_snapshot, control_logic_snapshot, changelog', '场景版本'],
    ['场景', 'scenario_strategies', 'scenario_id, name, strategy_type, config(JSON), constraints(JSON), economic_targets(JSON)', '场景策略'],
    ['场景', 'scenario_simulations', 'scenario_id, strategy_id, status, boundary_conditions(JSON), time_range(JSON), step_interval_minutes, current_step, progress', '场景模拟'],
    ['场景', 'simulation_metrics', 'simulation_id, timestamp, metric_type, unit, value, threshold, is_violation', '模拟指标'],
    ['场景', 'scenario_evaluations', 'simulation_id, strategy_id, evaluation_report(JSON), effectiveness_score, issues(JSON), suggestions', '场景评估'],
    ['场景', 'scenario_interventions', 'scenario_id, simulation_id, operation_type, operation_params(JSON), params_before(JSON), params_after(JSON)', '人工干预记录'],
    ['项目', 'projects', 'project_code, project_name, project_type, pv_type, plan_id, capacity_kw, budget, status, custom_fields(JSON)', '规划项目'],
    ['项目', 'operation_projects', 'project_code, project_name, station_id, planned_annual_output_mwh, planned_equivalent_hours, status', '投运项目'],
    ['项目', 'access_conditions', 'project_id, condition_type, requirement, actual_value, is_satisfied', '接入条件'],
    ['项目', 'feasibility_assessments', 'project_id, technical_score, economic_score, environmental_score, social_score, comprehensive_score', '可行性评估'],
    ['项目', 'effectiveness_verifications', 'project_id, auto_output_kwh, auto_equivalent_hours, planned_*, final_*, is_effective, verified_by', '成效验证'],
    ['项目', 'project_audit', 'project_id, action, old_status, new_status, comment, performed_by', '项目审计追溯'],
    ['项目', 'project_types', 'name, code, description, sort_order', '项目类型'],
    ['项目', 'project_type_fields', 'type_id, field_code, field_name, field_type, field_options, is_required, sort_order, category', '项目类型字段'],
    ['项目', 'project_field_library', 'field_code, field_name, field_type, field_options, category', '项目字段库'],
    ['规划', 'plans', 'plan_name, plan_type, plan_year, tech_route, description, status', '规划方案'],
    ['规划', 'pv_stations', 'name, capacity_kw, panel_type, rated_voltage_kv, longitude, latitude, land_type, plan_id, model_type_id, custom_fields(JSON)', '规划光伏电站'],
    ['规划', 'pv_model_types', 'name, code, description, sort_order', '光伏模型类型'],
    ['规划', 'pv_model_type_fields', 'type_id, field_code, field_name, field_type, field_options, is_required', '模型类型字段'],
    ['规划', 'pv_field_library', 'field_code, field_name, field_type, field_options, category', '光伏字段库'],
    ['规划', 'pv_cost_library', 'model_name, model_type, manufacturer, unit_cost_per_kw, rated_power_kw, efficiency_pct, lifespan_years', '光伏造价库'],
    ['规划', 'investment_plans', 'plan_name, tech_route, capacity_kw, description', '投资方案'],
    ['规划', 'investment_config', 'investment_plan_id, cost_item_id, quantity, unit_price', '投资配置'],
    ['规划', 'cost_items', 'item_code, category, sub_category, equipment_type, model_spec, item_name, unit_price', '造价参数'],
    ['规划', 'constraint_rules', 'rule_name, rule_type, weight, enabled, params(JSON)', '约束规则'],
    ['规划', 'candidate_points', 'plan_id, station_id, longitude, latitude, recommended_capacity_kw, comprehensive_score, scores(JSON)', '候选接入点'],
    ['规划', 'absorption_plans', 'scheme_id, plan_name, parent_id, storage_config(JSON), reactive_comp_config(JSON), pv_output_profile(JSON), load_profile(JSON), investment_cost', '消纳方案'],
    ['规划', 'economic_analyses', 'plan_id, absorption_scheme_id, total_investment, unit_cost_per_kw, payback_period_years, irr_pct, npv', '经济分析'],
    ['规划', 'access_point_resources', 'name, zone, voltage_kv, annual_irradiance, sunshine_hours, solar_grade, short_circuit_capacity_mva, corridor_available, unit_cost, payback_years, irr_pct', '接入点资源'],
    ['资源', 'resource_models', 'model_name, model_type, model_parameters(JSON), station_id, version, is_active', '资源模型'],
    ['资源', 'power_plants', 'name, plant_type, capacity_kw, installed_date, longitude, latitude, status', '电站'],
    ['资源', 'resource_connection_attrs', 'source_node_type, source_node_id, target_node_type, target_node_id, topology_type, flow_direction, forward_power_max_kw, reverse_power_max_kw, control_logic', '拓扑连接属性'],
    ['资源', 'resource_relationships', 'source_model_id, target_model_id, relationship_type', '资源关系'],
    ['监控', 'alerts', 'alert_level, source_type, source_id, title, message, triggered_at, acknowledged_by', '告警'],
    ['监控', 'voltage_measurements', 'time, equipment_id, phase_a/b/c_v, voltage_deviation_pct, flicker_severity, thd_pct', '电压测量'],
    ['监控', 'carbon_emissions', 'plant_id, period_type, total_output_kwh, co2_reduction_kg, coal_saving_ton, so2_reduction_kg, nox_reduction_kg', '碳排放'],
    ['监控', 'data_validation_records', 'check_type, data_source_table, records_checked, records_passed, records_failed, failure_details', '数据校验记录'],
    ['监控', 'outage_events', '...', '停电事件'],
    ['监控', 'complaint_stats', '...', '投诉统计'],
    ['其他', 'load_measurements', 'time, bus_id, active_power_mw, reactive_power_mvar, temperature_c, humidity_pct', '负荷测量数据'],
    ['其他', 'unit_cost_params', 'category, item_name, unit_cost, unit, cost_type, effective_date', '单位造价参数'],
    ['其他', 'access_condition_plans', 'name, plan_type, conditions(JSON)', '接入条件计划'],
    ['其他', 'site_recommendations', 'plan_id, longitude, latitude, recommended_capacity_kw, score, constraint_description', '站点推荐'],
    ['其他', 'project_documents', 'project_id, doc_name, doc_type, file_path, file_size', '项目文档']
  ]
}

// ==================== 主函数：构建文档 ====================

async function main() {
  const children = []

  // ===== 封面 =====
  children.push(new Paragraph({ spacing: { before: 3000 }, children: [] }))
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: '电网在线计算与分析平台', bold: true, font: 'Microsoft YaHei', size: 44 })]
  }))
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: '需求规格说明书', bold: true, font: 'Microsoft YaHei', size: 36 })]
  }))
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: '版本 1.0', font: 'Microsoft YaHei', size: 24 })]
  }))
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: '2026年6月', font: 'Microsoft YaHei', size: 24 })]
  }))
  children.push(new Paragraph({ children: [new TextRun({ text: '', break: 1 })] }))

  // ===== 目录占位 =====
  children.push(heading('目录', HeadingLevel.HEADING_1))
  children.push(para('（在Word中右键此处选择"更新域"可自动生成目录）'))

  // ===== 第1章：系统概述 =====
  children.push(new Paragraph({ children: [new PageBreak()] }))
  children.push(heading('1 系统概述'))
  children.push(heading('1.1 项目背景', HeadingLevel.HEADING_2))
  children.push(para('电网在线计算与分析平台是一个面向配电网规划、运行分析和成效评估的综合信息化系统。平台围绕集中式光伏电站接入配电网的全生命周期管理需求，提供电网诊断、潮流计算、规划辅助、场景仿真、成果管理等核心功能模块，支撑电网规划人员、运维人员和管理人员进行科学决策。'))
  children.push(para('平台采用B/S架构，前端基于Vue 3框架构建单页应用（SPA），后端基于Express 5提供RESTful API服务，数据层采用SQLite3多数据库架构（电网数据、任务队列、配置分离存储）。核心计算引擎实现了自定义的牛顿-拉夫逊法潮流求解器，支持标准潮流、三相潮流、概率潮流、反向潮流四种计算模式。'))

  children.push(heading('1.2 技术栈', HeadingLevel.HEADING_2))
  children.push(createTable(
    ['层级', '技术选型', '说明'],
    [
      ['前端框架', 'Vue 3 + TypeScript + Vite', '组合式API（<script setup>），TypeScript严格模式'],
      ['UI组件库', 'Element Plus', '企业级中后台UI组件'],
      ['图表可视化', 'ECharts 5.5 + vue-echarts', '支持柱状图/折线图/饼图/散点图/雷达图/仪表盘/热力图'],
      ['拓扑图编辑', '@antv/x6 v3', '力导向拓扑图，内置所有插件（History/Selection/Keyboard/Clipboard/Scroller/Snapline/Dnd）'],
      ['后端框架', 'Express 5 + TypeScript', '模块化架构，每个功能模块独立目录'],
      ['数据库', 'better-sqlite3 + Knex', '多数据库文件：grid.db / tasks.db / config.db'],
      ['认证', 'JWT + bcryptjs', '开发模式支持x-device-id绕过认证'],
      ['共享层', 'packages/shared (TypeScript)', '共享类型定义、常量、工具函数'],
      ['文件处理', 'multer + exceljs + docx + pdfkit', '文件上传、Excel导入导出、Word/PDF报告生成']
    ]
  ))

  children.push(heading('1.3 用户角色体系', HeadingLevel.HEADING_2))
  children.push(para('系统定义四级用户角色，不同角色拥有不同的页面访问和操作权限：'))
  children.push(createTable(
    ['角色', '标识', '权限范围', '典型用户'],
    [
      ['管理员', 'admin', '系统全部功能（含阈值配置、批量计算、型号参数、版本回滚、参数管理）', '系统管理员/IT运维'],
      ['规划员', 'planner', '除阈值配置、批量计算、型号参数外的全部功能', '电网规划工程师'],
      ['操作员', 'operator', '不可访问配电网规划、批量计算、型号参数；在线计算（除任务跟踪viewer扩展）和数据校验可操作', '调度员/运维值班员'],
      ['只读用户', 'viewer', '仅可查看：发电情况（除极端场景）/网架结构/供电质量/指标概览（除阈值配置）/任务跟踪/计算历史/资源/场景（限管理与评估）/规划项目库', '管理层/审计人员']
    ]
  ))

  // ===== 第2章：电网诊断 =====
  children.push(new Paragraph({ children: [new PageBreak()] }))
  children.push(heading('2 电网诊断'))
  children.push(para('电网诊断模块面向电网运行状态的实时监测和诊断分析，覆盖发电情况统计、网架结构评估、供电质量监测三大业务领域，共16个功能页面。'))

  // 2.1 发电情况
  children.push(heading(module211.title))
  module211.features.forEach(f => children.push(...featureBlock(f)))

  // 2.2 网架结构
  children.push(heading(module212.title))
  module212.features.forEach(f => children.push(...featureBlock(f)))

  // 2.3 供电质量
  children.push(heading(module213.title))
  module213.features.forEach(f => children.push(...featureBlock(f)))

  // ===== 第3章：配电网规划 =====
  children.push(new Paragraph({ children: [new PageBreak()] }))
  children.push(heading('3 配电网规划'))
  children.push(para('配电网规划模块面向光伏电站接入配电网的规划设计工作，提供光伏模型集成、布点规划推荐、约束条件配置、消纳方案编制、造价经济分析和设备台账管理等功能，共6个功能页面。权限要求：admin或planner。'))
  module3.features.forEach(f => children.push(...featureBlock(f)))

  // ===== 第4章：成果管理 =====
  children.push(new Paragraph({ children: [new PageBreak()] }))
  children.push(heading('4 成果管理'))
  children.push(para('成果管理模块面向光伏项目的全生命周期管理，从项目立项、类型定义、接入条件审核、可行性评估、投运后成效验证到历史追溯，形成完整的项目管理闭环，共5个功能页面。'))
  module4.features.forEach(f => children.push(...featureBlock(f)))

  // ===== 第5章：潮流分析 =====
  children.push(new Paragraph({ children: [new PageBreak()] }))
  children.push(heading('5 潮流分析'))
  children.push(para('潮流分析是平台的核心计算模块，基于自定义牛顿-拉夫逊法潮流求解器（Newton-Raphson），提供指标概览、数据校验、在线计算（标准/反向/概率/三相四种模式）、批量计算、计算历史和型号参数管理等功能，共13个功能页面。'))
  children.push(para('计算引擎特性：Y-bus导纳矩阵构建 → Jacobian矩阵 → 高斯消元 → PQ/PV/Slack节点类型支持 → 四种计算模式（标准/三相/probabilistic/反向）→ 三种场景模式（normal/fault-N1/solar光伏接入）→ 异步执行（setImmediate循环 + SQLite进度轮询）'))

  // 5.1 指标概览
  children.push(heading(module511.title))
  module511.features.forEach(f => children.push(...featureBlock(f)))

  // 5.2 数据校验
  children.push(heading(module512.title))
  module512.features.forEach(f => children.push(...featureBlock(f)))

  // 5.3 在线计算
  children.push(heading(module513.title))
  module513.features.forEach(f => children.push(...featureBlock(f)))

  // 5.4 批量计算
  children.push(heading(module514.title))
  module514.features.forEach(f => children.push(...featureBlock(f)))

  // 5.5 计算历史
  children.push(heading(module515.title))
  module515.features.forEach(f => children.push(...featureBlock(f)))

  // 5.6 型号参数
  children.push(heading(module516.title))
  module516.features.forEach(f => children.push(...featureBlock(f)))

  // ===== 第6章：资源管理 =====
  children.push(new Paragraph({ children: [new PageBreak()] }))
  children.push(heading('6 资源管理'))
  children.push(para('资源管理模块管理电网中的光伏电站、储能、负荷等资源的模型参数、设备信息和拓扑关联关系，为潮流计算和场景仿真提供准确的基础数据支撑，共3个功能页面。'))
  module6.features.forEach(f => children.push(...featureBlock(f)))

  // ===== 第7章：场景管理 =====
  children.push(new Paragraph({ children: [new PageBreak()] }))
  children.push(heading('7 场景管理'))
  children.push(para('场景管理模块面向电网互动场景（光储协同、削峰填谷、需求响应等）的全流程管理，从场景定义、策略配置、时序仿真、效果评估到人工干预，构建完整的仿真验证闭环，共5个功能页面。'))
  module7.features.forEach(f => children.push(...featureBlock(f)))

  // ===== 附录A：API接口清单 =====
  children.push(new Paragraph({ children: [new PageBreak()] }))
  children.push(heading('附录A：API接口清单'))
  children.push(para('以下列出系统主要的API接口，按模块分组。所有接口统一挂载在 /api/v1/ 前缀下。'))

  const apiModules = [
    {
      name: 'A.1 电网诊断 API', prefix: '/api/v1/grid-diagnosis',
      apis: [
        'GET /stations - 获取电站列表', 'GET /stations/snapshot - 电站实时快照', 'GET /storage-list - 储能列表',
        'GET /pv-output/stats - 发电量统计', 'GET /pv-output/factors - 出力因素分析', 'POST /pv-output/simulate-extreme - 极端场景模拟',
        'POST /pv-output/simulate-extreme/export - 导出极端场景报告', 'GET /carbon/dynamic - 碳排放动态', 'GET /carbon/stats - 碳排放统计',
        'GET /joint-output/analysis - 光储联合出力分析', 'POST /backfeed/detect - 光伏倒送检测',
        'GET /equipment/capacity - 设备承载力', 'GET /equipment/reliability/:id - 设备可靠性', 'GET /equipment/lifecycle/:id - 设备生命周期',
        'POST /equipment/lifecycle/predict - 寿命预测', 'POST /equipment/lifecycle/replacement-plan - 更换计划',
        'GET /power-quality/voltage-fluctuation - 电压波动', 'GET /power-quality/reliability - 供电可靠性', 'GET /power-quality/qualification-rate - 电压合格率',
        'GET /power-quality/equipment-impact - 设备影响', 'GET /power-quality/complaint-stats - 投诉统计', 'GET /power-quality/hotspot-distribution - 热点分布',
        'GET /alerts - 告警列表', 'POST /alerts/:id/acknowledge - 确认告警', 'GET /events/:id/trace - 事件追溯'
      ]
    },
    {
      name: 'A.2 配电网规划 API', prefix: '/api/v1/planning',
      apis: [
        'GET/POST / - 规划方案列表/创建', 'PUT /:id - 更新规划',
        'GET/POST/PUT/DELETE /pv-stations - 光伏电站CRUD',
        'GET/POST /pv-cost-library - 光伏造价库',
        'GET/POST/PUT/DELETE /pv-model-types - 光伏模型类型CRUD', 'GET/POST /pv-model-types/:id/fields - 模型字段管理',
        'GET/POST/DELETE /field-library - 字段库管理',
        'GET/POST /constraint-rules - 约束规则管理',
        'GET /potential-sites - 潜在站点', 'GET /evaluate - 综合评价',
        'POST /spatial-analysis - 空间分析', 'GET /candidate-points - 候选点位',
        'POST /absorption-plans - 生成消纳方案', 'GET/PUT /absorption-plans/:id - 消纳方案详情/更新',
        'GET/POST /absorption-plans/:id/variants - 方案变体',
        'GET/POST/PUT/DELETE /investment-plans - 投资方案CRUD',
        'GET/POST /investment-config - 投资配置',
        'GET/POST/PUT/DELETE /cost-items - 造价参数CRUD', 'GET /unit-cost-params - 单价参数',
        'POST /calculate-investment - 投资计算', 'POST /compare-cost - 造价对比', 'POST /roi-analysis - ROI分析',
        'GET /equipment-ledger/:planId - 设备台账', 'GET /equipment-by-station/:stationId - 按电站查设备',
        'POST/PUT/DELETE /equipment-items - 设备条目CRUD',
        'POST /equipment-lifecycle - 创建生命周期记录', 'GET /equipment-lifecycle/:equipmentId - 生命周期列表'
      ]
    },
    {
      name: 'A.3 成果管理 API', prefix: '/api/v1/achievement',
      apis: [
        'GET/POST/PUT /projects - 项目管理', 'GET/POST/DELETE /projects/:id/documents - 项目文档',
        'GET/POST /projects/:id/access-conditions - 接入条件', 'POST/GET /projects/:id/feasibility - 可行性评估',
        'POST /projects/:id/verify - 成效验证(旧)',
        'GET/POST/PUT/DELETE /operation-projects - 投运项目CRUD', 'GET /available-stations - 可选电站',
        'GET/POST /operation-projects/:id/verifications - 成效验证',
        'GET /projects/:id/trace - 历史追溯',
        'GET/POST/PUT/DELETE /project-types - 项目类型CRUD', 'GET /project-types/with-fields - 类型+字段',
        'GET/POST /project-types/:id/fields - 类型字段管理',
        'GET/POST/DELETE /project-field-library - 字段库管理',
        'GET/POST/PUT/DELETE /condition-plans - 条件计划CRUD',
        'GET/POST/PUT /access-points - 接入点CRUD', 'POST /access-points/import - 批量导入'
      ]
    },
    {
      name: 'A.4 潮流计算 API', prefix: '/api/v1/power-flow',
      apis: [
        'GET /indicators - 指标总览', 'GET /indicators/node-stability - 节点稳定性', 'GET /indicators/three-phase - 三相不平衡',
        'GET/PUT /thresholds - 阈值配置',
        'POST /calculate/standard - 标准潮流', 'POST /calculate/reverse - 反向潮流', 'POST /calculate/probabilistic - 概率潮流', 'POST /calculate/three-phase - 三相潮流',
        'GET /calculate/:taskId/progress - 任务进度', 'GET /calculate/:taskId/result - 计算结果',
        'POST /calculate/:taskId/pause - 暂停', 'POST /calculate/:taskId/resume - 恢复', 'GET /tasks - 任务列表',
        'POST /batch - 提交批量配置', 'GET /batch - 批量列表', 'GET /batch/:groupId - 批次详情', 'GET /batch/:groupId/status - 批次状态',
        'POST /batch/:groupId/cancel - 取消批次', 'DELETE /batch/:groupId - 删除批次', 'GET /batch/:groupId/results - 批量结果', 'GET /batch/:groupId/export - 导出结果',
        'GET /history - 历史列表', 'GET /history/compare - 版本对比', 'POST /history/reuse/:id - 复用历史',
        'POST /history/:taskId/lock - 锁定', 'DELETE /history/:taskId - 删除', 'POST /history/cleanup - 清理过期',
        'GET /grid/buses - 母线', 'GET /grid/loads - 负荷', 'GET /grid/generators - 发电机', 'GET /grid/branches - 支路',
        'GET /solar-stations - 光伏电站', 'GET /feeders - 馈线',
        'GET /phase-data-summary - 相数据汇总', 'POST /phase-data/detail - 相数据明细'
      ]
    },
    {
      name: 'A.5 型号参数 API', prefix: '/api/v1/power-flow/model-params',
      apis: [
        'GET/POST/PUT/DELETE /curve-templates - 曲线模板CRUD', 'GET /curve-templates/all - 全部模板',
        'POST /curve-templates/:id/rollback - 回滚', 'GET /curve-templates/:rootId/versions - 版本历史',
        'GET/POST/PUT/DELETE /confidence-settings - 置信系数CRUD', 'GET /confidence-settings/all - 全部配置',
        'POST /confidence-settings/:id/rollback - 回滚', 'GET /confidence-settings/:rootId/versions - 版本历史',
        'GET/POST/PUT /station-models - 电站模型CRUD', 'GET /station-models/all - 全部模型',
        'POST /station-models/:id/rollback - 回滚', 'GET /station-models/compare - 版本对比',
        'GET /station-models/:rootId/versions - 版本历史', 'POST /station-models/export - 导出'
      ]
    },
    {
      name: 'A.6 资源管理 API', prefix: '/api/v1/resource',
      apis: [
        'GET/POST/PUT/DELETE /models - 资源模型CRUD', 'GET /models/:id/health - 模型健康度', 'GET /models/:id/storage-life - 储能寿命',
        'GET/POST/PUT/DELETE /power-plants - 电站CRUD', 'POST /power-plants/batch-import - 批量导入',
        'GET /power-plants/:id/versions - 电站版本', 'POST /power-plants/:id/bind-models - 绑定模型',
        'GET/POST /equipment - 设备列表/新增', 'GET/PUT /equipment/:id - 设备详情/更新',
        'GET /topology - 光伏电网拓扑', 'GET /topology/nodes-by-type/:type - 按类型查节点',
        'POST /topology/source-nodes - 创建源节点', 'POST /topology/grid-nodes - 创建电网节点',
        'GET/POST/PUT/DELETE /topology/connections - 连接属性CRUD',
        'GET/POST/PUT/DELETE /topology/load-entities - 负荷实体CRUD',
        'GET/POST/PUT/DELETE /topology/storage-entities - 储能实体CRUD'
      ]
    },
    {
      name: 'A.7 场景管理 API', prefix: '/api/v1/scenario',
      apis: [
        'GET/POST/PUT/DELETE /scenarios - 场景CRUD', 'POST /scenarios/batch-delete - 批量删除',
        'POST /scenarios/:id/copy - 复制', 'POST /scenarios/batch-copy - 批量复制',
        'GET /scenarios/:id/versions - 版本历史', 'POST /scenarios/:id/restore-version/:vid - 恢复版本',
        'POST /scenarios/preview - 预览', 'POST /scenarios/export - 导出',
        'GET/POST/PUT/DELETE /strategies - 策略CRUD', 'POST /strategies/generate - 自动生成策略',
        'GET/POST /simulations - 模拟列表/启动', 'GET /simulations/running - 运行中模拟',
        'GET /simulations/:id - 模拟详情', 'PUT /simulations/:id/stop|pause|resume - 控制',
        'PUT /simulations/:id/params - 修改参数', 'GET /simulations/:id/results - 结果', 'GET /simulations/:id/live - 实时数据',
        'GET/POST /evaluations - 评估列表/生成', 'GET /evaluations/:id/export - 导出评估',
        'GET/POST /interventions - 干预列表/创建', 'GET /interventions/export - 导出干预'
      ]
    },
    {
      name: 'A.8 数据校验 API', prefix: '/api/v1/data-validation',
      apis: [
        'POST /pv-completeness - 光伏数据完整性校验',
        'POST /boundary - 边界条件合理性校验',
        'POST /time-series - 时序数据一致性校验'
      ]
    }
  ]

  apiModules.forEach(mod => {
    children.push(heading(mod.name, HeadingLevel.HEADING_2))
    children.push(para(`基础路径：${mod.prefix}`))
    mod.apis.forEach(a => children.push(para(`  • ${a}`)))
  })

  // ===== 附录B：数据库表结构概要 =====
  children.push(new Paragraph({ children: [new PageBreak()] }))
  children.push(heading('附录B：数据库表结构概要'))
  children.push(para('系统采用SQLite3多数据库架构，包含约70张数据表。以下列出核心业务表及其用途：'))
  children.push(createTable(dbTables.headers, dbTables.rows))

  // ===== 附录C：角色权限矩阵 =====
  children.push(new Paragraph({ children: [new PageBreak()] }))
  children.push(heading('附录C：角色权限矩阵'))
  children.push(para('以下表格展示各角色在不同功能模块的访问权限：'))
  children.push(createTable(roleMatrix.headers, roleMatrix.rows))

  // ===== 构建文档 =====
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Microsoft YaHei', size: 21 },
          paragraph: { spacing: { line: 360 } }
        }
      }
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.2)
          }
        }
      },
      children
    }]
  })

  const buffer = await Packer.toBuffer(doc)
  const outPath = 'C:\\Users\\PC\\Desktop\\需求文档.docx'
  fs.writeFileSync(outPath, buffer)
  console.log(`需求文档已生成：${outPath}`)
  console.log(`文件大小：${(buffer.length / 1024).toFixed(0)} KB`)
}

main().catch(err => {
  console.error('生成失败：', err)
  process.exit(1)
})
