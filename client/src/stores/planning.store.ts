import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchCandidatePoints } from '@/api/planning'
import type { CandidatePoint } from '@new-energy/shared'

export const usePlanningStore = defineStore('planning', () => {
  const candidates = ref<CandidatePoint[]>([])

  function setCandidates(data: CandidatePoint[]) {
    candidates.value = data
  }

  async function loadCandidates() {
    try {
      candidates.value = await fetchCandidatePoints()
    } catch {
      candidates.value = []
    }
  }

  return { candidates, setCandidates, loadCandidates }
})
