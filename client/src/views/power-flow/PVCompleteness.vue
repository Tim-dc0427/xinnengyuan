<script setup lang="ts">
import { ref } from 'vue'
import { checkPVCompleteness } from '@/api/data-validation'
import { Warning, CircleCheck, CircleClose } from '@element-plus/icons-vue'

const loading = ref(false)
const result = ref<any>(null)

async function handleCheck() {
  loading.value = true
  try {
    result.value = await checkPVCompleteness()
  } finally {
    loading.value = false
  }
}

const severityMap: Record<string, string> = {
  '严重': 'danger', '警告': 'warning', '正常': 'success',
}
</script>

<template>
  <div class="page-container">
    <!-- 操作栏 -->
    <div class="filter-bar">
      <span style="font-size:14px;font-weight:600;color:#303133">光伏数据完整性校验</span>
      <div style="flex:1" />
      <el-button type="primary" size="small" :loading="loading" @click="handleCheck">
        {{ result ? '重新校验' : '执行完整性校验' }}
      </el-button>
    </div>

    <!-- 总体报告 -->
    <div v-if="result" class="summary-bar">
      <div class="summary-item">
        <span class="summary-label">总校验项</span>
        <span class="summary-val" style="color:#267F7B">{{ result.report.totalParams }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">通过</span>
        <span class="summary-val" style="color:#67C23A">{{ result.report.passedParams }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">总体合格率</span>
        <span class="summary-val" :style="{ color: result.report.overallPassRate > 90 ? '#67C23A' : '#E6A23C' }">
          {{ result.report.overallPassRate }}%
        </span>
      </div>
      <div class="summary-item">
        <span class="summary-label">问题总数</span>
        <span class="summary-val" :style="{ color: result.report.totalIssues > 0 ? '#F56C6C' : '#909399' }">
          {{ result.report.totalIssues }}
        </span>
      </div>
    </div>

    <div v-if="loading" style="padding:60px;text-align:center;color:#909399">校验进行中…</div>

    <!-- 维度1：出力曲线时间连续性 -->
    <div v-if="result" class="chart-panel">
      <div class="chart-panel-title">
        维度一：出力曲线时间连续性
        <el-tag :type="result.continuity.continuityRate > 98 ? 'success' : 'warning'" size="small" style="margin-left:8px">
          连续率 {{ result.continuity.continuityRate }}%
        </el-tag>
      </div>
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="总时段数">{{ result.continuity.totalSlots }}</el-descriptions-item>
        <el-descriptions-item label="连续通过">{{ result.continuity.passedSlots }}</el-descriptions-item>
        <el-descriptions-item label="间断点">{{ result.continuity.issues.length }} 处</el-descriptions-item>
      </el-descriptions>
      <el-table v-if="result.continuity.issues.length" :data="result.continuity.issues" stripe size="small" max-height="200" style="margin-top:8px">
        <el-table-column label="类型" width="100">
          <template #default="{ row }"><el-tag size="small">{{ row.type === 'time_gap' ? '时间间断' : row.type }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="startTime" label="起始时间" width="180" />
        <el-table-column prop="endTime" label="结束时间" width="180" />
        <el-table-column label="间断时长" width="100">
          <template #default="{ row }">{{ row.gapMinutes }} 分钟</template>
        </el-table-column>
        <el-table-column label="严重程度" width="80">
          <template #default="{ row }"><el-tag :type="severityMap[row.severity] || 'info'" size="small">{{ row.severity }}</el-tag></template>
        </el-table-column>
      </el-table>
      <div v-if="result.continuity.suggestion" style="margin-top:8px;font-size:12px;color:#909399;background:#f5f7fa;padding:8px 12px;border-radius:4px">
        <el-icon><Warning /></el-icon> 建议：{{ result.continuity.suggestion }}
      </div>
    </div>

    <!-- 维度2：置信因素合理性 -->
    <div v-if="result" class="chart-panel">
      <div class="chart-panel-title">
        维度二：置信因素合理性
        <el-tag :type="result.confidence.passRate > 95 ? 'success' : 'warning'" size="small" style="margin-left:8px">
          通过率 {{ result.confidence.passRate }}%
        </el-tag>
      </div>
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="总检查项">{{ result.confidence.totalChecks }}</el-descriptions-item>
        <el-descriptions-item label="通过">{{ result.confidence.passedChecks }}</el-descriptions-item>
        <el-descriptions-item label="置信偏低">{{ result.confidence.issues.length }} 项</el-descriptions-item>
      </el-descriptions>
      <el-table v-if="result.confidence.issues.length" :data="result.confidence.issues" stripe size="small" max-height="200" style="margin-top:8px">
        <el-table-column prop="time" label="时间" width="180" />
        <el-table-column label="置信因素值" width="120">
          <template #default="{ row }">{{ row.factorValue }}</template>
        </el-table-column>
        <el-table-column prop="threshold" label="阈值" width="80" />
        <el-table-column label="严重程度" width="80">
          <template #default="{ row }"><el-tag :type="severityMap[row.severity] || 'info'" size="small">{{ row.severity }}</el-tag></template>
        </el-table-column>
      </el-table>
      <div v-if="result.confidence.suggestion" style="margin-top:8px;font-size:12px;color:#909399;background:#f5f7fa;padding:8px 12px;border-radius:4px">
        <el-icon><Warning /></el-icon> 建议：{{ result.confidence.suggestion }}
      </div>
    </div>

    <!-- 维度3：天气场景匹配度 -->
    <div v-if="result" class="chart-panel">
      <div class="chart-panel-title">
        维度三：天气场景匹配度
        <el-tag :type="result.weather.matchRate > 90 ? 'success' : 'warning'" size="small" style="margin-left:8px">
          匹配率 {{ result.weather.matchRate }}%
        </el-tag>
      </div>
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="总校验数">{{ result.weather.totalChecks }}</el-descriptions-item>
        <el-descriptions-item label="匹配通过">{{ result.weather.matchedChecks }}</el-descriptions-item>
        <el-descriptions-item label="不匹配">{{ result.weather.issues.length }} 项</el-descriptions-item>
      </el-descriptions>
      <el-table v-if="result.weather.issues.length" :data="result.weather.issues" stripe size="small" max-height="200" style="margin-top:8px">
        <el-table-column prop="time" label="时间" width="180" />
        <el-table-column prop="weatherCondition" label="天气条件" width="90" />
        <el-table-column label="预期出力(kW)" width="110">
          <template #default="{ row }">{{ row.expectedPower }}</template>
        </el-table-column>
        <el-table-column label="实际出力(kW)" width="110">
          <template #default="{ row }">{{ row.actualPower }}</template>
        </el-table-column>
        <el-table-column label="严重程度" width="80">
          <template #default="{ row }"><el-tag :type="severityMap[row.severity] || 'info'" size="small">{{ row.severity }}</el-tag></template>
        </el-table-column>
      </el-table>
      <div v-if="result.weather.suggestion" style="margin-top:8px;font-size:12px;color:#909399;background:#f5f7fa;padding:8px 12px;border-radius:4px">
        <el-icon><Warning /></el-icon> 建议：{{ result.weather.suggestion }}
      </div>
    </div>

    <!-- 无结果 -->
    <div v-if="!result && !loading" style="padding:80px 0;text-align:center;color:#c0c4cc">
      <el-icon :size="48"><CircleClose /></el-icon>
      <p style="margin-top:12px">点击上方按钮执行光伏数据完整性校验</p>
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
