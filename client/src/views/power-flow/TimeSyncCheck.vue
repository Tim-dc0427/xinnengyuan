<script setup lang="ts">
import { ref, computed } from 'vue'
import { checkTimeSeriesConsistency } from '@/api/data-validation'
import { Warning, CircleClose } from '@element-plus/icons-vue'

const loading = ref(false)
const result = ref<any>(null)
const repairDialogVisible = ref(false)
const repairAction = ref<'auto' | 'manual'>('auto')
const repairNote = ref('')
const alignRateBefore = ref(0)
const alignRateAfter = ref(0)
const repairDone = ref(false)

async function handleCheck() {
  loading.value = true
  repairDone.value = false
  try {
    result.value = await checkTimeSeriesConsistency()
  } finally {
    loading.value = false
  }
}

const pvChartData = computed(() => {
  if (!result.value?.pvCurve) return []
  return result.value.pvCurve.map((d: any) => ({
    time: new Date(d.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    value: d.powerKw,
  }))
})

const loadChartData = computed(() => {
  if (!result.value?.loadCurve) return []
  return result.value.loadCurve.map((d: any) => ({
    time: new Date(d.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    value: d.powerMw,
  }))
})

function openRepair() {
  alignRateBefore.value = result.value?.alignment?.alignmentRate ?? 0
  repairAction.value = 'auto'
  repairNote.value = ''
  repairDone.value = false
  repairDialogVisible.value = true
}

function doRepair() {
  // 模拟纠偏：对齐率提升
  alignRateAfter.value = Math.min(100, alignRateBefore.value + 15 + Math.random() * 10)
  repairDone.value = true
}

const severityMap: Record<string, string> = {
  '严重': 'danger', '警告': 'warning', '正常': 'success',
}
</script>

<template>
  <div class="page-container">
    <div class="filter-bar">
      <span style="font-size:14px;font-weight:600;color:#303133">时序数据一致性校验</span>
      <div style="flex:1" />
      <el-button type="primary" size="small" :loading="loading" @click="handleCheck">
        {{ result ? '重新校验' : '执行一致性校验' }}
      </el-button>
    </div>

    <!-- 概览 -->
    <div v-if="result" class="summary-bar">
      <div class="summary-item">
        <span class="summary-label">数据对总数</span>
        <span class="summary-val" style="color:#267F7B">{{ result.alignment.totalPairs }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">对齐通过</span>
        <span class="summary-val" style="color:#67C23A">{{ result.alignment.alignedPairs }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">对齐率</span>
        <span class="summary-val" :style="{ color: result.alignment.alignmentRate > 95 ? '#67C23A' : '#E6A23C' }">
          {{ result.alignment.alignmentRate }}%
        </span>
      </div>
      <div class="summary-item">
        <span class="summary-label">错位数</span>
        <span class="summary-val" :style="{ color: result.alignment.mismatches.length > 0 ? '#F56C6C' : '#909399' }">
          {{ result.alignment.mismatches.length }}
        </span>
      </div>
      <div class="summary-item">
        <span class="summary-label">PV采样间隔</span>
        <span class="summary-val" style="color:#606266">{{ result.frequency.pvAvgInterval }} min</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">负荷采样间隔</span>
        <span class="summary-val" style="color:#606266">{{ result.frequency.loadAvgInterval }} min</span>
      </div>
    </div>

    <!-- 时间同步性检查 -->
    <div v-if="result" class="chart-panel">
      <div class="chart-panel-title">
        时间同步性检查
        <el-tag :type="result.alignment.alignmentRate > 95 ? 'success' : 'warning'" size="small" style="margin-left:8px">
          对齐率 {{ result.alignment.alignmentRate }}%
        </el-tag>
      </div>
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="总数据对">{{ result.alignment.totalPairs }}</el-descriptions-item>
        <el-descriptions-item label="对齐通过">{{ result.alignment.alignedPairs }}</el-descriptions-item>
        <el-descriptions-item label="时序错位">{{ result.alignment.mismatches.length }} 处</el-descriptions-item>
      </el-descriptions>
      <el-table v-if="result.alignment.mismatches.length" :data="result.alignment.mismatches" stripe size="small" max-height="200" style="margin-top:8px">
        <el-table-column prop="pvTime" label="光伏时间戳" width="180" />
        <el-table-column prop="loadTime" label="负荷时间戳" width="180" />
        <el-table-column label="偏移量" width="90">
          <template #default="{ row }">{{ row.offsetMinutes }} 分钟</template>
        </el-table-column>
        <el-table-column label="严重程度" width="80">
          <template #default="{ row }"><el-tag :type="severityMap[row.severity] || 'info'" size="small">{{ row.severity }}</el-tag></template>
        </el-table-column>
      </el-table>
      <div v-if="result.alignment.suggestion" style="margin-top:8px;font-size:12px;color:#909399;background:#f5f7fa;padding:8px 12px;border-radius:4px">
        <el-icon><Warning /></el-icon> 建议：{{ result.alignment.suggestion }}
      </div>
    </div>

    <!-- 采样频率对比 -->
    <div v-if="result" class="chart-panel">
      <div class="chart-panel-title">
        采样频率对比
        <el-tag :type="result.frequency.isConsistent ? 'success' : 'warning'" size="small" style="margin-left:8px">
          {{ result.frequency.isConsistent ? '频率一致' : '频率不一致' }}
        </el-tag>
      </div>
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="光伏平均间隔">{{ result.frequency.pvAvgInterval }} 分钟</el-descriptions-item>
        <el-descriptions-item label="负荷平均间隔">{{ result.frequency.loadAvgInterval }} 分钟</el-descriptions-item>
        <el-descriptions-item label="异常时段">{{ result.frequency.issues.length }} 处</el-descriptions-item>
      </el-descriptions>
    </div>

    <!-- 操作：纠偏 -->
    <div v-if="result" class="chart-panel" style="border-left:3px solid #267F7B">
      <div class="chart-panel-title">
        时序错位数据处理
        <span style="font-size:12px;color:#909399;margin-left:8px;font-weight:400">通过算法或手工修正对齐时间轴</span>
      </div>
      <div v-if="result.alignment.mismatches.length > 0" style="padding:8px 0">
        <el-button type="primary" size="small" @click="openRepair">执行重同步</el-button>
        <el-button size="small" @click="openRepair">手工修正</el-button>
      </div>
      <div v-else style="padding:16px 0;color:#67C23A;font-size:13px">
        当前数据时序一致，无需处理
      </div>
    </div>

    <!-- 无结果 -->
    <div v-if="!result && !loading" style="padding:80px 0;text-align:center;color:#c0c4cc">
      <el-icon :size="48"><CircleClose /></el-icon>
      <p style="margin-top:12px">点击上方按钮执行时序数据一致性校验</p>
    </div>

    <!-- 纠偏对话框 -->
    <el-dialog v-model="repairDialogVisible" title="时序错位数据纠偏" width="520px">
      <div style="margin-bottom:16px">
        <span style="font-size:13px;color:#606266">纠偏方式：</span>
        <el-radio-group v-model="repairAction" size="small">
          <el-radio-button value="auto">自动重同步（线性插值）</el-radio-button>
          <el-radio-button value="manual">手工修正</el-radio-button>
        </el-radio-group>
      </div>

      <div v-if="repairAction === 'manual'" style="margin-bottom:16px">
        <el-input v-model="repairNote" type="textarea" :rows="3" placeholder="填写需要修正的时间段和修正方式…" />
      </div>

      <div v-if="!repairDone" style="padding:12px;background:#f0f9eb;border-radius:4px;font-size:13px;color:#67C23A">
        <el-icon><Warning /></el-icon> 纠偏前对齐率：{{ alignRateBefore.toFixed(1) }}%
      </div>

      <div v-if="repairDone" style="padding:12px;background:#fef0f0;border-radius:4px;font-size:13px;color:#F56C6C">
        <el-icon><Warning /></el-icon> 纠偏前：{{ alignRateBefore.toFixed(1) }}% → 纠偏后：{{ alignRateAfter.toFixed(1) }}%
        <div style="margin-top:4px;font-size:12px;color:#909399">建议导出纠偏日志存档备查</div>
      </div>

      <template #footer>
        <el-button size="small" @click="repairDialogVisible = false">取消</el-button>
        <el-button v-if="!repairDone" type="primary" size="small" @click="doRepair">执行纠偏</el-button>
        <el-button v-else size="small" @click="repairDialogVisible = false">完成</el-button>
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
.summary-val { font-size:16px; font-weight:700; color:#303133; }
</style>
