import { ref, computed } from 'vue'
import { fetchFeeders } from '@/api/power-flow'

export function useFeederSelection() {
  const feeders = ref<any[]>([])
  const selectedFeederIds = ref<string[]>([])
  const feederZoneFilter = ref<string>('')

  const feederZoneOptions = computed(() => {
    const zones = [...new Set(feeders.value.map((f: any) => f.zone).filter(Boolean))] as string[]
    return zones.sort()
  })

  const filteredFeeders = computed(() => {
    if (!feederZoneFilter.value) return feeders.value
    return feeders.value.filter((f: any) => f.zone === feederZoneFilter.value)
  })

  const feederOptions = computed(() => {
    return filteredFeeders.value.map((f: any) => ({
      value: f.id,
      label: `${f.name} (${f.substation_name}) — ${f.zone} — 光伏${f.pvCount}座/${(f.totalCapacityMw || 0).toFixed(0)}MW`,
    }))
  })

  function selectAllFeeders() {
    selectedFeederIds.value = feederOptions.value.map((o: any) => o.value)
  }
  function deselectAllFeeders() {
    selectedFeederIds.value = []
  }

  // 根据选中馈线自动确定的光伏电站列表
  const feederPVStations = computed(() => {
    if (selectedFeederIds.value.length === 0) return []
    const stations: any[] = []
    for (const fid of selectedFeederIds.value) {
      const feeder = feeders.value.find((f: any) => f.id === fid)
      if (feeder?.pvStations) stations.push(...feeder.pvStations)
    }
    return stations
  })

  // 从选中馈线的光伏电站提取 bus_id
  const feederPVBusIds = computed(() => {
    return [...new Set(feederPVStations.value.map((s: any) => s.bus_id))]
  })

  async function loadFeeders() {
    try {
      feeders.value = (await fetchFeeders()) || []
    } catch {
      feeders.value = []
    }
  }

  return {
    feeders,
    selectedFeederIds,
    feederZoneFilter,
    feederZoneOptions,
    filteredFeeders,
    feederOptions,
    selectAllFeeders,
    deselectAllFeeders,
    feederPVStations,
    feederPVBusIds,
    loadFeeders,
  }
}
