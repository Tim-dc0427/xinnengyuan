<script setup lang="ts">
import { computed } from 'vue'
import type { EquipmentCapacityResult, StationOption } from '@new-energy/shared'

const props = defineProps<{
  visible: boolean
  equipment: EquipmentCapacityResult | null
  station: StationOption | null
}>()

const emit = defineEmits<{ 'update:visible': [val: boolean] }>()

const UK_PCT = 5

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
  const snKva = eq.ratedCapacityKva || 0
  const unKv = eq.ratedVoltageKv || 10
  const inA = eq.ratedCurrentA || (snKva > 0 ? (snKva * 1000) / (Math.sqrt(3) * unKv) : 0)
  const ikA = eq.shortCircuitCurrentA || inA / (UK_PCT / 100)
  const ithA = eq.throughCurrentA || ikA * 0.6
  const loadRate = eq.loadRate || 0
  const pvMw = props.station?.installedCapacityMw || 0
  return { snKva, unKv, inA, ikA, ithA, loadRate, pvMw, ukPct: UK_PCT }
})

// ================== 变压器专用 ==================
const txData = computed(() => {
  if (!calc.value) return null
  const { snKva, unKv, inA, ikA, ithA, loadRate, pvMw } = calc.value
  const spvKva = pvMw * 1000 / 0.9
  const marginPct = +((1 - loadRate) * 100).toFixed(1)
  let grade: string; let color: string
  if (loadRate <= 0.8) { grade = '正常（裕度充足）'; color = '#67c23a' }
  else if (loadRate <= 1.0) { grade = '关注（接近满载）'; color = '#e6a23c' }
  else { grade = '严重（过载运行）'; color = '#f56c6c' }
  return { spvKva, marginPct, grade, color }
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
const swData = computed(() => {
  const eq = props.equipment
  if (!eq || !calc.value) return null
  const a = eq.assessment || {}
  const ratedI = a.ratedThroughCurrentA || eq.ratedCurrentA || 0
  const actualI = a.actualThroughCurrentA || calc.value.ithA
  const marginPct = ratedI > 0 ? +((1 - actualI / ratedI) * 100).toFixed(1) : 0
  const insufficient = a.isInsufficient || actualI > ratedI
  const color = insufficient ? '#f56c6c' : marginPct < 15 ? '#e6a23c' : '#67c23a'
  return { ratedI, actualI, marginPct, insufficient, color }
})

// ================== 结论文案 ==================
const conclusion = computed(() => {
  const eq = props.equipment
  if (!eq) return null
  switch (eq.equipmentType) {
    case 'TRANSFORMER': {
      if (!txData.value) return null
      if (calc.value!.loadRate <= 0.8) return { ok: true, text: '变压器承载能力满足光伏接入要求，容量裕度 ' + txData.value.marginPct + '%，无需增容。', color: '#67c23a' }
      if (calc.value!.loadRate <= 1.0) return { ok: false, text: '变压器接近满载，建议增加负载监测频次，如光伏出力持续增长应评估更换更大容量变压器。', color: '#e6a23c' }
      return { ok: false, text: '变压器已过载运行，存在安全隐患。建议：① 限制光伏最大出力至 ' + (calc.value!.snKva * 0.9 * 0.9).toFixed(0) + ' kW 以下；② 更换额定容量不低于 ' + (txData.value.spvKva * 1.2).toFixed(0) + ' kVA 的变压器。', color: '#f56c6c' }
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
      if (!swData.value) return null
      if (!swData.value.insufficient) return { ok: true, text: '开关设备额定电流 ' + swData.value.ratedI.toFixed(0) + ' A 大于穿越电流 ' + swData.value.actualI.toFixed(0) + ' A，电流裕度 ' + swData.value.marginPct + '%，承载力满足要求。', color: '#67c23a' }
      return { ok: false, text: '开关设备额定电流 ' + swData.value.ratedI.toFixed(0) + ' A 小于穿越电流 ' + swData.value.actualI.toFixed(0) + ' A，承载力不足。建议更换额定电流不低于 ' + Math.ceil(swData.value.actualI * 1.2) + ' A 的开关设备。', color: '#f56c6c' }
    }
    default: return null
  }
})

function handlePrint() { window.print() }
</script>

<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
    :title="equipment ? typeLabel[equipment.equipmentType] + '评估报告' : '设备评估报告'"
    width="820px" top="3vh" :close-on-click-modal="false"
  >
    <div class="report-container" v-if="equipment && calc">
      <!-- ═══════════ 一、设备基础信息 ═══════════ -->
      <div class="report-section">
        <h3 class="report-h3">一、设备基础信息</h3>
        <table class="report-table">
          <tr><td class="label">设备名称</td><td>{{ equipment.equipmentName }}</td><td class="label">设备类型</td><td>{{ typeLabel[equipment.equipmentType] || equipment.equipmentType }}</td></tr>
          <tr><td class="label">设备型号</td><td>{{ equipment.modelNumber || '-' }}</td><td class="label">制造厂家</td><td>{{ equipment.manufacturer || '-' }}</td></tr>
          <tr><td class="label">额定容量</td><td>{{ calc.snKva.toFixed(0) }} kVA</td><td class="label">额定电压</td><td>{{ calc.unKv }} kV</td></tr>
          <tr><td class="label">额定电流</td><td>{{ calc.inA.toFixed(1) }} A</td><td class="label">短路阻抗 Uk%</td><td>{{ calc.ukPct }}%（标准值）</td></tr>
          <tr><td class="label">安装日期</td><td>{{ equipment.installationDate || '-' }}</td><td class="label">设计寿命</td><td>{{ equipment.designLifeYears || '-' }} 年</td></tr>
          <tr v-if="station"><td class="label">所属电站</td><td colspan="3">{{ station.stationName }}（装机 {{ station.installedCapacityMw }} MW，并网 {{ station.gridConnectionVoltageKv }} kV）</td></tr>
        </table>
      </div>

      <!-- ═══════════ 二、短路电流与穿越电流计算 ═══════════ -->
      <div class="report-section">
        <h3 class="report-h3">二、短路电流与穿越电流计算</h3>
        <div class="formula-box">
          <p><b>计算参数：</b></p>
          <p>S<sub>n</sub> = {{ calc.snKva.toFixed(0) }} kVA，U<sub>n</sub> = {{ calc.unKv }} kV，U<sub>k</sub>% = {{ calc.ukPct }}%（GB/T 1094 标准值）</p>
          <p style="margin-top:8px"><b>计算过程：</b></p>
          <p>① 额定电流 I<sub>n</sub> = S<sub>n</sub> / (√3 × U<sub>n</sub>) = {{ calc.snKva.toFixed(0) }} / (1.732 × {{ calc.unKv }}) = <b>{{ calc.inA.toFixed(1) }} A</b></p>
          <p>② 三相短路电流 I<sub>k</sub> = I<sub>n</sub> / U<sub>k</sub>% = {{ calc.inA.toFixed(1) }} / 0.05 = <b>{{ (calc.ikA / 1000).toFixed(2) }} kA</b></p>
          <p>③ 穿越电流 I<sub>th</sub> = I<sub>k</sub> × 0.6 = <b>{{ (calc.ithA / 1000).toFixed(2) }} kA</b>（保守估算，考虑故障穿越电流衰减特性）</p>
        </div>
      </div>

      <!-- ═══════════ 三、专项评估 ═══════════ -->

      <!-- 变压器 -->
      <div v-if="equipment.equipmentType === 'TRANSFORMER' && txData" class="report-section">
        <h3 class="report-h3">三、承载等级评估过程</h3>
        <div class="formula-box">
          <p><b>评估参数：</b></p>
          <p>光伏装机 P<sub>pv</sub> = {{ calc.pvMw }} MW，功率因数 cosφ = 0.9</p>
          <p style="margin-top:8px"><b>计算过程：</b></p>
          <p>① 光伏接入视在功率 S<sub>pv</sub> = P<sub>pv</sub> / cosφ = {{ calc.pvMw }} × 1000 / 0.9 = <b>{{ txData.spvKva.toFixed(0) }} kVA</b></p>
          <p>② 负载率 η = S<sub>pv</sub> / S<sub>n</sub> = {{ txData.spvKva.toFixed(0) }} / {{ calc.snKva.toFixed(0) }} = <b :style="{ color: txData.color }">{{ (txData.spvKva / calc.snKva * 100).toFixed(1) }}%</b></p>
          <p style="margin-top:8px"><b>承载等级判定标准：</b></p>
          <table class="grade-table">
            <tr><th>负载率</th><th>等级</th><th>说明</th></tr>
            <tr :class="{ active: (txData.spvKva / calc.snKva) <= 0.8 }"><td>η ≤ 80%</td><td style="color:#67c23a">正常</td><td>容量裕度充足，可安全承载光伏接入</td></tr>
            <tr :class="{ active: (txData.spvKva / calc.snKva) > 0.8 && (txData.spvKva / calc.snKva) <= 1.0 }"><td>80% &lt; η ≤ 100%</td><td style="color:#e6a23c">关注</td><td>接近满载，需密切监测负载变化</td></tr>
            <tr :class="{ active: (txData.spvKva / calc.snKva) > 1.0 }"><td>η &gt; 100%</td><td style="color:#f56c6c">严重</td><td>过载运行，存在过热和绝缘老化风险</td></tr>
          </table>
          <p style="margin-top:8px">判定结果：<b :style="{ color: txData.color, fontSize: '15px' }">{{ txData.grade }}</b></p>
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

      <!-- 开关设备 -->
      <div v-if="equipment.equipmentType === 'SWITCH' && swData" class="report-section">
        <h3 class="report-h3">三、穿越电流匹配度校验</h3>
        <div class="formula-box">
          <p><b>校验参数：</b></p>
          <p>开关设备额定电流 I<sub>r</sub> = <b>{{ swData.ratedI.toFixed(0) }} A</b></p>
          <p>光伏接入后穿越电流 I<sub>th</sub> = <b>{{ swData.actualI.toFixed(0) }} A</b></p>
          <p style="margin-top:8px"><b>校验过程：</b></p>
          <p>电流裕度 = (I<sub>r</sub> − I<sub>th</sub>) / I<sub>r</sub> × 100% = ({{ swData.ratedI.toFixed(0) }} − {{ swData.actualI.toFixed(0) }}) / {{ swData.ratedI.toFixed(0) }} = <b :style="{ color: swData.color }">{{ swData.marginPct }}%</b></p>
          <p style="margin-top:8px"><b>判定标准：</b></p>
          <table class="grade-table">
            <tr><th>裕度</th><th>状态</th><th>说明</th></tr>
            <tr :class="{ active: swData.marginPct >= 15 }"><td>裕度 ≥ 15%</td><td style="color:#67c23a">充足</td><td>额定电流充裕，可安全承载光伏接入后的穿越电流</td></tr>
            <tr :class="{ active: swData.marginPct >= 0 && swData.marginPct < 15 }"><td>0 ≤ 裕度 &lt; 15%</td><td style="color:#e6a23c">临界</td><td>额定电流接近穿越电流，裕度偏小</td></tr>
            <tr :class="{ active: swData.marginPct < 0 }"><td>裕度 &lt; 0</td><td style="color:#f56c6c">不足</td><td>额定电流低于穿越电流，无法安全承载</td></tr>
          </table>
          <p style="margin-top:8px">校验结果：<b :style="{ color: swData.color, fontSize: '15px' }">{{ swData.insufficient ? '承载力不足' : swData.marginPct < 15 ? '承载力临界' : '承载力充足' }}</b></p>
        </div>
      </div>

      <!-- ═══════════ 四、结论分析 ═══════════ -->
      <div v-if="conclusion" class="report-section">
        <h3 class="report-h3">四、结论分析</h3>
        <div class="conclusion-box">
          <p>本报告对 <b>{{ equipment.equipmentName }}</b>（{{ typeLabel[equipment.equipmentType] || equipment.equipmentType }}）在光伏电站 <b>{{ station?.stationName || equipment.stationName || '-' }}</b> 接入后进行专项评估，结论如下：</p>
          <p style="margin-top:8px">
            ① <b>短路耐受</b>：三相短路电流 {{ (calc.ikA / 1000).toFixed(2) }} kA，穿越电流 {{ (calc.ithA / 1000).toFixed(2) }} kA。
          </p>
          <p>
            ② <b>专项评估</b>：<span :style="{ color: conclusion.color, fontWeight: 600 }">{{ conclusion.text }}</span>
          </p>
          <p>
            ③ <b>综合风险等级</b>：
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
        <el-button type="primary" @click="handlePrint">打印 / 导出 PDF</el-button>
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

@media print {
  :deep(.el-dialog__header) { display: none; }
  :deep(.el-dialog__footer) { display: none; }
  .report-container { font-size: 11px; }
  .report-section { page-break-inside: avoid; }
}
</style>
