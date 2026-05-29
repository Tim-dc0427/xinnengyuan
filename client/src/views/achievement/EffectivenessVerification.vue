<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import ChartContainer from '@/components/common/ChartContainer.vue'
import { fetchProjects, verifyEffectiveness } from '@/api/achievement'
import type { ProjectItem, EffectivenessRecord } from '@/api/achievement'

const projects = ref<ProjectItem[]>([])
const selectedProjectId = ref('')
const records = ref<EffectivenessRecord[]>([])
const saving = ref(false)

const form = ref({
  plannedOutputKwh: 0,
  actualOutputKwh: 0,
  absorptionRatePct: 0,
  voltageCompliancePct: 0,
  isEffective: true,
  remarks: '',
})

onMounted(async () => {
  projects.value = await fetchProjects({ status: 'operation' })
})

const selectedProject = computed(() => projects.value.find(p => p.id === selectedProjectId.value))

const deviationPct = computed(() => {
  if (!form.value.plannedOutputKwh) return 0
  return ((form.value.actualOutputKwh - form.value.plannedOutputKwh) / form.value.plannedOutputKwh * 100)
})

const barOption = computed(() => {
  const planned = form.value.plannedOutputKwh || 0
  const actual = form.value.actualOutputKwh || 0
  return {
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['计划值', '实际值'], bottom: 0 },
    grid: { left: '10%', right: '10%', top: 20, bottom: 40 },
    xAxis: { type: 'category' as const, data: ['发电量(MWh)', '消纳率(%)', '电压合规率(%)'] },
    yAxis: { type: 'value' as const },
    series: [
      { name: '计划值', type: 'bar' as const, data: [planned / 1000, form.value.absorptionRatePct || 0, form.value.voltageCompliancePct || 0], itemStyle: { color: '#909399' } },
      { name: '实际值', type: 'bar' as const, data: [actual / 1000, 0, 0], itemStyle: { color: '#267F7B' } },
    ],
  }
})

async function handleSave() {
  if (!selectedProjectId.value) return
  saving.value = true
  try {
    const record = await verifyEffectiveness(selectedProjectId.value, { ...form.value })
    records.value.unshift(record)
    ElMessage.success('成效验证记录保存成功')
  } catch { ElMessage.error('保存失败') } finally { saving.value = false }
}
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">项目成效验证评估</div>

    <div class="chart-panel">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <span>选择已投运项目：</span>
        <el-select v-model="selectedProjectId" placeholder="请选择项目" size="small" style="width:280px">
          <el-option v-for="p in projects" :key="p.id" :label="p.project_name" :value="p.id" />
        </el-select>
      </div>
    </div>

    <template v-if="selectedProject">
      <div class="grid-2">
        <div class="chart-panel">
          <div style="font-size:14px;font-weight:600;color:#303133;margin-bottom:12px">竣工成效数据录入</div>
          <el-form :model="form" label-width="130px" size="small">
            <el-form-item label="计划发电量(kWh)">
              <el-input-number v-model="form.plannedOutputKwh" :min="0" style="width:100%" />
            </el-form-item>
            <el-form-item label="实际发电量(kWh)">
              <el-input-number v-model="form.actualOutputKwh" :min="0" style="width:100%" />
            </el-form-item>
            <el-form-item label="消纳率(%)">
              <el-input-number v-model="form.absorptionRatePct" :min="0" :max="100" :precision="1" style="width:100%" />
            </el-form-item>
            <el-form-item label="电压合规率(%)">
              <el-input-number v-model="form.voltageCompliancePct" :min="0" :max="100" :precision="1" style="width:100%" />
            </el-form-item>
            <el-form-item label="是否达标">
              <el-switch v-model="form.isEffective" />
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="form.remarks" type="textarea" :rows="2" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" size="small" @click="handleSave" :loading="saving">保存验证记录</el-button>
            </el-form-item>
          </el-form>
        </div>

        <div class="chart-panel">
          <div style="font-size:14px;font-weight:600;color:#303133;margin-bottom:12px">规划目标与实际结果对比</div>

          <ChartContainer :option="barOption" height="240px" />

          <div style="margin-top:12px">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="计划发电量">{{ (form.plannedOutputKwh / 1000).toFixed(2) }} MWh</el-descriptions-item>
              <el-descriptions-item label="实际发电量">{{ (form.actualOutputKwh / 1000).toFixed(2) }} MWh</el-descriptions-item>
              <el-descriptions-item label="偏差率">
                <span :style="{ color: Math.abs(deviationPct) > 10 ? '#F56C6C' : '#67C23A', fontWeight: 600 }">
                  {{ deviationPct > 0 ? '+' : '' }}{{ deviationPct.toFixed(2) }}%
                </span>
              </el-descriptions-item>
              <el-descriptions-item label="达标判定">
                <el-tag :type="form.isEffective ? 'success' : 'danger'" size="small">
                  {{ form.isEffective ? '达标' : '未达标' }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="消纳率">{{ form.absorptionRatePct }}%</el-descriptions-item>
              <el-descriptions-item label="电压合规率">{{ form.voltageCompliancePct }}%</el-descriptions-item>
            </el-descriptions>
          </div>
        </div>
      </div>

      <div class="chart-panel" v-if="records.length > 0">
        <div style="font-size:14px;font-weight:600;color:#303133;margin-bottom:8px">历史验证记录</div>
        <el-table :data="records" stripe size="small">
          <el-table-column prop="verification_date" label="验证日期" width="120" />
          <el-table-column label="计划发电量(kWh)" width="130">
            <template #default="{ row }">{{ row.planned_output_kwh.toLocaleString() }}</template>
          </el-table-column>
          <el-table-column label="实际发电量(kWh)" width="130">
            <template #default="{ row }">{{ row.actual_output_kwh.toLocaleString() }}</template>
          </el-table-column>
          <el-table-column label="消纳率" width="80">
            <template #default="{ row }">{{ row.absorption_rate_pct }}%</template>
          </el-table-column>
          <el-table-column label="电压合规率" width="100">
            <template #default="{ row }">{{ row.voltage_compliance_pct }}%</template>
          </el-table-column>
          <el-table-column label="达标" width="80">
            <template #default="{ row }">
              <el-tag :type="row.is_effective ? 'success' : 'danger'" size="small">
                {{ row.is_effective ? '是' : '否' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remarks" label="备注" min-width="150" />
        </el-table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page-container { display: flex; flex-direction: column; gap: 16px; }
.chart-panel { background: #fff; border-radius: 4px; padding: 16px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
</style>
