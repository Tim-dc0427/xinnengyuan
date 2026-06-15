<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Monitor, Edit, Collection, DataAnalysis, Connection, Setting, ArrowDown } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth.store'
import { MENU_TREE } from '@new-energy/shared'
import type { MenuTreeNode } from '@new-energy/shared'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const expandedGroup = ref<string | null>(null)

interface MenuItem {
  path?: string
  title: string
  icon?: any
  children?: MenuItem[]
}

const allMenuItems: MenuItem[] = [
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
      { path: '/planning/distribution', title: '配电网规划' },
    ],
  },
  {
    title: '成果管理', icon: Collection,
    children: [
      { path: '/achievement/projects', title: '规划项目库' },
    ],
  },
  {
    title: '潮流计算', icon: DataAnalysis,
    children: [
      { path: '/power-flow/indicators', title: '指标概览' },
      { path: '/power-flow/data-validation', title: '数据校验' },
      { path: '/power-flow/online', title: '在线计算' },
      { path: '/power-flow/batch', title: '批量计算' },
      { path: '/power-flow/history', title: '计算历史' },
      { path: '/power-flow/model-params', title: '型号参数' },
    ],
  },
  {
    title: '互动资源管理', icon: Connection,
    children: [
      { path: '/resources/hub', title: '互动资源库' },
      { path: '/resources/scenarios', title: '互动场景库' },
    ],
  },
  {
    title: '系统管理', icon: Setting,
    children: [
      { path: '/system/users', title: '用户管理' },
      { path: '/system/roles', title: '角色管理' },
      { path: '/system/departments', title: '组织管理' },
      { path: '/system/audit-logs', title: '操作日志' },
    ],
  },
]

// 建立侧边栏二级 path → MENU_TREE 中对应节点的映射，用于收集其下所有叶子 path
function buildLeafMap(): Map<string, string[]> {
  const map = new Map<string, string[]>()
  function collectLeaves(node: MenuTreeNode): string[] {
    if (!node.children || node.children.length === 0) {
      return node.path ? [node.path] : []
    }
    const leaves: string[] = []
    for (const c of node.children) {
      leaves.push(...collectLeaves(c))
    }
    return leaves
  }
  for (const group of MENU_TREE) {
    if (group.children) {
      for (const child of group.children) {
        if (child.path) {
          map.set(child.path, collectLeaves(child))
        }
      }
    }
  }
  return map
}
const hubToLeaves = buildLeafMap()

// 判断某个二级菜单 path 是否有权限访问（至少一个叶子在 menus 中）
function hasAccessToHub(hubPath: string): boolean {
  const menus = authStore.permissions.menus
  if (menus.includes('*')) return true
  const leaves = hubToLeaves.get(hubPath)
  if (!leaves || leaves.length === 0) return menus.includes(hubPath)
  return leaves.some(p => menus.includes(p))
}

// 过滤后的菜单
function buildFilteredMenu(): MenuItem[] {
  const result: MenuItem[] = []
  for (const group of allMenuItems) {
    const filteredChildren = (group.children || []).filter(c => hasAccessToHub(c.path || ''))
    if (filteredChildren.length > 0) {
      result.push({ ...group, children: filteredChildren })
    }
  }
  return result
}
const menuItems = computed<MenuItem[]>(() => buildFilteredMenu())

// 当前展开的一级菜单项
const activeGroupItem = computed(() => {
  if (!expandedGroup.value) return null
  return menuItems.value.find(m => m.title === expandedGroup.value) || null
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
  for (const item of menuItems.value) {
    if (isGroupActive(item)) {
      expandedGroup.value = item.title
      return
    }
  }
}
syncExpandedGroup()
watch(() => route.path, syncExpandedGroup)

// 点击一级菜单
function handleGroupClick(item: MenuItem) {
  if (item.children && item.children.length > 0) {
    expandedGroup.value = expandedGroup.value === item.title ? null : item.title
  }
}

// 点击二级菜单项（跳转 Hub，如有权限则跳第一个有权限的子页面）
function handleItemClick(it: MenuItem) {
  if (it.path) {
    router.push(it.path)
  }
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
          <el-icon v-if="item.children" class="menu-arrow"><ArrowDown /></el-icon>
        </div>
      </div>

      <!-- 二级菜单抽屉 -->
      <div v-if="activeGroupItem" class="menu-sub">
        <div
          v-for="child in activeGroupItem.children"
          :key="child.path || child.title"
          :class="['menu-sub-item', { active: isItemActive(child.path) }]"
          @click="handleItemClick(child)"
        >
          {{ child.title }}
        </div>
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

/* 二级菜单链接项 */
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
