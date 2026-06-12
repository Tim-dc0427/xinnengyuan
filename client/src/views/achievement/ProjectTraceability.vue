<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent, DataZoomComponent } from 'echarts/components'

use([CanvasRenderer, LineChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, DataZoomComponent])

import {
  fetchProjects, fetchProjectVersions, compareVersions,
  restoreProjectVersion, fetchProjectArchive, fetchOutputCurve,
  fetchProjectDeviceParams, fetchComplianceResults, runComplianceCheck,
  fetchComplianceReport, fetchPlanAdjustments, fetchProjectDocuments,
  createPlanAdjustment, approvePlanAdjustment,
} from '@/api/achievement'
import type {
  ProjectItem, ProjectVersion, VersionDiff, OutputCurvePoint,
  DeviceParam, ComplianceCheckResult, ComplianceReport,
  PlanAdjustment, ProjectDocument, AuditRecord, ArchiveCompleteness,
} from '@/api/achievement'
import { traceHistory } from '@/api/achievement'

// ==================== 项目检索 ====================
const projects = ref<ProjectItem[]>([])
const selectedProjectId = ref('')
const activeTab = ref('archive')

onMounted(async () => {
  projects.value = await fetchProjects()
})

const selectedProject = computed(() => projects.value.find(p => p.id === selectedProjectId.value))

// ==================== Tab1: 档案数据 ====================
const archiveLoading = ref(false)
const deviceParams = ref<DeviceParam[]>([])
const projectDocs = ref<ProjectDocument[]>([])
const completeness = ref<ArchiveCompleteness | null>(null)
const archiveProject = ref<ProjectItem | null>(null)

// ==================== 出力曲线 ====================
const curveLoading = ref(false)
const curveDate = ref('2026-06-10')
const curveData = ref<OutputCurvePoint[]>([])

const curveOption = computed(() => {
  if (!curveData.value.length) return {}
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['有功功率(kW)'], bottom: 0 },
    grid: { left: 60, right: 30, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: curveData.value.map(d => d.time.slice(11, 16)) },
    yAxis: { type: 'value', name: 'kW' },
    series: [
      { name: '有功功率(kW)', type: 'line', data: curveData.value.map(d => d.activePower), smooth: true },
    ],
  }
})

// ==================== Tab2: 版本追溯 ====================
const versions = ref<ProjectVersion[]>([])
const versionLoading = ref(false)
const versionFilterStage = ref('')
const versionDateStart = ref('')
const versionDateEnd = ref('')
const compareV1 = ref(0)
const compareV2 = ref(0)
const diffResult = ref<VersionDiff | null>(null)
const auditRecords = ref<AuditRecord[]>([])
const auditDateStart = ref('')
const auditDateEnd = ref('')

const stageLabel: Record<string, string> = {
  initiated: '立项', feasibility: '可行性', approved: '已审批',
  construction: '建设', completed: '已完工', operation: '投产', closed: '关闭', other: '其他',
}
const stageOrder = ['initiated', 'feasibility', 'approved', 'construction', 'completed', 'operation', 'closed']

const filteredVersions = computed(() => {
  let list = versions.value
  if (versionFilterStage.value) list = list.filter(v => v.stage === versionFilterStage.value)
  if (versionDateStart.value) list = list.filter(v => v.created_at >= versionDateStart.value)
  if (versionDateEnd.value) list = list.filter(v => v.created_at <= versionDateEnd.value + 'T23:59:59')
  return list
})

const filteredAuditRecords = computed(() => {
  let list = auditRecords.value
  if (auditDateStart.value) list = list.filter(r => r.created_at >= auditDateStart.value)
  if (auditDateEnd.value) list = list.filter(r => r.created_at <= auditDateEnd.value + 'T23:59:59')
  return list
})

function setStageFilter(stage: string) {
  versionFilterStage.value = versionFilterStage.value === stage ? '' : stage
}

const versionOptions = computed(() => {
  return versions.value.map(v => ({
    label: `v${v.version_number} - ${stageLabel[v.stage] || v.stage}`,
    value: v.version_number,
  }))
})

// ==================== Tab3: 合规检查 ====================
const complianceResults = ref<ComplianceCheckResult[]>([])
const complianceLoading = ref(false)
const complianceReport = ref<ComplianceReport | null>(null)

// ==================== 规划调整 ====================
const planAdjustments = ref<PlanAdjustment[]>([])
const adjDialogVisible = ref(false)
const adjForm = ref({ adjustmentType: 'capacity_change', fieldPath: '', oldValue: '', newValue: '', reason: '' })

// ==================== 项目选择变化 ====================
watch(selectedProjectId, async (id) => {
  if (!id) { resetAll(); return }
  await loadAllData()
})

function resetAll() {
  archiveProject.value = null
  deviceParams.value = []
  projectDocs.value = []
  completeness.value = null
  curveData.value = []
  versions.value = []
  auditRecords.value = []
  complianceResults.value = []
  complianceReport.value = null
  planAdjustments.value = []
  diffResult.value = null
}

async function loadAllData() {
  if (!selectedProjectId.value) return
  archiveLoading.value = true
  try {
    const archive = await fetchProjectArchive(selectedProjectId.value)
    archiveProject.value = archive.project
    deviceParams.value = archive.deviceParams
    projectDocs.value = archive.documents
    planAdjustments.value = archive.adjustments
    completeness.value = archive.completeness
  } catch { /* */ } finally { archiveLoading.value = false }
  loadCurve()
  loadVersions()
  loadAudit()
  loadCompliance()
}

// ==================== 出力曲线 ====================
async function loadCurve() {
  if (!selectedProjectId.value || !selectedProject.value?.station_id) return
  curveLoading.value = true
  try {
    curveData.value = await fetchOutputCurve(selectedProjectId.value, 'day', curveDate.value)
  } catch { curveData.value = [] } finally { curveLoading.value = false }
}

// ==================== 版本管理 ====================
async function loadVersions() {
  versionLoading.value = true
  try { versions.value = await fetchProjectVersions(selectedProjectId.value) } catch { versions.value = [] }
  finally { versionLoading.value = false }
}

async function handleCompare() {
  if (!compareV1.value || !compareV2.value) { ElMessage.warning('请选择两个版本'); return }
  try { diffResult.value = await compareVersions(selectedProjectId.value, compareV1.value, compareV2.value) }
  catch (e: any) { ElMessage.error(e?.message || '版本对比失败') }
}

async function handleRestore(versionId: string) {
  try {
    await restoreProjectVersion(selectedProjectId.value, versionId)
    ElMessage.success('版本恢复成功')
    await loadAllData()
  } catch (e: any) { ElMessage.error(e?.message || '版本恢复失败') }
}

async function loadAudit() {
  try { auditRecords.value = await traceHistory(selectedProjectId.value) } catch { auditRecords.value = [] }
}

// ==================== 合规检查 ====================
async function loadCompliance() {
  complianceLoading.value = true
  try { complianceResults.value = await fetchComplianceResults(selectedProjectId.value) } catch { complianceResults.value = [] }
  finally { complianceLoading.value = false }
}

async function handleRunCompliance() {
  complianceLoading.value = true
  try {
    complianceResults.value = await runComplianceCheck(selectedProjectId.value)
    ElMessage.success('合规检查完成')
  } catch (e: any) { ElMessage.error(e?.message || '合规检查失败') }
  finally { complianceLoading.value = false }
}

async function handleGenReport() {
  try { complianceReport.value = await fetchComplianceReport(selectedProjectId.value) }
  catch (e: any) { ElMessage.error(e?.message || '报告生成失败') }
}

// ==================== 规划调整 ====================
function openAdjDialog() { adjDialogVisible.value = true }

async function handleCreateAdj() {
  if (!adjForm.value.reason) { ElMessage.warning('请填写调整原因'); return }
  try {
    await createPlanAdjustment(selectedProjectId.value, adjForm.value)
    ElMessage.success('规划调整记录已创建')
    adjDialogVisible.value = false
    adjForm.value = { adjustmentType: 'capacity_change', fieldPath: '', oldValue: '', newValue: '', reason: '' }
    const archive = await fetchProjectArchive(selectedProjectId.value)
    planAdjustments.value = archive.adjustments
  } catch (e: any) { ElMessage.error(e?.message || '创建失败') }
}

async function handleApproveAdj(id: string, status: 'approved' | 'rejected') {
  try {
    await approvePlanAdjustment(id, status)
    ElMessage.success(status === 'approved' ? '已批准' : '已驳回')
    const archive = await fetchProjectArchive(selectedProjectId.value)
    planAdjustments.value = archive.adjustments
  } catch (e: any) { ElMessage.error(e?.message || '审批失败') }
}

function completenessColor(rate: number) {
  if (rate >= 0.9) return '#67c23a'
  if (rate >= 0.7) return '#e6a23c'
  return '#f56c6c'
}

// 从 custom_fields 提取值
function cfVal(obj: any, key: string): string {
  if (!obj?.custom_fields) return '-'
  let cf: any = {}
  try { cf = JSON.parse(obj.custom_fields) } catch { return '-' }
  return cf[key] !== undefined && cf[key] !== null ? String(cf[key]) : '-'
}

// 档案完整率缓存
const archiveCompleteness = ref<ArchiveCompleteness | null>(null)

// ==================== 附件上传 ====================
function getToken(): string {
  return localStorage.getItem('accessToken') || ''
}

async function handleUploadSuccess(res: any) {
  if (res.code === 200) {
    ElMessage.success('上传成功')
    const docs = await fetchProjectDocuments(selectedProjectId.value)
    projectDocs.value = docs
  } else {
    ElMessage.error(res.message || '上传失败')
  }
}

function handleUploadError() { ElMessage.error('上传失败') }
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">项目留痕与追溯</div>

    <!-- 项目检索 -->
    <div class="chart-panel">
      <div style="display:flex;gap:12px;align-items:center">
        <span>项目检索：</span>
        <el-select v-model="selectedProjectId" placeholder="选择项目" size="small" style="width:340px" clearable filterable>
          <el-option v-for="p in projects" :key="p.id" :label="`${p.project_name} (${p.project_code})`" :value="p.id" />
        </el-select>
      </div>
    </div>

    <template v-if="selectedProject">
      <el-tabs v-model="activeTab">
        <!-- ==================== Tab1: 项目档案核心内容记录 ==================== -->
        <el-tab-pane label="项目档案核心内容记录" name="archive">
          <div style="display:flex;flex-direction:column;gap:16px">

            <!-- 光伏接入位置 -->
            <div class="chart-panel">
              <div class="section-title">光伏接入位置</div>
              <el-descriptions :column="3" border size="small">
                <el-descriptions-item label="经度">{{ archiveProject?.longitude ?? '-' }}</el-descriptions-item>
                <el-descriptions-item label="纬度">{{ archiveProject?.latitude ?? '-' }}</el-descriptions-item>
                <el-descriptions-item label="地址">{{ archiveProject?.address || '-' }}</el-descriptions-item>
                <el-descriptions-item label="并网点名称">{{ archiveProject?.station_name || '-' }}</el-descriptions-item>
                <el-descriptions-item label="并网点电压等级">{{ archiveProject?.grid_connection_voltage_kv ? archiveProject.grid_connection_voltage_kv + 'kV' : '-' }}</el-descriptions-item>
                <el-descriptions-item label="接入线路编号">{{ cfVal(archiveProject, 'access_line_code') }}</el-descriptions-item>
                <el-descriptions-item label="调度分界点">{{ cfVal(archiveProject, 'dispatch_boundary') }}</el-descriptions-item>
                <el-descriptions-item label="区域">{{ archiveProject?.zone || '-' }}</el-descriptions-item>
                <el-descriptions-item label="面板类型">{{ archiveProject?.panel_type || '-' }}</el-descriptions-item>
              </el-descriptions>
            </div>

            <!-- 实时出力曲线 -->
            <div class="chart-panel" v-if="selectedProject.station_id">
              <div class="section-title">实时出力曲线</div>
              <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
                <span style="font-size:13px">日期：</span>
                <el-date-picker v-model="curveDate" type="date" placeholder="选择日期" size="small" style="width:150px" value-format="YYYY-MM-DD" @change="loadCurve" />
                <el-button size="small" @click="loadCurve" :loading="curveLoading">刷新</el-button>
              </div>
              <VChart v-if="curveData.length > 0" :option="curveOption" style="height:320px" autoresize />
              <div v-else style="color:#909399;font-size:13px;padding:24px;text-align:center">该日无出力数据</div>
            </div>

            <!-- 设备参数 -->
            <div class="chart-panel">
              <div class="section-title">设备参数</div>
              <el-descriptions :column="3" border size="small">
                <el-descriptions-item label="装机总容量(kW)">{{ selectedProject.capacity_kw || '-' }}</el-descriptions-item>
                <el-descriptions-item label="组件总装机功率(kW)">{{ cfVal(archiveProject || selectedProject, 'dc_capacity_kw') }}</el-descriptions-item>
                <el-descriptions-item label="交流额定容量(kW)">{{ cfVal(archiveProject || selectedProject, 'ac_rated_capacity_kw') }}</el-descriptions-item>
                <el-descriptions-item label="并网点电压等级">{{ archiveProject?.grid_connection_voltage_kv ? archiveProject.grid_connection_voltage_kv + 'kV' : cfVal(archiveProject || selectedProject, 'grid_voltage') }}</el-descriptions-item>
                <el-descriptions-item label="接入线路编号">{{ cfVal(archiveProject || selectedProject, 'access_line_code') }}</el-descriptions-item>
                <el-descriptions-item label="调度分界点">{{ cfVal(archiveProject || selectedProject, 'dispatch_boundary') }}</el-descriptions-item>
                <el-descriptions-item label="占地面积(亩)">{{ archiveProject?.land_area_mu ?? '-' }}</el-descriptions-item>
                <el-descriptions-item label="方阵数量">{{ cfVal(archiveProject || selectedProject, 'array_count') }}</el-descriptions-item>
                <el-descriptions-item label="土地类型">{{ cfVal(archiveProject || selectedProject, 'land_type') }}</el-descriptions-item>
                <el-descriptions-item label="设计年利用小时数(h)">{{ cfVal(archiveProject || selectedProject, 'planned_equivalent_hours') }}</el-descriptions-item>
                <el-descriptions-item label="设计发电量(MWh)">{{ cfVal(archiveProject || selectedProject, 'planned_annual_output_mwh') }}</el-descriptions-item>
                <el-descriptions-item label="无功补偿总容量(kvar)">{{ cfVal(archiveProject || selectedProject, 'reactive_compensation_capacity_kvar') }}</el-descriptions-item>
                <el-descriptions-item label="储能配套容量(MWh)">{{ cfVal(archiveProject || selectedProject, 'storage_capacity_mwh') }}</el-descriptions-item>
                <el-descriptions-item label="设计倾角(°)">{{ cfVal(archiveProject || selectedProject, 'design_tilt_angle') }}</el-descriptions-item>
                <el-descriptions-item label="方位角(°)">{{ cfVal(archiveProject || selectedProject, 'design_azimuth_angle') }}</el-descriptions-item>
                <el-descriptions-item label="海拔(m)">{{ deviceParams.length > 0 ? deviceParams[0].altitudeM : '-' }}</el-descriptions-item>
                <el-descriptions-item label="设计温度(°C)">{{ deviceParams.length > 0 ? deviceParams[0].designTempC : '-' }}</el-descriptions-item>
                <el-descriptions-item label="设计辐照度(W/m²)">{{ deviceParams.length > 0 ? deviceParams[0].designIrradiance : '-' }}</el-descriptions-item>
                <el-descriptions-item label="设计湿度(%)">{{ deviceParams.length > 0 ? deviceParams[0].designHumidityPct : '-' }}</el-descriptions-item>
              </el-descriptions>
            </div>

            <!-- 档案完整率 -->
            <div class="chart-panel" v-if="completeness">
              <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
                <span>档案信息完整率</span>
                <span style="font-size:13px;color:#606266">
                  {{ completeness.filledFields }}/{{ completeness.totalFields }} 字段已填写
                </span>
              </div>
              <div style="display:flex;align-items:center;gap:16px">
                <el-progress :percentage="Math.round(completeness.rate * 100)" :color="completenessColor(completeness.rate)" :stroke-width="16" style="flex:1" />
                <div v-if="completeness.missingFields.length" style="font-size:12px;color:#f56c6c;max-width:400px">
                  缺失：{{ completeness.missingFields.join('、') }}
                </div>
              </div>
            </div>

            <!-- 规划调整记录 -->
            <div class="chart-panel">
              <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
                <span>规划调整记录</span>
                <el-button size="small" type="primary" @click="openAdjDialog">新增调整</el-button>
              </div>
              <el-table :data="planAdjustments" stripe size="small" v-if="planAdjustments.length > 0">
                <el-table-column label="调整类型" width="120">
                  <template #default="{ row }">
                    <el-tag size="small" type="info">{{ row.adjustment_type }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="变更内容" width="240">
                  <template #default="{ row }">
                    <span v-if="row.field_path">{{ row.field_path }}: {{ row.old_value || '-' }} → {{ row.new_value || '-' }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="reason" label="调整原因" min-width="180" />
                <el-table-column label="审批状态" width="100">
                  <template #default="{ row }">
                    <el-tag :type="row.approval_status === 'approved' ? 'success' : row.approval_status === 'rejected' ? 'danger' : 'warning'" size="small">
                      {{ row.approval_status === 'approved' ? '已批准' : row.approval_status === 'rejected' ? '已驳回' : '待审批' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="created_at" label="时间" width="160" />
                <el-table-column label="操作" width="120" v-if="planAdjustments.some(a => a.approval_status === 'pending')">
                  <template #default="{ row }">
                    <template v-if="row.approval_status === 'pending'">
                      <el-button size="small" type="success" link @click="handleApproveAdj(row.id, 'approved')">批准</el-button>
                      <el-button size="small" type="danger" link @click="handleApproveAdj(row.id, 'rejected')">驳回</el-button>
                    </template>
                  </template>
                </el-table-column>
              </el-table>
              <div v-else style="color:#909399;font-size:13px;padding:16px">暂无规划调整记录</div>
            </div>

            <!-- 附件列表 -->
            <div class="chart-panel">
              <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
                <span>附件文档</span>
                <el-upload
                  :action="`/api/v1/achievement/projects/${selectedProjectId}/documents`"
                  :headers="{ Authorization: 'Bearer ' + getToken() }"
                  :data="{ docType: '其他' }"
                  :show-file-list="false"
                  :on-success="handleUploadSuccess"
                  :on-error="handleUploadError"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.dwg,.zip,.rar"
                >
                  <el-button size="small" type="primary">上传附件</el-button>
                </el-upload>
              </div>
              <el-table :data="projectDocs" stripe size="small" v-if="projectDocs.length > 0">
                <el-table-column prop="doc_name" label="文件名" min-width="200" />
                <el-table-column prop="doc_type" label="类型" width="120" />
                <el-table-column label="大小" width="100">
                  <template #default="{ row }">{{ row.file_size ? (row.file_size / 1024).toFixed(1) + 'KB' : '-' }}</template>
                </el-table-column>
                <el-table-column prop="uploaded_at" label="上传时间" width="160" />
              </el-table>
              <div v-else style="color:#909399;font-size:13px;padding:16px">暂无附件</div>
            </div>
          </div>
        </el-tab-pane>

        <!-- ==================== Tab2: 历史版本追溯功能 ==================== -->
        <el-tab-pane label="历史版本追溯功能" name="version">
          <div style="display:flex;flex-direction:column;gap:16px">

            <!-- 组合检索 -->
            <div class="chart-panel">
              <div class="section-title">组合检索</div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <span style="font-size:13px;color:#606266">项目名称：</span>
                <span style="font-size:13px;font-weight:600">{{ selectedProject.project_name }}</span>
                <span style="font-size:13px;color:#606266;margin-left:16px">时间：</span>
                <el-date-picker v-model="versionDateStart" type="date" placeholder="开始日期" size="small" style="width:140px" value-format="YYYY-MM-DD" />
                <span style="color:#909399">—</span>
                <el-date-picker v-model="versionDateEnd" type="date" placeholder="结束日期" size="small" style="width:140px" value-format="YYYY-MM-DD" />
                <el-button size="small" @click="versionDateStart='';versionDateEnd=''">重置</el-button>
              </div>
            </div>

            <!-- 版本追溯 -->
            <div class="chart-panel">
              <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
                <span>版本历史</span>
                <el-button size="small" @click="loadVersions" :loading="versionLoading">刷新</el-button>
              </div>
              <!-- 阶段快捷回溯 -->
              <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
                <el-button size="small" :type="!versionFilterStage ? 'primary' : 'default'" @click="versionFilterStage=''">全部</el-button>
                <el-button v-for="s in stageOrder" :key="s" size="small" :type="versionFilterStage === s ? 'primary' : 'default'" @click="setStageFilter(s)">{{ stageLabel[s] }}</el-button>
              </div>
              <!-- 版本对比 -->
              <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">
                <el-select v-model="compareV1" placeholder="版本A" size="small" style="width:200px">
                  <el-option v-for="opt in versionOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
                <span style="color:#909399">vs</span>
                <el-select v-model="compareV2" placeholder="版本B" size="small" style="width:200px">
                  <el-option v-for="opt in versionOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
                <el-button size="small" type="primary" @click="handleCompare">对比</el-button>
              </div>
              <!-- 对比结果 -->
              <div v-if="diffResult" style="margin-bottom:12px">
                <el-table :data="diffResult.diffs" stripe size="small" max-height="200">
                  <el-table-column prop="field" label="字段" width="160" />
                  <el-table-column label="版本A" width="200"><template #default="{ row }">{{ row.v1Value }}</template></el-table-column>
                  <el-table-column label="版本B" width="200"><template #default="{ row }">{{ row.v2Value }}</template></el-table-column>
                </el-table>
              </div>
              <!-- 版本时间线 -->
              <el-timeline v-if="filteredVersions.length > 0">
                <el-timeline-item
                  v-for="v in filteredVersions" :key="v.id"
                  :timestamp="v.created_at?.slice(0, 10)"
                  :type="v.stage === 'operation' ? 'success' : v.stage === 'construction' ? 'warning' : 'primary' as any"
                  :hollow="!v.changed_fields"
                >
                  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                    <el-tag size="small" type="info">v{{ v.version_number }}</el-tag>
                    <el-tag :type="v.stage === 'operation' ? 'success' : v.stage === 'construction' ? 'warning' : '' as any" size="small">{{ stageLabel[v.stage] || v.stage }}</el-tag>
                    <span style="font-size:13px">{{ v.changelog }}</span>
                    <!-- 变更节点标记 -->
                    <el-tag v-if="v.changed_fields" size="small" type="danger" effect="dark">有变更</el-tag>
                  </div>
                  <!-- 自动标注变更节点 -->
                  <div v-if="v.changed_fields" style="margin-top:6px;padding:6px 8px;background:#fef0f0;border-radius:4px;border-left:3px solid #f56c6c">
                    <div style="font-size:12px;color:#f56c6c;font-weight:600;margin-bottom:4px">数据变更节点：</div>
                    <template v-for="(cf, ci) in (() => { try { return JSON.parse(v.changed_fields || '[]') } catch { return [] } })()" :key="ci">
                      <div style="font-size:12px;color:#606266;margin-bottom:2px">
                        <el-tag size="small" type="warning" effect="plain">{{ cf.field }}</el-tag>
                        <span style="margin:0 4px">{{ cf.oldValue }}</span>
                        <span style="color:#f56c6c">→</span>
                        <span style="margin-left:4px;font-weight:600">{{ cf.newValue }}</span>
                      </div>
                    </template>
                  </div>
                  <el-button size="small" type="primary" link style="margin-top:6px" @click="handleRestore(v.id)">恢复此版本</el-button>
                </el-timeline-item>
              </el-timeline>
              <div v-else style="color:#909399;font-size:13px;padding:16px">暂无版本记录</div>
            </div>

            <!-- 审计记录明细 -->
            <div class="chart-panel">
              <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
                <span>审计记录明细</span>
                <div style="display:flex;gap:8px;align-items:center">
                  <el-date-picker v-model="auditDateStart" type="date" placeholder="开始日期" size="small" style="width:130px" value-format="YYYY-MM-DD" />
                  <span style="color:#909399">—</span>
                  <el-date-picker v-model="auditDateEnd" type="date" placeholder="结束日期" size="small" style="width:130px" value-format="YYYY-MM-DD" />
                </div>
              </div>
              <el-table :data="filteredAuditRecords" stripe size="small" max-height="320">
                <el-table-column prop="created_at" label="时间" width="160" />
                <el-table-column prop="action" label="操作类型" width="110" />
                <el-table-column label="阶段" width="80">
                  <template #default="{ row }">{{ stageLabel[row.stage] || row.stage || '-' }}</template>
                </el-table-column>
                <el-table-column prop="comment" label="描述" min-width="160" />
                <el-table-column label="变更字段" width="220">
                  <template #default="{ row }">
                    <template v-if="row.changed_fields">
                      <div v-for="(cf, ci) in (() => { try { return JSON.parse(row.changed_fields || '[]') } catch { return [] } })()" :key="ci" style="margin-bottom:2px">
                        <el-tag size="small" type="warning" effect="plain">{{ cf.field }}</el-tag>
                        <span style="font-size:11px;color:#909399;margin:0 2px">{{ cf.oldValue }}→{{ cf.newValue }}</span>
                      </div>
                    </template>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="performed_by" label="操作人" width="100" />
              </el-table>
            </div>
          </div>
        </el-tab-pane>

        <!-- ==================== Tab3: 审计与合规性支持 ==================== -->
        <el-tab-pane label="审计与合规性支持" name="compliance">
          <div style="display:flex;flex-direction:column;gap:16px">
            <div class="chart-panel">
              <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
                <span>合规性检查清单</span>
                <div style="display:flex;gap:8px">
                  <el-button size="small" type="primary" @click="handleRunCompliance" :loading="complianceLoading">执行检查</el-button>
                  <el-button size="small" @click="handleGenReport" v-if="complianceResults.length > 0">生成报告</el-button>
                </div>
              </div>
              <el-table :data="complianceResults" stripe size="small" v-loading="complianceLoading" v-if="complianceResults.length > 0">
                <el-table-column prop="checkItemName" label="检查项" width="180" />
                <el-table-column prop="category" label="分类" width="100" />
                <el-table-column label="状态" width="80">
                  <template #default="{ row }">
                    <el-tag :type="row.check_status === 'pass' ? 'success' : row.check_status === 'fail' ? 'danger' : row.check_status === 'na' ? 'info' : 'warning'" size="small">
                      {{ row.check_status === 'pass' ? '通过' : row.check_status === 'fail' ? '不通过' : row.check_status === 'na' ? '不适用' : '待检查' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="actual_value" label="实际值/说明" min-width="200" />
                <el-table-column prop="checked_at" label="检查时间" width="160" />
              </el-table>
              <div v-else style="color:#909399;font-size:13px;padding:16px">尚未执行合规检查，请点击"执行检查"</div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </template>
  </div>

  <!-- 合规报告弹窗 -->
  <el-dialog :model-value="complianceReport !== null" @update:model-value="(val: boolean) => { if (!val) complianceReport = null }" title="合规性检查报告" width="700px">
    <template v-if="complianceReport">
      <el-descriptions :column="2" border size="small" style="margin-bottom:12px">
        <el-descriptions-item label="项目名称">{{ complianceReport.projectInfo.projectName }}</el-descriptions-item>
        <el-descriptions-item label="项目编号">{{ complianceReport.projectInfo.projectCode }}</el-descriptions-item>
        <el-descriptions-item label="电站">{{ complianceReport.projectInfo.stationName }}</el-descriptions-item>
        <el-descriptions-item label="检查时间">{{ complianceReport.checkedAt?.slice(0, 10) }}</el-descriptions-item>
      </el-descriptions>
      <div style="margin-bottom:12px;font-size:14px;font-weight:600">
        总体判定：
        <el-tag :type="complianceReport.overallVerdict === '合规' ? 'success' : complianceReport.overallVerdict === '不合规' ? 'danger' : 'warning'" size="small">
          {{ complianceReport.overallVerdict }}
        </el-tag>
        （通过 {{ complianceReport.summary.passCount }}/{{ complianceReport.summary.total }}，不通过 {{ complianceReport.summary.failCount }}，待检 {{ complianceReport.summary.pendingCount }}）
      </div>
      <el-table :data="complianceReport.results" stripe size="small" max-height="360">
        <el-table-column prop="checkItemName" label="检查项" width="160" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.check_status === 'pass' ? 'success' : 'danger'" size="small">{{ row.check_status === 'pass' ? '通过' : '不通过' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="actual_value" label="说明" min-width="200" />
      </el-table>
    </template>
  </el-dialog>

  <!-- 新增规划调整弹窗 -->
  <el-dialog v-model="adjDialogVisible" title="新增规划调整" width="500px">
    <el-form :model="adjForm" label-width="80px" size="small">
      <el-form-item label="调整类型">
        <el-select v-model="adjForm.adjustmentType" style="width:100%">
          <el-option label="容量变更" value="capacity_change" />
          <el-option label="电站变更" value="station_change" />
          <el-option label="预算变更" value="budget_change" />
          <el-option label="计划调整" value="schedule_change" />
          <el-option label="范围变更" value="scope_change" />
        </el-select>
      </el-form-item>
      <el-form-item label="变更字段"><el-input v-model="adjForm.fieldPath" placeholder="如 capacity_kw" /></el-form-item>
      <el-form-item label="变更前值"><el-input v-model="adjForm.oldValue" /></el-form-item>
      <el-form-item label="变更后值"><el-input v-model="adjForm.newValue" /></el-form-item>
      <el-form-item label="调整原因"><el-input v-model="adjForm.reason" type="textarea" :rows="2" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button size="small" @click="adjDialogVisible = false">取消</el-button>
      <el-button size="small" type="primary" @click="handleCreateAdj">确认</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.page-container { display: flex; flex-direction: column; gap: 16px; }
.chart-panel { background: #fff; border-radius: 4px; padding: 16px; }
.section-title { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 12px; }
</style>
