<script setup lang="ts" generic="T extends Record<string, unknown>">
import type { PaginationQuery } from '@new-energy/shared'

const props = withDefaults(defineProps<{
  data: T[]
  columns: Array<{ prop: string; label: string; width?: string | number; sortable?: boolean }>
  total?: number
  loading?: boolean
  pagination?: PaginationQuery
}>(), {
  total: 0,
  loading: false,
})

const emit = defineEmits<{
  pageChange: [page: number, pageSize: number]
  sortChange: [sort: { prop: string; order: string }]
  rowClick: [row: T]
}>()

function handlePageChange(page: number) {
  emit('pageChange', page, props.pagination?.pageSize || 20)
}

function handleSizeChange(size: number) {
  emit('pageChange', 1, size)
}
</script>

<template>
  <el-table
    :data="data"
    v-loading="loading"
    stripe
    border
    style="width: 100%"
    @row-click="(row: T) => emit('rowClick', row)"
  >
    <el-table-column
      v-for="col in columns"
      :key="col.prop"
      :prop="col.prop"
      :label="col.label"
      :width="col.width"
      :sortable="col.sortable"
    />
  </el-table>
  <div class="table-pagination" v-if="total > 0">
    <el-pagination
      :total="total"
      :page-size="pagination?.pageSize || 20"
      :current-page="pagination?.page || 1"
      layout="total, prev, pager, next, sizes"
      @current-change="handlePageChange"
      @size-change="handleSizeChange"
    />
  </div>
</template>

<style scoped>
.table-pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
