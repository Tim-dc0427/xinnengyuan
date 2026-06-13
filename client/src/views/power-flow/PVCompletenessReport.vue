<script setup lang="ts">
import { inject } from 'vue'
import { CircleCheck, CircleClose } from '@element-plus/icons-vue'
import { COMPLETENESS_KEY } from './pv-completeness-key'
import dayjs from 'dayjs'
import { formatDateTime } from '@/utils/time'

const shared = inject(COMPLETENESS_KEY)!

const severityMap: Record<string, string> = {
  '严重': 'danger', '警告': 'warning', '正常': 'success',
}

function allIssues() {
  if (!shared.state.result) return []
  return [
    ...shared.state.result.continuity.issues.map((i: any) => ({ ...i, dimension: '出力曲线时间连续性' })),
    ...shared.state.result.confidence.issues.map((i: any) => ({ ...i, dimension: '置信因素合理性' })),
    ...shared.state.result.weather.issues.map((i: any) => ({ ...i, dimension: '天气场景匹配度' })),
  ]
}
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">光伏数据质量报告</div>

    <!-- 有结果：展示报告 -->
    <template v-if="shared.state.result">
      <div class="report-section">
        <!-- 总体报告 -->
        <div class="summary-cards">
          <div class="metric-card">
            <div class="metric-label">总校验项</div>
            <div class="metric-value" style="color:#267F7B">{{ shared.state.result.report.totalParams }}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">通过</div>
            <div class="metric-value" style="color:#67C23A">{{ shared.state.result.report.passedParams }}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">总体合格率</div>
            <div class="metric-value" :style="{ color: shared.state.result.report.overallPassRate > 90 ? '#67C23A' : '#E6A23C' }">
              {{ shared.state.result.report.overallPassRate }}%
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-label">问题总数</div>
            <div class="metric-value" :style="{ color: shared.state.result.report.totalIssues > 0 ? '#F56C6C' : '#909399' }">
              {{ shared.state.result.report.totalIssues }}
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-label">报告生成时间</div>
            <div class="metric-value" style="font-size:12px;color:#909399">
              {{ dayjs(shared.state.result.report.generatedAt).format('YYYY-MM-DD HH:mm:ss') }}
            </div>
          </div>
        </div>

        <!-- 各维度合格率 -->
        <div class="chart-panel">
          <div class="section-title">各维度合格率</div>
          <el-descriptions :column="3" border size="small">
            <el-descriptions-item label="出力曲线时间连续性">
              <el-tag :type="shared.state.result.continuity.continuityRate > 98 ? 'success' : 'warning'" size="small">
                连续率 {{ shared.state.result.continuity.continuityRate }}%
              </el-tag>
              <span style="margin-left:8px;font-size:12px;color:#909399">
                {{ shared.state.result.continuity.passedSlots }}/{{ shared.state.result.continuity.totalSlots }} 时段
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="置信因素合理性">
              <el-tag :type="shared.state.result.confidence.passRate > 95 ? 'success' : 'warning'" size="small">
                通过率 {{ shared.state.result.confidence.passRate }}%
              </el-tag>
              <span style="margin-left:8px;font-size:12px;color:#909399">
                {{ shared.state.result.confidence.passedChecks }}/{{ shared.state.result.confidence.totalChecks }} 项
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="天气场景匹配度">
              <el-tag :type="shared.state.result.weather.matchRate > 90 ? 'success' : 'warning'" size="small">
                匹配率 {{ shared.state.result.weather.matchRate }}%
              </el-tag>
              <span style="margin-left:8px;font-size:12px;color:#909399">
                {{ shared.state.result.weather.matchedChecks }}/{{ shared.state.result.weather.totalChecks }} 项
              </span>
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 问题数据位置汇总 -->
        <div class="chart-panel">
          <div class="section-title">
            问题数据位置汇总
            <span style="font-size:12px;color:#909399;font-weight:normal;margin-left:8px">
              共 {{ shared.state.result.report.totalIssues }} 处
            </span>
          </div>
          <el-table v-if="allIssues().length" :data="allIssues()" stripe size="small" max-height="350">
            <el-table-column prop="dimension" label="校验维度" width="160" />
            <el-table-column label="问题时间" width="180">
              <template #default="{ row }">{{ formatDateTime(row.time || row.startTime) }}</template>
            </el-table-column>
            <el-table-column label="问题描述" min-width="200">
              <template #default="{ row }">
                <template v-if="row.type === 'time_gap'">
                  时段 {{ formatDateTime(row.startTime) }} ~ {{ formatDateTime(row.endTime) }}，间断 {{ row.gapMinutes }} 分钟
                </template>
                <template v-else-if="row.dimension === '置信因素合理性'">
                  置信因素值 {{ row.factorValue }}，低于阈值 {{ row.threshold }}
                </template>
                <template v-else-if="row.dimension === '天气场景匹配度'">
                  天气 {{ row.weatherCondition }}，预期 {{ row.expectedPower }}kW / 实际 {{ row.actualPower }}kW
                </template>
              </template>
            </el-table-column>
            <el-table-column label="严重程度" width="80">
              <template #default="{ row }">
                <el-tag :type="severityMap[row.severity] || 'info'" size="small">{{ row.severity }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
          <div v-else style="padding:40px;text-align:center;color:#67C23A">
            <el-icon :size="24"><CircleCheck /></el-icon>
            <p style="margin-top:8px">全部校验通过，无问题数据</p>
          </div>
        </div>

        <!-- 修复建议汇总 -->
        <div class="chart-panel">
          <div class="section-title">修复建议</div>
          <div v-if="shared.state.result.continuity.suggestion" class="suggestion-item">
            <el-tag size="small" style="margin-right:8px">时间连续性</el-tag>
            <span>{{ shared.state.result.continuity.suggestion }}</span>
          </div>
          <div v-if="shared.state.result.confidence.suggestion" class="suggestion-item">
            <el-tag size="small" style="margin-right:8px">置信因素</el-tag>
            <span>{{ shared.state.result.confidence.suggestion }}</span>
          </div>
          <div v-if="shared.state.result.weather.suggestion" class="suggestion-item">
            <el-tag size="small" style="margin-right:8px">天气匹配</el-tag>
            <span>{{ shared.state.result.weather.suggestion }}</span>
          </div>
          <div v-if="shared.state.result.report.totalIssues === 0" class="suggestion-item" style="color:#67C23A">
            <el-icon style="margin-right:4px"><CircleCheck /></el-icon>
            光伏数据完整性校验全部通过，数据质量良好
          </div>
        </div>
      </div>
    </template>

    <!-- 无结果 -->
    <div v-else style="padding:80px 0;text-align:center;color:#c0c4cc">
      <el-icon :size="48"><CircleClose /></el-icon>
      <p style="margin-top:12px">暂无校验结果，请先在"数据完整性校验维度"中执行校验</p>
    </div>
  </div>
</template>

<style scoped>
.report-section { display:flex; flex-direction:column; gap:12px; }
.summary-cards { display:flex; background:#fff; border-radius:8px; overflow:hidden; }
.metric-card { flex:1; padding:14px 8px; text-align:center; border-right:1px solid #f0f0f0; }
.metric-card:last-child { border-right:none; }
.metric-label { font-size:11px; color:#909399; margin-bottom:4px; }
.metric-value { font-size:18px; font-weight:700; }
.section-title { font-size:13px; font-weight:600; color:#303133; margin-bottom:10px; }
.suggestion-item { display:flex; align-items:flex-start; padding:8px 12px; margin-bottom:6px; background:#f5f7fa; border-radius:4px; font-size:12px; color:#606266; }
.suggestion-item:last-child { margin-bottom:0; }
</style>
