<script setup lang="ts">
import { ref } from 'vue'
import StatCard from '@/components/common/StatCard.vue'

const projects = ref([
  { code: 'PV-2026-001', name: '阳光电站50MW并网项目', type: 'PV_GRID_CONNECTION', capacity: '50MW', status: 'construction', budget: '2.1亿' },
  { code: 'PV-2026-002', name: '绿能电站30MW并网项目', type: 'PV_GRID_CONNECTION', capacity: '30MW', status: 'approved', budget: '1.5亿' },
  { code: 'PV-2026-003', name: '光储联合示范项目', type: 'PV_STORAGE', capacity: '20MW+5MWh', status: 'feasibility', budget: '1.8亿' },
])

const feasibilityData = ref({
  technicalScore: 85, economicScore: 72, environmentalScore: 90, socialScore: 78, comprehensiveScore: 81,
})
</script>

<template>
  <div class="page-container">
    <div class="stat-card-row">
      <StatCard title="项目总数" value="8" unit="个" icon="Collection" color="#267F7B" />
      <StatCard title="已投运" value="3" unit="个" icon="CircleCheck" color="#67C23A" />
      <StatCard title="建设中" value="2" unit="个" icon="Loading" color="#E6A23C" />
      <StatCard title="可研阶段" value="3" unit="个" icon="Document" color="#909399" />
    </div>

    <div class="chart-panel">
      <div class="chart-panel-title">规划项目库</div>
      <el-table :data="projects" stripe>
        <el-table-column prop="code" label="项目编号" width="140" />
        <el-table-column prop="name" label="项目名称" />
        <el-table-column prop="type" label="项目类型" width="150" />
        <el-table-column prop="capacity" label="装机容量" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'construction' ? 'warning' : row.status === 'approved' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="budget" label="预算" width="100" />
        <el-table-column label="操作" width="300">
          <template #default>
            <el-button size="small" link>接入条件</el-button>
            <el-button size="small" link type="primary">可行性评估</el-button>
            <el-button size="small" link>成效验证</el-button>
            <el-button size="small" link>追溯</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="grid-2">
      <div class="chart-panel">
        <div class="chart-panel-title">并网可行性四维评估</div>
        <div style="height:300px;display:flex;align-items:center;justify-content:center;background:#f5f7fa;border-radius:4px;color:#909399">
          四维雷达图 (技术/经济/环境/社会)
        </div>
      </div>
      <div class="chart-panel">
        <div class="chart-panel-title">项目成效验证</div>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="计划发电量">3,200MWh/月</el-descriptions-item>
          <el-descriptions-item label="实际发电量">3,050MWh/月</el-descriptions-item>
          <el-descriptions-item label="消纳率">95.3%</el-descriptions-item>
          <el-descriptions-item label="电压合规率">99.2%</el-descriptions-item>
          <el-descriptions-item label="偏差率">-4.7%</el-descriptions-item>
        </el-descriptions>
      </div>
    </div>

    <div class="chart-panel">
      <div class="chart-panel-title">项目历史追溯</div>
      <el-timeline>
        <el-timeline-item timestamp="2026-01" content="项目立项" />
        <el-timeline-item timestamp="2026-02" content="可行性评估通过 (综合81分)" type="success" />
        <el-timeline-item timestamp="2026-03" content="接入条件核验完成" type="primary" />
        <el-timeline-item timestamp="2026-04" content="开工建设" type="warning" />
      </el-timeline>
    </div>
  </div>
</template>
