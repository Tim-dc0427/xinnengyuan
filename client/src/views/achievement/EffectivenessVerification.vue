<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import ChartContainer from '@/components/common/ChartContainer.vue'
import {
  fetchOperationProjects, createOperationProject,
  fetchAvailableStations, fetchVerifications, createVerification, updateVerification,
} from '@/api/achievement'
import type { OperationProject, EffectivenessVerification, AvailableStation } from '@/api/achievement'

// ==================== 状态 ====================
const projects = ref<OperationProject[]>([])
const selectedProjectId = ref('')
const verifications = ref<EffectivenessVerification[]>([])
const saving = ref(false)
const correcting = ref(false)

// 新建评估表单
const showCreateForm = ref(false)
const form = ref({
  periodStart: '',
  periodEnd: '',
  absorptionRatePct: null as number | null,
  finalOutputKwh: null as number | null,
  finalEquivalentHours: null as number | null,
  finalVoltageCompliancePct: null as number | null,
  finalFrequencyCompliancePct: null as number | null,
  finalPowerFactorRate: null as number | null,
  finalCompletenessPct: null as number | null,
  correctionNote: '',
  remarks: '',
})

// 新建项目弹窗
const showCreateProject = ref(false)
const availableStations = ref<AvailableStation[]>([])
const newProject = ref({
  projectCode: '',
  projectName: '',
  stationId: '',
  operationStartDate: '',
  plannedAnnualOutputMwh: null as number | null,
  plannedEquivalentHours: null as number | null,
  plannedAbsorptionRatePct: null as number | null,
  plannedVoltageCompliancePct: null as number | null,
})

// 最新评估结果（展示用）
const latestVerification = ref<EffectivenessVerification | null>(null)

onMounted(async () => {
  projects.value = await fetchOperationProjects()
  if (projects.value.length > 0) {
    selectedProjectId.value = projects.value[0].id
    await loadVerifications()
  }
})

// ==================== 项目操作 ====================
const selectedProject = computed(() => projects.value.find(p => p.id === selectedProjectId.value))

async function loadVerifications() {
  if (!selectedProjectId.value) return
  verifications.value = await fetchVerifications(selectedProjectId.value)
  latestVerification.value = verifications.value.length > 0 ? verifications.value[0] : null
}

async function openCreateProject() {
  availableStations.value = await fetchAvailableStations()
  newProject.value = {
    projectCode: `OP-${new Date().getFullYear()}-${String(projects.value.length + 1).padStart(3, '0')}`,
    projectName: '',
    stationId: '',
    operationStartDate: '',
    plannedAnnualOutputMwh: null,
    plannedEquivalentHours: null,
    plannedAbsorptionRatePct: null,
    plannedVoltageCompliancePct: null,
  }
  showCreateProject.value = true
}

async function handleCreateProject() {
  const np = newProject.value
  if (!np.stationId || !np.projectName) {
    ElMessage.warning('请选择电站并填写项目名称')
    return
  }
  await createOperationProject({
    projectCode: np.projectCode,
    projectName: np.projectName,
    stationId: np.stationId,
    operationStartDate: np.operationStartDate || undefined,
    plannedAnnualOutputMwh: np.plannedAnnualOutputMwh ?? undefined,
    plannedEquivalentHours: np.plannedEquivalentHours ?? undefined,
    plannedAbsorptionRatePct: np.plannedAbsorptionRatePct ?? undefined,
    plannedVoltageCompliancePct: np.plannedVoltageCompliancePct ?? undefined,
  })
  ElMessage.success('投运项目创建成功')
  showCreateProject.value = false
  projects.value = await fetchOperationProjects()
}

// ==================== 评估操作 ====================
function openCreateVerification() {
  form.value = {
    periodStart: '',
    periodEnd: '',
    absorptionRatePct: null,
    finalOutputKwh: null,
    finalEquivalentHours: null,
    finalVoltageCompliancePct: null,
    finalFrequencyCompliancePct: null,
    finalPowerFactorRate: null,
    finalCompletenessPct: null,
    correctionNote: '',
    remarks: '',
  }
  showCreateForm.value = true
}

async function handleCreateVerification() {
  if (!selectedProjectId.value || !form.value.periodStart || !form.value.periodEnd) {
    ElMessage.warning('请选择评估周期')
    return
  }
  saving.value = true
  try {
    const v = await createVerification(selectedProjectId.value, {
      periodStart: form.value.periodStart,
      periodEnd: form.value.periodEnd,
      absorptionRatePct: form.value.absorptionRatePct,
      finalOutputKwh: form.value.finalOutputKwh,
      finalEquivalentHours: form.value.finalEquivalentHours,
      finalVoltageCompliancePct: form.value.finalVoltageCompliancePct,
      finalFrequencyCompliancePct: form.value.finalFrequencyCompliancePct,
      finalPowerFactorRate: form.value.finalPowerFactorRate,
      finalCompletenessPct: form.value.finalCompletenessPct,
      correctionNote: form.value.correctionNote || undefined,
      remarks: form.value.remarks || undefined,
    })
    verifications.value.unshift(v)
    latestVerification.value = v
    showCreateForm.value = false
    ElMessage.success('成效评估创建成功')
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '评估失败')
  } finally {
    saving.value = false
  }
}

async function handleCorrect(record: EffectivenessVerification) {
  const data: Record<string, any> = {}
  if (record.final_output_kwh !== null) data.finalOutputKwh = record.final_output_kwh
  if (record.final_equivalent_hours !== null) data.finalEquivalentHours = record.final_equivalent_hours
  if (record.final_voltage_compliance_pct !== null) data.finalVoltageCompliancePct = record.final_voltage_compliance_pct
  if (record.final_frequency_compliance_pct !== null) data.finalFrequencyCompliancePct = record.final_frequency_compliance_pct
  if (record.final_power_factor_rate !== null) data.finalPowerFactorRate = record.final_power_factor_rate
  if (record.final_completeness_pct !== null) data.finalCompletenessPct = record.final_completeness_pct
  if (record.absorption_rate_pct !== null) data.absorptionRatePct = record.absorption_rate_pct
  if (record.correction_note !== null) data.correctionNote = record.correction_note
  if (record.remarks !== null) data.remarks = record.remarks

  correcting.value = true
  try {
    const updated = await updateVerification(record.id, data)
    const idx = verifications.value.findIndex(v => v.id === record.id)
    if (idx >= 0) verifications.value[idx] = updated
    if (latestVerification.value?.id === record.id) latestVerification.value = updated
    ElMessage.success('已保存修正')
  } catch { ElMessage.error('修正失败') } finally { correcting.value = false }
}

// ==================== 辅助函数 ====================
function getFinal(record: EffectivenessVerification, field: 'output' | 'equivalentHours' | 'voltage' | 'frequency' | 'powerFactor' | 'completeness') {
  switch (field) {
    case 'output': return record.final_output_kwh ?? record.auto_output_kwh
    case 'equivalentHours': return record.final_equivalent_hours ?? record.auto_equivalent_hours
    case 'voltage': return record.final_voltage_compliance_pct ?? record.auto_voltage_compliance_pct
    case 'frequency': return record.final_frequency_compliance_pct ?? record.auto_frequency_compliance_pct
    case 'powerFactor': return record.final_power_factor_rate ?? record.auto_power_factor_rate
    case 'completeness': return record.final_completeness_pct ?? record.auto_completeness_pct
  }
}

function hasManualOverride(record: EffectivenessVerification) {
  return record.manual_override === 1
}

function deviationPct(actual: number | null | undefined, planned: number | null | undefined) {
  if (!actual || !planned) return null
  return ((actual - planned) / planned * 100)
}

// ==================== 图表 ====================
const barOption = computed(() => {
  const v = latestVerification.value
  if (!v) return {}

  const plannedOut = (v.planned_output_mwh ?? 0) * 10000 // 万kWh → kWh
  const actualOutKwh = getFinal(v, 'output') ?? 0
  const plannedAbs = v.planned_absorption_rate_pct ?? 0
  const actualAbs = v.absorption_rate_pct ?? 0
  const plannedVol = v.planned_voltage_compliance_pct ?? 0
  const actualVol = getFinal(v, 'voltage') ?? 0

  return {
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['规划目标', '实际值'], bottom: 0 },
    grid: { left: '12%', right: '8%', top: 20, bottom: 40 },
    xAxis: { type: 'category' as const, data: ['发电量(万kWh)', '消纳率(%)', '电压合格率(%)'] },
    yAxis: { type: 'value' as const },
    series: [
      {
        name: '规划目标', type: 'bar' as const,
        data: [
          (plannedOut / 10000).toFixed(1),
          plannedAbs.toFixed(1),
          plannedVol.toFixed(1),
        ].map(Number),
        itemStyle: { color: '#b0b0b0' },
      },
      {
        name: '实际值', type: 'bar' as const,
        data: [
          (actualOutKwh / 10000).toFixed(1),
          actualAbs.toFixed(1),
          actualVol.toFixed(1),
        ].map(Number),
        itemStyle: { color: '#267F7B' },
      },
    ],
  }
})
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">项目成效验证评估</div>

    <!-- 项目选择 & 管理 -->
    <div class="chart-panel">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <span>投运项目：</span>
        <el-select v-model="selectedProjectId" placeholder="选择投运项目" size="small" style="width:320px" @change="loadVerifications">
          <el-option v-for="p in projects" :key="p.id" :label="`${p.project_code} ${p.project_name}`" :value="p.id" />
        </el-select>
        <el-button size="small" @click="openCreateProject">新建项目</el-button>
      </div>
    </div>

    <!-- 项目详情 -->
    <template v-if="selectedProject">
      <div class="chart-panel">
        <table class="info-table">
          <tbody>
            <tr>
              <td class="label">项目编号</td><td>{{ selectedProject.project_code }}</td>
              <td class="label">电站名称</td><td>{{ selectedProject.station_name }}</td>
              <td class="label">装机容量</td><td>{{ selectedProject.installed_capacity_mw }}MW</td>
            </tr>
            <tr>
              <td class="label">投产日期</td><td>{{ selectedProject.operation_start_date || '-' }}</td>
              <td class="label">并网电压</td><td>{{ selectedProject.grid_connection_voltage_kv }}kV</td>
              <td class="label">所属区域</td><td>{{ selectedProject.zone || '-' }}</td>
            </tr>
            <tr>
              <td class="label">计划年发电量</td><td>{{ selectedProject.planned_annual_output_mwh ?? '-' }} 万kWh</td>
              <td class="label">计划利用小时</td><td>{{ selectedProject.planned_equivalent_hours ?? '-' }}h</td>
              <td class="label">计划消纳率</td><td>{{ selectedProject.planned_absorption_rate_pct ?? '-' }}%</td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top:10px">
          <el-button type="primary" size="small" @click="openCreateVerification">新建评估</el-button>
        </div>
      </div>

      <!-- 最新评估对比 -->
      <template v-if="latestVerification">
        <div class="grid-2">
          <!-- 图表 -->
          <div class="chart-panel">
            <div style="font-size:14px;font-weight:600;color:#303133;margin-bottom:10px">
              规划目标与实际结果对比
              <span style="font-weight:400;font-size:12px;color:#909399;margin-left:8px">
                {{ latestVerification.period_start?.slice(0, 10) }} ~ {{ latestVerification.period_end?.slice(0, 10) }}
              </span>
            </div>
            <ChartContainer :option="barOption" height="240px" />
            <div style="margin-top:4px;font-size:12px;color:#909399" v-if="hasManualOverride(latestVerification)">
              * 含人工修正数据
            </div>
          </div>

          <!-- 明细表 -->
          <div class="chart-panel">
            <div style="font-size:14px;font-weight:600;color:#303133;margin-bottom:10px">量化对比清单</div>
            <el-table :data="[
              {
                key: '发电量(万kWh)',
                planned: ((latestVerification.planned_output_mwh ?? 0)).toFixed(1),
                auto: ((latestVerification.auto_output_kwh ?? 0) / 10000).toFixed(1),
                actual: ((getFinal(latestVerification, 'output') ?? 0) / 10000).toFixed(1),
                dev: deviationPct((getFinal(latestVerification, 'output') ?? 0) / 10000, latestVerification.planned_output_mwh),
              },
              {
                key: '等效利用小时(h)',
                planned: (latestVerification.planned_equivalent_hours ?? '-'),
                auto: (latestVerification.auto_equivalent_hours ?? '-'),
                actual: (getFinal(latestVerification, 'equivalentHours') ?? '-'),
                dev: deviationPct(getFinal(latestVerification, 'equivalentHours'), latestVerification.planned_equivalent_hours),
              },
              {
                key: '消纳率(%)',
                planned: (latestVerification.planned_absorption_rate_pct ?? '-'),
                auto: '-',
                actual: (latestVerification.absorption_rate_pct ?? '-'),
                dev: deviationPct(latestVerification.absorption_rate_pct, latestVerification.planned_absorption_rate_pct),
              },
              {
                key: '电压合格率(%)',
                planned: (latestVerification.planned_voltage_compliance_pct ?? '-'),
                auto: (latestVerification.auto_voltage_compliance_pct ?? '-'),
                actual: (getFinal(latestVerification, 'voltage') ?? '-'),
                dev: deviationPct(getFinal(latestVerification, 'voltage'), latestVerification.planned_voltage_compliance_pct),
              },
              {
                key: '频率合格率(%)',
                planned: '≥99',
                auto: (latestVerification.auto_frequency_compliance_pct ?? '-'),
                actual: (getFinal(latestVerification, 'frequency') ?? '-'),
                dev: null,
              },
              {
                key: '功率因数达标率(%)',
                planned: '≥95',
                auto: (latestVerification.auto_power_factor_rate ?? '-'),
                actual: (getFinal(latestVerification, 'powerFactor') ?? '-'),
                dev: null,
              },
              {
                key: '数据完整率(%)',
                planned: '目标95',
                auto: (latestVerification.auto_completeness_pct ?? '-'),
                actual: (getFinal(latestVerification, 'completeness') ?? '-'),
                dev: null,
              },
            ]" stripe size="small" :show-header="true">
              <el-table-column prop="key" label="指标" width="140" />
              <el-table-column prop="planned" label="规划目标" width="100" />
              <el-table-column prop="auto" label="自动聚合" width="100" />
              <el-table-column label="实际采用" width="100">
                <template #default="{ row }">
                  <span :style="{ fontWeight: hasManualOverride(latestVerification) ? 600 : 400 }">
                    {{ row.actual }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="偏差率" width="90">
                <template #default="{ row }">
                  <span v-if="row.dev !== null" :style="{ color: Math.abs(row.dev) > 10 ? '#F56C6C' : '#67C23A', fontWeight: 600 }">
                    {{ row.dev > 0 ? '+' : '' }}{{ row.dev.toFixed(1) }}%
                  </span>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="80">
                <template #default="{ row }">
                  <template v-if="row.dev !== null">
                    <el-tag :type="Math.abs(row.dev) > 10 ? 'danger' : 'success'" size="small">
                      {{ Math.abs(row.dev) > 10 ? '偏差' : '正常' }}
                    </el-tag>
                  </template>
                  <span v-else>-</span>
                </template>
              </el-table-column>
            </el-table>
            <div style="margin-top:10px;text-align:right">
              <el-tag :type="latestVerification.is_effective ? 'success' : 'danger'" size="small">
                {{ latestVerification.is_effective ? '综合判定：达标' : '综合判定：未达标' }}
              </el-tag>
            </div>
          </div>
        </div>

        <!-- 修正面板（最新评估） -->
        <div class="chart-panel" v-if="hasManualOverride(latestVerification)">
          <div style="font-size:13px;font-weight:600;color:#E6A23C;margin-bottom:8px">人工修正记录</div>
          <span style="font-size:12px;color:#909399">{{ latestVerification.correction_note || '无修正说明' }}</span>
        </div>
      </template>

      <!-- 历史评估记录 -->
      <div class="chart-panel">
        <div style="font-size:14px;font-weight:600;color:#303133;margin-bottom:10px">历史评估记录</div>
        <el-table :data="verifications" stripe size="small" v-if="verifications.length > 0">
          <el-table-column label="评估周期" width="200">
            <template #default="{ row }">{{ row.period_start?.slice(0, 10) }} ~ {{ row.period_end?.slice(0, 10) }}</template>
          </el-table-column>
          <el-table-column label="实际发电量(kWh)" width="140">
            <template #default="{ row }">{{ ((getFinal(row, 'output') ?? 0)).toLocaleString() }}</template>
          </el-table-column>
          <el-table-column label="等效利用小时" width="100">
            <template #default="{ row }">{{ getFinal(row, 'equivalentHours') ?? '-' }}</template>
          </el-table-column>
          <el-table-column label="消纳率" width="80">
            <template #default="{ row }">{{ row.absorption_rate_pct ?? '-' }}%</template>
          </el-table-column>
          <el-table-column label="电压合格率" width="90">
            <template #default="{ row }">{{ getFinal(row, 'voltage') ?? '-' }}%</template>
          </el-table-column>
          <el-table-column label="数据完整率" width="90">
            <template #default="{ row }">
              <span :style="{ color: (getFinal(row, 'completeness') ?? 0) < 95 ? '#F56C6C' : '' }">
                {{ getFinal(row, 'completeness') ?? '-' }}%
              </span>
            </template>
          </el-table-column>
          <el-table-column label="修正" width="70">
            <template #default="{ row }">
              <el-tag v-if="hasManualOverride(row)" type="warning" size="small">已修正</el-tag>
              <span v-else style="color:#909399">自动</span>
            </template>
          </el-table-column>
          <el-table-column label="达标" width="70">
            <template #default="{ row }">
              <el-tag :type="row.is_effective ? 'success' : 'danger'" size="small">
                {{ row.is_effective ? '是' : '否' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="handleCorrect(row)" :loading="correcting">修正</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-else style="color:#909399;font-size:13px;text-align:center;padding:20px">暂无评估记录</div>
      </div>
    </template>

    <!-- 无项目提示 -->
    <div class="chart-panel" v-else style="text-align:center;padding:40px;color:#909399">
      暂无投运项目，请先<el-button type="primary" link size="small" @click="openCreateProject">新建项目</el-button>
    </div>

    <!-- 新建评估弹窗 -->
    <el-dialog v-model="showCreateForm" title="新建成效评估" width="680px" :close-on-click-modal="false">
      <el-form label-width="120px" size="small" v-if="selectedProject">
        <el-form-item label="评估周期">
          <el-date-picker v-model="form.periodStart" type="date" placeholder="开始日期" value-format="YYYY-MM-DD" style="width:160px" />
          <span style="margin:0 8px;color:#909399">至</span>
          <el-date-picker v-model="form.periodEnd" type="date" placeholder="结束日期" value-format="YYYY-MM-DD" style="width:160px" />
        </el-form-item>

        <el-divider content-position="left" style="margin:12px 0">规划目标（从项目带入）</el-divider>
        <table class="info-table" style="margin-bottom:12px">
          <tbody>
            <tr>
              <td class="label">计划年发电量</td><td>{{ selectedProject.planned_annual_output_mwh ?? '-' }} 万kWh</td>
              <td class="label">计划利用小时</td><td>{{ selectedProject.planned_equivalent_hours ?? '-' }}h</td>
            </tr>
            <tr>
              <td class="label">计划消纳率</td><td>{{ selectedProject.planned_absorption_rate_pct ?? '-' }}%</td>
              <td class="label">计划电压合格率</td><td>{{ selectedProject.planned_voltage_compliance_pct ?? '-' }}%</td>
            </tr>
          </tbody>
        </table>

        <el-divider content-position="left" style="margin:12px 0">实际运行数据（保存后自动从 pv_output_measurements 聚合，以下为手动修正入口）</el-divider>
        <el-form-item label="消纳率(%)">
          <el-input-number v-model="form.absorptionRatePct" :min="0" :max="100" :precision="1" style="width:160px" placeholder="手动录入" />
          <span style="font-size:11px;color:#909399;margin-left:8px">需手动录入，无法自动计算</span>
        </el-form-item>
        <el-form-item label="修正发电量(kWh)">
          <el-input-number v-model="form.finalOutputKwh" :min="0" style="width:220px" placeholder="留空则用自动值" />
        </el-form-item>
        <el-form-item label="修正等效利用小时">
          <el-input-number v-model="form.finalEquivalentHours" :min="0" :precision="1" style="width:160px" placeholder="留空则用自动值" />
        </el-form-item>
        <el-form-item label="修正电压合格率(%)">
          <el-input-number v-model="form.finalVoltageCompliancePct" :min="0" :max="100" :precision="1" style="width:160px" />
        </el-form-item>
        <el-form-item label="修正频率合格率(%)">
          <el-input-number v-model="form.finalFrequencyCompliancePct" :min="0" :max="100" :precision="1" style="width:160px" />
        </el-form-item>
        <el-form-item label="修正功率因数率(%)">
          <el-input-number v-model="form.finalPowerFactorRate" :min="0" :max="100" :precision="1" style="width:160px" />
        </el-form-item>
        <el-form-item label="修正数据完整率(%)">
          <el-input-number v-model="form.finalCompletenessPct" :min="0" :max="100" :precision="1" style="width:160px" />
        </el-form-item>
        <el-form-item label="修正原因">
          <el-input v-model="form.correctionNote" type="textarea" :rows="2" placeholder="如有手动修正，请说明原因" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remarks" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="showCreateForm = false">取消</el-button>
        <el-button type="primary" size="small" @click="handleCreateVerification" :loading="saving">保存评估</el-button>
      </template>
    </el-dialog>

    <!-- 新建项目弹窗 -->
    <el-dialog v-model="showCreateProject" title="新建投运项目" width="560px" :close-on-click-modal="false">
      <el-form label-width="130px" size="small">
        <el-form-item label="项目编号">
          <el-input v-model="newProject.projectCode" style="width:200px" />
        </el-form-item>
        <el-form-item label="项目名称">
          <el-input v-model="newProject.projectName" style="width:100%" />
        </el-form-item>
        <el-form-item label="关联电站">
          <el-select v-model="newProject.stationId" placeholder="选择已投运的实际电站" style="width:100%" filterable>
            <el-option v-for="s in availableStations" :key="s.id" :label="`${s.station_name} (${s.installed_capacity_mw}MW)`" :value="s.id">
              <div>{{ s.station_name }}</div>
              <div style="font-size:11px;color:#909399">{{ s.installed_capacity_mw }}MW | {{ s.grid_connection_voltage_kv }}kV | {{ s.address }}</div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="投产日期">
          <el-date-picker v-model="newProject.operationStartDate" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width:200px" />
        </el-form-item>
        <el-divider content-position="left" style="margin:12px 0">规划目标</el-divider>
        <el-form-item label="计划年发电量(万kWh)">
          <el-input-number v-model="newProject.plannedAnnualOutputMwh" :min="0" :precision="1" style="width:200px" />
        </el-form-item>
        <el-form-item label="计划等效利用小时">
          <el-input-number v-model="newProject.plannedEquivalentHours" :min="0" :precision="0" style="width:160px" />
        </el-form-item>
        <el-form-item label="计划消纳率(%)">
          <el-input-number v-model="newProject.plannedAbsorptionRatePct" :min="0" :max="100" :precision="1" style="width:160px" />
        </el-form-item>
        <el-form-item label="计划电压合格率(%)">
          <el-input-number v-model="newProject.plannedVoltageCompliancePct" :min="0" :max="100" :precision="1" style="width:160px" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="showCreateProject = false">取消</el-button>
        <el-button type="primary" size="small" @click="handleCreateProject">创建项目</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-container { display: flex; flex-direction: column; gap: 16px; }
.chart-panel { background: #fff; border-radius: 4px; padding: 16px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.info-table { width: 100%; font-size: 13px; border-collapse: collapse; }
.info-table td { padding: 4px 8px; border: 1px solid #ebeef5; }
.info-table td.label { background: #fafafa; color: #909399; width: 110px; text-align: right; white-space: nowrap; }
</style>
