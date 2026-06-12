<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchOperationProjects, createOperationProject, fetchAvailableStations,
  fetchRunningStats, fetchCompletionComparison, updateCompletionTargets,
  createVerification, fetchEvaluationReport, fetchVerifications,
  fetchLessons, createLesson, deleteLesson,
} from '@/api/achievement'
import type { OperationProject, AvailableStation, RunningStats, CompletionComparison, EvaluationReport, LessonItem } from '@/api/achievement'

// ==================== 项目 ====================
const projects = ref<OperationProject[]>([])
const selectedProjectId = ref('')
const selectedProject = computed(() => projects.value.find(p => p.id === selectedProjectId.value))
const activeTab = ref('running')

onMounted(async () => {
  projects.value = await fetchOperationProjects()
  if (projects.value.length > 0) { selectedProjectId.value = projects.value[0].id; await loadAll() }
})
async function onProjectChange() { if (selectedProjectId.value) await loadAll() }
async function loadAll() {
  if (!selectedProjectId.value) return
  await Promise.all([loadLessons(), loadLatestReport()])
  if (activeTab.value === 'running') await fetchStats()
  if (activeTab.value === 'compare') await fetchComparison()
}
watch(activeTab, async t => {
  if (t === 'running' && !runningStats.value) await fetchStats()
  if (t === 'compare' && !comparison.value) await fetchComparison()
})

// ==================== 功能一：运行数据 ====================
const runningStats = ref<RunningStats | null>(null)
const statsLoading = ref(false)
const correction = ref<Record<string, number | null>>({})
const showCorrection = ref(false)
const saving = ref(false)

async function fetchStats() {
  if (!selectedProjectId.value) return
  statsLoading.value = true
  const end = new Date().toISOString().slice(0, 10)
  const start = '2024-01-01' // 后端会取 actual_completion_date 和此值的较大者
  try { runningStats.value = await fetchRunningStats(selectedProjectId.value, start, end) } catch { runningStats.value = null } finally { statsLoading.value = false }
}
function getStatsVal(f: string) { return correction.value[f] ?? (runningStats.value?.auto as any)?.[f] ?? null }
function hasCorrection() { return Object.values(correction.value).some(v => v != null) }
function startCorrection() {
  const a = runningStats.value?.auto; if (!a) return
  correction.value = { outputMwh: a.outputMwh, equivalentHours: a.equivalentHours, voltageCompliancePct: a.voltageCompliancePct, frequencyCompliancePct: a.frequencyCompliancePct, powerFactorRate: a.powerFactorRate, voltageViolationRate: a.voltageViolationRate, reactiveReverseRate: a.reactiveReverseRate, absorptionRatePct: a.absorptionRatePct, completenessPct: a.completenessPct }
  showCorrection.value = true
}
function clearCorrection() { correction.value = {}; showCorrection.value = false }
async function saveCorrection() {
  if (!selectedProjectId.value) return; saving.value = true
  try {
    await createVerification(selectedProjectId.value, {
      periodStart: '2024-01-01', periodEnd: new Date().toISOString().slice(0, 10),
      finalOutputKwh: correction.value.outputMwh != null ? correction.value.outputMwh * 10000 : undefined,
      finalEquivalentHours: correction.value.equivalentHours ?? undefined,
      finalVoltageCompliancePct: correction.value.voltageCompliancePct ?? undefined,
      finalFrequencyCompliancePct: correction.value.frequencyCompliancePct ?? undefined,
      finalPowerFactorRate: correction.value.powerFactorRate ?? undefined,
      finalVoltageViolationRate: correction.value.voltageViolationRate ?? undefined,
      finalReactiveReverseRate: correction.value.reactiveReverseRate ?? undefined,
      finalCompletenessPct: correction.value.completenessPct ?? undefined,
      absorptionRatePct: correction.value.absorptionRatePct ?? undefined,
      correctionNote: '运行数据人工修正',
    })
    ElMessage.success('修正已保存'); correction.value = {}; showCorrection.value = false
  } catch (e: any) { ElMessage.error(e?.response?.data?.message || '保存失败') } finally { saving.value = false }
}
function fmtStats(v: number | null | undefined, k: string) { if (v == null) return '-'; return v.toFixed(2) }

const statDims = [
  { title: '并网性能', items: ['voltageCompliancePct','frequencyCompliancePct','powerFactorRate'], labels: ['电压合格率(%)','频率合格率(%)','功率因数达标率(%)'] },
  { title: '电网影响', items: ['voltageViolationRate','reactiveReverseRate','absorptionRatePct'], labels: ['电压越限率(%)','无功倒送率(%)','消纳率(%)'] },
  { title: '经济效益', items: ['outputMwh','equivalentHours'], labels: ['发电量(万kWh)','等效利用小时(h)'] },
]

// ==================== 功能二：对比分析 ====================
const comparison = ref<CompletionComparison | null>(null)
const compLoading = ref(false)
const showTargetEdit = ref(false)
const targetForm = ref<Record<string, number>>({})

async function fetchComparison() {
  if (!selectedProjectId.value) return; compLoading.value = true
  try { comparison.value = await fetchCompletionComparison(selectedProjectId.value) } catch { comparison.value = null } finally { compLoading.value = false }
}
function startTargetEdit() {
  if (!comparison.value) return
  targetForm.value = { ...comparison.value.planned as any }
  showTargetEdit.value = true
}
async function saveTargets() {
  if (!selectedProjectId.value) return
  try {
    await updateCompletionTargets(selectedProjectId.value, targetForm.value)
    showTargetEdit.value = false
    await fetchComparison()
    ElMessage.success('目标已更新')
  } catch { ElMessage.error('保存失败') }
}

async function generateReport() {
  if (!selectedProjectId.value) return
  reportLoading.value = true
  try {
    // 创建评估快照
    const c = comparison.value
    if (!c) return
    const v = await createVerification(selectedProjectId.value, {
      periodStart: c.periodStart, periodEnd: c.periodEnd,
      finalOutputKwh: c.auto.outputMwh != null ? c.auto.outputMwh * 10000 : undefined,
      finalEquivalentHours: c.auto.equivalentHours ?? undefined,
      finalVoltageCompliancePct: c.auto.voltageCompliancePct ?? undefined,
      finalFrequencyCompliancePct: c.auto.frequencyCompliancePct ?? undefined,
      finalPowerFactorRate: c.auto.powerFactorRate ?? undefined,
      finalVoltageViolationRate: c.auto.voltageViolationRate ?? undefined,
      finalReactiveReverseRate: c.auto.reactiveReverseRate ?? undefined,
      finalCompletenessPct: c.auto.completenessPct ?? undefined,
      absorptionRatePct: (c.planned as any).absorptionRatePct ?? undefined,
    })
    // 获取报告
    report.value = await fetchEvaluationReport(v.id)
    activeTab.value = 'report'
  } catch (e: any) { ElMessage.error(e?.response?.data?.message || '生成报告失败') } finally { reportLoading.value = false }
}

// 关键差异点汇总
const keyDiffs = computed(() => {
  if (!comparison.value) return []
  const diffs: any[] = []
  for (const dim of comparison.value.dimensions) {
    for (const ind of dim.indicators) {
      if (ind.status === '偏差') diffs.push({ dimension: dim.dimension, ...ind })
    }
  }
  return diffs
})

// ==================== 评估报告 ====================
const report = ref<EvaluationReport | null>(null)
const reportLoading = ref(false)

async function loadLatestReport() {
  if (!selectedProjectId.value) return
  reportLoading.value = true
  try {
    const vers = await fetchVerifications(selectedProjectId.value)
    if (vers.length > 0) report.value = await fetchEvaluationReport(vers[0].id)
    else report.value = null
  } catch { report.value = null } finally { reportLoading.value = false }
}

function downloadReport() {
  if (!report.value) return
  const r = report.value
  const dHtml = r.dimensions.map(d => `<p><strong>${d.dimension}</strong>：${d.indicators.map(i => `${i.label}${i.status==='偏差'?'⚠':'✓'}`).join(' | ')}</p>`).join('')
  const h = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>成效评估报告</title><style>body{font-family:'Microsoft YaHei',sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#303133}h2{text-align:center}h3{margin-top:24px}h4{color:#267F7B;margin:16px 0 8px}.good{background:#f0f9eb;padding:4px 8px;margin:2px 0}.bad{background:#fef0f0;padding:4px 8px;margin:2px 0}.v{text-align:center;font-size:18px;font-weight:bold;margin:20px 0}td{padding:4px 12px}</style></head><body>
<h2>项目成效评估报告</h2><p style="text-align:center;color:#909399">${r.evaluationPeriod.start} ~ ${r.evaluationPeriod.end} | ${r.verifiedAt}</p>
<h3>一、项目概况</h3><table><tr><td>项目编号：${r.projectInfo.projectCode}</td><td>项目名称：${r.projectInfo.projectName}</td></tr><tr><td>电站名称：${r.projectInfo.stationName}</td><td>装机容量：${r.projectInfo.capacityMw}MW</td></tr><tr><td>并网电压：${r.projectInfo.gridVoltageKv}kV</td><td>投产日期：${r.projectInfo.operationDate}</td></tr></table>
<h3>二、目标完成度分析</h3>${dHtml}
<h3>三、偏差原因剖析</h3>${r.deviations.length?r.deviations.map(d=>`<div class="bad">${d.dimension}·${d.indicator}：规划${d.planned}，实际${d.actual}，偏差${d.deviation}${d.autoCause?`<br><small>${d.autoCause}</small>`:''}</div>`).join(''):'<p>各项指标均达标</p>'}
<h3>四、合规性审查</h3><p>数据完整率：${r.dataCompleteness}${r.hasManualCorrection?' | 含人工修正':''}</p><p>综合判定：<span style="color:${r.overallVerdict==='达标'?'#67C23A':'#F56C6C'};font-weight:bold">${r.overallVerdict}</span></p>
<h3>五、成效亮点</h3>${r.highlights.map(h=>`<div class="good">${h.text}</div>`).join('')}
<h3>六、改进项</h3>${r.improvements.map(i=>`<div class="bad">${i.text}</div>`).join('')}
<div class="v">综合判定：${r.overallVerdict}</div></body></html>`
  const b = new Blob([h], { type: 'text/html;charset=utf-8' }); const u = URL.createObjectURL(b); const a = document.createElement('a')
  a.href = u; a.download = `成效评估报告_${r.projectInfo.projectCode}_${r.evaluationPeriod.start}_${r.evaluationPeriod.end}.html`; a.click(); URL.revokeObjectURL(u)
}

// ==================== 功能四：案例库 ====================
const lessons = ref<LessonItem[]>([])
const lessonDlg = ref(false)
const lessonForm = ref({ title: '', type: 'lesson' as string, dimension: '经济效益', indicator: '', content: '', cause: '', suggestion: '' })
async function loadLessons() { if (selectedProjectId.value) lessons.value = await fetchLessons(selectedProjectId.value) }
function openCreateLesson() {
  lessonForm.value = { title: '', type: 'lesson', dimension: '经济效益', indicator: '', content: '', cause: '', suggestion: '' }
  lessonDlg.value = true
}
async function handleCreateLesson() {
  if (!selectedProjectId.value || !lessonForm.value.title) { ElMessage.warning('请填写标题'); return }
  await createLesson({ projectId: selectedProjectId.value, ...lessonForm.value })
  lessonDlg.value = false; await loadLessons(); ElMessage.success('案例已创建')
}
async function handleDeleteLesson(id: string) {
  try { await ElMessageBox.confirm('确定删除该案例？', '确认', { type: 'warning' }); await deleteLesson(selectedProjectId.value!, id); await loadLessons() } catch {}
}
// 从报告提炼案例
function refineFromReport(dim: string, ind: string, dev: string, autoCause: string, isSuccess: boolean) {
  const pn = selectedProject.value?.project_name || ''
  lessonForm.value = {
    title: `${pn} — ${ind || dim}${isSuccess ? '达标经验' : '偏差教训'}`,
    type: isSuccess ? 'success' : 'lesson',
    dimension: dim || '综合', indicator: ind || '',
    content: isSuccess
      ? `${ind || dim}实际表现符合规划目标，该指标管控可作为同类项目参考`
      : `${ind}出现偏差${dev}，需要分析根因并制定整改措施`,
    cause: autoCause || (isSuccess ? '各项管控措施落实到位，设备运行稳定，运维管理规范' : ''),
    suggestion: isSuccess
      ? `建议将${ind || '该'}指标的管控措施标准化，纳入同类项目设计规范`
      : '建议核查运行工况，制定针对性整改措施并纳入后续项目规划考量',
  }
  lessonDlg.value = true
}

// ==================== 新建项目 ====================
const showCreateProject = ref(false); const availableStations = ref<AvailableStation[]>([])
const newProject = ref({ projectCode: '', projectName: '', stationId: '', operationStartDate: '', plannedAnnualOutputMwh: null as number | null, plannedEquivalentHours: null as number | null, plannedAbsorptionRatePct: null as number | null, plannedVoltageCompliancePct: null as number | null })
async function openCreateProject() {
  availableStations.value = await fetchAvailableStations()
  newProject.value = { projectCode: `PV-GC-${new Date().getFullYear()}-${String(projects.value.length+1).padStart(3,'0')}`, projectName:'', stationId:'', operationStartDate:'', plannedAnnualOutputMwh:null, plannedEquivalentHours:null, plannedAbsorptionRatePct:null, plannedVoltageCompliancePct:null }
  showCreateProject.value = true
}
async function handleCreateProject() {
  const np = newProject.value; if (!np.stationId||!np.projectName) { ElMessage.warning('请选择电站并填写项目名称'); return }
  await createOperationProject({ projectCode:np.projectCode, projectName:np.projectName, projectType:'PV_GRID_CONNECTION', stationId:np.stationId, operationStartDate:np.operationStartDate||undefined, plannedAnnualOutputMwh:np.plannedAnnualOutputMwh??undefined, plannedEquivalentHours:np.plannedEquivalentHours??undefined, plannedAbsorptionRatePct:np.plannedAbsorptionRatePct??undefined, plannedVoltageCompliancePct:np.plannedVoltageCompliancePct??undefined })
  ElMessage.success('项目创建成功'); showCreateProject.value=false; projects.value = await fetchOperationProjects()
}
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">项目成效验证评估</div>
    <div class="chart-panel">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <span>项目：</span>
        <el-select v-model="selectedProjectId" placeholder="选择项目" size="small" style="width:320px" @change="onProjectChange">
          <el-option v-for="p in projects" :key="p.id" :label="`${p.project_code} ${p.project_name}`" :value="p.id" />
        </el-select>
        <el-button size="small" @click="openCreateProject">新建项目</el-button>
      </div>
      <template v-if="selectedProject">
        <table class="info-table" style="margin-top:12px"><tbody>
          <tr><td class="label">编号</td><td>{{ selectedProject.project_code }}</td><td class="label">电站</td><td>{{ selectedProject.station_name }}</td><td class="label">容量</td><td>{{ selectedProject.installed_capacity_mw }}MW</td></tr>
          <tr><td class="label">投产</td><td>{{ selectedProject.operation_start_date || '-' }}</td><td class="label">电压</td><td>{{ selectedProject.grid_connection_voltage_kv }}kV</td><td class="label">区域</td><td>{{ selectedProject.zone || '-' }}</td></tr>
        </tbody></table>
      </template>
    </div>

    <template v-if="selectedProject">
      <el-tabs v-model="activeTab">
        <!-- ======== Tab 1: 运行数据 ======== -->
        <el-tab-pane label="运行数据" name="running">
          <div class="chart-panel" v-loading="statsLoading">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <span style="font-size:12px;color:#909399">竣工至今运行数据</span>
              <el-button size="small" @click="fetchStats" text>刷新</el-button>
            </div>
            <div v-if="runningStats">
              <div v-for="dim in statDims" :key="dim.title" style="margin-bottom:10px">
                <div style="font-size:13px;font-weight:600;padding-left:4px;border-left:3px solid #267F7B;margin-bottom:4px">{{ dim.title }}</div>
                <el-table :data="dim.items" stripe size="small">
                  <el-table-column label="指标" width="160">
                    <template #default="{ row, $index }">{{ dim.labels[$index] }}</template>
                  </el-table-column>
                  <el-table-column label="数值" width="140">
                    <template #default="{ row: k, $index }">
                      <span :style="{ fontWeight: correction[k] != null ? 600 : 400 }">
                        {{ fmtStats(getStatsVal(k), k) }}
                      </span>
                      <span v-if="correction[k] != null" style="color:#E6A23C;font-size:11px">*</span>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
              <div v-if="showCorrection" style="background:#fafafa;padding:10px;border-radius:4px;margin-bottom:12px">
                <div style="font-size:13px;font-weight:600;color:#E6A23C;margin-bottom:6px">人工修正</div>
                <div style="display:flex;gap:10px;flex-wrap:wrap">
                  <div v-for="dim in statDims" :key="'cr-'+dim.title">
                    <div v-for="(k, idx) in dim.items" :key="'cr-'+k" style="display:inline-flex;align-items:center;gap:4px;margin:2px 8px 2px 0">
                      <span style="font-size:12px;white-space:nowrap">{{ dim.labels[idx].replace(/[(%)\\(\\)]/g,'') }}</span>
                      <el-input-number v-model="correction[k]" :min="0" :precision="2" size="small" style="width:110px" controls-position="right" />
                    </div>
                  </div>
                </div>
              </div>
              <div style="display:flex;gap:8px;justify-content:flex-end">
                <el-button v-if="!showCorrection" size="small" @click="startCorrection">人工修正</el-button>
                <template v-else>
                  <el-button size="small" @click="clearCorrection">取消</el-button>
                  <el-button type="primary" size="small" @click="saveCorrection" :loading="saving">保存修正</el-button>
                </template>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- ======== Tab 2: 对比分析 ======== -->
        <el-tab-pane label="对比分析" name="compare">
          <div class="chart-panel" v-loading="compLoading">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <span style="font-size:14px;font-weight:600;color:#303133">量化对比清单</span>
              <div style="display:flex;gap:8px;align-items:center">
                <span style="font-size:12px;color:#909399">竣工至今</span>
                <el-button size="small" @click="startTargetEdit">调整目标</el-button>
              </div>
            </div>
            <template v-if="comparison">
              <!-- 关键差异点 -->
              <div v-if="keyDiffs.length > 0" style="background:#fef0f0;padding:10px 14px;border-radius:4px;margin-bottom:12px;border:1px solid #fab6b6">
                <div style="font-size:13px;font-weight:600;color:#F56C6C;margin-bottom:6px">关键差异点</div>
                <div v-for="d in keyDiffs" :key="d.label" style="font-size:12px;color:#606266;line-height:1.8">
                  <span style="color:#909399">{{ d.dimension }} · </span>
                  <span>{{ d.label }}：规划 {{ d.planned }} → 实际 {{ d.actual }}</span>
                  <span style="color:#F56C6C;font-weight:600">（{{ d.deviation }}）</span>
                </div>
              </div>

              <div v-for="dim in comparison.dimensions" :key="dim.dimension" style="margin-bottom:12px">
                <div style="font-size:13px;font-weight:600;padding-left:4px;border-left:3px solid #267F7B;margin-bottom:4px">{{ dim.dimension }}</div>
                <el-table :data="dim.indicators" stripe size="small">
                  <el-table-column prop="label" label="指标" width="140" />
                  <el-table-column prop="planned" label="规划目标" width="100" />
                  <el-table-column prop="actual" label="实际值" width="100" />
                  <el-table-column label="偏差率" width="90">
                    <template #default="{ row: i }">
                      <span :style="{ color: i.status==='偏差'?'#F56C6C':'#67C23A', fontWeight: 600 }">{{ i.deviation }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="状态" width="70">
                    <template #default="{ row: i }">
                      <el-tag :type="i.status==='偏差'?'danger':'success'" size="small">{{ i.status }}</el-tag>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
              <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;align-items:center">
                <el-tag :type="comparison.overallVerdict==='达标'?'success':'danger'" size="small">{{ comparison.overallVerdict }}</el-tag>
                <el-button type="primary" size="small" @click="generateReport" :loading="reportLoading">生成报告</el-button>
              </div>

              <!-- 调整目标面板 -->
              <div v-if="showTargetEdit" style="background:#fafafa;padding:12px;border-radius:4px;margin-top:12px">
                <div style="font-size:13px;font-weight:600;margin-bottom:8px">调整规划目标</div>
                <div style="display:flex;gap:10px;flex-wrap:wrap">
                  <div v-for="dim in comparison.dimensions" :key="'tg-'+dim.dimension">
                    <div v-for="ind in dim.indicators" :key="'tg-'+ind.label" style="display:inline-flex;align-items:center;gap:4px;margin:2px 8px 2px 0">
                      <span style="font-size:12px;white-space:nowrap">{{ ind.label }}{{ ind.unit==='%'?'(%)':ind.unit }}</span>
                      <el-input-number v-model="targetForm[ind.label==='发电量'?'outputMwh':ind.label==='等效利用小时'?'equivalentHours':ind.label==='电压合格率'?'voltageCompliancePct':ind.label==='频率合格率'?'frequencyCompliancePct':ind.label==='功率因数达标率'?'powerFactorRate':ind.label==='电压越限率'?'voltageViolationRate':ind.label==='无功倒送率'?'reactiveReverseRate':ind.label==='消纳率'?'absorptionRatePct':'completenessPct']" :min="0" :precision="ind.label==='等效利用小时'?0:1" size="small" style="width:100px" controls-position="right" />
                    </div>
                  </div>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
                  <el-button size="small" @click="showTargetEdit=false">取消</el-button>
                  <el-button type="primary" size="small" @click="saveTargets">保存</el-button>
                </div>
              </div>
            </template>
            <div v-else style="text-align:center;padding:20px;color:#909399">加载中...</div>
          </div>
        </el-tab-pane>

        <!-- ======== Tab 3: 评估报告 ======== -->
        <el-tab-pane label="评估报告" name="report">
          <div class="chart-panel" v-loading="reportLoading">
            <template v-if="report">
              <div style="font-size:13px;line-height:1.8;color:#303133">
                <h4 style="margin:0 0 8px;color:#267F7B">一、项目概况</h4>
                <table class="info-table" style="margin-bottom:16px">
                  <tr><td class="label">项目编号</td><td>{{ report.projectInfo.projectCode }}</td><td class="label">项目名称</td><td>{{ report.projectInfo.projectName }}</td></tr>
                  <tr><td class="label">电站名称</td><td>{{ report.projectInfo.stationName }}</td><td class="label">装机容量</td><td>{{ report.projectInfo.capacityMw }}MW</td></tr>
                  <tr><td class="label">并网电压</td><td>{{ report.projectInfo.gridVoltageKv }}kV</td><td class="label">投产日期</td><td>{{ report.projectInfo.operationDate }}</td></tr>
                </table>
                <h4 style="margin:12px 0 8px;color:#267F7B">二、目标完成度分析</h4>
                <p style="font-size:12px;color:#909399;margin:0 0 8px">{{ report.evaluationPeriod.start }} ~ {{ report.evaluationPeriod.end }}</p>
                <div v-for="dim in report.dimensions" :key="dim.dimension" style="margin-bottom:4px">
                  <span style="font-weight:600">{{ dim.dimension }}：</span>
                  <span v-for="(ind,idx) in dim.indicators" :key="ind.label" style="font-size:12px"><span v-if="idx>0" style="color:#ddd"> | </span>{{ ind.label }}{{ ind.status==='偏差'?'⚠':'✓' }}</span>
                </div>
                <h4 style="margin:12px 0 8px;color:#267F7B">三、偏差原因剖析</h4>
                <div v-if="report.deviations.length>0">
                  <div v-for="d in report.deviations" :key="d.indicator" style="background:#fef0f0;padding:8px 10px;margin:4px 0;font-size:12px;border-radius:2px">
                    <div style="font-weight:600;margin-bottom:2px">{{ d.dimension }} · {{ d.indicator }}：规划{{ d.planned }}，实际{{ d.actual }}，偏差{{ d.deviation }}</div>
                    <div v-if="d.autoCause" style="color:#606266;margin-bottom:4px">{{ d.autoCause }}</div>
                    <el-button type="warning" link size="small" @click="refineFromReport(d.dimension, d.indicator, d.deviation, d.autoCause||'', false)">提炼为教训</el-button>
                  </div>
                </div>
                <p v-else style="color:#909399;font-size:13px">各项指标均达标</p>
                <h4 style="margin:12px 0 8px;color:#267F7B">四、合规性审查</h4>
                <p style="font-size:13px">数据完整率：{{ report.dataCompleteness }}<span v-if="report.hasManualCorrection" style="color:#E6A23C"> | 含人工修正</span></p>
                <p style="font-size:13px">综合判定：<el-tag :type="report.overallVerdict==='达标'?'success':'danger'" size="small">{{ report.overallVerdict }}</el-tag></p>
                <h4 style="margin:12px 0 8px;color:#267F7B">五、成效亮点</h4>
                <div v-for="(h,i) in report.highlights" :key="i" style="background:#f0f9eb;padding:6px 10px;margin:4px 0;font-size:12px;border-radius:2px;display:flex;justify-content:space-between;align-items:center">
                  <span>{{ h.text }}</span>
                  <el-button type="success" link size="small" @click="refineFromReport(h.dimension, h.indicator, '', '', true)">提炼为经验</el-button>
                </div>
                <h4 style="margin:12px 0 8px;color:#267F7B">六、改进项</h4>
                <div v-for="(imp,i) in report.improvements" :key="i" style="background:#fef0f0;padding:6px 10px;margin:4px 0;font-size:12px;border-radius:2px;display:flex;justify-content:space-between;align-items:center">
                  <span>{{ imp.text }}</span>
                  <el-button type="warning" link size="small" @click="refineFromReport(imp.dimension, imp.indicator, '', '', false)">提炼为教训</el-button>
                </div>
                <div style="text-align:center;margin-top:16px;font-size:15px;font-weight:bold">综合判定：<span :style="{color:report.overallVerdict==='达标'?'#67C23A':'#F56C6C'}">{{ report.overallVerdict }}</span></div>
              </div>
            </template>
            <div v-else-if="!reportLoading" style="text-align:center;padding:40px;color:#909399">暂无评估报告，请在对比分析中生成报告</div>
          </div>
          <div v-if="report" style="text-align:right;margin-top:12px">
            <el-button size="small" @click="downloadReport">下载报告</el-button>
          </div>
        </el-tab-pane>

        <!-- ======== Tab 4: 案例库 ======== -->
        <el-tab-pane label="案例库" name="lessons">
          <div class="chart-panel">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <span style="font-size:14px;font-weight:600;color:#303133">经验教训案例库</span>
              <el-button type="primary" size="small" @click="openCreateLesson">新建案例</el-button>
            </div>
            <div v-if="lessons.length>0">
              <div v-for="l in lessons" :key="l.id" style="padding:10px 12px;margin-bottom:8px;border-radius:4px;display:flex;justify-content:space-between;align-items:flex-start"
                :style="{ background: l.type==='success' ? '#f0f9eb' : '#fef0f0', border: '1px solid ' + (l.type==='success' ? '#b3e19d' : '#fab6b6') }">
                <div style="flex:1">
                  <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">
                    <el-tag :type="l.type==='success'?'success':'danger'" size="small">{{ l.type==='success'?'成功经验':'失败教训' }}</el-tag>
                    <span style="font-size:13px;font-weight:600">{{ l.title }}</span>
                    <span style="font-size:12px;color:#909399">{{ l.dimension }} · {{ l.indicator || '-' }}</span>
                  </div>
                  <div style="font-size:12px;color:#606266;line-height:1.6">{{ l.content }}</div>
                  <div v-if="l.cause" style="font-size:12px;color:#909399;margin-top:4px">原因：{{ l.cause }}</div>
                  <div v-if="l.suggestion" style="font-size:12px;color:#267F7B;margin-top:4px">建议：{{ l.suggestion }}</div>
                </div>
                <el-button type="danger" link size="small" @click="handleDeleteLesson(l.id)">删除</el-button>
              </div>
            </div>
            <div v-else style="text-align:center;padding:40px;color:#909399">暂无案例，可从评估报告中提炼</div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </template>

    <div class="chart-panel" v-else style="text-align:center;padding:40px;color:#909399">暂无项目，请先<el-button type="primary" link size="small" @click="openCreateProject">新建项目</el-button></div>

    <!-- 案例编辑弹窗 -->
    <el-dialog v-model="lessonDlg" title="案例编辑" width="580px">
      <el-form label-width="80px" size="small">
        <el-form-item label="标题" required><el-input v-model="lessonForm.title" /></el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="lessonForm.type"><el-radio value="success">成功经验</el-radio><el-radio value="lesson">失败教训</el-radio></el-radio-group>
        </el-form-item>
        <el-form-item label="维度">
          <el-select v-model="lessonForm.dimension" style="width:100%">
            <el-option v-for="d in ['并网性能','电网影响','经济效益','综合']" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联指标"><el-input v-model="lessonForm.indicator" /></el-form-item>
        <el-form-item label="内容" required><el-input v-model="lessonForm.content" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="原因分析"><el-input v-model="lessonForm.cause" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="可复用建议"><el-input v-model="lessonForm.suggestion" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button size="small" @click="lessonDlg=false">取消</el-button><el-button type="primary" size="small" @click="handleCreateLesson">创建</el-button></template>
    </el-dialog>

    <!-- 新建项目弹窗 -->
    <el-dialog v-model="showCreateProject" title="新建项目" width="560px">
      <el-form label-width="130px" size="small">
        <el-form-item label="项目编号"><el-input v-model="newProject.projectCode" style="width:200px" /></el-form-item>
        <el-form-item label="项目名称"><el-input v-model="newProject.projectName" style="width:100%" /></el-form-item>
        <el-form-item label="关联电站">
          <el-select v-model="newProject.stationId" placeholder="选择已投运的实际电站" style="width:100%" filterable>
            <el-option v-for="s in availableStations" :key="s.id" :label="`${s.station_name} (${s.installed_capacity_mw}MW)`" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="投产日期"><el-date-picker v-model="newProject.operationStartDate" type="date" value-format="YYYY-MM-DD" style="width:200px" /></el-form-item>
        <el-divider>规划目标</el-divider>
        <el-form-item label="计划年发电量(万kWh)"><el-input-number v-model="newProject.plannedAnnualOutputMwh" :min="0" :precision="1" style="width:200px" /></el-form-item>
        <el-form-item label="计划等效利用小时"><el-input-number v-model="newProject.plannedEquivalentHours" :min="0" :precision="0" style="width:160px" /></el-form-item>
        <el-form-item label="计划消纳率(%)"><el-input-number v-model="newProject.plannedAbsorptionRatePct" :min="0" :max="100" :precision="1" style="width:160px" /></el-form-item>
        <el-form-item label="计划电压合格率(%)"><el-input-number v-model="newProject.plannedVoltageCompliancePct" :min="0" :max="100" :precision="1" style="width:160px" /></el-form-item>
      </el-form>
      <template #footer><el-button size="small" @click="showCreateProject=false">取消</el-button><el-button type="primary" size="small" @click="handleCreateProject">创建项目</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-container { display: flex; flex-direction: column; gap: 16px; }
.chart-panel { background: #fff; border-radius: 4px; padding: 16px; }
.info-table { width: 100%; font-size: 13px; border-collapse: collapse; }
.info-table td { padding: 4px 8px; border: 1px solid #ebeef5; }
.info-table td.label { background: #fafafa; color: #909399; width: 80px; text-align: right; white-space: nowrap; }
</style>
