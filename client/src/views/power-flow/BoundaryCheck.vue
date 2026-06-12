<script setup lang="ts">
import { ref } from 'vue'
import { checkBoundaryReasonability } from '@/api/data-validation'
import { Warning, CircleClose } from '@element-plus/icons-vue'

const loading = ref(false)
const result = ref<any>(null)
const detailVisible = ref(false)
const selectedParam = ref<any>(null)

const voltageLevel = ref('')
const region = ref('')
const voltageLevelOptions = ['', '220kV', '110kV', '10kV']
const regionOptions = ref(['', '余杭区', '萧山区', '滨江区', '西湖区', '拱墅区', '上城区', '钱塘区', '临平区', '富阳区', '临安区', '桐庐县', '建德市', '淳安县'])

async function handleCheck() {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (voltageLevel.value) params.voltageLevel = voltageLevel.value
    if (region.value) params.region = region.value
    result.value = await checkBoundaryReasonability(params)
  } finally {
    loading.value = false
  }
}

function showDetail(param: any) {
  selectedParam.value = param
  detailVisible.value = true
}
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">边界条件合理性校验</div>
    <div class="filter-bar">
      <span style="font-size:14px;font-weight:600;color:#303133">边界条件合理性校验</span>
      <el-select v-model="voltageLevel" placeholder="电压等级" clearable size="small" style="width:130px;margin-left:16px">
        <el-option v-for="v in voltageLevelOptions" :key="v" :label="v || '全部'" :value="v" />
      </el-select>
      <el-select v-model="region" placeholder="区域" clearable size="small" style="width:180px;margin-left:8px">
        <el-option v-for="r in regionOptions" :key="r" :label="r || '全部'" :value="r" />
      </el-select>
      <div style="flex:1" />
      <el-button type="primary" size="small" :loading="loading" @click="handleCheck">
        {{ result ? '重新校验' : '执行边界校验' }}
      </el-button>
    </div>

    <!-- 概览统计 -->
    <div v-if="result" class="summary-bar">
      <div class="summary-item">
        <span class="summary-label">总参数</span>
        <span class="summary-val" style="color:#267F7B">{{ result.totalParams }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">通过</span>
        <span class="summary-val" style="color:#67C23A">{{ result.passedParams }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">通过率</span>
        <span class="summary-val" :style="{ color: result.passRate > 90 ? '#67C23A' : '#E6A23C' }">{{ result.passRate }}%</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">异常参数</span>
        <span class="summary-val" :style="{ color: result.anomalies.length > 0 ? '#F56C6C' : '#909399' }">{{ result.anomalies.length }}</span>
      </div>
    </div>

    <!-- 问题清单 -->
    <div v-if="result" class="chart-panel">
      <div class="chart-panel-title">
        问题清单
        <span style="font-size:12px;color:#909399;font-weight:normal;margin-left:8px">
          共 {{ result.anomalies.length }} 项异常
        </span>
      </div>
      <template v-if="result.anomalies.length">
        <el-table :data="result.anomalies" stripe size="small" max-height="380">
          <el-table-column label="参数类型" width="90">
            <template #default="{ row }">
              <el-tag size="small" type="danger">{{ row.paramType }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="paramName" label="参数名称" width="120" />
          <el-table-column label="当前值" width="110">
            <template #default="{ row }">{{ row.currentValue }} {{ row.unit }}</template>
          </el-table-column>
          <el-table-column label="参考边界" width="110">
            <template #default="{ row }">{{ row.historicalAvg }} {{ row.unit }}</template>
          </el-table-column>
          <el-table-column label="偏差率" width="90">
            <template #default="{ row }">
              <span style="color:#F56C6C;font-weight:600">{{ row.deviationPct }}%</span>
            </template>
          </el-table-column>
          <el-table-column label="风险说明" min-width="180">
            <template #default="{ row }">
              {{ row.paramType === '电压幅值' ? `电压偏离基准值${row.deviationPct}%，影响潮流计算精度` : `偏离历史同期${row.deviationPct}%，输入参数可能异常` }}
            </template>
          </el-table-column>
          <el-table-column label="数据来源" width="170">
            <template #default="{ row }">
              <span style="font-size:12px;color:#606266">{{ row.dataSource }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="showDetail(row)">核查</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="result.suggestion" style="margin-top:8px;font-size:12px;color:#909399;background:#fef0f0;padding:8px 12px;border-radius:4px">
          <el-icon><Warning /></el-icon> {{ result.suggestion }}
        </div>
      </template>
      <div v-else style="padding:40px;text-align:center;color:#67C23A;font-size:13px">
        未发现边界条件异常，输入参数符合电网运行规律
      </div>
    </div>

    <!-- 全量参数偏差一览 -->
    <div v-if="result" class="chart-panel">
      <div class="chart-panel-title">
        边界参数偏差一览
        <span style="font-size:12px;color:#909399;margin-left:8px;font-weight:400">
          （标注 <span style="color:#F56C6C;font-weight:600">红色</span> 为异常值）
        </span>
      </div>
      <el-table :data="result.parameters" stripe size="small" max-height="420"
        :row-class-name="({ row }: any) => row.isAnomaly ? 'anomaly-row' : ''">
        <el-table-column label="参数类型" width="90">
          <template #default="{ row }">
            <el-tag size="small">{{ row.paramType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="paramName" label="参数名称" min-width="140" />
        <el-table-column label="当前值" width="100">
          <template #default="{ row }">{{ row.currentValue }} {{ row.unit === 'p.u.' ? '' : '' }}</template>
        </el-table-column>
        <el-table-column label="历史均值" width="100">
          <template #default="{ row }">{{ row.historicalAvg }}</template>
        </el-table-column>
        <el-table-column label="偏差率" width="90">
          <template #default="{ row }">
            <span :style="{ color: row.deviationPct > 15 ? '#F56C6C' : '#606266', fontWeight: 600 }">
              {{ row.deviationPct }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column label="单位" width="60" prop="unit" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.isAnomaly ? 'danger' : 'success'" size="small">
              {{ row.isAnomaly ? '异常' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="严重程度" width="80">
          <template #default="{ row }">
            <el-tag :type="row.severity === '严重' ? 'danger' : row.severity === '警告' ? 'warning' : 'info'" size="small">
              {{ row.severity }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.isAnomaly" type="primary" link size="small" @click="showDetail(row)">核查</el-button>
            <span v-else style="color:#c0c4cc">—</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 无结果 -->
    <div v-if="!result && !loading" style="padding:80px 0;text-align:center;color:#c0c4cc">
      <el-icon :size="48"><CircleClose /></el-icon>
      <p style="margin-top:12px">点击上方按钮执行边界条件合理性校验</p>
    </div>

    <!-- 数据核查弹窗 -->
    <el-dialog v-model="detailVisible" title="异常参数核查" width="480px">
      <template v-if="selectedParam">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="参数类型">{{ selectedParam.paramType }}</el-descriptions-item>
          <el-descriptions-item label="参数名称">{{ selectedParam.paramName }}</el-descriptions-item>
          <el-descriptions-item label="当前值">{{ selectedParam.currentValue }}</el-descriptions-item>
          <el-descriptions-item label="历史均值">{{ selectedParam.historicalAvg }}</el-descriptions-item>
          <el-descriptions-item label="偏差率">
            <span style="color:#F56C6C;font-weight:600">{{ selectedParam.deviationPct }}%</span>
          </el-descriptions-item>
          <el-descriptions-item label="严重程度">
            <el-tag :type="selectedParam.severity === '严重' ? 'danger' : 'warning'" size="small">{{ selectedParam.severity }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>
        <div style="margin:16px 0;padding:12px;background:#f5f7fa;border-radius:4px;font-size:13px">
          <span style="color:#606266">数据来源：</span>
          <span style="color:#303133;font-weight:600">{{ selectedParam.dataSource }}</span>
        </div>
        <div style="font-size:12px;color:#E6A23C">
          <el-icon><Warning /></el-icon> 该参数与历史同期偏差较大，建议核查数据源
        </div>
      </template>
      <template #footer>
        <el-button type="primary" size="small" @click="detailVisible = false">已知晓</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.filter-bar { display:flex; align-items:center; margin-bottom:12px; padding:12px 16px; background:#fff; border-radius:8px; }
.summary-bar { display:flex; margin-bottom:12px; background:#fff; border-radius:8px; overflow:hidden; }
.summary-item { flex:1; padding:12px 8px; text-align:center; border-right:1px solid #f0f0f0; }
.summary-item:last-child { border-right:none; }
.summary-label { display:block; font-size:11px; color:#909399; margin-bottom:4px; }
.summary-val { font-size:18px; font-weight:700; color:#303133; }
:deep(.anomaly-row) { background-color: #fef0f0 !important; }
</style>
