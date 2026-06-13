<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import ChartContainer from '@/components/common/ChartContainer.vue'
import AssessmentModelMgmt from './AssessmentModelMgmt.vue'
import { fetchProjects, runFeasibility } from '@/api/achievement'
import type { ProjectItem, FeasibilityResult } from '@/api/achievement'
import dayjs from 'dayjs'

// ==================== Tab 状态 ====================
const activeTab = ref('model')

// ==================== 项目选择 ====================
const projects = ref<ProjectItem[]>([])
const selectedProjectId = ref('')

onMounted(async () => {
  try { projects.value = await fetchProjects() } catch { projects.value = [] }
})

const selectedProject = computed(() => projects.value.find(p => p.id === selectedProjectId.value))

// ==================== 评估参数（从 custom_fields 自动填入） ====================
const params = reactive<Record<string, any>>({})
const gradeOptions = ['A', 'B', 'C']
const corrOptions = ['可用', '受限', '不可用']
const sensOptions = ['不敏感', '一般', '敏感']
const riskOptions = ['低', '中', '高']
const landOptions = ['未利用地', '建设用地', '草地', '农用地', '林地']
const voltOptions = ['220V', '380V', '10kV', '35kV', '110kV', '220kV']

function loadProjectParams(project: ProjectItem) {
  let cf: Record<string, any> = {}
  try { if (project.custom_fields) cf = JSON.parse(project.custom_fields) } catch { /* ignore */ }
  const fieldList = ['annual_irradiance', 'sunshine_hours', 'solar_grade', 'capacity_mwp',
    'grid_voltage', 'short_circuit_capacity_mva', 'transmission_distance_km', 'corridor_available',
    'unit_cost', 'payback_years', 'irr_pct',
    'land_type', 'env_sensitivity', 'geohazard_risk']
  // 重置
  for (const f of fieldList) params[f] = ''
  // 从 custom_fields 填充
  for (const [k, v] of Object.entries(cf)) {
    if (v !== null && v !== undefined && v !== '') params[k] = v
  }
}

function onProjectChange(id: string) {
  selectedProjectId.value = id
  const p = projects.value.find(x => x.id === id)
  if (p) loadProjectParams(p)
}

// ==================== 权重 ====================
const weights = reactive({ resource: 25, grid: 25, investment: 25, environment: 25 })
const threshold = ref(60)
const hasValidParams = computed(() => {
  return params.annual_irradiance || params.capacity_mwp
})

// ==================== 评估 ====================
const feasibility = ref<FeasibilityResult | null>(null)
const loading = ref(false)
const lastParams = ref<any>(null)

async function handleRun() {
  if (!selectedProjectId.value) return
  loading.value = true
  try {
    const data = {
      params: { ...params },
      weights: {
        resource: weights.resource / 100,
        grid: weights.grid / 100,
        investment: weights.investment / 100,
        environment: weights.environment / 100,
      },
      accessPointId: undefined,
    }
    lastParams.value = data
    feasibility.value = await runFeasibility(selectedProjectId.value, data)
    ElMessage.success('评估完成')
  } catch { ElMessage.error('评估失败') } finally { loading.value = false }
}

// ==================== 雷达图 ====================
const radarOption = computed(() => {
  if (!feasibility.value) return {}
  const f = feasibility.value
  return {
    tooltip: {
      formatter: (p: any) => {
        if (!p?.value) return ''
        const labels = ['资源', '电网', '投资', '环境']
        return labels.map((l, i) => `${l}: ${Number(p.value[i]).toFixed(2)}`).join('<br/>')
      },
    },
    radar: {
      indicator: [
        { name: '资源', max: 100 }, { name: '电网', max: 100 },
        { name: '投资', max: 100 }, { name: '环境', max: 100 },
      ],
      shape: 'circle', center: ['50%', '55%'], radius: '65%',
    },
    series: [{
      type: 'radar',
      data: [{ value: [f.technical_score, f.social_score, f.economic_score, f.environmental_score], name: '得分' }],
      areaStyle: { color: 'rgba(38,127,123,0.2)' },
      lineStyle: { color: '#267F7B' }, itemStyle: { color: '#267F7B' },
    }],
  }
})

const scoreItems = computed(() => {
  if (!feasibility.value) return []
  const f = feasibility.value
  return [
    { label: '资源', score: f.technical_score, weight: weights.resource },
    { label: '电网', score: f.social_score, weight: weights.grid },
    { label: '投资', score: f.economic_score, weight: weights.investment },
    { label: '环境', score: f.environmental_score, weight: weights.environment },
  ]
})

const isAbove = computed(() => feasibility.value ? feasibility.value.comprehensive_score >= threshold.value : false)

const constraints = computed(() => {
  return scoreItems.value.filter(s => s.score < threshold.value).map(s => ({
    dimension: s.label, score: s.score,
    gap: threshold.value - s.score,
    suggestion: `${s.label}维度得分${s.score.toFixed(1)}低于阈值${threshold.value}，建议优化相关指标`,
  }))
})

function scoreColor(s: number) { return s >= 80 ? '#67C23A' : s >= 50 ? '#E6A23C' : '#F56C6C' }

// ==================== 报告 ====================
function exportPDF() {
  const el = document.getElementById('feasibility-report')
  if (!el) return
  const win = window.open('', '_blank', 'width=800,height=600')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>评估报告</title>
<style>body{font-family:'Microsoft YaHei',sans-serif;padding:30px 40px;color:#303133;line-height:1.8;font-size:13px}
h2{text-align:center;margin-bottom:4px}h4{border-bottom:2px solid #267F7B;padding-bottom:4px;margin:16px 0 8px}
table{width:100%;border-collapse:collapse;margin-bottom:12px}
td,th{padding:4px 8px;border:1px solid #e4e7ed}th{background:#f5f7fa;text-align:left}
@media print{body{padding:0}}</style></head><body>${el.innerHTML}</body></html>`)
  win.document.close()
  setTimeout(() => { win.print(); win.close() }, 500)
}
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">并网可行性综合分析</div>

    <el-tabs v-model="activeTab" class="feasibility-tabs">
      <!-- Tab1: 四维评估模型构建 -->
      <el-tab-pane name="model" label="四维评估模型构建">
        <AssessmentModelMgmt />
      </el-tab-pane>

      <!-- Tab2: 并网可行性得分计算 -->
      <el-tab-pane name="calc" label="并网可行性得分计算">
        <!-- 选择区 -->
        <div class="chart-panel">
          <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="color:#606266;font-size:13px">选择项目：</span>
              <el-select v-model="selectedProjectId" placeholder="选择项目" size="small" style="width:300px" @change="onProjectChange">
                <el-option v-for="p in projects" :key="p.id" :label="p.project_name" :value="p.id" />
              </el-select>
            </div>
          </div>
        </div>

        <template v-if="selectedProject">
          <!-- 评估参数 -->
          <div class="chart-panel">
            <div style="font-size:14px;font-weight:600;color:#303133;margin-bottom:8px">评估参数（已从项目数据自动填入，可手动修改）</div>
            <div class="param-grid">
              <div class="param-group">
                <div class="param-group-title">资源维度</div>
                <div class="param-row"><span>年均辐照度</span><el-input-number v-model="params.annual_irradiance" size="small" style="width:160px" controls-position="right" /><span class="param-unit">kWh/㎡·年</span></div>
                <div class="param-row"><span>年日照小时数</span><el-input-number v-model="params.sunshine_hours" size="small" style="width:160px" controls-position="right" /><span class="param-unit">h</span></div>
                <div class="param-row"><span>资源等级</span><el-select v-model="params.solar_grade" size="small" style="width:160px" clearable><el-option v-for="o in gradeOptions" :key="o" :label="o" :value="o" /></el-select></div>
                <div class="param-row"><span>装机容量</span><el-input-number v-model="params.capacity_mwp" size="small" style="width:160px" controls-position="right" /><span class="param-unit">MWp</span></div>
              </div>
              <div class="param-group">
                <div class="param-group-title">电网维度</div>
                <div class="param-row"><span>电压等级</span><el-select v-model="params.grid_voltage" size="small" style="width:160px" clearable><el-option v-for="o in voltOptions" :key="o" :label="o" :value="o" /></el-select></div>
                <div class="param-row"><span>短路容量</span><el-input-number v-model="params.short_circuit_capacity_mva" size="small" style="width:160px" controls-position="right" /><span class="param-unit">MVA</span></div>
                <div class="param-row"><span>接入距离</span><el-input-number v-model="params.transmission_distance_km" size="small" style="width:160px" controls-position="right" /><span class="param-unit">km</span></div>
                <div class="param-row"><span>走廊可用性</span><el-select v-model="params.corridor_available" size="small" style="width:160px" clearable><el-option v-for="o in corrOptions" :key="o" :label="o" :value="o" /></el-select></div>
              </div>
              <div class="param-group">
                <div class="param-group-title">投资维度</div>
                <div class="param-row"><span>单位造价</span><el-input-number v-model="params.unit_cost" size="small" style="width:160px" controls-position="right" /><span class="param-unit">元/W</span></div>
                <div class="param-row"><span>回收期</span><el-input-number v-model="params.payback_years" size="small" style="width:160px" controls-position="right" /><span class="param-unit">年</span></div>
                <div class="param-row"><span>内部收益率</span><el-input-number v-model="params.irr_pct" size="small" style="width:160px" controls-position="right" /><span class="param-unit">%</span></div>
              </div>
              <div class="param-group">
                <div class="param-group-title">环境维度</div>
                <div class="param-row"><span>土地性质</span><el-select v-model="params.land_type" size="small" style="width:160px" clearable><el-option v-for="o in landOptions" :key="o" :label="o" :value="o" /></el-select></div>
                <div class="param-row"><span>环保敏感性</span><el-select v-model="params.env_sensitivity" size="small" style="width:160px" clearable><el-option v-for="o in sensOptions" :key="o" :label="o" :value="o" /></el-select></div>
                <div class="param-row"><span>地灾风险</span><el-select v-model="params.geohazard_risk" size="small" style="width:160px" clearable><el-option v-for="o in riskOptions" :key="o" :label="o" :value="o" /></el-select></div>
              </div>
            </div>
          </div>

          <!-- 权重 + 运行 -->
          <div class="chart-panel">
            <div style="font-size:14px;font-weight:600;color:#303133;margin-bottom:8px">权重配置</div>
            <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
              <template v-for="(_, k) in weights" :key="k">
                <div style="display:flex;align-items:center;gap:4px">
                  <span style="font-size:13px;color:#909399;width:40px">{{ { resource: '资源', grid: '电网', investment: '投资', environment: '环境' }[k as string] }}</span>
                  <el-input-number v-model="weights[k as keyof typeof weights]" :min="0" :max="100" size="small" style="width:80px" />
                  <span style="color:#909399;font-size:12px">%</span>
                </div>
              </template>
              <span style="color:#909399;font-size:12px">（总和应=100%）</span>
              <div style="display:flex;align-items:center;gap:4px;margin-left:12px">
                <span style="font-size:13px;color:#909399">通过阈值</span>
                <el-input-number v-model="threshold" :min="0" :max="100" size="small" style="width:80px" />
              </div>
              <el-button type="primary" size="small" @click="handleRun" :loading="loading" :disabled="!hasValidParams">运行评估</el-button>
            </div>
          </div>

          <!-- 评估结果 -->
          <template v-if="feasibility">
            <div class="grid-2">
              <div class="chart-panel">
                <div style="font-size:14px;font-weight:600;color:#303133;margin-bottom:4px">四维评估雷达图</div>
                <ChartContainer :option="radarOption" height="340px" />
              </div>
              <div class="chart-panel">
                <div style="font-size:14px;font-weight:600;color:#303133;margin-bottom:12px">得分明细</div>
                <div style="margin-bottom:12px;padding:16px;background:#f5f7fa;border-radius:4px;text-align:center">
                  <div style="font-size:12px;color:#909399">综合得分</div>
                  <div :style="{ fontSize: '36px', fontWeight: 700, color: scoreColor(feasibility.comprehensive_score) }">{{ feasibility.comprehensive_score.toFixed(1) }}</div>
                  <div style="font-size:12px" :style="{ color: isAbove ? '#67C23A' : '#F56C6C' }">{{ isAbove ? '通过阈值' : '未通过阈值' }}（阈值 {{ threshold }}）</div>
                </div>
                <el-table :data="scoreItems" stripe size="small">
                  <el-table-column prop="label" label="维度" width="60" />
                  <el-table-column label="得分" width="70"><template #default="{ row }">{{ row.score.toFixed(1) }}</template></el-table-column>
                  <el-table-column label="权重" width="70"><template #default="{ row }">{{ row.weight }}%</template></el-table-column>
                  <el-table-column label="加权得分" width="90"><template #default="{ row }">{{ (row.score * row.weight / 100).toFixed(1) }}</template></el-table-column>
                </el-table>
              </div>
            </div>
          </template>
        </template>
        <div v-else class="chart-panel" style="text-align:center;color:#909399;padding:40px">
          请选择项目后进行评估
        </div>
      </el-tab-pane>

      <!-- Tab3: 关键制约因素分析 -->
      <el-tab-pane name="constraint" label="关键制约因素分析" :disabled="!feasibility">
        <template v-if="feasibility">
          <div class="chart-panel" v-if="constraints.length > 0">
            <div style="font-size:14px;font-weight:600;color:#303133;margin-bottom:8px">关键制约因素</div>
            <el-table :data="constraints" stripe size="small">
              <el-table-column prop="dimension" label="维度" width="80" />
              <el-table-column label="得分" width="80"><template #default="{ row }">{{ row.score.toFixed(1) }}</template></el-table-column>
              <el-table-column label="与阈值差距" width="100"><template #default="{ row }">{{ row.gap.toFixed(1) }}</template></el-table-column>
              <el-table-column prop="suggestion" label="改进建议" min-width="300" />
            </el-table>
          </div>
          <div class="chart-panel" v-else>
            <div style="color:#67C23A;font-size:14px;text-align:center;padding:8px">全部维度通过阈值，无明显制约因素</div>
          </div>
        </template>
        <div v-else class="chart-panel" style="text-align:center;color:#909399;padding:40px">
          请先在"并网可行性得分计算"中完成评估
        </div>
      </el-tab-pane>

      <!-- Tab4: 可行性分析报告生成 -->
      <el-tab-pane name="report" label="可行性分析报告生成" :disabled="!feasibility">
        <template v-if="feasibility && selectedProject">
          <div class="chart-panel">
            <div style="text-align:right;margin-bottom:12px">
              <el-button size="small" type="primary" @click="exportPDF">导出PDF</el-button>
            </div>
            <div id="feasibility-report" style="font-size:13px;color:#303133;line-height:1.8">
              <div style="text-align:center;margin-bottom:20px">
                <h2 style="margin:0 0 4px">光伏项目并网可行性评估报告</h2>
                <div style="color:#909399">报告生成时间：{{ dayjs().format('YYYY-MM-DD HH:mm:ss') }}</div>
              </div>

              <h4 style="border-bottom:2px solid #267F7B;padding-bottom:4px;margin-bottom:8px">一、项目基本信息</h4>
              <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
                <tr><td style="padding:4px 8px;border:1px solid #e4e7ed;width:120px;background:#f5f7fa">项目名称</td><td style="padding:4px 8px;border:1px solid #e4e7ed">{{ selectedProject.project_name }}</td></tr>
                <tr><td style="padding:4px 8px;border:1px solid #e4e7ed;background:#f5f7fa">项目编号</td><td style="padding:4px 8px;border:1px solid #e4e7ed">{{ selectedProject.project_code }}</td></tr>
                <tr><td style="padding:4px 8px;border:1px solid #e4e7ed;background:#f5f7fa">项目类型</td><td style="padding:4px 8px;border:1px solid #e4e7ed">{{ selectedProject.project_type }}</td></tr>
                <tr><td style="padding:4px 8px;border:1px solid #e4e7ed;background:#f5f7fa">装机容量</td><td style="padding:4px 8px;border:1px solid #e4e7ed">{{ params.capacity_mwp || '-' }} MWp</td></tr>
                <tr><td style="padding:4px 8px;border:1px solid #e4e7ed;background:#f5f7fa">并网电压</td><td style="padding:4px 8px;border:1px solid #e4e7ed">{{ params.grid_voltage || '-' }}</td></tr>
                <tr><td style="padding:4px 8px;border:1px solid #e4e7ed;background:#f5f7fa">土地性质</td><td style="padding:4px 8px;border:1px solid #e4e7ed">{{ params.land_type || '-' }}</td></tr>
              </table>

              <h4 style="border-bottom:2px solid #267F7B;padding-bottom:4px;margin-bottom:8px">二、四维评估得分</h4>
              <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
                <tr style="background:#f5f7fa"><th style="padding:6px 8px;border:1px solid #e4e7ed;text-align:left">评估维度</th><th style="padding:6px 8px;border:1px solid #e4e7ed;text-align:center">得分</th><th style="padding:6px 8px;border:1px solid #e4e7ed;text-align:center">权重</th><th style="padding:6px 8px;border:1px solid #e4e7ed;text-align:center">加权得分</th></tr>
                <tr v-for="s in scoreItems" :key="s.label">
                  <td style="padding:4px 8px;border:1px solid #e4e7ed">{{ s.label }}</td>
                  <td style="padding:4px 8px;border:1px solid #e4e7ed;text-align:center">{{ s.score.toFixed(1) }}</td>
                  <td style="padding:4px 8px;border:1px solid #e4e7ed;text-align:center">{{ s.weight }}%</td>
                  <td style="padding:4px 8px;border:1px solid #e4e7ed;text-align:center">{{ (s.score * s.weight / 100).toFixed(1) }}</td>
                </tr>
                <tr style="font-weight:600">
                  <td style="padding:4px 8px;border:1px solid #e4e7ed">综合得分</td>
                  <td colspan="3" style="padding:4px 8px;border:1px solid #e4e7ed;font-size:16px" :style="{ color: scoreColor(feasibility.comprehensive_score) }">{{ feasibility.comprehensive_score.toFixed(1) }}（{{ isAbove ? '通过' : '未通过' }}阈值 {{ threshold }}）</td>
                </tr>
              </table>

              <template v-if="constraints.length > 0">
                <h4 style="border-bottom:2px solid #F56C6C;padding-bottom:4px;margin-bottom:8px">三、制约因素分析</h4>
                <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
                  <tr style="background:#f5f7fa"><th style="padding:6px 8px;border:1px solid #e4e7ed;text-align:left">维度</th><th style="padding:6px 8px;border:1px solid #e4e7ed;text-align:center">得分</th><th style="padding:6px 8px;border:1px solid #e4e7ed;text-align:center">差距</th><th style="padding:6px 8px;border:1px solid #e4e7ed;text-align:left">改进建议</th></tr>
                  <tr v-for="c in constraints" :key="c.dimension">
                    <td style="padding:4px 8px;border:1px solid #e4e7ed">{{ c.dimension }}</td>
                    <td style="padding:4px 8px;border:1px solid #e4e7ed;text-align:center;color:#F56C6C">{{ c.score.toFixed(1) }}</td>
                    <td style="padding:4px 8px;border:1px solid #e4e7ed;text-align:center;color:#F56C6C">{{ c.gap.toFixed(1) }}</td>
                    <td style="padding:4px 8px;border:1px solid #e4e7ed">{{ c.suggestion }}</td>
                  </tr>
                </table>
              </template>
              <template v-else>
                <h4 style="border-bottom:2px solid #67C23A;padding-bottom:4px;margin-bottom:8px">三、制约因素分析</h4>
                <p style="color:#67C23A">所有维度均通过阈值，无制约因素。</p>
              </template>

              <h4 style="border-bottom:2px solid #267F7B;padding-bottom:4px;margin-bottom:8px">四、审批决策参考</h4>
              <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
                <tr><td style="padding:4px 8px;border:1px solid #e4e7ed;width:120px;background:#f5f7fa">综合评定</td><td style="padding:4px 8px;border:1px solid #e4e7ed;font-weight:600" :style="{ color: isAbove ? '#67C23A' : '#F56C6C' }">{{ isAbove ? '建议通过' : '建议暂缓，待优化后重新评估' }}</td></tr>
                <tr><td style="padding:4px 8px;border:1px solid #e4e7ed;background:#f5f7fa">评估依据</td><td style="padding:4px 8px;border:1px solid #e4e7ed">基于资源、电网、投资、环境四维模型综合评估，权重分别为{{ weights.resource }}%、{{ weights.grid }}%、{{ weights.investment }}%、{{ weights.environment }}%</td></tr>
                <tr v-if="constraints.length > 0"><td style="padding:4px 8px;border:1px solid #e4e7ed;background:#f5f7fa">主要风险</td><td style="padding:4px 8px;border:1px solid #e4e7ed;color:#F56C6C">{{ constraints.map(c => c.dimension).join('、') }}维度未达到阈值要求，需重点关注</td></tr>
                <tr><td style="padding:4px 8px;border:1px solid #e4e7ed;background:#f5f7fa">审批建议</td><td style="padding:4px 8px;border:1px solid #e4e7ed">{{ isAbove ? '项目各项指标达到可行性要求，建议按照相关流程推进审批。' : '建议针对制约因素制定整改方案，整改完成后重新提交评估。' }}</td></tr>
              </table>
            </div>
          </div>
        </template>
        <div v-else class="chart-panel" style="text-align:center;color:#909399;padding:40px">
          请先在"并网可行性得分计算"中完成评估
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.page-container { display: flex; flex-direction: column; gap: 16px; }
.chart-panel { background: #fff; border-radius: 4px; padding: 16px; margin-bottom: 12px; }
.chart-panel:last-child { margin-bottom: 0; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.param-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
.param-group { display: flex; flex-direction: column; gap: 4px; }
.param-group-title { font-size: 12px; font-weight: 600; color: #267F7B; padding-bottom: 4px; border-bottom: 1px solid #eee; }
.param-row { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.param-row > span:first-child { width: 90px; color: #606266; }
.param-unit { color: #909399; font-size: 12px; width: 80px; }
.feasibility-tabs :deep(.el-tabs__content) { padding-top: 8px; }
</style>
