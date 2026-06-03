<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import L from 'leaflet'

interface BusPoint {
  id: string
  name: string
  zone: string
  voltageLevel: string
  baseKv: number
  longitude: number
  latitude: number
}

const props = defineProps<{
  buses: BusPoint[]
  selectedIds: string[]
}>()

const emit = defineEmits<{
  'update:selectedIds': [ids: string[]]
}>()

const mapContainer = ref<HTMLElement | null>(null)
const selectMode = ref(false)

let map: L.Map | null = null
let markerLayer = L.layerGroup()

// busId → circleMarker 映射，用 setStyle 同步更新避免重建 DOM
const markerMap = new Map<string, L.CircleMarker>()
// 选中状态 Set
let selectedIdSet = new Set<string>()
// 框选状态
let selectRect: L.Rectangle | null = null
let selectStart: L.LatLng | null = null
let isDrawing = false
let suppressClick = false

const voltageColors: Record<string, string> = {
  '500kV': '#f56c6c',
  '220kV': '#e6a23c',
  '110kV': '#267F7B',
  '10kV': '#67c23a',
}

function getColor(voltageLevel: string): string {
  return voltageColors[voltageLevel] || '#909399'
}

function getRadius(baseKv: number): number {
  return baseKv >= 500 ? 18 : baseKv >= 220 ? 15 : 12
}

function getNormalStyle(bus: BusPoint) {
  return {
    radius: getRadius(bus.baseKv || 10),
    fillColor: getColor(bus.voltageLevel),
    color: 'rgba(255,255,255,0.6)',
    weight: 2,
    fillOpacity: 0.85,
  }
}

function getSelectedStyle(bus: BusPoint) {
  return {
    radius: getRadius(bus.baseKv || 10) + 3,
    fillColor: getColor(bus.voltageLevel),
    color: '#fff',
    weight: 3,
    fillOpacity: 1,
  }
}

// 同步更新单个 marker 的样式
function updateMarkerStyle(busId: string) {
  const marker = markerMap.get(busId)
  if (!marker) return
  const bus = props.buses.find((b) => b.id === busId)
  if (!bus) return
  const isSelected = selectedIdSet.has(busId)
  marker.setStyle(isSelected ? getSelectedStyle(bus) : getNormalStyle(bus))
}

// 批量更新所有 marker 样式（用于全选/清空）
function refreshAllMarkers() {
  for (const id of markerMap.keys()) {
    updateMarkerStyle(id)
  }
}

// emit 选中变化
function emitSelection() {
  emit('update:selectedIds', [...selectedIdSet])
}

// 添加节点到选中集合并更新样式
function addToSelection(ids: string[]) {
  for (const id of ids) {
    if (!selectedIdSet.has(id)) {
      selectedIdSet.add(id)
      updateMarkerStyle(id)
    }
  }
}

function createMarkers() {
  markerMap.clear()
  markerLayer.clearLayers()

  for (const bus of props.buses) {
    const marker = L.circleMarker([bus.latitude, bus.longitude], getNormalStyle(bus))

    marker.bindTooltip(`${bus.name} (${bus.voltageLevel})<br/>${bus.zone}`, {
      direction: 'top',
      offset: [0, -getRadius(bus.baseKv || 10) - 4],
    })

    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e)
      if (suppressClick) return
      if (selectedIdSet.has(bus.id)) {
        selectedIdSet.delete(bus.id)
      } else {
        selectedIdSet.add(bus.id)
      }
      updateMarkerStyle(bus.id)
      emitSelection()
    })

    markerMap.set(bus.id, marker)
    markerLayer.addLayer(marker)
  }
}

function initMap() {
  if (!mapContainer.value || map) return

  map = L.map(mapContainer.value, {
    center: [29.9, 120.18],
    zoom: 11,
    minZoom: 9,
    maxBounds: L.latLngBounds([29.0, 118.8], [30.6, 121.0]).pad(0.1),
    zoomControl: true,
    attributionControl: false,
  })

  L.tileLayer(
    'https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}',
    { maxZoom: 18, subdomains: ['1', '2', '3', '4'] },
  ).addTo(map)

  markerLayer.addTo(map)
  createMarkers()

  // 初始选中状态
  selectedIdSet = new Set(props.selectedIds)
  refreshAllMarkers()

  // ---- 框选 ----
  map.on('mousedown', (e) => {
    if (!selectMode.value || !map) return
    L.DomEvent.stopPropagation(e)
    isDrawing = true
    selectStart = e.latlng
    map.dragging.disable()
    const p: [number, number] = [e.latlng.lat, e.latlng.lng]
    selectRect = L.rectangle([p, p], {
      color: '#267F7B', weight: 1, fillOpacity: 0.1, dashArray: '5,5', interactive: false,
    }).addTo(map)
  })

  map.on('mousemove', (e) => {
    if (!isDrawing || !selectRect || !selectStart || !map) return
    selectRect.setBounds(L.latLngBounds(selectStart, e.latlng))
  })

  map.on('mouseup', (e) => {
    if (!isDrawing || !selectRect || !selectStart || !map) return
    L.DomEvent.stopPropagation(e)

    const endLatLng = e.latlng
    const minLat = Math.min(selectStart.lat, endLatLng.lat)
    const maxLat = Math.max(selectStart.lat, endLatLng.lat)
    const minLng = Math.min(selectStart.lng, endLatLng.lng)
    const maxLng = Math.max(selectStart.lng, endLatLng.lng)

    const ids: string[] = []
    for (const bus of props.buses) {
      if (bus.latitude >= minLat && bus.latitude <= maxLat && bus.longitude >= minLng && bus.longitude <= maxLng) {
        ids.push(bus.id)
      }
    }

    if (ids.length > 0) {
      addToSelection(ids)
      emitSelection()
    }

    selectRect.remove()
    selectRect = null
    selectStart = null
    isDrawing = false
    map.dragging.enable()
    suppressClick = true
    setTimeout(() => { suppressClick = false }, 0)
  })
}

function fitToData() {
  if (!map || props.buses.length === 0) return
  const lats = props.buses.map((b) => b.latitude)
  const lngs = props.buses.map((b) => b.longitude)
  map.fitBounds(L.latLngBounds(
    L.latLng(Math.min(...lats), Math.min(...lngs)),
    L.latLng(Math.max(...lats), Math.max(...lngs)),
  ).pad(0.1))
}

function toggleSelectMode() { selectMode.value = !selectMode.value }

function selectAll() {
  const ids = props.buses.map((b) => b.id)
  addToSelection(ids)
  emitSelection()
}

function deselectAll() {
  for (const id of selectedIdSet) updateMarkerStyle(id)
  selectedIdSet.clear()
  refreshAllMarkers()
  emitSelection()
}

// 监听外部 props 变化
watch(() => props.buses, () => {
  if (!map) return
  markerLayer.clearLayers()
  markerMap.clear()
  createMarkers()
  selectedIdSet = new Set(props.selectedIds)
  refreshAllMarkers()
})

watch(() => props.selectedIds, (newIds) => {
  const newSet = new Set(newIds)
  // 找出变化并更新
  for (const id of selectedIdSet) {
    if (!newSet.has(id)) updateMarkerStyle(id)
  }
  for (const id of newSet) {
    if (!selectedIdSet.has(id)) updateMarkerStyle(id)
  }
  selectedIdSet = newSet
})

onMounted(() => { nextTick(() => initMap()) })

onUnmounted(() => {
  if (map) { map.remove(); map = null }
  markerMap.clear()
})

defineExpose({ fitToData, selectAll, deselectAll })
</script>

<template>
  <div class="map-selector">
    <div class="map-toolbar">
      <el-button size="small" :type="selectMode ? 'primary' : 'default'" @click="toggleSelectMode">
        {{ selectMode ? '框选模式（拖拽选取）' : '框选模式' }}
      </el-button>
      <el-button size="small" @click="selectAll">全选</el-button>
      <el-button size="small" @click="deselectAll">清空</el-button>
      <el-button size="small" @click="fitToData">适应数据</el-button>
      <div class="map-legend">
        <template v-for="(color, kv) in voltageColors" :key="kv">
          <span class="legend-item"><span class="legend-dot" :style="{ background: color }" /> {{ kv }}</span>
        </template>
      </div>
    </div>
    <div ref="mapContainer" class="map-container" />
  </div>
</template>

<style scoped>
.map-selector { border: 1px solid #e4e7ed; border-radius: 4px; overflow: hidden; }
.map-toolbar { display: flex; align-items: center; gap: 6px; padding: 6px 8px; background: #f5f7fa; border-bottom: 1px solid #e4e7ed; }
.map-container { height: 480px; width: 100%; }
.map-legend { display: flex; gap: 10px; margin-left: auto; font-size: 11px; color: #909399; }
.legend-item { display: flex; align-items: center; gap: 2px; }
.legend-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
</style>
