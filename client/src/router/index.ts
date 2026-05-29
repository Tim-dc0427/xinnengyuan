import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', noAuth: true },
  },
  {
    path: '/',
    redirect: '/grid-diagnosis/power-generation',
    component: () => import('@/components/common/AppLayout.vue'),
    children: [
      // Module 1: Grid Diagnosis
      {
        path: 'grid-diagnosis/power-generation',
        name: 'PowerGeneration',
        component: () => import('@/views/grid-diagnosis/PowerGeneration.vue'),
        meta: { title: '发电情况', roles: ['admin', 'planner', 'operator', 'viewer'] },
      },
      {
        path: 'grid-diagnosis/grid-structure',
        name: 'GridStructure',
        component: () => import('@/views/grid-diagnosis/GridStructure.vue'),
        meta: { title: '网架结构', roles: ['admin', 'planner', 'operator', 'viewer'] },
      },
      {
        path: 'grid-diagnosis/power-quality',
        name: 'PowerQuality',
        component: () => import('@/views/grid-diagnosis/PowerQuality.vue'),
        meta: { title: '供电质量', roles: ['admin', 'planner', 'operator', 'viewer'] },
      },
      // Module 2: Planning — Distribution Planning (Hub + 5 children)
      {
        path: 'planning/distribution',
        component: () => import('@/views/planning/DistributionPlanningHub.vue'),
        meta: { title: '配电网规划', roles: ['admin', 'planner'] },
        redirect: '/planning/distribution/pv-model',
        children: [
          {
            path: 'pv-model',
            name: 'PvModelIntegration',
            component: () => import('@/views/planning/PvModelIntegration.vue'),
            meta: { title: '集中式光伏模型集成', roles: ['admin', 'planner'] },
          },
          {
            path: 'site-planning',
            name: 'SitePlanning',
            component: () => import('@/views/planning/SitePlanning.vue'),
            meta: { title: '布点规划智能推荐', roles: ['admin', 'planner'] },
          },
          {
            path: 'constraint-settings',
            name: 'ConstraintSettings',
            component: () => import('@/views/planning/ConstraintSettings.vue'),
            meta: { title: '约束条件配置', roles: ['admin', 'planner'] },
          },
          {
            path: 'absorption-scheme',
            name: 'AbsorptionScheme',
            component: () => import('@/views/planning/AbsorptionScheme.vue'),
            meta: { title: '消纳方案智能编制', roles: ['admin', 'planner'] },
          },
          {
            path: 'cost-analysis',
            name: 'CostAnalysis',
            component: () => import('@/views/planning/CostAnalysis.vue'),
            meta: { title: '造价管理与经济性分析', roles: ['admin', 'planner'] },
          },
          {
            path: 'equipment-ledger',
            name: 'EquipmentLedger',
            component: () => import('@/views/planning/EquipmentLedger.vue'),
            meta: { title: '设备台账动态管理', roles: ['admin', 'planner'] },
          },
        ],
      },
      // Module 3: Achievement — 规划项目库 (Hub + 5 children)
      {
        path: 'achievement/projects',
        component: () => import('@/views/achievement/ProjectPortfolio.vue'),
        meta: { title: '规划项目库', roles: ['admin', 'planner', 'operator', 'viewer'] },
        redirect: '/achievement/projects/type-mgmt',
        children: [
          {
            path: 'type-mgmt',
            name: 'ProjectTypeManagement',
            component: () => import('@/views/achievement/ProjectTypeManagement.vue'),
            meta: { title: '光伏项目类型兼容', roles: ['admin', 'planner', 'operator', 'viewer'] },
          },
          {
            path: 'access-conditions',
            name: 'AccessConditionManagement',
            component: () => import('@/views/achievement/AccessConditionManagement.vue'),
            meta: { title: '接入条件数字化管理', roles: ['admin', 'planner', 'operator', 'viewer'] },
          },
          {
            path: 'feasibility',
            name: 'FeasibilityAnalysis',
            component: () => import('@/views/achievement/FeasibilityAnalysis.vue'),
            meta: { title: '并网可行性综合分析', roles: ['admin', 'planner', 'operator', 'viewer'] },
          },
          {
            path: 'effectiveness',
            name: 'EffectivenessVerification',
            component: () => import('@/views/achievement/EffectivenessVerification.vue'),
            meta: { title: '项目成效验证评估', roles: ['admin', 'planner', 'operator', 'viewer'] },
          },
          {
            path: 'traceability',
            name: 'ProjectTraceability',
            component: () => import('@/views/achievement/ProjectTraceability.vue'),
            meta: { title: '项目留痕与追溯', roles: ['admin', 'planner', 'operator', 'viewer'] },
          },
        ],
      },
      // Module 4: Power Flow
      {
        path: 'power-flow/indicators',
        component: () => import('@/views/power-flow/IndicatorOverview.vue'),
        meta: { title: '指标概览', roles: ['admin', 'planner', 'operator', 'viewer'] },
        redirect: '/power-flow/indicators/overview',
        children: [
          {
            path: 'overview',
            name: 'IndicatorOverview',
            component: () => import('@/views/power-flow/IndicatorDashboard.vue'),
            meta: { title: '综合概览', roles: ['admin', 'planner', 'operator', 'viewer'] },
          },
          {
            path: 'voltage-stability',
            name: 'VoltageStability',
            component: () => import('@/views/power-flow/VoltageStability.vue'),
            meta: { title: '节点电压稳定性', roles: ['admin', 'planner', 'operator', 'viewer'] },
          },
          {
            path: 'imbalance',
            name: 'ImbalanceAssessment',
            component: () => import('@/views/power-flow/ImbalanceAssessment.vue'),
            meta: { title: '三相不平衡度', roles: ['admin', 'planner', 'operator', 'viewer'] },
          },
          {
            path: 'thresholds',
            name: 'ThresholdConfig',
            component: () => import('@/views/power-flow/ThresholdConfig.vue'),
            meta: { title: '阈值配置', roles: ['admin', 'planner'] },
          },
        ],
      },
      {
        path: 'power-flow/data-validation',
        component: () => import('@/views/power-flow/DataValidationHub.vue'),
        meta: { title: '数据校验', roles: ['admin', 'planner', 'operator'] },
        redirect: '/power-flow/data-validation/completeness',
        children: [
          {
            path: 'completeness',
            name: 'PVCompleteness',
            component: () => import('@/views/power-flow/PVCompleteness.vue'),
            meta: { title: '光伏数据完整性校验', roles: ['admin', 'planner', 'operator'] },
          },
          {
            path: 'boundary',
            name: 'BoundaryCheck',
            component: () => import('@/views/power-flow/BoundaryCheck.vue'),
            meta: { title: '边界条件合理性校验', roles: ['admin', 'planner', 'operator'] },
          },
          {
            path: 'time-sync',
            name: 'TimeSyncCheck',
            component: () => import('@/views/power-flow/TimeSyncCheck.vue'),
            meta: { title: '时序数据一致性校验', roles: ['admin', 'planner', 'operator'] },
          },
        ],
      },
      {
        path: 'power-flow/online',
        component: () => import('@/views/power-flow/OnlineCalculationHub.vue'),
        meta: { title: '在线计算', roles: ['admin', 'planner', 'operator'] },
        redirect: '/power-flow/online/standard',
        children: [
          {
            path: 'standard',
            name: 'StandardPowerFlow',
            component: () => import('@/views/power-flow/StandardPowerFlow.vue'),
            meta: { title: '潮流计算支持', roles: ['admin', 'planner', 'operator'] },
          },
          {
            path: 'reverse',
            name: 'ReversePowerFlow',
            component: () => import('@/views/power-flow/ReversePowerFlow.vue'),
            meta: { title: '反向潮流计算支持', roles: ['admin', 'planner', 'operator'] },
          },
          {
            path: 'probabilistic',
            name: 'ProbabilisticPowerFlow',
            component: () => import('@/views/power-flow/ProbabilisticPowerFlow.vue'),
            meta: { title: '概率潮流计算支持', roles: ['admin', 'planner', 'operator'] },
          },
          {
            path: 'three-phase',
            name: 'ThreePhasePowerFlow',
            component: () => import('@/views/power-flow/ThreePhasePowerFlow.vue'),
            meta: { title: '三相潮流计算支持', roles: ['admin', 'planner', 'operator'] },
          },
          {
            path: 'tasks',
            name: 'TaskManagement',
            component: () => import('@/views/power-flow/TaskManagement.vue'),
            meta: { title: '异步计算及进度跟踪', roles: ['admin', 'planner', 'operator', 'viewer'] },
          },
        ],
      },
      {
        path: 'power-flow/batch',
        component: () => import('@/views/power-flow/BatchCalculationHub.vue'),
        meta: { title: '批量计算', roles: ['admin', 'planner'] },
        redirect: '/power-flow/batch/config',
        children: [
          {
            path: 'config',
            name: 'BatchParamConfig',
            component: () => import('@/views/power-flow/batch/ParamConfig.vue'),
            meta: { title: '参数配置', roles: ['admin', 'planner'] },
          },
          {
            path: 'monitor',
            name: 'BatchTaskMonitor',
            component: () => import('@/views/power-flow/batch/TaskMonitor.vue'),
            meta: { title: '任务监控', roles: ['admin', 'planner'] },
          },
          {
            path: 'results',
            name: 'BatchResultAnalysis',
            component: () => import('@/views/power-flow/batch/ResultAnalysis.vue'),
            meta: { title: '结果分析', roles: ['admin', 'planner'] },
          },
        ],
      },
      {
        path: 'power-flow/history',
        name: 'CalculationHistory',
        component: () => import('@/views/power-flow/CalculationHistory.vue'),
        meta: { title: '计算历史', roles: ['admin', 'planner', 'operator', 'viewer'] },
      },
      {
        path: 'power-flow/model-params',
        component: () => import('@/views/power-flow/ModelParametersHub.vue'),
        meta: { title: '型号参数', roles: ['admin', 'planner'] },
        redirect: '/power-flow/model-params/management',
        children: [
          {
            path: 'management',
            name: 'ParamManagement',
            component: () => import('@/views/power-flow/ParamManagement.vue'),
            meta: { title: '参数管理', roles: ['admin', 'planner'] },
          },
          {
            path: 'versioning',
            name: 'ParamVersioning',
            component: () => import('@/views/power-flow/ParamVersioning.vue'),
            meta: { title: '参数版本控制', roles: ['admin', 'planner'] },
          },
        ],
      },
      // Module 5: Resource
      {
        path: 'resources/hub',
        component: () => import('@/views/resource/ResourceHub.vue'),
        meta: { title: '互动资源库', roles: ['admin', 'planner', 'operator', 'viewer'] },
        redirect: '/resources/hub/models',
        children: [
          {
            path: 'models',
            name: 'ResourceModels',
            component: () => import('@/views/resource/ResourceLibrary.vue'),
            meta: { title: '资源模型构建', roles: ['admin', 'planner', 'operator', 'viewer'] },
          },
          {
            path: 'maintenance',
            name: 'ResourceMaintenance',
            component: () => import('@/views/resource/ResourceMaintenance.vue'),
            meta: { title: '资源维护', roles: ['admin', 'planner', 'operator', 'viewer'] },
          },
          {
            path: 'topology',
            name: 'ResourceTopology',
            component: () => import('@/views/resource/ResourceTopology.vue'),
            meta: { title: '资源关联关系', roles: ['admin', 'planner', 'operator', 'viewer'] },
          },
        ],
      },
      {
        path: 'resources/scenarios',
        component: () => import('@/views/scenario/ScenarioHub.vue'),
        meta: { title: '互动场景库', roles: ['admin', 'planner', 'operator', 'viewer'] },
        redirect: '/resources/scenarios/management',
        children: [
          {
            path: 'management',
            name: 'ScenarioManagement',
            component: () => import('@/views/scenario/ScenarioManagement.vue'),
            meta: { title: '互动场景管理', roles: ['admin', 'planner', 'operator', 'viewer'] },
          },
          {
            path: 'strategy',
            name: 'StrategyManagement',
            component: () => import('@/views/scenario/StrategyManagement.vue'),
            meta: { title: '互动场景策略管理', roles: ['admin', 'planner', 'operator'] },
          },
          {
            path: 'simulation',
            name: 'SimulationVerification',
            component: () => import('@/views/scenario/SimulationVerification.vue'),
            meta: { title: '场景模拟与验证', roles: ['admin', 'planner', 'operator'] },
          },
          {
            path: 'evaluation',
            name: 'ExecutionEvaluation',
            component: () => import('@/views/scenario/ExecutionEvaluation.vue'),
            meta: { title: '场景执行效果评估', roles: ['admin', 'planner', 'operator', 'viewer'] },
          },
          {
            path: 'intervention',
            name: 'ManualIntervention',
            component: () => import('@/views/scenario/ManualIntervention.vue'),
            meta: { title: '场景策略人工干预', roles: ['admin', 'planner', 'operator'] },
          },
        ],
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/NotFound.vue'),
  },
]

const base = import.meta.env.BASE_URL

export const router = createRouter({
  history: createWebHistory(base),
  routes,
})

router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title || '系统'} - 新能源智能分析系统`
  next()
})
