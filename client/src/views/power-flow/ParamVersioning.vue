<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchAllCurveTemplates, rollbackCurveTemplate, fetchCurveTemplateVersionHistory,
  fetchAllConfidenceSettings, rollbackConfidenceSetting, fetchConfidenceSettingVersionHistory,
  fetchAllStationModels, rollbackStationModel, fetchStationModelVersionHistory,
  compareStationModelVersions,
  type CurveTemplate, type ConfidenceSetting, type StationModelParam,
} from '@/api/model-params'

type ParamType = 'station' | 'curve' | 'confidence'

const activeTab = ref<ParamType>('station')

// ============ 数据 ============
const stationAll = ref<StationModelParam[]>([])
const curveAll = ref<CurveTemplate[]>([])
const confidenceAll = ref<ConfidenceSetting[]>([])

const loading = ref(false)

// 展开的 root_id
const expandedStation = ref<string | null>(null)
const expandedCurve = ref<string | null>(null)
const expandedConfidence = ref<string | null>(null)

// 版本历史（展开后加载的明细）
const stationVersions = ref<StationModelParam[]>([])
const curveVersions = ref<CurveTemplate[]>([])
const confidenceVersions = ref<ConfidenceSetting[]>([])

// 对比选中
const compareA = ref<string | null>(null)
const compareB = ref<string | null>(null)
const compareResult = ref<any>(null)
const showCompareDialog = ref(false)

// ============ 分组计算 ============
interface RootGroup<T> {
  rootId: string
  name: string
  latestVersion: number
  totalVersions: number
  activeVersion: number | null
  lastModified: string
  lastModifier: string
  items: T[]
}

const stationGroups = computed<RootGroup<StationModelParam>[]>(() => groupByRoot(stationAll.value, 'model_name'))
const curveGroups = computed<RootGroup<CurveTemplate>[]>(() => groupByRoot(curveAll.value, 'name'))
const confidenceGroups = computed<RootGroup<ConfidenceSetting>[]>(() => groupByRoot(confidenceAll.value, 'name', (item) => item.name || `${item.distribution_type}_${item.confidence_level}`))

function groupByRoot<T extends { root_id: string; version: number; is_active: number; modified_by: string | null; created_at: string }>(
  items: T[], nameKey: string, nameFn?: (item: T) => string
): RootGroup<T>[] {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const root = item.root_id || (item as any).id
    if (!map.has(root)) map.set(root, [])
    map.get(root)!.push(item)
  }
  const groups: RootGroup<T>[] = []
  for (const [rootId, its] of map) {
    its.sort((a, b) => b.version - a.version)
    const latest = its[0]
    const active = its.find(i => i.is_active === 1 || (i.is_active as any) === true)
    groups.push({
      rootId,
      name: nameFn ? nameFn(latest) : (latest as any)[nameKey] || '未知',
      latestVersion: latest.version,
      totalVersions: its.length,
      activeVersion: active?.version ?? null,
      lastModified: latest.created_at,
      lastModifier: latest.modified_by || '-',
      items: its,
    })
  }
  return groups
}

// ============ 加载 ============
async function loadStationModels() {
  try {
    const { data } = await fetchAllStationModels()
    stationAll.value = data.data || []
  } catch { /* empty */ }
}

async function loadCurveTemplates() {
  try {
    const { data } = await fetchAllCurveTemplates()
    curveAll.value = data.data || []
  } catch { /* empty */ }
}

async function loadConfidenceSettings() {
  try {
    const { data } = await fetchAllConfidenceSettings()
    confidenceAll.value = data.data || []
  } catch { /* empty */ }
}

async function handleTabChange(tab: ParamType) {
  activeTab.value = tab
  if (tab === 'station' && stationAll.value.length === 0) await loadStationModels()
  if (tab === 'curve' && curveAll.value.length === 0) await loadCurveTemplates()
  if (tab === 'confidence' && confidenceAll.value.length === 0) await loadConfidenceSettings()
}

async function toggleExpand(type: ParamType, group: RootGroup<any>) {
  if (type === 'station') {
    expandedStation.value = expandedStation.value === group.rootId ? null : group.rootId
    if (expandedStation.value === group.rootId) {
      const { data } = await fetchStationModelVersionHistory(group.rootId)
      stationVersions.value = data.data || []
    }
  } else if (type === 'curve') {
    expandedCurve.value = expandedCurve.value === group.rootId ? null : group.rootId
    if (expandedCurve.value === group.rootId) {
      const { data } = await fetchCurveTemplateVersionHistory(group.rootId)
      curveVersions.value = data.data || []
    }
  } else {
    expandedConfidence.value = expandedConfidence.value === group.rootId ? null : group.rootId
    if (expandedConfidence.value === group.rootId) {
      const { data } = await fetchConfidenceSettingVersionHistory(group.rootId)
      confidenceVersions.value = data.data || []
    }
  }
}

// ============ 回退 ============
async function handleRollback(type: ParamType, versionId: string) {
  try {
    await ElMessageBox.confirm('确定回退到该版本？将创建新版本并设为活跃。', '确认回退', { type: 'warning' })
    if (type === 'station') await rollbackStationModel(versionId)
    else if (type === 'curve') await rollbackCurveTemplate(versionId)
    else await rollbackConfidenceSetting(versionId)
    ElMessage.success('版本已回退')
    // 重载
    if (type === 'station') { await loadStationModels(); expandedStation.value = null; stationVersions.value = [] }
    else if (type === 'curve') { await loadCurveTemplates(); expandedCurve.value = null; curveVersions.value = [] }
    else { await loadConfidenceSettings(); expandedConfidence.value = null; confidenceVersions.value = [] }
  } catch { /* cancelled */ }
}

// ============ 版本对比（仅电站模型） ============
async function handleCompare() {
  if (!compareA.value || !compareB.value) return
  try {
    const { data } = await compareStationModelVersions(compareA.value, compareB.value)
    compareResult.value = data.data
    showCompareDialog.value = true
  } catch {
    ElMessage.error('版本对比失败')
  }
}

function handleSelectForCompare(type: ParamType, row: any) {
  if (type !== 'station') return
  if (!compareA.value) { compareA.value = row.id; return }
  if (!compareB.value && row.id !== compareA.value) { compareB.value = row.id; handleCompare(); return }
  // reset
  compareA.value = null; compareB.value = null
}

function formatFieldLabel(key: string): string {
  const map: Record<string, string> = {
    model_name: '模型名称', rated_capacity_mw: '额定容量(MW)', rated_voltage_kv: '额定电压(kV)',
    power_factor: '功率因数', efficiency_pct: '效率(%)', short_circuit_ratio: '短路比',
    mppt_algorithm: 'MPPT算法', power_limit_mode: '功率限制模式', ramp_rate_limit: '爬坡率',
    lvrt_enabled: '低压穿越', hvrt_enabled: '高压穿越', island_protection: '防孤岛保护',
    design_temp_c: '设计温度(°C)', design_irradiance: '设计辐照度(W/m²)',
    design_humidity_pct: '设计湿度(%)', altitude_m: '海拔(m)', soiling_factor: '积灰系数',
  }
  return map[key] || key
}

onMounted(() => {
  loadStationModels()
  loadCurveTemplates()
  loadConfidenceSettings()
})
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">参数版本控制</div>
    <!-- Tab 切换 -->
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <el-tab-pane label="光伏电站模型" name="station" />
      <el-tab-pane label="出力曲线模板" name="curve" />
      <el-tab-pane label="置信系数设置" name="confidence" />
    </el-tabs>

    <!-- 版本对比工具栏（仅电站模型） -->
    <div v-if="activeTab === 'station'" style="margin-bottom:12px;display:flex;align-items:center;gap:8px;font-size:13px;color:#666">
      <span>版本对比：</span>
      <el-tag v-if="compareA" closable size="small" @close="compareA = null">版本A: {{ stationAll.find(s => s.id === compareA)?.version }}</el-tag>
      <span v-if="compareA">vs</span>
      <el-tag v-if="compareB" closable size="small" @close="compareB = null">版本B: {{ stationAll.find(s => s.id === compareB)?.version }}</el-tag>
      <el-button v-if="compareA && compareB" size="small" type="primary" @click="handleCompare">对比</el-button>
      <span v-if="!compareA" style="color:#999">点击版本行选择</span>
    </div>

    <!-- 光伏电站模型列表 -->
    <template v-if="activeTab === 'station'">
      <div v-loading="loading" class="version-list">
        <div v-for="group in stationGroups" :key="group.rootId" class="version-group">
          <div class="group-header" @click="toggleExpand('station', group)">
            <span class="group-arrow">{{ expandedStation === group.rootId ? '▾' : '▸' }}</span>
            <span class="group-name">{{ group.name }}</span>
            <el-tag size="small" type="info">v{{ group.activeVersion || '?' }} 当前</el-tag>
            <span class="group-meta">共 {{ group.totalVersions }} 个版本 · 最近修改 {{ group.lastModifier }} · {{ group.lastModified }}</span>
          </div>
          <template v-if="expandedStation === group.rootId">
            <el-table :data="stationVersions" size="small" stripe class="version-table">
              <el-table-column label="版本" width="80">
                <template #default="{ row }">
                  <span :style="{ fontWeight: row.is_active ? 700 : 400 }">v{{ row.version }}</span>
                  <el-tag v-if="row.is_active" size="small" type="success" style="margin-left:4px">当前</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="修改人" width="100">
                <template #default="{ row }">{{ row.modified_by || row.created_by || '-' }}</template>
              </el-table-column>
              <el-table-column label="修改内容" min-width="180" show-overflow-tooltip>
                <template #default="{ row }">{{ row.change_summary || '-' }}</template>
              </el-table-column>
              <el-table-column label="时间" width="170">
                <template #default="{ row }">{{ row.created_at }}</template>
              </el-table-column>
              <el-table-column label="操作" width="160" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" link type="primary" @click="handleSelectForCompare('station', row)">
                    {{ compareA === row.id ? '已选A' : compareB === row.id ? '已选B' : '选为对比' }}
                  </el-button>
                  <el-button v-if="!row.is_active" size="small" link type="warning" @click="handleRollback('station', row.id)">回退</el-button>
                </template>
              </el-table-column>
            </el-table>
          </template>
        </div>
        <div v-if="stationGroups.length === 0" style="text-align:center;color:#999;padding:40px">暂无数据</div>
      </div>
    </template>

    <!-- 出力曲线模板列表 -->
    <template v-if="activeTab === 'curve'">
      <div v-loading="loading" class="version-list">
        <div v-for="group in curveGroups" :key="group.rootId" class="version-group">
          <div class="group-header" @click="toggleExpand('curve', group)">
            <span class="group-arrow">{{ expandedCurve === group.rootId ? '▾' : '▸' }}</span>
            <span class="group-name">{{ group.name }}</span>
            <el-tag size="small" type="info">v{{ group.activeVersion || '?' }} 当前</el-tag>
            <span class="group-meta">共 {{ group.totalVersions }} 个版本 · 最近修改 {{ group.lastModifier }} · {{ group.lastModified }}</span>
          </div>
          <template v-if="expandedCurve === group.rootId">
            <el-table :data="curveVersions" size="small" stripe class="version-table">
              <el-table-column label="版本" width="80">
                <template #default="{ row }">
                  <span :style="{ fontWeight: row.is_active ? 700 : 400 }">v{{ row.version }}</span>
                  <el-tag v-if="row.is_active" size="small" type="success" style="margin-left:4px">当前</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="修改人" width="100">
                <template #default="{ row }">{{ row.modified_by || row.created_by || '-' }}</template>
              </el-table-column>
              <el-table-column label="修改内容" min-width="180" show-overflow-tooltip>
                <template #default="{ row }">{{ row.change_summary || '-' }}</template>
              </el-table-column>
              <el-table-column label="时间" width="170">
                <template #default="{ row }">{{ row.created_at }}</template>
              </el-table-column>
              <el-table-column label="操作" width="80" fixed="right">
                <template #default="{ row }">
                  <el-button v-if="!row.is_active" size="small" link type="warning" @click="handleRollback('curve', row.id)">回退</el-button>
                </template>
              </el-table-column>
            </el-table>
          </template>
        </div>
        <div v-if="curveGroups.length === 0" style="text-align:center;color:#999;padding:40px">暂无数据</div>
      </div>
    </template>

    <!-- 置信系数设置列表 -->
    <template v-if="activeTab === 'confidence'">
      <div v-loading="loading" class="version-list">
        <div v-for="group in confidenceGroups" :key="group.rootId" class="version-group">
          <div class="group-header" @click="toggleExpand('confidence', group)">
            <span class="group-arrow">{{ expandedConfidence === group.rootId ? '▾' : '▸' }}</span>
            <span class="group-name">{{ group.name }}</span>
            <el-tag size="small" type="info">v{{ group.activeVersion || '?' }} 当前</el-tag>
            <span class="group-meta">共 {{ group.totalVersions }} 个版本 · 最近修改 {{ group.lastModifier }} · {{ group.lastModified }}</span>
          </div>
          <template v-if="expandedConfidence === group.rootId">
            <el-table :data="confidenceVersions" size="small" stripe class="version-table">
              <el-table-column label="版本" width="80">
                <template #default="{ row }">
                  <span :style="{ fontWeight: row.is_active ? 700 : 400 }">v{{ row.version }}</span>
                  <el-tag v-if="row.is_active" size="small" type="success" style="margin-left:4px">当前</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="修改人" width="100">
                <template #default="{ row }">{{ row.modified_by || row.created_by || '-' }}</template>
              </el-table-column>
              <el-table-column label="修改内容" min-width="180" show-overflow-tooltip>
                <template #default="{ row }">{{ row.change_summary || '-' }}</template>
              </el-table-column>
              <el-table-column label="时间" width="170">
                <template #default="{ row }">{{ row.created_at }}</template>
              </el-table-column>
              <el-table-column label="操作" width="80" fixed="right">
                <template #default="{ row }">
                  <el-button v-if="!row.is_active" size="small" link type="warning" @click="handleRollback('confidence', row.id)">回退</el-button>
                </template>
              </el-table-column>
            </el-table>
          </template>
        </div>
        <div v-if="confidenceGroups.length === 0" style="text-align:center;color:#999;padding:40px">暂无数据</div>
      </div>
    </template>

    <!-- 版本对比弹窗 -->
    <el-dialog title="版本对比" v-model="showCompareDialog" width="700px">
      <el-table :data="compareResult ? Object.entries(compareResult).filter(([k]) => !k.startsWith('_') && k !== 'id' && k !== 'root_id' && k !== 'version' && k !== 'is_active' && k !== 'created_at' && k !== 'updated_at').map(([k, v]) => ({ field: formatFieldLabel(k), key: k, values: v })) : []" size="small">
        <el-table-column prop="field" label="参数" width="180" />
        <el-table-column label="版本A">
          <template #default="{ row }">{{ (row.values as any).a ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="版本B">
          <template #default="{ row }">{{ (row.values as any).b ?? '-' }}</template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<style scoped>
.version-list {
  max-height: calc(100vh - 220px);
  overflow-y: auto;
}

.version-group {
  border: 1px solid #ebeef5;
  margin-bottom: 8px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  background: #fafafa;
  font-size: 13px;
}
.group-header:hover { background: #f0f0f0; }

.group-arrow { font-size: 12px; color: #999; width: 16px; }
.group-name { font-weight: 600; flex: 1; }
.group-meta { color: #999; font-size: 12px; }

.version-table { margin: 0 12px 12px; width: calc(100% - 24px); }
</style>
