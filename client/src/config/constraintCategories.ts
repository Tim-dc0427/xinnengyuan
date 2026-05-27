import type { ConstraintCategoryMeta } from '@new-energy/shared'

export const CONSTRAINT_CATEGORIES: ConstraintCategoryMeta[] = [
  {
    type: 'resource',
    name: '光伏资源禀赋',
    icon: 'Sunny',
    sortOrder: 1,
    params: [
      { key: 'annualIrradiance', label: '年水平面总辐照量', type: 'number', defaultValue: 1300, unit: 'kWh/m²', min: 0, max: 3000, step: 10 },
      { key: 'equivHours', label: '光伏发电年等效利用小时数', type: 'number', defaultValue: 1200, unit: 'h', min: 0, max: 2500, step: 10 },
      { key: 'tiltAngleMin', label: '斜面倾斜角度', type: 'number', defaultValue: 15, unit: '° (最小)', min: 0, max: 90, step: 1 },
      { key: 'tiltAngleMax', label: '斜面倾斜角度', type: 'number', defaultValue: 45, unit: '° (最大)', min: 0, max: 90, step: 1 },
      { key: 'annualSunshineHours', label: '年日照时数', type: 'number', defaultValue: 1300, unit: 'h', min: 0, max: 3000, step: 10 },
      { key: 'peakSunHours', label: '年峰值日照时数', type: 'number', defaultValue: 4, unit: 'h/d', min: 0, max: 8, step: 0.1 },
    ],
  },
  {
    type: 'grid',
    name: '电网网架约束',
    icon: 'Connection',
    sortOrder: 2,
    params: [
      { key: 'availableCapacity', label: '可开放容量', type: 'number', defaultValue: 50, unit: 'MW', min: 0, max: 1000, step: 5 },
      { key: 'shortCircuitRatio', label: '短路容量比', type: 'number', defaultValue: 10, unit: '', min: 0, max: 100, step: 1 },
      { key: 'n1PassRate', label: 'N-1通过率', type: 'number', defaultValue: 100, unit: '%', min: 0, max: 100, step: 1 },
    ],
  },
  {
    type: 'land',
    name: '土地可用性',
    icon: 'MapLocation',
    sortOrder: 3,
    params: [
      { key: 'landForbidden', label: '是否土地禁止', type: 'select', defaultValue: 'no', unit: '', options: [
        { label: '否', value: 'no' },
        { label: '是', value: 'yes' },
      ]},
      { key: 'landType', label: '土地类型', type: 'multiSelect', defaultValue: ['desert', 'gobi', 'unused'], unit: '', options: [
        { label: '荒漠', value: 'desert' },
        { label: '戈壁', value: 'gobi' },
        { label: '农用地', value: 'agricultural' },
        { label: '未利用地', value: 'unused' },
        { label: '林地', value: 'forest' },
        { label: '其他', value: 'other' },
      ]},
      { key: 'landCost', label: '土地成本', type: 'number', defaultValue: 1.5, unit: '万元/亩/年', min: 0, max: 50, step: 0.1 },
      { key: 'terrainType', label: '地形类别', type: 'multiSelect', defaultValue: ['plain'], unit: '', options: [
        { label: '平原', value: 'plain' },
        { label: '丘陵', value: 'hill' },
        { label: '山地', value: 'mountain' },
        { label: '高原', value: 'plateau' },
      ]},
    ],
  },
]

export function getDefaultCategoryValues() {
  return CONSTRAINT_CATEGORIES.map((cat) => {
    const paramValues: Record<string, any> = {}
    cat.params.forEach((p) => { paramValues[p.key] = p.defaultValue })
    return {
      categoryType: cat.type,
      paramValues,
    }
  })
}
