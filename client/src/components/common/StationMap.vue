<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import L from 'leaflet'
import type { StationOption, StationSnapshot } from '@new-energy/shared'

const props = defineProps<{
  stations: StationOption[]
  snapshots: StationSnapshot[]
  activeId: string | null
}>()

const emit = defineEmits<{
  select: [id: string | null]
}>()

const mapContainer = ref<HTMLElement | null>(null)
let map: L.Map | null = null
let markerLayer = L.layerGroup()
let labelLayer = L.layerGroup()

const voltageColors: Record<string, string> = {
  '500kV': '#f56c6c',
  '220kV': '#e6a23c',
  '110kV': '#267F7B',
  '10kV': '#67c23a',
}

function getMarkerColor(voltageLevel: string): string {
  return voltageColors[voltageLevel] || '#909399'
}

function getIconSize(baseKv: number): number {
  return baseKv >= 500 ? 36 : baseKv >= 220 ? 32 : 28
}

function buildMarkerHtml(color: string, isActive: boolean, isBackfeed: boolean, baseKv: number): string {
  const size = getIconSize(baseKv)
  const diameter = isActive ? size : size - 4
  const shadow = isActive
    ? `0 0 12px ${color}, 0 2px 6px rgba(0,0,0,0.3)`
    : '0 2px 6px rgba(0,0,0,0.25)'
  const backfeedRing = isBackfeed
    ? `<div style="position:absolute;inset:-4px;border:3px solid #f56c6c;border-radius:50%;animation:pv-pulse 1.2s ease-in-out infinite;pointer-events:none;"></div>`
    : ''

  return `
    <div style="position:relative;width:${diameter + 8}px;height:${diameter + 8}px;display:flex;align-items:center;justify-content:center;">
      ${backfeedRing}
      <div style="
        width:${diameter}px;height:${diameter}px;border-radius:50%;
        background:${color};
        box-shadow:${shadow};
        border:2px solid rgba(255,255,255,0.6);
        transition:all 0.2s;
      "></div>
    </div>
  `
}

function renderMarkers() {
  markerLayer.clearLayers()
  labelLayer.clearLayers()

  const snapshotMap = new Map(props.snapshots.map((s) => [s.stationId, s]))

  for (const station of props.stations) {
    const color = getMarkerColor(station.voltageLevel)
    const isActive = station.id === props.activeId
    const snap = snapshotMap.get(station.id)
    const isBackfeed = snap?.isBackfeed ?? false
    const baseKv = Number(station.gridConnectionVoltageKv || station.voltageLevel?.replace('kV', '') || 10)
    const iconSize = getIconSize(baseKv) + 8

    const html = buildMarkerHtml(color, isActive, isBackfeed, baseKv)
    const icon = L.divIcon({
      className: '',
      html,
      iconSize: [iconSize, iconSize],
      iconAnchor: [iconSize / 2, iconSize / 2],
    })

    const marker = L.marker([station.latitude, station.longitude], { icon })

    // Hover tooltip：详细信息
    let tipHtml = `${snap?.stationName || station.stationName} (${station.gridConnectionVoltageKv}kV)`
    if (isBackfeed) tipHtml += ' ⚠倒送'
    tipHtml += `<br/>${station.zone} | ${station.installedCapacityMw}MW`
    if (snap) {
      tipHtml += `<br/>P: ${snap.activePowerKw.toFixed(1)}kW | Q: ${snap.reactivePowerKvar.toFixed(1)}kvar | S: ${snap.apparentPowerKva.toFixed(1)}kVA`
    }
    marker.bindTooltip(tipHtml, { direction: 'top', offset: [0, -iconSize / 2 - 2] })

    // 永久标签：简洁显示 P 值和方向
    if (snap) {
      const pKw = snap.activePowerKw
      const arrow = pKw >= 0 ? '↑' : '↓'
      const pColor = pKw >= 0 ? '#67c23a' : '#f56c6c'
      const labelText = `<span style="font-size:11px;font-weight:600;color:${pColor};background:rgba(255,255,255,0.85);padding:1px 4px;border-radius:2px;white-space:nowrap;">${arrow} ${Math.abs(pKw).toFixed(0)}kW</span>`
      const labelIcon = L.divIcon({
        className: '',
        html: labelText,
        iconSize: [0, 0],
        iconAnchor: [-iconSize / 2 - 4, 6],
      })
      const label = L.marker([station.latitude, station.longitude], { icon: labelIcon, interactive: false })
      labelLayer.addLayer(label)
    }

    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e)
      emit('select', station.id)
    })

    markerLayer.addLayer(marker)
  }
}

function initMap() {
  if (!mapContainer.value || map) return

  const hangzhouBounds = L.latLngBounds([29.0, 118.8], [30.6, 121.0])

  map = L.map(mapContainer.value, {
    center: [29.9, 120.18],
    zoom: 11,
    minZoom: 9,
    maxBounds: hangzhouBounds.pad(0.1),
    zoomControl: true,
    attributionControl: false,
  })

  L.tileLayer('https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}', {
    maxZoom: 18,
    subdomains: ['1', '2', '3', '4'],
  }).addTo(map)

  markerLayer.addTo(map)
  labelLayer.addTo(map)

  map.on('click', () => emit('select', null))
  renderMarkers()
}

function fitToData() {
  if (!map || props.stations.length === 0) return
  const lats = props.stations.map((s) => s.latitude)
  const lngs = props.stations.map((s) => s.longitude)
  map.fitBounds(L.latLngBounds(
    L.latLng(Math.min(...lats), Math.min(...lngs)),
    L.latLng(Math.max(...lats), Math.max(...lngs)),
  ).pad(0.1))
}

watch(() => props.stations, () => renderMarkers(), { deep: true })
watch(() => props.snapshots, () => renderMarkers(), { deep: true })
watch(() => props.activeId, () => renderMarkers())

onMounted(() => nextTick(() => initMap()))
onUnmounted(() => {
  if (map) { map.remove(); map = null }
})

defineExpose({ fitToData })
</script>

<template>
  <div class="station-map">
    <div class="map-toolbar">
      <el-button size="small" @click="fitToData">适应数据</el-button>
      <div class="map-legend">
        <template v-for="(color, kv) in voltageColors" :key="kv">
          <span class="legend-item"><span class="legend-dot" :style="{ background: color }" /> {{ kv }}</span>
        </template>
        <span class="legend-item legend-backfeed"><span class="legend-ring" /> 倒送预警</span>
        <span class="legend-item"><span style="color:#67c23a;font-weight:600">↑</span> 正向</span>
        <span class="legend-item"><span style="color:#f56c6c;font-weight:600">↓</span> 反向</span>
      </div>
    </div>
    <div ref="mapContainer" class="map-container" />
  </div>
</template>

<style scoped>
.station-map {
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
  gap: 10px;
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
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.legend-ring {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #f56c6c;
  background: transparent;
}
</style>

<style>
@keyframes pv-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.15); }
}
</style>
