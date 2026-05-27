<script setup lang="ts">
import { ref } from 'vue'

const batchTasks = ref([
  { id: 'BATCH-001', name: '区域A-10kV线路群', tasks: 24, completed: 24, status: 'completed', time: '2026-05-18 10:30' },
  { id: 'BATCH-002', name: '区域B-光伏接入点群', tasks: 16, completed: 12, status: 'running', time: '2026-05-18 14:00' },
  { id: 'BATCH-003', name: '区域C-新增布点评估', tasks: 8, completed: 0, status: 'pending', time: '-' },
])
</script>

<template>
  <div class="page-container">
    <div class="chart-panel">
      <div class="chart-panel-title">批量计算参数配置</div>
      <el-form label-width="120px" size="small">
        <el-form-item label="计算类型">
          <el-select model-value="ONLINE" style="width:200px">
            <el-option label="标准潮流" value="ONLINE" />
          </el-select>
        </el-form-item>
        <el-form-item label="区域选取">
          <el-button>地图框选区域</el-button>
          <el-button>导入线路/节点列表</el-button>
        </el-form-item>
        <el-form-item label="统一参数">
          <el-input-number model-value="1.05" :step="0.01" :precision="2" /> 负荷增长系数
        </el-form-item>
        <el-form-item>
          <el-button type="primary">开始批量计算</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="chart-panel">
      <div class="chart-panel-title">任务实时监控</div>
      <el-table :data="batchTasks" stripe>
        <el-table-column prop="id" label="批次ID" width="120" />
        <el-table-column prop="name" label="任务名称" />
        <el-table-column label="进度" width="200">
          <template #default="{ row }">
            <el-progress :percentage="Math.round((row.completed / row.tasks) * 100)" :status="row.status === 'completed' ? 'success' : ''" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'completed' ? 'success' : row.status === 'running' ? 'warning' : 'info'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="time" label="完成时间" width="180" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button size="small" link :type="row.status === 'completed' ? 'primary' : 'info'" :disabled="row.status !== 'completed'">查看结果</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="chart-panel">
      <div class="chart-panel-title">异常结果标记</div>
      <el-empty v-if="true" description="暂无异常结果" />
    </div>
  </div>
</template>
