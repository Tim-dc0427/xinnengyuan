/**
 * 升级现有角色权限字段到新格式 { menus: string[], actions: string[] }
 * 运行方式: cd server && npx tsx src/common/db/scripts/upgrade_role_permissions.ts
 */
import { db } from '../../../config/database.js'

const ROLE_UPGRADES: Record<string, { menus: string[]; actions: string[] }> = {
  admin: { menus: ['*'], actions: ['*'] },
  planner: {
    menus: [
      '/grid-diagnosis/power-generation/stats', '/grid-diagnosis/power-generation/factors',
      '/grid-diagnosis/power-generation/extreme', '/grid-diagnosis/power-generation/carbon',
      '/grid-diagnosis/power-generation/joint',
      '/grid-diagnosis/grid-structure/backfeed', '/grid-diagnosis/grid-structure/capacity',
      '/grid-diagnosis/grid-structure/reliability', '/grid-diagnosis/grid-structure/lifecycle',
      '/grid-diagnosis/power-quality/fluctuation', '/grid-diagnosis/power-quality/reliability',
      '/grid-diagnosis/power-quality/qualification', '/grid-diagnosis/power-quality/alerts',
      '/grid-diagnosis/power-quality/event-trace', '/grid-diagnosis/power-quality/impact',
      '/planning/distribution/pv-model', '/planning/distribution/site-planning',
      '/planning/distribution/absorption-scheme', '/planning/distribution/cost-analysis',
      '/planning/distribution/equipment-ledger',
      '/achievement/projects/type-mgmt', '/achievement/projects/access-conditions',
      '/achievement/projects/feasibility', '/achievement/projects/effectiveness',
      '/achievement/projects/traceability',
      '/power-flow/indicators/overview', '/power-flow/indicators/voltage-stability',
      '/power-flow/indicators/imbalance', '/power-flow/indicators/thresholds',
      '/power-flow/history/management',
      '/resources/hub/models', '/resources/hub/maintenance', '/resources/hub/topology',
      '/resources/scenarios/management', '/resources/scenarios/strategy',
      '/resources/scenarios/simulation', '/resources/scenarios/evaluation',
      '/resources/scenarios/intervention',
    ],
    actions: ['view', 'create', 'edit', 'delete', 'export', 'import', 'calculate', 'config'],
  },
  operator: {
    menus: [
      '/grid-diagnosis/power-generation/stats', '/grid-diagnosis/power-generation/factors',
      '/grid-diagnosis/power-generation/extreme', '/grid-diagnosis/power-generation/carbon',
      '/grid-diagnosis/power-generation/joint',
      '/grid-diagnosis/grid-structure/backfeed', '/grid-diagnosis/grid-structure/capacity',
      '/grid-diagnosis/grid-structure/reliability', '/grid-diagnosis/grid-structure/lifecycle',
      '/grid-diagnosis/power-quality/fluctuation', '/grid-diagnosis/power-quality/reliability',
      '/grid-diagnosis/power-quality/qualification', '/grid-diagnosis/power-quality/alerts',
      '/grid-diagnosis/power-quality/event-trace', '/grid-diagnosis/power-quality/impact',
      '/power-flow/indicators/overview', '/power-flow/indicators/voltage-stability',
      '/power-flow/indicators/imbalance',
      '/power-flow/data-validation/pv-completeness/check', '/power-flow/data-validation/pv-completeness/report',
      '/power-flow/data-validation/boundary', '/power-flow/data-validation/time-sync',
      '/power-flow/online/standard', '/power-flow/online/reverse',
      '/power-flow/online/probabilistic', '/power-flow/online/three-phase',
      '/power-flow/online/tasks',
      '/power-flow/history/management',
      '/resources/hub/models', '/resources/hub/maintenance', '/resources/hub/topology',
    ],
    actions: ['view', 'calculate', 'export', 'execute', 'config'],
  },
  viewer: {
    menus: [
      '/grid-diagnosis/power-generation/stats', '/grid-diagnosis/power-generation/factors',
      '/grid-diagnosis/power-generation/carbon', '/grid-diagnosis/power-generation/joint',
      '/grid-diagnosis/grid-structure/backfeed', '/grid-diagnosis/grid-structure/capacity',
      '/grid-diagnosis/grid-structure/reliability', '/grid-diagnosis/grid-structure/lifecycle',
      '/grid-diagnosis/power-quality/fluctuation', '/grid-diagnosis/power-quality/reliability',
      '/grid-diagnosis/power-quality/qualification', '/grid-diagnosis/power-quality/alerts',
      '/grid-diagnosis/power-quality/event-trace', '/grid-diagnosis/power-quality/impact',
      '/power-flow/indicators/overview', '/power-flow/indicators/voltage-stability',
      '/power-flow/indicators/imbalance',
      '/power-flow/history/management',
      '/resources/hub/models', '/resources/hub/maintenance', '/resources/hub/topology',
    ],
    actions: ['view', 'export'],
  },
}

async function main() {
  console.log('开始升级角色权限字段...')

  const roles = await db('roles').select('id', 'name', 'permissions')
  for (const role of roles) {
    const upgrade = ROLE_UPGRADES[role.name]
    if (!upgrade) {
      console.log(`  [跳过] ${role.name} — 未定义升级映射`)
      continue
    }
    await db('roles').where('id', role.id).update({
      permissions: JSON.stringify(upgrade),
    })
    console.log(`  [完成] ${role.name}`)
  }

  console.log('角色权限升级完成')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
