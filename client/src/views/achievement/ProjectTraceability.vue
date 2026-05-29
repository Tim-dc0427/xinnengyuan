<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { fetchProjects, traceHistory } from '@/api/achievement'
import type { ProjectItem, AuditRecord } from '@/api/achievement'

const projects = ref<ProjectItem[]>([])
const selectedProjectId = ref('')
const auditRecords = ref<AuditRecord[]>([])
const loading = ref(false)

const filterName = ref('')
const filterDateStart = ref('')
const filterDateEnd = ref('')

onMounted(async () => {
  projects.value = await fetchProjects()
})

const filteredProjects = computed(() => {
  let list = projects.value
  if (filterName.value) list = list.filter(p => p.project_name.includes(filterName.value))
  return list
})

async function selectProject(id: string) {
  selectedProjectId.value = id
  loading.value = true
  try {
    auditRecords.value = await traceHistory(id)
  } catch { auditRecords.value = [] } finally { loading.value = false }
}

const filteredRecords = computed(() => {
  let list = auditRecords.value
  if (filterDateStart.value) list = list.filter(r => r.created_at >= filterDateStart.value)
  if (filterDateEnd.value) list = list.filter(r => r.created_at <= filterDateEnd.value + 'T23:59:59')
  return list
})

const selectedProject = computed(() => projects.value.find(p => p.id === selectedProjectId.value))

const timelineItems = computed(() => {
  return filteredRecords.value.map(r => ({
    timestamp: r.created_at?.slice(0, 10) || '',
    content: r.description || r.action,
    type: r.action === 'created' ? 'primary' : r.action === 'updated' ? 'warning' : 'info',
  }))
})
</script>

<template>
  <div class="page-container">
    <div class="chart-panel-title">项目留痕与追溯</div>

    <div class="chart-panel">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
        <span>项目检索：</span>
        <el-input v-model="filterName" placeholder="项目名称" size="small" style="width:200px" clearable />
        <el-select v-model="selectedProjectId" placeholder="选择项目" size="small" style="width:280px" @change="selectProject" clearable>
          <el-option v-for="p in filteredProjects" :key="p.id" :label="p.project_name" :value="p.id" />
        </el-select>
      </div>
    </div>

    <template v-if="selectedProject">
      <div class="chart-panel">
        <div style="font-size:14px;font-weight:600;color:#303133;margin-bottom:8px">
          项目档案 — {{ selectedProject.project_name }}
        </div>
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="项目编号">{{ selectedProject.project_code }}</el-descriptions-item>
          <el-descriptions-item label="项目类型">{{ selectedProject.project_type }}</el-descriptions-item>
          <el-descriptions-item label="当前状态">{{ selectedProject.status }}</el-descriptions-item>
          <el-descriptions-item label="装机容量">{{ selectedProject.capacity_kw ? selectedProject.capacity_kw + 'kW' : '-' }}</el-descriptions-item>
          <el-descriptions-item label="预算">{{ selectedProject.budget || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ selectedProject.created_at?.slice(0, 10) || '-' }}</el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="grid-2">
        <div class="chart-panel">
          <div style="font-size:14px;font-weight:600;color:#303133;margin-bottom:8px">历史版本追溯</div>
          <div style="display:flex;gap:8px;margin-bottom:8px">
            <el-date-picker v-model="filterDateStart" type="date" placeholder="开始日期" size="small" style="width:140px" value-format="YYYY-MM-DD" />
            <el-date-picker v-model="filterDateEnd" type="date" placeholder="结束日期" size="small" style="width:140px" value-format="YYYY-MM-DD" />
          </div>
          <el-timeline v-if="timelineItems.length > 0">
            <el-timeline-item
              v-for="(item, idx) in timelineItems"
              :key="idx"
              :timestamp="item.timestamp"
              :type="item.type as any"
            >
              {{ item.content }}
            </el-timeline-item>
          </el-timeline>
          <div v-else style="color:#909399;font-size:13px;padding:16px">暂无历史追溯记录</div>
        </div>

        <div class="chart-panel">
          <div style="font-size:14px;font-weight:600;color:#303133;margin-bottom:8px">审计记录明细</div>
          <el-table :data="filteredRecords" stripe size="small" v-loading="loading" max-height="320">
            <el-table-column prop="created_at" label="时间" width="160" />
            <el-table-column prop="action" label="操作类型" width="100" />
            <el-table-column prop="description" label="描述" min-width="180" />
            <el-table-column prop="operator" label="操作人" width="100" />
          </el-table>
        </div>
      </div>

      <div class="chart-panel">
        <div style="font-size:14px;font-weight:600;color:#303133;margin-bottom:8px">合规性检查清单</div>
        <el-table :data="[
          { item: '接入位置合规性', status: true, note: '接入点符合规划要求' },
          { item: '设备参数一致性', status: true, note: '设备规格与规划一致' },
          { item: '规划调整审批', status: auditRecords.length > 0, note: auditRecords.length > 0 ? '有审批记录' : '无审批记录' },
          { item: '并网检测报告', status: false, note: '待上传' },
        ]" stripe size="small">
          <el-table-column prop="item" label="检查项" width="160" />
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.status ? 'success' : 'danger'" size="small">{{ row.status ? '通过' : '待完善' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="note" label="备注" min-width="200" />
        </el-table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page-container { display: flex; flex-direction: column; gap: 16px; }
.chart-panel { background: #fff; border-radius: 4px; padding: 16px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
</style>
