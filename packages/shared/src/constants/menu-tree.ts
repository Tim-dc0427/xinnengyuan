import type { MenuTreeNode } from '../types/common.js'

export const MENU_TREE: MenuTreeNode[] = [
  {
    key: '_group_电网诊断',
    title: '电网诊断',
    children: [
      {
        key: '/grid-diagnosis/power-generation',
        path: '/grid-diagnosis/power-generation',
        title: '发电情况',
        children: [
          { key: '/grid-diagnosis/power-generation/stats', path: '/grid-diagnosis/power-generation/stats', title: '发电量统计分析' },
          { key: '/grid-diagnosis/power-generation/factors', path: '/grid-diagnosis/power-generation/factors', title: '出力影响因素分析' },
          { key: '/grid-diagnosis/power-generation/extreme', path: '/grid-diagnosis/power-generation/extreme', title: '极端场景模拟分析' },
          { key: '/grid-diagnosis/power-generation/carbon', path: '/grid-diagnosis/power-generation/carbon', title: '碳排放量统计分析' },
          { key: '/grid-diagnosis/power-generation/joint', path: '/grid-diagnosis/power-generation/joint', title: '光储联合出力分析' },
        ],
      },
      {
        key: '/grid-diagnosis/grid-structure',
        path: '/grid-diagnosis/grid-structure',
        title: '网架结构',
        children: [
          { key: '/grid-diagnosis/grid-structure/backfeed', path: '/grid-diagnosis/grid-structure/backfeed', title: '光伏倒送场景判断' },
          { key: '/grid-diagnosis/grid-structure/capacity', path: '/grid-diagnosis/grid-structure/capacity', title: '设备承载力量化计算' },
          { key: '/grid-diagnosis/grid-structure/reliability', path: '/grid-diagnosis/grid-structure/reliability', title: '设备可靠性评估' },
          { key: '/grid-diagnosis/grid-structure/lifecycle', path: '/grid-diagnosis/grid-structure/lifecycle', title: '设备寿命周期管理' },
        ],
      },
      {
        key: '/grid-diagnosis/power-quality',
        path: '/grid-diagnosis/power-quality',
        title: '供电质量',
        children: [
          { key: '/grid-diagnosis/power-quality/fluctuation', path: '/grid-diagnosis/power-quality/fluctuation', title: '并网点电压波动监测' },
          { key: '/grid-diagnosis/power-quality/reliability', path: '/grid-diagnosis/power-quality/reliability', title: '供电可靠性计算' },
          { key: '/grid-diagnosis/power-quality/qualification', path: '/grid-diagnosis/power-quality/qualification', title: '电压合格率统计' },
          { key: '/grid-diagnosis/power-quality/alerts', path: '/grid-diagnosis/power-quality/alerts', title: '供电质量预警机制' },
          { key: '/grid-diagnosis/power-quality/event-trace', path: '/grid-diagnosis/power-quality/event-trace', title: '历史事件追溯分析' },
          { key: '/grid-diagnosis/power-quality/impact', path: '/grid-diagnosis/power-quality/impact', title: '电压波动影响分析' },
        ],
      },
    ],
  },
  {
    key: '_group_规划编制',
    title: '规划编制',
    children: [
      {
        key: '/planning/distribution',
        path: '/planning/distribution',
        title: '配电网规划',
        children: [
          { key: '/planning/distribution/pv-model', path: '/planning/distribution/pv-model', title: '集中式光伏模型集成' },
          { key: '/planning/distribution/site-planning', path: '/planning/distribution/site-planning', title: '布点规划智能推荐' },
          { key: '/planning/distribution/absorption-scheme', path: '/planning/distribution/absorption-scheme', title: '消纳方案智能编制' },
          { key: '/planning/distribution/cost-analysis', path: '/planning/distribution/cost-analysis', title: '造价管理与经济性分析' },
          { key: '/planning/distribution/equipment-ledger', path: '/planning/distribution/equipment-ledger', title: '设备台账动态管理' },
        ],
      },
    ],
  },
  {
    key: '_group_成果管理',
    title: '成果管理',
    children: [
      {
        key: '/achievement/projects',
        path: '/achievement/projects',
        title: '规划项目库',
        children: [
          { key: '/achievement/projects/type-mgmt', path: '/achievement/projects/type-mgmt', title: '光伏项目类型兼容' },
          { key: '/achievement/projects/access-conditions', path: '/achievement/projects/access-conditions', title: '接入条件数字化管理' },
          { key: '/achievement/projects/feasibility', path: '/achievement/projects/feasibility', title: '并网可行性综合分析' },
          { key: '/achievement/projects/effectiveness', path: '/achievement/projects/effectiveness', title: '项目成效验证评估' },
          { key: '/achievement/projects/traceability', path: '/achievement/projects/traceability', title: '项目留痕与追溯' },
        ],
      },
    ],
  },
  {
    key: '_group_潮流计算',
    title: '潮流计算',
    children: [
      {
        key: '/power-flow/indicators',
        path: '/power-flow/indicators',
        title: '指标概览',
        children: [
          { key: '/power-flow/indicators/overview', path: '/power-flow/indicators/overview', title: '综合概览' },
          { key: '/power-flow/indicators/voltage-stability', path: '/power-flow/indicators/voltage-stability', title: '节点电压稳定性' },
          { key: '/power-flow/indicators/imbalance', path: '/power-flow/indicators/imbalance', title: '三相不平衡度' },
          { key: '/power-flow/indicators/thresholds', path: '/power-flow/indicators/thresholds', title: '阈值配置' },
        ],
      },
      {
        key: '/power-flow/data-validation',
        path: '/power-flow/data-validation',
        title: '数据校验',
        children: [
          { key: '/power-flow/data-validation/pv-completeness/check', path: '/power-flow/data-validation/pv-completeness/check', title: '数据完整性校验维度' },
          { key: '/power-flow/data-validation/pv-completeness/report', path: '/power-flow/data-validation/pv-completeness/report', title: '数据质量报告生成' },
          { key: '/power-flow/data-validation/boundary', path: '/power-flow/data-validation/boundary', title: '边界条件合理性校验' },
          { key: '/power-flow/data-validation/time-sync', path: '/power-flow/data-validation/time-sync', title: '时序数据一致性校验' },
        ],
      },
      {
        key: '/power-flow/online',
        path: '/power-flow/online',
        title: '在线计算',
        children: [
          { key: '/power-flow/online/standard', path: '/power-flow/online/standard', title: '潮流计算支持' },
          { key: '/power-flow/online/reverse', path: '/power-flow/online/reverse', title: '反向潮流计算支持' },
          { key: '/power-flow/online/probabilistic', path: '/power-flow/online/probabilistic', title: '概率潮流计算支持' },
          { key: '/power-flow/online/three-phase', path: '/power-flow/online/three-phase', title: '三相潮流计算支持' },
          { key: '/power-flow/online/tasks', path: '/power-flow/online/tasks', title: '异步计算及进度跟踪' },
        ],
      },
      {
        key: '/power-flow/batch',
        path: '/power-flow/batch',
        title: '批量计算',
        children: [
          { key: '/power-flow/batch/config', path: '/power-flow/batch/config', title: '参数配置' },
          { key: '/power-flow/batch/monitor', path: '/power-flow/batch/monitor', title: '任务监控' },
          { key: '/power-flow/batch/results', path: '/power-flow/batch/results', title: '结果分析' },
        ],
      },
      {
        key: '/power-flow/history',
        path: '/power-flow/history',
        title: '计算历史',
        children: [
          { key: '/power-flow/history/management', path: '/power-flow/history/management', title: '历史记录管理' },
        ],
      },
      {
        key: '/power-flow/model-params',
        path: '/power-flow/model-params',
        title: '型号参数',
        children: [
          { key: '/power-flow/model-params/management', path: '/power-flow/model-params/management', title: '参数管理' },
          { key: '/power-flow/model-params/versioning', path: '/power-flow/model-params/versioning', title: '参数版本控制' },
        ],
      },
    ],
  },
  {
    key: '_group_互动资源管理',
    title: '互动资源管理',
    children: [
      {
        key: '/resources/hub',
        path: '/resources/hub',
        title: '互动资源库',
        children: [
          { key: '/resources/hub/models', path: '/resources/hub/models', title: '资源模型构建' },
          { key: '/resources/hub/maintenance', path: '/resources/hub/maintenance', title: '资源维护' },
          { key: '/resources/hub/topology', path: '/resources/hub/topology', title: '资源关联关系' },
        ],
      },
      {
        key: '/resources/scenarios',
        path: '/resources/scenarios',
        title: '互动场景库',
        children: [
          { key: '/resources/scenarios/management', path: '/resources/scenarios/management', title: '互动场景管理' },
          { key: '/resources/scenarios/strategy', path: '/resources/scenarios/strategy', title: '互动场景策略管理' },
          { key: '/resources/scenarios/simulation', path: '/resources/scenarios/simulation', title: '场景模拟验证' },
          { key: '/resources/scenarios/evaluation', path: '/resources/scenarios/evaluation', title: '场景执行效果评估' },
          { key: '/resources/scenarios/intervention', path: '/resources/scenarios/intervention', title: '场景策略人工干预' },
        ],
      },
    ],
  },
  {
    key: '_group_系统管理',
    title: '系统管理',
    children: [
      { key: '/system/users', path: '/system/users', title: '用户管理' },
      { key: '/system/roles', path: '/system/roles', title: '角色管理' },
      { key: '/system/departments', path: '/system/departments', title: '组织管理' },
      { key: '/system/audit-logs', path: '/system/audit-logs', title: '操作日志' },
    ],
  },
]

export const ALL_ACTIONS = [
  { value: 'view', label: '查看' },
  { value: 'create', label: '新增' },
  { value: 'edit', label: '编辑' },
  { value: 'delete', label: '删除' },
  { value: 'export', label: '导出' },
  { value: 'import', label: '导入' },
  { value: 'calculate', label: '计算' },
  { value: 'config', label: '配置' },
  { value: 'execute', label: '执行控制' },
]

/** 提取所有叶子节点（三级路由）的 path，用于菜单权限匹配 */
export function collectLeafPaths(nodes: MenuTreeNode[]): string[] {
  const result: string[] = []
  function walk(list: MenuTreeNode[]) {
    for (const n of list) {
      if (n.children && n.children.length > 0) {
        walk(n.children)
      } else if (n.path) {
        result.push(n.path)
      }
    }
  }
  walk(nodes)
  return result
}

export const ALL_MENU_PATHS: string[] = collectLeafPaths(MENU_TREE)

/** 根据 menus 权限过滤侧边栏菜单树，返回过滤后的树 */
export function filterMenuTree(tree: MenuTreeNode[], menus: string[]): MenuTreeNode[] {
  if (menus.includes('*')) return tree

  function filter(nodes: MenuTreeNode[]): MenuTreeNode[] {
    const result: MenuTreeNode[] = []
    for (const n of nodes) {
      if (n.children && n.children.length > 0) {
        const filteredChildren = filter(n.children)
        if (filteredChildren.length > 0) {
          result.push({ ...n, children: filteredChildren })
        }
      } else if (n.path && menus.includes(n.path)) {
        result.push(n)
      }
    }
    return result
  }
  return filter(tree)
}
