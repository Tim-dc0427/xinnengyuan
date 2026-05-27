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
let map: L.Map | null = null
let markerLayer = L.layerGroup()
let selectRect: L.Rectangle | null = null
let selectStart: L.LatLng | null = null
let isSelecting = false
const selectMode = ref(false)

const voltageColors: Record<string, string> = {
  '500kV': '#f56c6c',
  '220kV': '#e6a23c',
  '110kV': '#267F7B',
  '10kV': '#67c23a',
}

function getMarkerColor(bus: BusPoint): string {
  return voltageColors[bus.voltageLevel] || '#909399'
}

function getMarkerRadius(bus: BusPoint): number {
  return bus.baseKv >= 500 ? 8 : bus.baseKv >= 220 ? 6 : bus.baseKv >= 110 ? 5 : 4
}

function renderMarkers() {
  markerLayer.clearLayers()
  const selectedSet = new Set(props.selectedIds)

  for (const bus of props.buses) {
    const isSelected = selectedSet.has(bus.id)
    const color = getMarkerColor(bus)
    const marker = L.circleMarker([bus.latitude, bus.longitude], {
      radius: isSelected ? getMarkerRadius(bus) + 2 : getMarkerRadius(bus),
      fillColor: isSelected ? '#ff6b6b' : color,
      color: isSelected ? '#c0392b' : '#666',
      weight: isSelected ? 2 : 0.5,
      fillOpacity: isSelected ? 1 : 0.7,
    })
    marker.bindTooltip(`${bus.name} (${bus.voltageLevel})`, {
      direction: 'top',
      offset: [0, -getMarkerRadius(bus) - 2],
    })
    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e)
      const ids = [...props.selectedIds]
      const idx = ids.indexOf(bus.id)
      if (idx >= 0) ids.splice(idx, 1)
      else ids.push(bus.id)
      emit('update:selectedIds', ids)
    })
    markerLayer.addLayer(marker)
  }
}

function initMap() {
  if (!mapContainer.value || map) return

  map = L.map(mapContainer.value, {
    center: [30.25, 120.18],
    zoom: 10,
    zoomControl: true,
    attributionControl: false,
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
  }).on('tileerror', function () {
    // OSM 瓦片在国内可能加载失败，静默处理
  }).addTo(map)

  markerLayer.addTo(map)

  // 矩形框选
  map.on('mousedown', (e) => {
    if (!selectMode.value || !map) return
    L.DomEvent.stopPropagation(e)
    isSelecting = true
    selectStart = e.latlng
    map.dragging.disable()
    const p: [number, number] = [e.latlng.lat, e.latlng.lng]
    selectRect = L.rectangle([p, p], {
      color: '#267F7B',
      weight: 1,
      fillOpacity: 0.1,
      dashArray: '5,5',
    }).addTo(map)
  })

  map.on('mousemove', (e) => {
    if (!isSelecting || !selectRect || !selectStart || !map) return
    const b = L.latLngBounds(selectStart, e.latlng)
    selectRect.setBounds(b)
  })

  map.on('mouseup', (e) => {
    if (!isSelecting || !selectRect || !map) return
    L.DomEvent.stopPropagation(e)

    const bounds = selectRect.getBounds()
    const newIds = new Set(props.selectedIds)

    for (const bus of props.buses) {
      const pt: [number, number] = [bus.latitude, bus.longitude]
      if ((bounds as any).contains(pt)) {
        newIds.add(bus.id)
      }
    }

    emit('update:selectedIds', [...newIds])
    selectRect.remove()
    selectRect = null
    selectStart = null
    isSelecting = false
    map.dragging.enable()
    selectMode.value = false
  })

  // 点击非框选模式则取消
  map.on('click', () => {
    if (!selectMode.value) return
  })

  renderMarkers()
}

function fitToData() {
  if (!map || props.buses.length === 0) return
  const lats = props.buses.map((b) => b.latitude)
  const lngs = props.buses.map((b) => b.longitude)
  const sw = L.latLng(Math.min(...lats), Math.min(...lngs))
  const ne = L.latLng(Math.max(...lats), Math.max(...lngs))
  map.fitBounds(L.latLngBounds(sw, ne).pad(0.1))
}

function toggleSelectMode() {
  selectMode.value = !selectMode.value
}

function selectAll() {
  emit('update:selectedIds', props.buses.map((b) => b.id))
}

function deselectAll() {
  emit('update:selectedIds', [])
}

watch(() => props.buses, () => {
  renderMarkers()
})

watch(() => props.selectedIds, () => {
  renderMarkers()
}, { deep: true })

onMounted(() => {
  nextTick(() => initMap())
})

onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
})

defineExpose({ fitToData, selectAll, deselectAll })
</script>

<template>
  <div class="map-selector">
    <div class="map-toolbar">
      <el-button
        size="small"
        :type="selectMode ? 'primary' : 'default'"
        @click="toggleSelectMode"
      >
        {{ selectMode ? '框选模式（拖拽选取）' : '框选模式' }}
      </el-button>
      <el-button size="small" @click="selectAll">全选</el-button>
      <el-button size="small" @click="deselectAll">清空</el-button>
      <el-button size="small" @click="fitToData">适应数据</el-button>
      <div class="map-legend">
        <span v-for="(color, kv) in voltageColors" :key="kv" class="legend-item">
          <span class="legend-dot" :style="{ background: color }" /> {{ kv }}
        </span>
      </div>
    </div>
    <div ref="mapContainer" class="map-container" />
  </div>
</template>

<style scoped>
.map-selector {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  overflow: hidden;
}
.map-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
}
.map-container {
  height: 480px;
  width: 100%;
}
.map-legend {
  display: flex;
  gap: 8px;
  margin-left: auto;
  font-size: 11px;
  color: #909399;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 2px;
}
.legend-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
</style>
