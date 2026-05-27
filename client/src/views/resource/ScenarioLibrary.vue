<script setup lang="ts">
import { ref } from 'vue'

const scenarios = ref([
  { name: '正常日运行场景', type: 'NORMAL', status: 'published', resources: 6, updated: '2026-05-15' },
  { name: '高峰负荷场景', type: 'PEAK_LOAD', status: 'validated', resources: 8, updated: '2026-05-14' },
  { name: '高温极端天气场景', type: 'EXTREME_WEATHER', status: 'draft', resources: 5, updated: '2026-05-16' },
  { name: '线路检修场景', type: 'MAINTENANCE', status: 'draft', resources: 4, updated: '2026-05-13' },
])

const strategies = ref([
  { name: '优化调度策略A', type: 'AUTO', algorithm: 'OPTIMIZATION', score: 88, status: 'validated' },
  { name: '人工干预策略B', type: 'MANUAL', algorithm: '-', score: 72, status: 'draft' },
])
</script>

<template>
  <div class="page-container">
    <div class="chart-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span class="chart-panel-title" style="margin-bottom:0">互动场景管理</span>
        <el-button type="primary" size="small">创建场景</el-button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));gap:16px">
        <el-card v-for="s in scenarios" :key="s.name" shadow="hover">
          <div style="font-size:16px;font-weight:600;margin-bottom:8px">{{ s.name }}</div>
          <el-tag size="small">{{ s.type }}</el-tag>
          <el-tag size="small" :type="s.status === 'published' ? 'success' : s.status === 'validated' ? 'primary' : 'info'" style="margin-left:8px">{{ s.status }}</el-tag>
          <div style="margin-top:12px;font-size:12px;color:#909399">
            <div>资源: {{ s.resources }}个 | 更新: {{ s.updated }}</div>
          </div>
          <div style="margin-top:12px;display:flex;gap:4px">
            <el-button size="small" link type="primary">编辑</el-button>
            <el-button size="small" link>模拟</el-button>
            <el-button size="small" link>评估</el-button>
            <el-button size="small" link type="danger">删除</el-button>
          </div>
        </el-card>
      </div>
    </div>

    <div class="grid-2">
      <div class="chart-panel">
        <div class="chart-panel-title">协同策略管理</div>
        <el-table :data="strategies" stripe size="small">
          <el-table-column prop="name" label="策略名称" />
          <el-table-column prop="type" label="类型" width="80" />
          <el-table-column prop="algorithm" label="算法" width="120" />
          <el-table-column prop="score" label="效果评分" width="80" />
          <el-table-column label="操作" width="120">
            <template #default>
              <el-button size="small" link type="primary">执行</el-button>
              <el-button size="small" link>编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-button size="small" type="primary" style="margin-top:12px">自动生成协同策略</el-button>
      </div>
      <div class="chart-panel">
        <div class="chart-panel-title">场景模拟结果</div>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="消纳率">85.3%</el-descriptions-item>
          <el-descriptions-item label="电压稳定性">0.98</el-descriptions-item>
          <el-descriptions-item label="电网效率">96.5%</el-descriptions-item>
          <el-descriptions-item label="经济评分">82分</el-descriptions-item>
          <el-descriptions-item label="综合评分">86分</el-descriptions-item>
        </el-descriptions>
        <div style="margin-top:12px;display:flex;gap:8px">
          <el-button size="small" type="warning">人工干预</el-button>
          <el-button size="small" type="primary">生成评估报告</el-button>
        </div>
      </div>
    </div>
  </div>
</template>
