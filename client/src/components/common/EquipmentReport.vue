<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import type { EquipmentCapacityResult, StationOption } from '@new-energy/shared'

const props = defineProps<{
  visible: boolean
  equipment: EquipmentCapacityResult | null
  station: StationOption | null
}>()

const emit = defineEmits<{ 'update:visible': [val: boolean] }>()

const typeLabel: Record<string, string> = {
  TRANSFORMER: '变压器', BREAKER: '断路器', CABLE: '电缆', SWITCH: '开关设备',
}

const riskTag: Record<string, string> = {
  critical: '严重', warning: '关注', normal: '正常',
}

// ================== 通用计算参数 ==================
const calc = computed(() => {
  const eq = props.equipment
  if (!eq) return null
  const a = eq.assessment || {}
  const snKva = eq.ratedCapacityKva || 0
  const unKv = eq.ratedVoltageKv || 10
  const inA = eq.ratedCurrentA || (snKva > 0 ? (snKva * 1000) / (Math.sqrt(3) * unKv) : 0)
  const ukPct = a.shortCircuitImpedancePct || 5
  const ikA = eq.shortCircuitCurrentA || inA / (ukPct / 100)
  const ithA = eq.throughCurrentA || ikA * 0.6
  const loadRate = eq.loadRate || 0
  const pvMw = props.station?.installedCapacityMw || 0
  return { snKva, unKv, inA, ikA, ithA, loadRate, pvMw, ukPct }
})

const txThermal = computed(() => {
  const a = props.equipment?.assessment || {}
  const ts = a.thermalStability
  if (!ts) return null
  const passed = ts.passed
  const color = passed ? '#67c23a' : ts.ratio < 1.5 ? '#e6a23c' : '#f56c6c'
  const label = passed ? '校验通过' : ts.ratio < 1.5 ? '校验临界' : '校验不通过'
  return { ...ts, color, label }
})

const txDynamic = computed(() => {
  const a = props.equipment?.assessment || {}
  const ds = a.dynamicStability
  if (!ds) return null
  const passed = ds.passed
  const color = passed ? '#67c23a' : ds.ratio < 1.5 ? '#e6a23c' : '#f56c6c'
  const label = passed ? '校验通过' : ds.ratio < 1.5 ? '校验临界' : '校验不通过'
  return { ...ds, color, label }
})

// ================== 断路器专用 ==================
const brData = computed(() => {
  const eq = props.equipment
  if (!eq || !calc.value) return null
  const a = eq.assessment || {}
  const ratedKa = a.ratedBreakingKa || 40
  const actualKa = a.actualShortCircuitKa || (calc.value.ikA / 1000)
  const margin = ratedKa - actualKa
  const insufficient = margin < 0
  const color = insufficient ? '#f56c6c' : margin < 10 ? '#e6a23c' : '#67c23a'
  return { ratedKa, actualKa, margin, insufficient, color }
})

// ================== 电缆专用 ==================
const cbData = computed(() => {
  const eq = props.equipment
  if (!eq || !calc.value) return null
  const a = eq.assessment || {}
  const ratedAmp = a.ratedAmpacityA || eq.ratedCurrentA || 400
  const actualLoad = a.actualLoadA || (calc.value.loadRate * ratedAmp)
  const thermal = a.thermalEffectA2s || (actualLoad ** 2)
  const overload = a.isOverload || calc.value.loadRate > 0.9
  const tempMargin = a.temperatureMarginC || 90 * (1 - calc.value.loadRate)
  const color = overload ? '#f56c6c' : tempMargin < 20 ? '#e6a23c' : '#67c23a'
  return { ratedAmp, actualLoad, thermal, overload, tempMargin, color }
})

// ================== 开关设备专用 ==================
const swLongTerm = computed(() => {
  const a = props.equipment?.assessment || {}
  const lt = a.longTermCurrent
  if (!lt) return null
  const passed = lt.passed
  const color = passed ? '#67c23a' : lt.ratio < 1.2 ? '#e6a23c' : '#f56c6c'
  const label = passed ? '校验通过' : lt.ratio < 1.2 ? '校验临界' : '校验不通过'
  return { ...lt, color, label }
})
const swThermal = computed(() => {
  const a = props.equipment?.assessment || {}
  const ts = a.thermalStability
  if (!ts) return null
  const passed = ts.passed
  const color = passed ? '#67c23a' : ts.ratio < 1.5 ? '#e6a23c' : '#f56c6c'
  const label = passed ? '校验通过' : ts.ratio < 1.5 ? '校验临界' : '校验不通过'
  return { ...ts, color, label }
})
const swDynamic = computed(() => {
  const a = props.equipment?.assessment || {}
  const ds = a.dynamicStability
  if (!ds) return null
  const passed = ds.passed
  const color = passed ? '#67c23a' : ds.ratio < 1.5 ? '#e6a23c' : '#f56c6c'
  const label = passed ? '校验通过' : ds.ratio < 1.5 ? '校验临界' : '校验不通过'
  return { ...ds, color, label }
})
const swBreaking = computed(() => {
  const a = props.equipment?.assessment || {}
  const bc = a.breakingCapacity
  if (!bc) return null
  const passed = bc.passed
  const color = passed ? '#67c23a' : bc.ratio < 1.5 ? '#e6a23c' : '#f56c6c'
  const label = passed ? '校验通过' : bc.ratio < 1.5 ? '校验临界' : '校验不通过'
  return { ...bc, color, label }
})

// ================== 结论文案 ==================
const conclusion = computed(() => {
  const eq = props.equipment
  if (!eq) return null
  switch (eq.equipmentType) {
    case 'TRANSFORMER': {
      const thermalOk = txThermal.value?.passed ?? true
      const dynamicOk = txDynamic.value?.passed ?? true
      const allOk = thermalOk && dynamicOk
      if (allOk) return { ok: true, text: '变压器承载能力满足要求：热稳定校验通过（短路热效应在设备耐受范围内），动稳定校验通过（短路冲击电流在峰值耐受范围内）。', color: '#67c23a' }
      if (!thermalOk && !dynamicOk) return { ok: false, text: '变压器热稳定与动稳定校验均不通过，短路耐受能力不足，存在严重安全隐患。建议：① 核查系统短路容量是否超出设备耐受极限；② 加装限流电抗器；③ 更换更高短路耐受等级的变压器。', color: '#f56c6c' }
      const failed = !thermalOk ? '热稳定' : '动稳定'
      const action = !thermalOk ? '核查短路电流水平，必要时加装限流措施或更换更高热稳定等级的变压器' : '核查系统短路冲击水平，必要时更换更高峰值耐受等级的变压器'
      return { ok: false, text: `变压器${failed}校验不通过。建议：${action}。`, color: '#e6a23c' }
    }
    case 'BREAKER': {
      if (!brData.value) return null
      if (!brData.value.insufficient) return { ok: true, text: '断路器额定分断能力 ' + brData.value.ratedKa + ' kA 大于实际短路电流 ' + brData.value.actualKa.toFixed(2) + ' kA，安全裕度 ' + brData.value.margin.toFixed(1) + ' kA，满足要求。', color: '#67c23a' }
      return { ok: false, text: '断路器额定分断能力 ' + brData.value.ratedKa + ' kA 小于实际短路电流 ' + brData.value.actualKa.toFixed(2) + ' kA，分断能力不足。建议更换额定分断能力不低于 ' + Math.ceil(brData.value.actualKa / 5) * 5 + ' kA 的断路器。', color: '#f56c6c' }
    }
    case 'CABLE': {
      if (!cbData.value) return null
      if (!cbData.value.overload) return { ok: true, text: '电缆载流量满足要求，额定 ' + cbData.value.ratedAmp.toFixed(0) + ' A > 实际 ' + cbData.value.actualLoad.toFixed(1) + ' A，温升裕度 ' + cbData.value.tempMargin.toFixed(1) + ' ℃。', color: '#67c23a' }
      return { ok: false, text: '电缆载流量超标，实际负载 ' + cbData.value.actualLoad.toFixed(1) + ' A 超过额定载流量 ' + cbData.value.ratedAmp.toFixed(0) + ' A，绝缘温升裕度仅 ' + cbData.value.tempMargin.toFixed(1) + ' ℃。建议更换额定载流量不低于 ' + Math.ceil(cbData.value.actualLoad * 1.25) + ' A 的电缆。', color: '#f56c6c' }
    }
    case 'SWITCH': {
      const a = props.equipment?.assessment || {}
      const verdict: string = a.overallVerdict || '—'
      const verdictOk = verdict.startsWith('满足')
      if (verdictOk) return { ok: true, text: verdict, color: '#67c23a' }
      const verdictCond = verdict.startsWith('有条件')
      if (verdictCond) return { ok: true, text: verdict, color: '#e6a23c' }
      return { ok: false, text: verdict, color: '#f56c6c' }
    }
    default: return null
  }
})

const reportRef = ref<HTMLElement | null>(null)

async function handleExportPdf() {
  if (!reportRef.value) return
  try {
    const canvas = await html2canvas(reportRef.value, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 10
    const imgWidth = pageWidth - margin * 2
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    const pageInnerHeight = pageHeight - margin * 2

    let heightLeft = imgHeight
    let position = margin

    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
    heightLeft -= pageInnerHeight

    while (heightLeft > 0) {
      position -= pageInnerHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
      heightLeft -= pageInnerHeight
    }
    const name = props.equipment?.equipmentName || '设备报告'
    pdf.save(`${name}_评估报告.pdf`)
    ElMessage.success('PDF 导出成功')
  } catch {
    ElMessage.error('PDF 导出失败')
  }
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
    :title="equipment ? typeLabel[equipment.equipmentType] + '评估报告' : '设备评估报告'"
    width="820px" top="3vh" :close-on-click-modal="false"
  >
    <div ref="reportRef" class="report-container" v-if="equipment && calc">
      <!-- ═══════════ 一、设备基础信息 ═══════════ -->
      <div class="report-section">
        <h3 class="report-h3">一、设备基础信息</h3>
        <table class="report-table">
          <tr><td class="label">设备名称</td><td>{{ equipment.equipmentName }}</td><td class="label">设备类型</td><td>{{ typeLabel[equipment.equipmentType] || equipment.equipmentType }}</td></tr>
          <tr><td class="label">设备型号</td><td>{{ equipment.modelNumber || '-' }}</td><td class="label">制造厂家</td><td>{{ equipment.manufacturer || '-' }}</td></tr>
          <tr><td class="label">额定容量</td><td>{{ calc.snKva.toFixed(0) }} kVA</td><td class="label">额定电压</td><td>{{ calc.unKv }} kV</td></tr>
          <tr><td class="label">额定电流</td><td>{{ calc.inA.toFixed(1) }} A</td><td class="label">短路阻抗 Uk%</td><td>{{ calc.ukPct }}%（设备铭牌值）</td></tr>
          <tr><td class="label">安装日期</td><td>{{ equipment.installationDate || '-' }}</td><td class="label">设计寿命</td><td>{{ equipment.designLifeYears || '-' }} 年</td></tr>
          <tr v-if="station"><td class="label">所属电站</td><td colspan="3">{{ station.stationName }}（装机 {{ station.installedCapacityMw }} MW，并网 {{ station.gridConnectionVoltageKv }} kV）</td></tr>
        </table>
      </div>

      <!-- ═══════════ 二、短路电流与穿越电流计算 ═══════════ -->
      <div class="report-section">
        <h3 class="report-h3">二、短路电流与穿越电流计算</h3>
        <div class="formula-box">
          <p><b>计算参数：</b></p>
          <p>S<sub>n</sub> = {{ calc.snKva.toFixed(0) }} kVA，U<sub>n</sub> = {{ calc.unKv }} kV，U<sub>k</sub>% = {{ calc.ukPct }}%（设备铭牌值）</p>
          <p style="margin-top:8px"><b>计算过程：</b></p>
          <p>① 额定电流 I<sub>n</sub> = S<sub>n</sub> / (√3 × U<sub>n</sub>) = {{ calc.snKva.toFixed(0) }} / (1.732 × {{ calc.unKv }}) = <b>{{ calc.inA.toFixed(1) }} A</b></p>
          <p>② 三相短路电流 I<sub>k</sub> = I<sub>n</sub> / (U<sub>k</sub>% / 100) = {{ calc.inA.toFixed(1) }} / {{ (calc.ukPct / 100).toFixed(3) }} = <b>{{ (calc.ikA / 1000).toFixed(2) }} kA</b></p>
          <p>③ 穿越电流 I<sub>th</sub> = I<sub>k</sub> × 0.6 = <b>{{ (calc.ithA / 1000).toFixed(2) }} kA</b>（保守估算，考虑故障穿越电流衰减特性）</p>
        </div>
      </div>

      <!-- ═══════════ 三、专项评估 ═══════════ -->

      <!-- 变压器 — 热稳定校验 -->
      <div v-if="equipment.equipmentType === 'TRANSFORMER' && txThermal" class="report-section">
        <h3 class="report-h3">三、热稳定校验</h3>
        <div class="formula-box">
          <p><b>校验原理：</b>短路电流通过变压器绕组时产生热效应 Q = I²t，不得超出设备热稳定耐受能力 Q<sub>rated</sub> = I<sub>th</sub>² × t<sub>th</sub></p>
          <p style="margin-top:8px"><b>计算参数：</b></p>
          <p>三相短路电流 I<sub>k</sub> = {{ txThermal.shortCircuitCurrentKa }} kA</p>
          <p>等效短路时间 t<sub>eq</sub> = {{ txThermal.equivalentTimeS }}s（后备保护 0.5s + 断路器分闸 0.1s）</p>
          <p>设备热稳定耐受电流 I<sub>th</sub> = {{ txThermal.ratedThermalWithstandCurrentKa }} kA / {{ txThermal.ratedThermalDurationS }}s</p>
          <p style="margin-top:8px"><b>校验过程：</b></p>
          <p>① 短路热效应 Q<sub>sc</sub> = I<sub>k</sub>² × t<sub>eq</sub> = {{ txThermal.shortCircuitCurrentKa }}² × {{ txThermal.equivalentTimeS }} = <b>{{ txThermal.thermalEffectKa2s }} kA²·s</b></p>
          <p>② 设备耐受能力 Q<sub>rated</sub> = <b>{{ txThermal.ratedThermalWithstandKa2s }} kA²·s</b></p>
          <p>③ 校验比 = Q<sub>sc</sub> / Q<sub>rated</sub> = {{ txThermal.thermalEffectKa2s }} / {{ txThermal.ratedThermalWithstandKa2s }} = <b :style="{ color: txThermal.color }">{{ txThermal.ratio }}</b></p>
          <p style="margin-top:8px"><b>判定标准：</b></p>
          <table class="grade-table">
            <tr><th>校验比</th><th>状态</th><th>说明</th></tr>
            <tr :class="{ active: txThermal.ratio < 1 }"><td>&lt; 1.0</td><td style="color:#67c23a">通过</td><td>设备短路热稳定能力充足</td></tr>
            <tr :class="{ active: txThermal.ratio >= 1 && txThermal.ratio < 1.5 }"><td>1.0 ~ 1.5</td><td style="color:#e6a23c">临界</td><td>短路热效应接近设备耐受上限</td></tr>
            <tr :class="{ active: txThermal.ratio >= 1.5 }"><td>≥ 1.5</td><td style="color:#f56c6c">不通过</td><td>短路热效应超过设备耐受能力，存在热击穿风险</td></tr>
          </table>
          <p style="margin-top:8px">校验结果：<b :style="{ color: txThermal.color, fontSize: '15px' }">{{ txThermal.label }}</b></p>
        </div>
      </div>

      <!-- 变压器 — 动稳定校验 -->
      <div v-if="equipment.equipmentType === 'TRANSFORMER' && txDynamic" class="report-section">
        <h3 class="report-h3">四、动稳定校验</h3>
        <div class="formula-box">
          <p><b>校验原理：</b>短路冲击电流产生巨大电动力作用于绕组，峰值不得超过设备动稳定耐受能力 i<sub>peak</sub> ≤ i<sub>peak,rated</sub></p>
          <p style="margin-top:8px"><b>计算参数：</b></p>
          <p>三相短路电流有效值 I<sub>k</sub> = {{ txDynamic.shortCircuitCurrentKa || (calc.ikA / 1000).toFixed(2) }} kA</p>
          <p>冲击系数 K<sub>imp</sub> = {{ txDynamic.impulseCoefficient || 1.8 }}（高压系统标准值，对应 X/R ≥ 14）</p>
          <p>设备峰值耐受电流 i<sub>peak,rated</sub> = {{ txDynamic.ratedPeakWithstandCurrentKa }} kA</p>
          <p style="margin-top:8px"><b>校验过程：</b></p>
          <p>① 短路冲击电流 i<sub>peak</sub> = √2 × K<sub>imp</sub> × I<sub>k</sub> = 1.414 × {{ txDynamic.impulseCoefficient || 1.8 }} × {{ txDynamic.shortCircuitCurrentKa || (calc.ikA / 1000).toFixed(2) }} = <b>{{ txDynamic.peakShortCircuitCurrentKa }} kA</b></p>
          <p>② 校验比 = i<sub>peak</sub> / i<sub>peak,rated</sub> = {{ txDynamic.peakShortCircuitCurrentKa }} / {{ txDynamic.ratedPeakWithstandCurrentKa }} = <b :style="{ color: txDynamic.color }">{{ txDynamic.ratio }}</b></p>
          <p style="margin-top:8px"><b>判定标准：</b></p>
          <table class="grade-table">
            <tr><th>校验比</th><th>状态</th><th>说明</th></tr>
            <tr :class="{ active: txDynamic.ratio < 1 }"><td>&lt; 1.0</td><td style="color:#67c23a">通过</td><td>设备动稳定能力充足，可承受短路电动力冲击</td></tr>
            <tr :class="{ active: txDynamic.ratio >= 1 && txDynamic.ratio < 1.5 }"><td>1.0 ~ 1.5</td><td style="color:#e6a23c">临界</td><td>短路冲击电流接近设备耐受上限</td></tr>
            <tr :class="{ active: txDynamic.ratio >= 1.5 }"><td>≥ 1.5</td><td style="color:#f56c6c">不通过</td><td>短路冲击电流超过设备耐受能力，存在绕组变形风险</td></tr>
          </table>
          <p style="margin-top:8px">校验结果：<b :style="{ color: txDynamic.color, fontSize: '15px' }">{{ txDynamic.label }}</b></p>
        </div>
      </div>

      <!-- 断路器 -->
      <div v-if="equipment.equipmentType === 'BREAKER' && brData" class="report-section">
        <h3 class="report-h3">三、短路分断能力校验</h3>
        <div class="formula-box">
          <p><b>校验参数：</b></p>
          <p>光伏接入后三相短路电流 I<sub>k</sub> = <b>{{ brData.actualKa.toFixed(2) }} kA</b></p>
          <p>断路器额定短路分断能力 I<sub>cu</sub> = <b>{{ brData.ratedKa }} kA</b></p>
          <p style="margin-top:8px"><b>校验过程：</b></p>
          <p>安全裕度 Δ = I<sub>cu</sub> − I<sub>k</sub> = {{ brData.ratedKa }} − {{ brData.actualKa.toFixed(2) }} = <b :style="{ color: brData.color }">{{ brData.margin.toFixed(1) }} kA</b></p>
          <p style="margin-top:8px"><b>判定标准：</b></p>
          <table class="grade-table">
            <tr><th>裕度</th><th>状态</th><th>说明</th></tr>
            <tr :class="{ active: brData.margin >= 10 }"><td>Δ ≥ 10 kA</td><td style="color:#67c23a">充足</td><td>分断能力充裕，可安全分断光伏接入后最大短路电流</td></tr>
            <tr :class="{ active: brData.margin >= 0 && brData.margin < 10 }"><td>0 ≤ Δ &lt; 10 kA</td><td style="color:#e6a23c">临界</td><td>分断能力接近实际短路水平，建议制定更换计划</td></tr>
            <tr :class="{ active: brData.margin < 0 }"><td>Δ &lt; 0</td><td style="color:#f56c6c">不足</td><td>分断能力低于实际短路电流，无法安全分断故障</td></tr>
          </table>
          <p style="margin-top:8px">校验结果：<b :style="{ color: brData.color, fontSize: '15px' }">{{ brData.insufficient ? '分断能力不足' : brData.margin < 10 ? '分断能力临界' : '分断能力充足' }}</b></p>
        </div>
      </div>

      <!-- 电缆 -->
      <div v-if="equipment.equipmentType === 'CABLE' && cbData" class="report-section">
        <h3 class="report-h3">三、载流量与温升校验</h3>
        <div class="formula-box">
          <p><b>校验参数：</b></p>
          <p>电缆额定载流量 I<sub>z</sub> = <b>{{ cbData.ratedAmp.toFixed(0) }} A</b></p>
          <p>光伏接入后实际负载电流 I<sub>L</sub> = <b>{{ cbData.actualLoad.toFixed(1) }} A</b></p>
          <p>短路热效应 Q = I²t = {{ cbData.thermal.toFixed(0) }} A²s</p>
          <p>绝缘耐温等级：90℃（XLPE交联聚乙烯）</p>
          <p style="margin-top:8px"><b>校验过程：</b></p>
          <p>① 载流量裕度 = (I<sub>z</sub> − I<sub>L</sub>) / I<sub>z</sub> = <b :style="{ color: cbData.color }">{{ ((1 - cbData.actualLoad / cbData.ratedAmp) * 100).toFixed(1) }}%</b></p>
          <p>② 绝缘温升裕度 = 90℃ − 预估运行温度 = <b :style="{ color: cbData.color }">{{ cbData.tempMargin.toFixed(1) }} ℃</b></p>
          <p style="margin-top:8px"><b>判定标准：</b></p>
          <table class="grade-table">
            <tr><th>条件</th><th>状态</th><th>说明</th></tr>
            <tr :class="{ active: !cbData.overload && cbData.tempMargin >= 20 }"><td>载流量达标且温升裕度 ≥ 20℃</td><td style="color:#67c23a">正常</td><td>电缆载流量和温升均满足要求</td></tr>
            <tr :class="{ active: !cbData.overload && cbData.tempMargin < 20 }"><td>载流量达标但温升裕度 &lt; 20℃</td><td style="color:#e6a23c">关注</td><td>温升裕度偏小，需监测电缆运行温度</td></tr>
            <tr :class="{ active: cbData.overload }"><td>实际负载 &gt; 额定载流量</td><td style="color:#f56c6c">超标</td><td>载流量超标，绝缘加速老化，存在热击穿风险</td></tr>
          </table>
          <p style="margin-top:8px">校验结果：<b :style="{ color: cbData.color, fontSize: '15px' }">{{ cbData.overload ? '载流量超标' : cbData.tempMargin < 20 ? '温升裕度偏小' : '校验通过' }}</b></p>
        </div>
      </div>

      <!-- 开关设备 — 四维校验 -->
      <div v-if="equipment.equipmentType === 'SWITCH' && swLongTerm" class="report-section">
        <h3 class="report-h3">三、长期载流能力校验</h3>
        <div class="formula-box">
          <p><b>校验参数：</b></p>
          <p>开关设备额定电流 I<sub>r</sub> = <b>{{ swLongTerm.ratedCurrentA }} A</b></p>
          <p>实际运行负载电流 I<sub>L</sub> = <b>{{ swLongTerm.actualLoadA }} A</b></p>
          <p style="margin-top:8px"><b>校验过程：</b></p>
          <p>校验比 = I<sub>L</sub> / I<sub>r</sub> = {{ swLongTerm.actualLoadA }} / {{ swLongTerm.ratedCurrentA }} = <b :style="{ color: swLongTerm.color }">{{ swLongTerm.ratio }}</b></p>
          <p style="margin-top:8px"><b>判定标准：</b></p>
          <table class="grade-table">
            <tr><th>校验比</th><th>状态</th><th>说明</th></tr>
            <tr :class="{ active: swLongTerm.ratio < 1 }"><td>&lt; 1.0</td><td style="color:#67c23a">通过</td><td>长期运行电流在额定范围内</td></tr>
            <tr :class="{ active: swLongTerm.ratio >= 1 && swLongTerm.ratio < 1.2 }"><td>1.0 ~ 1.2</td><td style="color:#e6a23c">临界</td><td>长期运行电流接近或略超额定值</td></tr>
            <tr :class="{ active: swLongTerm.ratio >= 1.2 }"><td>≥ 1.2</td><td style="color:#f56c6c">不通过</td><td>长期过载运行，触头温升超标风险</td></tr>
          </table>
          <p style="margin-top:8px">校验结果：<b :style="{ color: swLongTerm.color, fontSize: '15px' }">{{ swLongTerm.label }}</b></p>
        </div>
      </div>

      <div v-if="equipment.equipmentType === 'SWITCH' && swThermal" class="report-section">
        <h3 class="report-h3">四、短路热稳定承载力校验</h3>
        <div class="formula-box">
          <p><b>校验参数：</b></p>
          <p>三相短路电流 I<sub>k</sub> = {{ swThermal.shortCircuitCurrentKa }} kA</p>
          <p>等效短路时间 t<sub>eq</sub> = {{ swThermal.equivalentTimeS }}s</p>
          <p>设备热稳定耐受 I<sub>th</sub> = {{ swThermal.ratedThermalWithstandCurrentKa }} kA / {{ swThermal.ratedThermalDurationS }}s</p>
          <p style="margin-top:8px"><b>校验过程：</b></p>
          <p>① 短路热效应 Q<sub>sc</sub> = I<sub>k</sub>² × t<sub>eq</sub> = {{ swThermal.shortCircuitCurrentKa }}² × {{ swThermal.equivalentTimeS }} = <b>{{ swThermal.thermalEffectKa2s }} kA²·s</b></p>
          <p>② 设备耐受能力 Q<sub>rated</sub> = <b>{{ swThermal.ratedThermalWithstandKa2s }} kA²·s</b></p>
          <p>③ 校验比 = Q<sub>sc</sub> / Q<sub>rated</sub> = <b :style="{ color: swThermal.color }">{{ swThermal.ratio }}</b></p>
          <p style="margin-top:8px"><b>判定标准：</b></p>
          <table class="grade-table">
            <tr><th>校验比</th><th>状态</th><th>说明</th></tr>
            <tr :class="{ active: swThermal.ratio < 1 }"><td>&lt; 1.0</td><td style="color:#67c23a">通过</td><td>设备短路热稳定能力充足</td></tr>
            <tr :class="{ active: swThermal.ratio >= 1 && swThermal.ratio < 1.5 }"><td>1.0 ~ 1.5</td><td style="color:#e6a23c">临界</td><td>短路热效应接近设备耐受上限</td></tr>
            <tr :class="{ active: swThermal.ratio >= 1.5 }"><td>≥ 1.5</td><td style="color:#f56c6c">不通过</td><td>短路热效应超过设备耐受，存在热击穿风险</td></tr>
          </table>
          <p style="margin-top:8px">校验结果：<b :style="{ color: swThermal.color, fontSize: '15px' }">{{ swThermal.label }}</b></p>
        </div>
      </div>

      <div v-if="equipment.equipmentType === 'SWITCH' && swDynamic" class="report-section">
        <h3 class="report-h3">五、短路动稳定承载力校验</h3>
        <div class="formula-box">
          <p><b>校验参数：</b></p>
          <p>三相短路电流 I<sub>k</sub> = {{ swDynamic.shortCircuitCurrentKa }} kA</p>
          <p>冲击系数 K<sub>imp</sub> = {{ swDynamic.impulseCoefficient }}（高压系统标准值）</p>
          <p>设备峰值耐受电流 i<sub>peak,rated</sub> = {{ swDynamic.ratedPeakWithstandCurrentKa }} kA</p>
          <p style="margin-top:8px"><b>校验过程：</b></p>
          <p>① 短路冲击电流 i<sub>peak</sub> = √2 × K<sub>imp</sub> × I<sub>k</sub> = <b>{{ swDynamic.peakShortCircuitCurrentKa }} kA</b></p>
          <p>② 校验比 = i<sub>peak</sub> / i<sub>peak,rated</sub> = <b :style="{ color: swDynamic.color }">{{ swDynamic.ratio }}</b></p>
          <p style="margin-top:8px"><b>判定标准：</b></p>
          <table class="grade-table">
            <tr><th>校验比</th><th>状态</th><th>说明</th></tr>
            <tr :class="{ active: swDynamic.ratio < 1 }"><td>&lt; 1.0</td><td style="color:#67c23a">通过</td><td>设备动稳定能力充足</td></tr>
            <tr :class="{ active: swDynamic.ratio >= 1 && swDynamic.ratio < 1.5 }"><td>1.0 ~ 1.5</td><td style="color:#e6a23c">临界</td><td>短路冲击电流接近设备耐受上限</td></tr>
            <tr :class="{ active: swDynamic.ratio >= 1.5 }"><td>≥ 1.5</td><td style="color:#f56c6c">不通过</td><td>短路冲击电流超过设备耐受，存在触头熔焊风险</td></tr>
          </table>
          <p style="margin-top:8px">校验结果：<b :style="{ color: swDynamic.color, fontSize: '15px' }">{{ swDynamic.label }}</b></p>
        </div>
      </div>

      <div v-if="equipment.equipmentType === 'SWITCH' && swBreaking" class="report-section">
        <h3 class="report-h3">六、开断能力校验</h3>
        <div class="formula-box">
          <p><b>校验参数：</b></p>
          <p>三相短路电流 I<sub>k</sub> = {{ swBreaking.shortCircuitCurrentKa }} kA</p>
          <p>设备额定开断电流 I<sub>break</sub> = <b>{{ swBreaking.ratedBreakingCurrentKa }} kA</b></p>
          <p style="margin-top:8px"><b>校验过程：</b></p>
          <p>校验比 = I<sub>k</sub> / I<sub>break</sub> = {{ swBreaking.shortCircuitCurrentKa }} / {{ swBreaking.ratedBreakingCurrentKa }} = <b :style="{ color: swBreaking.color }">{{ swBreaking.ratio }}</b></p>
          <p style="margin-top:8px"><b>判定标准：</b></p>
          <table class="grade-table">
            <tr><th>校验比</th><th>状态</th><th>说明</th></tr>
            <tr :class="{ active: swBreaking.ratio < 1 }"><td>&lt; 1.0</td><td style="color:#67c23a">通过</td><td>开断能力充足，可安全分断系统最大短路电流</td></tr>
            <tr :class="{ active: swBreaking.ratio >= 1 && swBreaking.ratio < 1.5 }"><td>1.0 ~ 1.5</td><td style="color:#e6a23c">临界</td><td>开断能力接近系统短路水平上限</td></tr>
            <tr :class="{ active: swBreaking.ratio >= 1.5 }"><td>≥ 1.5</td><td style="color:#f56c6c">不通过</td><td>开断能力不足，无法安全分断故障电流</td></tr>
          </table>
          <p style="margin-top:8px">校验结果：<b :style="{ color: swBreaking.color, fontSize: '15px' }">{{ swBreaking.label }}</b></p>
        </div>
      </div>

      <!-- ═══════════ 结论分析 ═══════════ -->
      <div v-if="conclusion" class="report-section">
        <h3 class="report-h3">{{ equipment.equipmentType === 'SWITCH' ? '七' : equipment.equipmentType === 'TRANSFORMER' ? '五' : '四' }}、结论分析</h3>
        <div class="conclusion-box">
          <p>本报告对 <b>{{ equipment.equipmentName }}</b>（{{ typeLabel[equipment.equipmentType] || equipment.equipmentType }}）在光伏电站 <b>{{ station?.stationName || equipment.stationName || '-' }}</b> 接入后进行专项评估，结论如下：</p>
          <p style="margin-top:8px">
            ① <b>短路耐受</b>：三相短路电流 {{ (calc.ikA / 1000).toFixed(2) }} kA，穿越电流 {{ (calc.ithA / 1000).toFixed(2) }} kA。
          </p>
          <p v-if="equipment.equipmentType === 'TRANSFORMER' && txThermal">
            ② <b>热稳定校验</b>：Q<sub>sc</sub> = {{ txThermal.thermalEffectKa2s }} kA²·s / Q<sub>rated</sub> = {{ txThermal.ratedThermalWithstandKa2s }} kA²·s，校验比 {{ txThermal.ratio }}，
            <span :style="{ color: txThermal.color, fontWeight: 600 }">{{ txThermal.label }}</span>
          </p>
          <p v-if="equipment.equipmentType === 'TRANSFORMER' && txDynamic">
            ③ <b>动稳定校验</b>：i<sub>peak</sub> = {{ txDynamic.peakShortCircuitCurrentKa }} kA / i<sub>peak,rated</sub> = {{ txDynamic.ratedPeakWithstandCurrentKa }} kA，校验比 {{ txDynamic.ratio }}，
            <span :style="{ color: txDynamic.color, fontWeight: 600 }">{{ txDynamic.label }}</span>
          </p>
          <p>
            <template v-if="equipment.equipmentType === 'SWITCH'">④</template>
            <template v-else-if="equipment.equipmentType === 'TRANSFORMER'">③</template>
            <template v-else>②</template>
            <b> 综合评估</b>：<span :style="{ color: conclusion.color, fontWeight: 600 }">{{ conclusion.text }}</span>
          </p>
          <p>
            <template v-if="equipment.equipmentType === 'SWITCH'">⑤</template>
            <template v-else-if="equipment.equipmentType === 'TRANSFORMER'">④</template>
            <template v-else>③</template>
            <b> 综合风险等级</b>：
            <el-tag v-if="equipment.riskLevel === 'critical'" type="danger" size="small">严重</el-tag>
            <el-tag v-else-if="equipment.riskLevel === 'warning'" type="warning" size="small">关注</el-tag>
            <el-tag v-else type="success" size="small">正常</el-tag>
          </p>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer no-print">
        <el-button @click="emit('update:visible', false)">关闭</el-button>
        <el-button type="primary" @click="handleExportPdf">导出 PDF</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.report-container { font-size: 13px; color: #303133; line-height: 1.8; }
.report-section { margin-bottom: 20px; }
.report-h3 { font-size: 15px; margin: 0 0 10px 0; padding-bottom: 6px; border-bottom: 1px solid #dcdfe6; }
.report-table { width: 100%; border-collapse: collapse; }
.report-table td { padding: 4px 8px; border: 1px solid #e4e7ed; font-size: 12px; }
.report-table td.label { background: #f5f7fa; width: 100px; color: #606266; }
.formula-box { background: #fafafa; border: 1px solid #e4e7ed; border-radius: 4px; padding: 12px 16px; font-size: 13px; }
.formula-box p { margin: 3px 0; }
.grade-table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12px; }
.grade-table th, .grade-table td { padding: 4px 8px; border: 1px solid #e4e7ed; }
.grade-table th { background: #f5f7fa; }
.grade-table tr.active { font-weight: 600; background: #fdf6ec; }
.conclusion-box { background: #fafafa; border: 1px solid #e4e7ed; border-radius: 4px; padding: 12px 16px; font-size: 13px; line-height: 2; }
.conclusion-box p { margin: 4px 0; }
</style>
