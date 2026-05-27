<script setup lang="ts">
import { ref } from 'vue'
import StatCard from '@/components/common/StatCard.vue'

const plans = ref([
  { name: '2026年配电网光伏接入规划', type: 'PV_INTEGRATION', year: 2026, status: 'draft', author: '规划人员' },
  { name: '阳光电站接入方案', type: 'PV_INTEGRATION', year: 2026, status: 'review', author: '规划人员' },
])

const sites = ref([
  { location: '区域A-光伏资源丰富区', score: 92, capacity: '50MW', cost: '2.1亿', absorption: '高' },
  { location: '区域B-负荷密集区', score: 85, capacity: '30MW', cost: '1.5亿', absorption: '中' },
  { location: '区域C-预留发展区', score: 78, capacity: '20MW', cost: '1.2亿', absorption: '中' },
])
</script>

<template>
  <div class="page-container">
    <div class="stat-card-row">
      <StatCard title="规划方案" value="5" unit="个" icon="Document" color="#267F7B" />
      <StatCard title="推荐布点" value="12" unit="个" icon="Location" color="#67C23A" />
      <StatCard title="平均消纳率" value="87.5" unit="%" icon="TrendCharts" color="#E6A23C" />
      <StatCard title="总投资预算" value="8.6" unit="亿元" icon="Money" color="#F56C6C" />
    </div>

    <div class="chart-panel">
      <div class="chart-panel-title">规划方案列表</div>
      <el-table :data="plans" stripe>
        <el-table-column prop="name" label="方案名称" />
        <el-table-column prop="type" label="类型" width="150" />
        <el-table-column prop="year" label="年度" width="80" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'draft' ? 'info' : 'warning'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250">
          <template #default>
            <el-button size="small" type="primary" link>集成PV模型</el-button>
            <el-button size="small" link>消纳方案</el-button>
            <el-button size="small" link>经济分析</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="chart-panel">
      <div class="chart-panel-title">布点规划智能推荐</div>
      <div style="height:350px;background:#e8edf2;display:flex;align-items:center;justify-content:center;border-radius:4px;color:#909399;margin-bottom:16px">
        地图 - 候选接入点空间分析展示
      </div>
      <el-table :data="sites" stripe size="small">
        <el-table-column prop="location" label="候选区域" />
        <el-table-column prop="score" label="综合评分" width="100" />
        <el-table-column prop="capacity" label="推荐容量" />
        <el-table-column prop="cost" label="估算投资" />
        <el-table-column prop="absorption" label="消纳能力" />
      </el-table>
    </div>

    <div class="grid-2">
      <div class="chart-panel">
        <div class="chart-panel-title">造价管理与经济性分析</div>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="总投资">21,000万元</el-descriptions-item>
          <el-descriptions-item label="单位容量造价">4,200元/kW</el-descriptions-item>
          <el-descriptions-item label="投资回收期">7.2年</el-descriptions-item>
          <el-descriptions-item label="内部收益率(IRR)">12.5%</el-descriptions-item>
          <el-descriptions-item label="净现值(NPV)">3,800万元</el-descriptions-item>
        </el-descriptions>
      </div>
      <div class="chart-panel">
        <div class="chart-panel-title">消纳方案编制</div>
        <el-form label-width="120px" size="small">
          <el-form-item label="储能配置"><el-input value="10MW/20MWh" /></el-form-item>
          <el-form-item label="无功补偿"><el-select model-value="SVG" style="width:100%"><el-option label="SVG" value="SVG" /></el-select></el-form-item>
          <el-form-item label="补偿容量"><el-input value="5Mvar" /></el-form-item>
          <el-form-item label="线路改造"><el-input type="textarea" value="导线截面升级LGJ-240→LGJ-400" /></el-form-item>
          <el-form-item><el-button type="primary">保存方案</el-button></el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>
