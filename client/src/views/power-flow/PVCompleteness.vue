<script setup lang="ts">
import { inject } from 'vue'
import { Warning, CircleCheck, CircleClose } from '@element-plus/icons-vue'
import { COMPLETENESS_KEY } from './pv-completeness-key'

const shared = inject(COMPLETENESS_KEY)!

const severityMap: Record<string, string> = {
  '严重': 'danger', '警告': 'warning', '正常': 'success',
}
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">光伏数据完整性校验维度</div>
    <!-- 操作栏 -->
    <div class="filter-bar">
      <span style="font-size:14px;font-weight:600;color:#303133">光伏数据完整性校验</span>
      <div style="flex:1" />
      <el-button type="primary" size="small" :loading="shared.state.loading" @click="shared.runCheck">
        {{ shared.state.result ? '重新校验' : '执行完整性校验' }}
      </el-button>
    </div>

    <div v-if="shared.state.loading" style="padding:60px;text-align:center;color:#909399">校验进行中…</div>

    <!-- 维度1：出力曲线时间连续性 -->
    <div v-if="shared.state.result" class="chart-panel">
      <div class="chart-panel-title">
        维度一：出力曲线时间连续性
        <el-tag :type="shared.state.result.continuity.continuityRate > 98 ? 'success' : 'warning'" size="small" style="margin-left:8px">
          连续率 {{ shared.state.result.continuity.continuityRate }}%
        </el-tag>
      </div>
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="总时段数">{{ shared.state.result.continuity.totalSlots }}</el-descriptions-item>
        <el-descriptions-item label="连续通过">{{ shared.state.result.continuity.passedSlots }}</el-descriptions-item>
        <el-descriptions-item label="间断点">{{ shared.state.result.continuity.issues.length }} 处</el-descriptions-item>
      </el-descriptions>
      <el-table v-if="shared.state.result.continuity.issues.length" :data="shared.state.result.continuity.issues" stripe size="small" max-height="200" style="margin-top:8px">
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
      <div v-if="shared.state.result.continuity.suggestion" style="margin-top:8px;font-size:12px;color:#909399;background:#f5f7fa;padding:8px 12px;border-radius:4px">
        <el-icon><Warning /></el-icon> 建议：{{ shared.state.result.continuity.suggestion }}
      </div>
    </div>

    <!-- 维度2：置信因素合理性 -->
    <div v-if="shared.state.result" class="chart-panel">
      <div class="chart-panel-title">
        维度二：置信因素合理性
        <el-tag :type="shared.state.result.confidence.passRate > 95 ? 'success' : 'warning'" size="small" style="margin-left:8px">
          通过率 {{ shared.state.result.confidence.passRate }}%
        </el-tag>
      </div>
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="总检查项">{{ shared.state.result.confidence.totalChecks }}</el-descriptions-item>
        <el-descriptions-item label="通过">{{ shared.state.result.confidence.passedChecks }}</el-descriptions-item>
        <el-descriptions-item label="置信偏低">{{ shared.state.result.confidence.issues.length }} 项</el-descriptions-item>
      </el-descriptions>
      <el-table v-if="shared.state.result.confidence.issues.length" :data="shared.state.result.confidence.issues" stripe size="small" max-height="200" style="margin-top:8px">
        <el-table-column prop="time" label="时间" width="180" />
        <el-table-column label="置信因素值" width="120">
          <template #default="{ row }">{{ row.factorValue }}</template>
        </el-table-column>
        <el-table-column prop="threshold" label="阈值" width="80" />
        <el-table-column label="严重程度" width="80">
          <template #default="{ row }"><el-tag :type="severityMap[row.severity] || 'info'" size="small">{{ row.severity }}</el-tag></template>
        </el-table-column>
      </el-table>
      <div v-if="shared.state.result.confidence.suggestion" style="margin-top:8px;font-size:12px;color:#909399;background:#f5f7fa;padding:8px 12px;border-radius:4px">
        <el-icon><Warning /></el-icon> 建议：{{ shared.state.result.confidence.suggestion }}
      </div>
    </div>

    <!-- 维度3：天气场景匹配度 -->
    <div v-if="shared.state.result" class="chart-panel">
      <div class="chart-panel-title">
        维度三：天气场景匹配度
        <el-tag :type="shared.state.result.weather.matchRate > 90 ? 'success' : 'warning'" size="small" style="margin-left:8px">
          匹配率 {{ shared.state.result.weather.matchRate }}%
        </el-tag>
      </div>
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="总校验数">{{ shared.state.result.weather.totalChecks }}</el-descriptions-item>
        <el-descriptions-item label="匹配通过">{{ shared.state.result.weather.matchedChecks }}</el-descriptions-item>
        <el-descriptions-item label="不匹配">{{ shared.state.result.weather.issues.length }} 项</el-descriptions-item>
      </el-descriptions>
      <el-table v-if="shared.state.result.weather.issues.length" :data="shared.state.result.weather.issues" stripe size="small" max-height="200" style="margin-top:8px">
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
      <div v-if="shared.state.result.weather.suggestion" style="margin-top:8px;font-size:12px;color:#909399;background:#f5f7fa;padding:8px 12px;border-radius:4px">
        <el-icon><Warning /></el-icon> 建议：{{ shared.state.result.weather.suggestion }}
      </div>
    </div>

    <!-- 无结果 -->
    <div v-if="!shared.state.result && !shared.state.loading" style="padding:80px 0;text-align:center;color:#c0c4cc">
      <el-icon :size="48"><CircleClose /></el-icon>
      <p style="margin-top:12px">点击上方按钮执行光伏数据完整性校验</p>
    </div>
  </div>
</template>

<style scoped>
.filter-bar { display:flex; align-items:center; margin-bottom:12px; padding:12px 16px; background:#fff; border-radius:8px; }
</style>
