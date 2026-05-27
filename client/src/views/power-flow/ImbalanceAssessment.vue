<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchThreePhase } from '@/api/power-flow'
import type { ThreePhaseItem } from '@/api/power-flow'
import ChartContainer from '@/components/common/ChartContainer.vue'

const loading = ref(false)
const voltageLevel = ref('')
const region = ref('')
const pvFilter = ref<'all' | 'pv' | 'non-pv'>('all')
const chartGroupBy = ref<'zone' | 'voltage'>('zone')

const list = ref<ThreePhaseItem[]>([])

const voltageLevelOptions = ['', '220kV', '110kV', '10kV']
const regionOptions = ['', 'A（西部：仓前/未来城）', 'B（中部：余杭/闲林）', 'C（东部：乔司）']
const regionValueMap: Record<string, string> = {
  'A（西部：仓前/未来城）': 'A',
  'B（中部：余杭/闲林）': 'B',
  'C（东部：乔司）': 'C',
}

const filteredList = computed(() => {
  let data = list.value
  if (pvFilter.value === 'pv') data = data.filter(i => i.pvRelated)
  else if (pvFilter.value === 'non-pv') data = data.filter(i => !i.pvRelated)
  return data
})

const pvRelatedItems = computed(() => list.value.filter(i => i.pvRelated))
const severeItems = computed(() => list.value.filter(i => i.imbalancePct > 2))
const warningItems = computed(() => list.value.filter(i => i.imbalancePct > 1 && i.imbalancePct <= 2))

// 按区域/电压等级分组的相幅值图表
const threePhaseChartOption = computed(() => {
  const data = filteredList.value.slice(0, 20)
  if (!data.length) return {}

  // 按分组字段排序
  const sortedData = [...data].sort((a, b) => {
    const groupKey = chartGroupBy.value === 'zone' ? 'zone' : 'voltageLevel'
    return ((a as any)[groupKey] || '').localeCompare((b as any)[groupKey] || '')
  })

  const names = sortedData.map(d => d.nodeId || d.name || d.id)
  const phaseA = sortedData.map(d => d.phaseA ?? 0)
  const phaseB = sortedData.map(d => d.phaseB ?? 0)
  const phaseC = sortedData.map(d => d.phaseC ?? 0)
  const imbalance = sortedData.map(d => Number(d.imbalancePct.toFixed(2)))

  // 构建分组标签（含区域+电压等级）
  const labels = sortedData.map(d => {
    const zone = d.zone || ''
    const vl = d.voltageLevel || ''
    if (chartGroupBy.value === 'zone') {
      // 同一个区域下标记电压等级
      return `${d.nodeId || d.name}\n${vl}`
    }
    return `${d.nodeId || d.name}\n${zone}`
  })

  return {
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      formatter: (params: any[]) => {
        const idx = params[0]?.dataIndex
        if (idx === undefined) return ''
        const d = sortedData[idx]
        let html = `<b>${d.nodeId || d.name}</b><br/>`
        html += `<span style="color:#909399">区域：${d.zone || '-'}  |  电压等级：${d.voltageLevel || '-'}</span><br/>`
        params.forEach((p: any) => { html += `${p.marker} ${p.seriesName}: ${(p.value as number).toFixed(4)} p.u.<br/>` })
        html += `不平衡度: <b style="color:${d.imbalancePct > 2 ? '#F56C6C' : d.imbalancePct > 1 ? '#E6A23C' : '#67C23A'}">${d.imbalancePct.toFixed(2)}%</b>`
        return html
      },
    },
    legend: { data: ['A 相', 'B 相', 'C 相'], top: 0 },
    grid: { left: 60, right: 60, top: 40, bottom: 80 },
    xAxis: {
      type: 'category' as const,
      data: labels,
      axisLabel: { rotate: 30, fontSize: 10, interval: 0 },
      axisLine: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      name: '电压 (p.u.)',
      min: 0.85,
      max: 1.15,
      splitLine: { lineStyle: { type: 'dashed', color: '#e0e0e0' } },
    },
    series: [
      {
        name: 'A 相',
        type: 'bar',
        data: phaseA,
        itemStyle: { color: '#F56C6C' },
        barWidth: 8,
        barGap: '10%',
      },
      {
        name: 'B 相',
        type: 'bar',
        data: phaseB,
        itemStyle: { color: '#E6A23C' },
        barWidth: 8,
      },
      {
        name: 'C 相',
        type: 'bar',
        data: phaseC,
        itemStyle: { color: '#267F7B' },
        barWidth: 8,
      },
    ],
  }
})

// 不平衡度分布散点图
const imbalanceScatterOption = computed(() => {
  const data = filteredList.value
  if (!data.length) return {}

  const scatterData = data.map(d => ({
    value: [d.imbalancePct, Math.max(d.phaseA ?? 0, d.phaseB ?? 0, d.phaseC ?? 0) - Math.min(d.phaseA ?? 0, d.phaseB ?? 0, d.phaseC ?? 0)],
    name: d.nodeId || d.name,
    zone: d.zone,
    voltageLevel: d.voltageLevel,
    pvRelated: d.pvRelated,
    imbalancePct: d.imbalancePct,
  }))

  return {
    tooltip: {
      formatter: (p: any) => {
        const d = p.data
        return `<b>${d[2]}</b><br/>
          不平衡度: <b>${d[3].toFixed(2)}%</b><br/>
          相间最大差: ${(d[1] * 100).toFixed(2)}%<br/>
          区域: ${d[4] || '-'} | ${d[5] || '-'}<br/>
          ${d[6] ? '☀ 光伏关联' : ''}`
      },
    },
    grid: { left: 70, right: 30, top: 30, bottom: 50 },
    xAxis: {
      type: 'value' as const,
      name: '不平衡度 (%)',
      splitLine: { lineStyle: { type: 'dashed' } },
    },
    yAxis: {
      type: 'value' as const,
      name: '相间最大差 (p.u.)',
      axisLabel: { formatter: (v: number) => v.toFixed(2) },
    },
    series: [{
      type: 'scatter',
      data: scatterData.map(d => ({
        value: [d.value[0], d.value[1], d.name, d.imbalancePct, d.zone, d.voltageLevel, d.pvRelated],
        itemStyle: { color: d.pvRelated ? '#E6A23C' : '#267F7B' },
      })),
      symbolSize: 12,
    }],
  }
})

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (voltageLevel.value) params.voltageLevel = voltageLevel.value
    if (region.value) params.region = regionValueMap[region.value] || region.value
    list.value = await fetchThreePhase(params) || []
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="page-container">
    <div class="filter-bar">
      <el-select v-model="voltageLevel" placeholder="电压等级" clearable size="small" style="width:140px" @change="loadData">
        <el-option v-for="v in voltageLevelOptions" :key="v" :label="v || '全部'" :value="v" />
      </el-select>
      <el-select v-model="region" placeholder="区域" clearable size="small" style="width:210px;margin-left:10px" @change="loadData">
        <el-option v-for="r in regionOptions" :key="r" :label="r || '全部'" :value="r" />
      </el-select>
      <el-divider direction="vertical" />
      <el-radio-group v-model="pvFilter" size="small">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="pv">仅光伏</el-radio-button>
        <el-radio-button value="non-pv">非光伏</el-radio-button>
      </el-radio-group>
      <div style="flex:1" />
      <el-button size="small" :loading="loading" @click="loadData">刷新</el-button>
    </div>

    <!-- 统计卡片 -->
    <div class="grid-4">
      <el-card shadow="hover" class="stat-mini">
        <div class="stat-mini-label">总节点数</div>
        <div class="stat-mini-val" style="color:#267F7B">{{ list.length }}</div>
      </el-card>
      <el-card shadow="hover" class="stat-mini">
        <div class="stat-mini-label">光伏关联节点</div>
        <div class="stat-mini-val" style="color:#E6A23C">{{ pvRelatedItems.length }}</div>
      </el-card>
      <el-card shadow="hover" class="stat-mini" style="border-left:3px solid #F56C6C">
        <div class="stat-mini-label">严重不平衡 >2%</div>
        <div class="stat-mini-val" style="color:#F56C6C">{{ severeItems.length }}</div>
      </el-card>
      <el-card shadow="hover" class="stat-mini" style="border-left:3px solid #E6A23C">
        <div class="stat-mini-label">预警 (1%~2%)</div>
        <div class="stat-mini-val" style="color:#E6A23C">{{ warningItems.length }}</div>
      </el-card>
    </div>

    <!-- 三相幅值差异可视化图表 -->
    <div class="chart-panel">
      <div class="chart-panel-title">
        三相电压幅值差异（分组柱状图）
        <div style="display:inline-flex;align-items:center;gap:8px;margin-left:16px;font-weight:400">
          <span style="font-size:12px;color:#909399">分组依据：</span>
          <el-radio-group v-model="chartGroupBy" size="small">
            <el-radio-button value="zone">按区域</el-radio-button>
            <el-radio-button value="voltage">按电压等级</el-radio-button>
          </el-radio-group>
        </div>
      </div>
      <ChartContainer :option="threePhaseChartOption" height="350px" :loading="loading" />
      <div style="font-size:12px;color:#909399;margin-top:6px;padding:0 12px">
        <span style="display:inline-block;width:12px;height:12px;background:#F56C6C;margin-right:4px;border-radius:2px;vertical-align:middle" />
        A 相
        <span style="display:inline-block;width:12px;height:12px;background:#E6A23C;margin-right:4px;margin-left:16px;border-radius:2px;vertical-align:middle" />
        B 相
        <span style="display:inline-block;width:12px;height:12px;background:#267F7B;margin-right:4px;margin-left:16px;border-radius:2px;vertical-align:middle" />
        C 相
        <span style="margin-left:24px;color:#c0c4cc">每节点三柱并排，柱高差异越大表示三相越不平衡</span>
      </div>
    </div>

    <!-- 不平衡度散点分布 -->
    <div class="chart-panel">
      <div class="chart-panel-title">不平衡度 — 相间最大差分布（散点图）</div>
      <ChartContainer :option="imbalanceScatterOption" height="300px" :loading="loading" />
      <div style="font-size:12px;color:#909399;margin-top:6px;padding:0 12px">
        <span style="display:inline-block;width:12px;height:12px;background:#267F7B;margin-right:4px;border-radius:50%;vertical-align:middle" />
        非光伏节点
        <span style="display:inline-block;width:12px;height:12px;background:#E6A23C;margin-right:4px;margin-left:16px;border-radius:50%;vertical-align:middle" />
        光伏关联节点
        <span style="margin-left:24px;color:#c0c4cc">X轴=不平衡度，Y轴=三相电压最大差值，右上区域为高风险节点</span>
      </div>
    </div>

    <!-- 台账表格 -->
    <div class="chart-panel">
      <div class="chart-panel-title">三相不平衡度台账</div>
      <el-table :data="filteredList" stripe size="small" v-loading="loading" max-height="400"
        :row-class-name="({ row }: any) => row.imbalancePct > 2 ? 'severe-row' : row.imbalancePct > 1 ? 'warning-row' : ''">
        <el-table-column label="节点" min-width="120">
          <template #default="{ row }">{{ row.nodeId || row.name }}</template>
        </el-table-column>
        <el-table-column label="区域" width="60">
          <template #default="{ row }"><el-tag size="small" type="info">{{ row.zone }}</el-tag></template>
        </el-table-column>
        <el-table-column label="电压等级" width="80">
          <template #default="{ row }"><el-tag size="small">{{ row.voltageLevel }}</el-tag></template>
        </el-table-column>
        <el-table-column label="不平衡度%" width="100">
          <template #default="{ row }">
            <span :style="{ fontWeight: 600, color: row.imbalancePct > 2 ? '#F56C6C' : row.imbalancePct > 1 ? '#E6A23C' : '#606266' }">
              {{ row.imbalancePct.toFixed(2) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="A 相" width="80">
          <template #default="{ row }">{{ row.phaseA?.toFixed(4) || '-' }}</template>
        </el-table-column>
        <el-table-column label="B 相" width="80">
          <template #default="{ row }">{{ row.phaseB?.toFixed(4) || '-' }}</template>
        </el-table-column>
        <el-table-column label="C 相" width="80">
          <template #default="{ row }">{{ row.phaseC?.toFixed(4) || '-' }}</template>
        </el-table-column>
        <el-table-column label="相间最大差" width="110">
          <template #default="{ row }">
            <span v-if="row.phaseA != null && row.phaseB != null && row.phaseC != null" style="font-weight:600">
              {{ (Math.max(row.phaseA, row.phaseB, row.phaseC) - Math.min(row.phaseA, row.phaseB, row.phaseC)).toFixed(4) }}
            </span>
            <span v-else style="color:#c0c4cc">-</span>
          </template>
        </el-table-column>
        <el-table-column label="光伏关联" width="80">
          <template #default="{ row }">
            <el-tag :type="row.pvRelated ? 'warning' : 'info'" size="small">{{ row.pvRelated ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="plantName" label="关联电站" min-width="100" />
      </el-table>
    </div>

    <!-- 光伏不平衡问题清单 -->
    <div class="chart-panel">
      <div class="chart-panel-title">光伏相关不平衡问题清单</div>
      <el-table v-if="pvRelatedItems.length" :data="pvRelatedItems" stripe size="small" max-height="250">
        <el-table-column label="节点" min-width="120">
          <template #default="{ row }">{{ row.nodeId || row.name }}</template>
        </el-table-column>
        <el-table-column label="区域" width="60">
          <template #default="{ row }"><el-tag size="small" type="info">{{ row.zone }}</el-tag></template>
        </el-table-column>
        <el-table-column label="电压等级" width="80">
          <template #default="{ row }"><el-tag size="small">{{ row.voltageLevel }}</el-tag></template>
        </el-table-column>
        <el-table-column label="不平衡度%" width="100">
          <template #default="{ row }">
            <span :style="{ color: row.imbalancePct > 2 ? '#F56C6C' : '#E6A23C', fontWeight: 600 }">{{ row.imbalancePct.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="plantName" label="光伏电站" min-width="100" />
      </el-table>
      <div v-else style="padding:30px;text-align:center;color:#909399">无光伏关联不平衡节点</div>
    </div>
  </div>
</template>

<style scoped>
.filter-bar { display:flex; align-items:center; margin-bottom:16px; padding:12px 16px; background:#fff; border-radius:8px; }
.grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:16px; }
.stat-mini { padding:8px 16px; }
.stat-mini-label { font-size:12px; color:#909399; margin-bottom:4px; }
.stat-mini-val { font-size:20px; font-weight:700; }
:deep(.severe-row) { background-color:#fef0f0 !important; }
:deep(.warning-row) { background-color:#fdf6ec !important; }
</style>
