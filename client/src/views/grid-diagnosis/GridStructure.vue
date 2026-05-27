<script setup lang="ts">
import { ref } from 'vue'
import ChartContainer from '@/components/common/ChartContainer.vue'

const equipmentData = ref([
  { name: '变压器#1', type: 'TRANSFORMER', capacity: '50MVA', voltage: '110kV', loadRate: '72%', grade: 'A', health: '正常' },
  { name: '逆变器#1', type: 'INVERTER', capacity: '300kW', voltage: '0.4kV', loadRate: '85%', grade: 'B', health: '关注' },
  { name: '断路器#1', type: 'BREAKER', capacity: '63kA', voltage: '110kV', loadRate: '60%', grade: 'A', health: '正常' },
  { name: '电缆#1', type: 'CABLE', capacity: '400A', voltage: '10kV', loadRate: '92%', grade: 'B', health: '预警' },
])
</script>

<template>
  <div class="page-container">
    <div class="chart-panel">
      <div class="chart-panel-title">光伏倒送判断 - 接入点展示</div>
      <div style="height:400px;background:#e8edf2;display:flex;align-items:center;justify-content:center;border-radius:4px;color:#909399">
        地图组件 - 标注光伏接入点 / 功率方向
      </div>
    </div>

    <div class="chart-panel">
      <div class="chart-panel-title">设备承载力评估</div>
      <el-table :data="equipmentData" stripe>
        <el-table-column prop="name" label="设备名称" width="150" />
        <el-table-column prop="type" label="类型" width="120" />
        <el-table-column prop="capacity" label="额定容量" width="120" />
        <el-table-column prop="voltage" label="电压等级" width="100" />
        <el-table-column prop="loadRate" label="负载率" />
        <el-table-column label="可靠性等级" width="100">
          <template #default="{ row }">
            <el-tag :type="row.grade === 'A' ? 'success' : row.grade === 'B' ? 'warning' : 'danger'">{{ row.grade }}级</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" type="primary" link>承载力详情</el-button>
            <el-button size="small" link>生命周期</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="grid-2">
      <div class="chart-panel">
        <div class="chart-panel-title">设备剩余寿命预测</div>
        <el-table :data="[
          { name: '变压器#1', age: '3年', design: '25年', remaining: '22年', priority: 3 },
          { name: '逆变器#1', age: '3年', design: '15年', remaining: '12年', priority: 2 },
          { name: '电缆#1', age: '3年', design: '20年', remaining: '17年', priority: 1 },
        ]" stripe size="small">
          <el-table-column prop="name" label="设备" />
          <el-table-column prop="remaining" label="剩余寿命" />
          <el-table-column prop="priority" label="更换优先级" />
        </el-table>
      </div>
      <div class="chart-panel">
        <div class="chart-panel-title">设备寿命周期管理</div>
        <el-timeline>
          <el-timeline-item timestamp="2023-06" content="变压器#1 投运" type="primary" />
          <el-timeline-item timestamp="2024-03" content="逆变器#1 检修" type="success" />
          <el-timeline-item timestamp="2025-01" content="断路器#1 试验" type="warning" />
          <el-timeline-item timestamp="2026-05" content="电缆#1 预警-载流量超标" type="danger" />
        </el-timeline>
      </div>
    </div>
  </div>
</template>
