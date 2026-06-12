<script setup lang="ts">
import { ref, computed } from 'vue'
import { checkTimeSeriesConsistency } from '@/api/data-validation'
import { Warning, CircleClose, CircleCheck } from '@element-plus/icons-vue'

const loading = ref(false)
const result = ref<any>(null)

async function handleCheck() {
  loading.value = true
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
    value: d.time, // 时间戳对齐标识
  }))
})

const severityMap: Record<string, string> = {
  '严重': 'danger', '警告': 'warning',
}
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">时序数据一致性校验</div>
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
        <span class="summary-label">基准时间点数</span>
        <span class="summary-val" style="color:#267F7B">{{ result.totalPairs }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">对齐通过</span>
        <span class="summary-val" style="color:#67C23A">{{ result.alignedPairs }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">对齐率</span>
        <span class="summary-val" :style="{ color: result.alignmentRate > 95 ? '#67C23A' : '#E6A23C' }">
          {{ result.alignmentRate }}%
        </span>
      </div>
      <div class="summary-item">
        <span class="summary-label">错位数</span>
        <span class="summary-val" :style="{ color: result.mismatches.length > 0 ? '#F56C6C' : '#909399' }">
          {{ result.mismatches.length }}
        </span>
      </div>
      <div class="summary-item">
        <span class="summary-label">容忍阈值</span>
        <span class="summary-val" style="color:#606266">±{{ result.toleranceMinutes }}min</span>
      </div>
    </div>

    <!-- 采样频率 -->
    <div v-if="result" class="chart-panel">
      <div class="chart-panel-title">采样频率</div>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="光伏采集粒度">{{ result.frequency.pvAvgIntervalMin }} 分钟</el-descriptions-item>
        <el-descriptions-item label="负荷采集粒度">{{ result.frequency.loadAvgIntervalMin }} 分钟</el-descriptions-item>
      </el-descriptions>
      <div style="margin-top:8px;font-size:12px;color:#909399">{{ result.frequency.note }}</div>
    </div>

    <!-- 问题清单 -->
    <div v-if="result" class="chart-panel">
      <div class="chart-panel-title">
        时序错位问题清单
        <span style="font-size:12px;color:#909399;font-weight:normal;margin-left:8px">
          共 {{ result.mismatches.length }} 处错位
        </span>
      </div>
      <template v-if="result.mismatches.length">
        <el-table :data="result.mismatches" stripe size="small" max-height="380">
          <el-table-column prop="loadTime" label="负荷基准时间" width="170" />
          <el-table-column label="光伏最近时间" width="170">
            <template #default="{ row }">
              <span :style="{ color: row.pvTime ? '#303133' : '#F56C6C' }">
                {{ row.pvTime || '无光伏数据' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="偏移量" width="90">
            <template #default="{ row }">
              <span :style="{ color: (row.offsetMinutes || 999) > 30 ? '#F56C6C' : '#E6A23C' }">
                {{ row.offsetMinutes ? row.offsetMinutes + ' 分钟' : '缺失' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="错位率" width="90">
            <template #default="{ row }">
              <span :style="{ color: (row.offsetMinutes || 999) > 30 ? '#F56C6C' : '#E6A23C', fontWeight: 600 }">
                {{ row.offsetMinutes ? ((row.offsetMinutes / result.toleranceMinutes) * 100).toFixed(0) + '%' : '—' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="严重程度" width="80">
            <template #default="{ row }">
              <el-tag :type="severityMap[row.severity] || 'info'" size="small">{{ row.severity }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </template>
      <div v-else style="padding:40px;text-align:center;color:#67C23A;font-size:13px">
        <el-icon :size="20"><CircleCheck /></el-icon>
        两类曲线时间戳对齐良好，无时序错位
      </div>
      <div v-if="result.suggestion && result.mismatches.length" style="margin-top:8px;font-size:12px;color:#909399;background:#fef0f0;padding:8px 12px;border-radius:4px">
        <el-icon><Warning /></el-icon> {{ result.suggestion }}
      </div>
    </div>

    <!-- 无结果 -->
    <div v-if="!result && !loading" style="padding:80px 0;text-align:center;color:#c0c4cc">
      <el-icon :size="48"><CircleClose /></el-icon>
      <p style="margin-top:12px">点击上方按钮执行时序数据一致性校验</p>
    </div>
  </div>
</template>

<style scoped>
.filter-bar { display:flex; align-items:center; margin-bottom:12px; padding:12px 16px; background:#fff; border-radius:8px; }
.summary-bar { display:flex; margin-bottom:12px; background:#fff; border-radius:8px; overflow:hidden; }
.summary-item { flex:1; padding:12px 8px; text-align:center; border-right:1px solid #f0f0f0; }
.summary-item:last-child { border-right:none; }
.summary-label { display:block; font-size:11px; color:#909399; margin-bottom:4px; }
.summary-val { font-size:18px; font-weight:700; color:#303133; }
</style>
