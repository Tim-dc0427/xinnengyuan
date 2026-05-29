<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Monitor, Edit, Collection, DataAnalysis, Connection } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const expandedGroup = ref<string | null>(null)
const expandedSubGroups = ref<Set<string>>(new Set())

interface MenuItem {
  path?: string
  title: string
  icon?: any
  children?: MenuItem[]
}

const menuItems: MenuItem[] = [
  {
    title: '电网诊断', icon: Monitor,
    children: [
      { path: '/grid-diagnosis/power-generation', title: '发电情况' },
      { path: '/grid-diagnosis/grid-structure', title: '网架结构' },
      { path: '/grid-diagnosis/power-quality', title: '供电质量' },
    ],
  },
  {
    title: '规划编制', icon: Edit,
    children: [
      {
        title: '配电网规划',
        children: [
          { path: '/planning/distribution/pv-model', title: '集中式光伏模型集成' },
          { path: '/planning/distribution/site-planning', title: '布点规划智能推荐' },
          { path: '/planning/distribution/absorption-scheme', title: '消纳方案智能编制' },
          { path: '/planning/distribution/cost-analysis', title: '造价管理与经济性分析' },
          { path: '/planning/distribution/equipment-ledger', title: '设备台账动态管理' },
        ],
      },
    ],
  },
  {
    title: '成果管理', icon: Collection,
    children: [
      {
        title: '规划项目库',
        children: [
          { path: '/achievement/projects/type-mgmt', title: '光伏项目类型兼容' },
          { path: '/achievement/projects/access-conditions', title: '接入条件数字化管理' },
          { path: '/achievement/projects/feasibility', title: '并网可行性综合分析' },
          { path: '/achievement/projects/effectiveness', title: '项目成效验证评估' },
          { path: '/achievement/projects/traceability', title: '项目留痕与追溯' },
        ],
      },
    ],
  },
  {
    title: '潮流计算', icon: DataAnalysis,
    children: [
      {
        title: '指标概览',
        children: [
          { path: '/power-flow/indicators/overview', title: '综合概览' },
          { path: '/power-flow/indicators/voltage-stability', title: '节点电压稳定性' },
          { path: '/power-flow/indicators/imbalance', title: '三相不平衡度' },
          { path: '/power-flow/indicators/thresholds', title: '阈值配置' },
        ],
      },
      {
        title: '数据校验',
        children: [
          { path: '/power-flow/data-validation/completeness', title: '光伏数据完整性校验' },
          { path: '/power-flow/data-validation/boundary', title: '边界条件合理性校验' },
          { path: '/power-flow/data-validation/time-sync', title: '时序数据一致性校验' },
        ],
      },
      {
        title: '在线计算',
        children: [
          { path: '/power-flow/online/standard', title: '潮流计算支持' },
          { path: '/power-flow/online/reverse', title: '反向潮流计算支持' },
          { path: '/power-flow/online/probabilistic', title: '概率潮流计算支持' },
          { path: '/power-flow/online/three-phase', title: '三相潮流计算支持' },
          { path: '/power-flow/online/tasks', title: '异步计算及进度跟踪' },
        ],
      },
      {
        title: '批量计算',
        children: [
          { path: '/power-flow/batch/config', title: '参数配置' },
          { path: '/power-flow/batch/monitor', title: '任务监控' },
          { path: '/power-flow/batch/results', title: '结果分析' },
        ],
      },
      { path: '/power-flow/history', title: '计算历史' },
      {
        title: '型号参数',
        children: [
          { path: '/power-flow/model-params/management', title: '参数管理' },
          { path: '/power-flow/model-params/versioning', title: '参数版本控制' },
        ],
      },
    ],
  },
  {
    title: '互动资源管理', icon: Connection,
    children: [
      {
        title: '互动资源库',
        children: [
          { path: '/resources/hub/models', title: '资源模型构建' },
          { path: '/resources/hub/maintenance', title: '资源维护' },
          { path: '/resources/hub/topology', title: '资源关联关系' },
        ],
      },
      {
        title: '互动场景库',
        children: [
          { path: '/resources/scenarios/management', title: '互动场景管理' },
          { path: '/resources/scenarios/strategy', title: '互动场景策略管理' },
          { path: '/resources/scenarios/simulation', title: '场景模拟与验证' },
          { path: '/resources/scenarios/evaluation', title: '场景执行效果评估' },
          { path: '/resources/scenarios/intervention', title: '场景策略人工干预' },
        ],
      },
    ],
  },
]

// 当前展开的一级菜单项
const activeGroupItem = computed(() => {
  if (!expandedGroup.value) return null
  return menuItems.find(m => m.title === expandedGroup.value) || null
})

// 判断路径是否属于某菜单组
function isGroupActive(item: MenuItem): boolean {
  const p = route.path
  const check = (children: MenuItem[] | undefined): boolean => {
    if (!children) return false
    for (const c of children) {
      if (c.path && p.startsWith(c.path)) return true
      if (c.path === p) return true
      if (check(c.children)) return true
    }
    return false
  }
  return check(item.children)
}

function isItemActive(path: string | undefined): boolean {
  if (!path) return false
  return route.path === path || route.path.startsWith(path + '/') || route.path.startsWith(path + '?')
}

// 根据当前路由自动展开对应的一级菜单
function syncExpandedGroup() {
  for (const item of menuItems) {
    if (isGroupActive(item)) {
      expandedGroup.value = item.title
      return
    }
  }
}
syncExpandedGroup()
watch(() => route.path, syncExpandedGroup)

// 根据当前路由自动展开对应的二级分组
function syncSubGroups() {
  const group = activeGroupItem.value
  if (!group) return
  for (const child of (group.children || [])) {
    if (child.children && child.children.some(c => isItemActive(c.path))) {
      expandedSubGroups.value.add(child.title)
    }
  }
}
watch(() => [route.path, expandedGroup.value], () => {
  syncSubGroups()
}, { immediate: true })

function toggleSubGroup(title: string) {
  if (expandedSubGroups.value.has(title)) {
    expandedSubGroups.value.delete(title)
  } else {
    expandedSubGroups.value.add(title)
  }
}

// 点击一级菜单
function handleGroupClick(item: MenuItem) {
  if (item.children && item.children.length > 0) {
    expandedGroup.value = expandedGroup.value === item.title ? null : item.title
  }
}

// 点击叶子菜单项
function handleItemClick(it: MenuItem) {
  if (it.path) {
    router.push(it.path)
  }
}

function isSubGroupActive(item: MenuItem): boolean {
  if (!item.children) return false
  return item.children.some(c => isItemActive(c.path))
}

</script>

<template>
  <aside :class="['app-sidebar', { expanded: !!expandedGroup }]">
    <!-- Logo -->
    <div class="logo">
      <span class="logo-text">新能源智能分析</span>
    </div>

    <!-- 菜单主体 -->
    <div class="menu-body">
      <!-- 一级菜单列 -->
      <div class="menu-primary">
        <div
          v-for="item in menuItems"
          :key="item.title"
          :class="['menu-item-primary', { active: expandedGroup === item.title || isGroupActive(item) }]"
          @click="handleGroupClick(item)"
        >
          <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
          <span class="menu-label">{{ item.title }}</span>
          <el-icon v-if="item.children" class="menu-arrow"><Fold /></el-icon>
        </div>
      </div>

      <!-- 子菜单抽屉 -->
      <div v-if="activeGroupItem" class="menu-sub">
        <template v-for="child in activeGroupItem.children" :key="child.title">
          <!-- 有子菜单的二级 -->
          <template v-if="child.children && child.children.length > 0">
            <div
              :class="['menu-sub-group-title', { active: isSubGroupActive(child) }]"
              @click="toggleSubGroup(child.title)"
            >
              <span>{{ child.title }}</span>
              <span :class="['sub-group-arrow', { open: expandedSubGroups.has(child.title) }]">▾</span>
            </div>
            <div
              v-for="grandchild in child.children"
              v-show="expandedSubGroups.has(child.title)"
              :key="grandchild.path"
              :class="['menu-sub-item', { active: isItemActive(grandchild.path) }]"
              @click="handleItemClick(grandchild)"
            >
              {{ grandchild.title }}
            </div>
          </template>
          <!-- 叶子菜单项 -->
          <div
            v-else
            :class="['menu-sub-item', { active: isItemActive(child.path) }]"
            @click="handleItemClick(child)"
          >
            {{ child.title }}
          </div>
        </template>
      </div>
    </div>

  </aside>
</template>

<style scoped>
.app-sidebar {
  width: var(--sidebar-width);
  background: #267F7B;
  display: flex;
  flex-direction: column;
  transition: width 0.25s;
  flex-shrink: 0;
  overflow: hidden;
}
/* Logo */
.logo {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 16px;
  font-weight: bold;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  flex-shrink: 0;
}
.logo-text { white-space: nowrap; }

/* 菜单主体：一行两列 */
.menu-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.menu-primary {
  width: var(--sidebar-width);
  flex-shrink: 1;
  min-width: 64px;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  padding: 4px 0;
  transition: width 0.2s;
}
/* 展开子菜单时挤压一级列，保留文字去掉图标 */
.menu-body:has(.menu-sub) .menu-primary {
  width: 100px;
}
.menu-body:has(.menu-sub) .menu-primary .menu-item-primary {
  padding: 0 12px;
  font-size: 13px;
  gap: 0;
}
.menu-body:has(.menu-sub) .menu-primary :deep(.el-icon) {
  display: none;
}
.menu-sub {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 0;
  background: #EBFDFD;
}

/* 一级菜单项 */
.menu-item-primary {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  height: 48px;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  font-size: 14px;
  transition: background 0.15s;
  white-space: nowrap;
}
.menu-item-primary:hover {
  background: rgba(255, 255, 255, 0.08);
}
.menu-item-primary.active {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}
.menu-label { flex: 1; }
.menu-arrow {
  font-size: 12px;
  transform: rotate(-90deg);
  opacity: 0.5;
}

/* 子菜单分组标题 */
.menu-sub-group-title {
  padding: 6px 16px 4px;
  font-size: 14px;
  color: #267F7B;
  margin-top: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
}
.menu-sub-group-title:hover {
  opacity: 0.7;
}
.menu-sub-group-title.active {
  font-weight: 600;
}
.sub-group-arrow {
  font-size: 12px;
  transition: transform 0.2s;
  opacity: 0.6;
}
.sub-group-arrow.open {
  transform: rotate(180deg);
}
/* 子菜单链接项 */
.menu-sub-item {
  padding: 0 20px;
  height: 40px;
  display: flex;
  align-items: center;
  color: #267F7B;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.15s;
}
.menu-sub-item:hover {
  background: rgba(38, 127, 123, 0.08);
}
.menu-sub-item.active {
  background: rgba(38, 127, 123, 0.15);
  font-weight: 600;
}

</style>
