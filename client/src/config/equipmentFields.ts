/** 设备类型特定字段定义 */
export interface EquipmentFieldDef {
  key: string
  label: string
  type: 'number' | 'string' | 'select'
  unit?: string
  required?: boolean
  options?: { value: any; label: string }[]
  placeholder?: string
}

export type EquipmentFieldsConfig = Record<string, EquipmentFieldDef[]>

/** 设备类型中文标签 */
export const equipmentTypeLabels: Record<string, string> = {
  pv_module: '光伏组件',
  inverter: '逆变器',
  transformer: '变压器',
  cable: '电缆',
  switchgear: '开关柜',
  other: '其他',
}

export const equipmentTypeOptions = Object.entries(equipmentTypeLabels).map(([value, label]) => ({
  value,
  label,
}))

/** 各设备类型的技术参数字段配置 */
export const equipmentFieldConfigs: EquipmentFieldsConfig = {
  /** 光伏组件 */
  pv_module: [
    { key: 'peakPower', label: '峰值功率', type: 'number', unit: 'Wp', required: true },
    { key: 'efficiency', label: '转换效率', type: 'number', unit: '%' },
    { key: 'voc', label: '开路电压', type: 'number', unit: 'V' },
    { key: 'vmp', label: '工作电压', type: 'number', unit: 'V' },
    { key: 'isc', label: '短路电流', type: 'number', unit: 'A' },
    { key: 'imp', label: '工作电流', type: 'number', unit: 'A' },
    { key: 'cellCount', label: '电池片数量', type: 'number', unit: '片' },
    { key: 'cellType', label: '电池类型', type: 'select', options: [
      { value: 'mono-si', label: '单晶硅' },
      { value: 'poly-si', label: '多晶硅' },
      { value: 'thin-film', label: '薄膜' },
      { value: 'hjt', label: '异质结(HJT)' },
      { value: 'bifacial', label: '双面双玻' },
    ]},
    { key: 'dimensions', label: '组件尺寸', type: 'string', placeholder: '长×宽×厚 mm' },
    { key: 'weight', label: '重量', type: 'number', unit: 'kg' },
    { key: 'tempCoefficient', label: '温度系数', type: 'number', unit: '%/°C' },
    { key: 'warrantyYears', label: '质保年限', type: 'number', unit: '年' },
  ],

  /** 逆变器 */
  inverter: [
    { key: 'ratedPower', label: '额定功率', type: 'number', unit: 'kW', required: true },
    { key: 'maxDcVoltage', label: '最大直流电压', type: 'number', unit: 'V' },
    { key: 'minDcVoltage', label: '最小直流电压', type: 'number', unit: 'V' },
    { key: 'mpptCount', label: 'MPPT数量', type: 'number', unit: '路' },
    { key: 'mpptVoltageRange', label: 'MPPT电压范围', type: 'string', placeholder: '如 200-1000V' },
    { key: 'acOutputVoltage', label: '交流输出电压', type: 'number', unit: 'V' },
    { key: 'ratedOutputCurrent', label: '额定输出电流', type: 'number', unit: 'A' },
    { key: 'maxEfficiency', label: '最大效率', type: 'number', unit: '%' },
    { key: 'euroEfficiency', label: '欧洲效率', type: 'number', unit: '%' },
    { key: 'protectionLevel', label: '防护等级', type: 'select', options: [
      { value: 'IP54', label: 'IP54' },
      { value: 'IP55', label: 'IP55' },
      { value: 'IP65', label: 'IP65' },
      { value: 'IP66', label: 'IP66' },
      { value: 'IP67', label: 'IP67' },
    ]},
    { key: 'coolingMethod', label: '冷却方式', type: 'select', options: [
      { value: 'natural', label: '自然冷却' },
      { value: 'forced_air', label: '强制风冷' },
      { value: 'liquid', label: '液冷' },
    ]},
    { key: 'noiseLevel', label: '噪音等级', type: 'number', unit: 'dB' },
  ],

  /** 变压器 */
  transformer: [
    { key: 'ratedCapacity', label: '额定容量', type: 'number', unit: 'kVA', required: true },
    { key: 'primaryVoltage', label: '一次侧电压', type: 'number', unit: 'kV' },
    { key: 'secondaryVoltage', label: '二次侧电压', type: 'number', unit: 'kV' },
    { key: 'connectionGroup', label: '连接组别', type: 'select', options: [
      { value: 'Dyn11', label: 'Dyn11' },
      { value: 'Yyn0', label: 'Yyn0' },
      { value: 'Yd11', label: 'Yd11' },
      { value: 'YNd11', label: 'YNd11' },
    ]},
    { key: 'noLoadLoss', label: '空载损耗', type: 'number', unit: 'W' },
    { key: 'loadLoss', label: '负载损耗', type: 'number', unit: 'W' },
    { key: 'impedanceVoltage', label: '阻抗电压', type: 'number', unit: '%' },
    { key: 'noLoadCurrent', label: '空载电流', type: 'number', unit: '%' },
    { key: 'coolingMethod', label: '冷却方式', type: 'select', options: [
      { value: 'on', label: '油浸自冷(ONAN)' },
      { value: 'of', label: '油浸风冷(ONAF)' },
      { value: 'dry', label: '干式自冷' },
      { value: 'forced', label: '强迫油循环' },
    ]},
    { key: 'insulationLevel', label: '绝缘等级', type: 'select', options: [
      { value: 'A', label: 'A级' },
      { value: 'E', label: 'E级' },
      { value: 'B', label: 'B级' },
      { value: 'F', label: 'F级' },
      { value: 'H', label: 'H级' },
    ]},
    { key: 'weight', label: '重量', type: 'number', unit: 'kg' },
  ],

  /** 电缆 */
  cable: [
    { key: 'conductorMaterial', label: '导体材质', type: 'select', options: [
      { value: 'copper', label: '铜芯' },
      { value: 'aluminum', label: '铝芯' },
    ]},
    { key: 'conductorSection', label: '导体截面', type: 'number', unit: 'mm²', required: true },
    { key: 'cableType', label: '电缆类型', type: 'select', options: [
      { value: 'single_core', label: '单芯' },
      { value: 'three_core', label: '三芯' },
      { value: 'four_core', label: '四芯' },
      { value: 'five_core', label: '五芯' },
      { value: 'armored', label: '铠装' },
    ]},
    { key: 'ratedVoltage', label: '额定电压', type: 'number', unit: 'kV' },
    { key: 'currentCapacity', label: '载流量', type: 'number', unit: 'A' },
    { key: 'insulationMaterial', label: '绝缘材料', type: 'select', options: [
      { value: 'xlpe', label: '交联聚乙烯(XLPE)' },
      { value: 'pvc', label: '聚氯乙烯(PVC)' },
      { value: 'epr', label: '乙丙橡胶(EPR)' },
      { value: 'oil', label: '油浸纸' },
    ]},
    { key: 'outerDiameter', label: '外径', type: 'number', unit: 'mm' },
    { key: 'weightPerMeter', label: '单位重量', type: 'number', unit: 'kg/m' },
    { key: 'minBendingRadius', label: '最小弯曲半径', type: 'number', unit: 'mm' },
    { key: 'flameRetardant', label: '阻燃等级', type: 'select', options: [
      { value: 'none', label: '无' },
      { value: 'A', label: 'A级' },
      { value: 'B', label: 'B级' },
      { value: 'C', label: 'C级' },
    ]},
  ],

  /** 开关柜 */
  switchgear: [
    { key: 'ratedVoltage', label: '额定电压', type: 'number', unit: 'kV', required: true },
    { key: 'ratedCurrent', label: '额定电流', type: 'number', unit: 'A' },
    { key: 'shortCircuitBreaking', label: '短路开断电流', type: 'number', unit: 'kA' },
    { key: 'shortCircuitMaking', label: '短路关合电流', type: 'number', unit: 'kA' },
    { key: 'peakWithstandCurrent', label: '峰值耐受电流', type: 'number', unit: 'kA' },
    { key: 'operationMode', label: '操作方式', type: 'select', options: [
      { value: 'fixed', label: '固定式' },
      { value: 'drawer', label: '抽屉式' },
      { value: 'sf6', label: 'SF6绝缘' },
    ]},
    { key: 'insulationMedium', label: '绝缘介质', type: 'select', options: [
      { value: 'air', label: '空气' },
      { value: 'sf6', label: 'SF6' },
      { value: 'solid', label: '固体绝缘' },
    ]},
    { key: 'protectionLevel', label: '防护等级', type: 'select', options: [
      { value: 'IP3X', label: 'IP3X' },
      { value: 'IP4X', label: 'IP4X' },
      { value: 'IP5X', label: 'IP5X' },
    ]},
    { key: 'cabinetType', label: '柜体类型', type: 'select', options: [
      { value: 'kyn', label: 'KYN中置柜' },
      { value: 'ggd', label: 'GGD固定柜' },
      { value: 'gcs', label: 'GCS抽屉柜' },
      { value: 'mns', label: 'MNS柜' },
      { value: 'hxgn', label: 'HXGN环网柜' },
    ]},
    { key: 'numberOfCircuits', label: '回路数', type: 'number', unit: '路' },
  ],

  /** 其他设备 - 无特定技术参数 */
  other: [],
}

/** 预置设备型号 — 选型号后自动填充制造商和技术参数 */
export interface ModelPreset {
  modelNumber: string
  manufacturer: string
  ratedParams: Record<string, any>
}

export const equipmentModelPresets: Record<string, ModelPreset[]> = {
  pv_module: [
    { modelNumber: 'HC-550W', manufacturer: '隆基绿能', ratedParams: { peakPower: 550, efficiency: 21.5, voc: 49.6, vmp: 41.8, isc: 13.9, imp: 13.2, cellCount: 144, cellType: 'mono-si', dimensions: '2279×1134×35mm', weight: 32.5, tempCoefficient: -0.35, warrantyYears: 25 } },
    { modelNumber: 'LR5-72HTH-550M', manufacturer: '隆基绿能', ratedParams: { peakPower: 550, efficiency: 21.8, voc: 50.1, vmp: 42.3, isc: 13.8, imp: 13.0, cellCount: 144, cellType: 'mono-si', dimensions: '2256×1133×30mm', weight: 31.8, tempCoefficient: -0.34, warrantyYears: 30 } },
    { modelNumber: 'Vertex T-660W', manufacturer: '天合光能', ratedParams: { peakPower: 660, efficiency: 22.3, voc: 50.2, vmp: 42.5, isc: 16.8, imp: 15.5, cellCount: 132, cellType: 'bifacial', dimensions: '2384×1303×35mm', weight: 38.7, tempCoefficient: -0.32, warrantyYears: 30 } },
    { modelNumber: 'JKM-600M', manufacturer: '晶科能源', ratedParams: { peakPower: 600, efficiency: 22.8, voc: 51.2, vmp: 42.8, isc: 14.5, imp: 14.0, cellCount: 156, cellType: 'hjt', dimensions: '2384×1303×35mm', weight: 36.5, tempCoefficient: -0.31, warrantyYears: 30 } },
    { modelNumber: 'TF-500W', manufacturer: '晶科能源', ratedParams: { peakPower: 500, efficiency: 16.8, voc: 45.2, vmp: 36.5, isc: 14.2, imp: 13.7, cellCount: 128, cellType: 'thin-film', dimensions: '2200×1100×28mm', weight: 28.0, tempCoefficient: -0.30, warrantyYears: 25 } },
  ],
  inverter: [
    { modelNumber: 'SG-250HV', manufacturer: '华为数字能源', ratedParams: { ratedPower: 250, maxDcVoltage: 1500, minDcVoltage: 200, mpptCount: 10, mpptVoltageRange: '200-1000', acOutputVoltage: 800, ratedOutputCurrent: 180, maxEfficiency: 99.0, euroEfficiency: 98.7, protectionLevel: 'IP66', coolingMethod: 'forced_air', noiseLevel: 65 } },
    { modelNumber: 'SG-110CX', manufacturer: '阳光电源', ratedParams: { ratedPower: 110, maxDcVoltage: 1100, minDcVoltage: 180, mpptCount: 6, mpptVoltageRange: '180-950', acOutputVoltage: 400, ratedOutputCurrent: 160, maxEfficiency: 98.7, euroEfficiency: 98.4, protectionLevel: 'IP65', coolingMethod: 'forced_air', noiseLevel: 58 } },
    { modelNumber: 'SUN2000-300KTL', manufacturer: '华为数字能源', ratedParams: { ratedPower: 300, maxDcVoltage: 1500, minDcVoltage: 200, mpptCount: 12, mpptVoltageRange: '200-1300', acOutputVoltage: 800, ratedOutputCurrent: 216, maxEfficiency: 99.1, euroEfficiency: 98.9, protectionLevel: 'IP66', coolingMethod: 'liquid', noiseLevel: 68 } },
    { modelNumber: 'EP-1000-HA', manufacturer: '上能电气', ratedParams: { ratedPower: 1000, maxDcVoltage: 1500, minDcVoltage: 200, mpptCount: 18, mpptVoltageRange: '200-1300', acOutputVoltage: 800, ratedOutputCurrent: 720, maxEfficiency: 99.0, euroEfficiency: 98.6, protectionLevel: 'IP55', coolingMethod: 'liquid', noiseLevel: 72 } },
  ],
  transformer: [
    { modelNumber: 'S11-2500/35', manufacturer: '特变电工', ratedParams: { ratedCapacity: 2500, primaryVoltage: 35, secondaryVoltage: 0.8, connectionGroup: 'Dyn11', noLoadLoss: 2750, loadLoss: 21500, impedanceVoltage: 6.5, noLoadCurrent: 0.8, coolingMethod: 'on', insulationLevel: 'F', weight: 6800 } },
    { modelNumber: 'S13-2000/35', manufacturer: '许继电气', ratedParams: { ratedCapacity: 2000, primaryVoltage: 35, secondaryVoltage: 0.4, connectionGroup: 'Dyn11', noLoadLoss: 2150, loadLoss: 18500, impedanceVoltage: 6.0, noLoadCurrent: 0.6, coolingMethod: 'on', insulationLevel: 'F', weight: 5500 } },
    { modelNumber: 'SZ18-5000/220', manufacturer: '中国西电', ratedParams: { ratedCapacity: 5000, primaryVoltage: 220, secondaryVoltage: 35, connectionGroup: 'YNd11', noLoadLoss: 4200, loadLoss: 32000, impedanceVoltage: 8.0, noLoadCurrent: 0.5, coolingMethod: 'of', insulationLevel: 'H', weight: 25000 } },
    { modelNumber: 'SCB13-2000/10', manufacturer: '特变电工', ratedParams: { ratedCapacity: 2000, primaryVoltage: 10, secondaryVoltage: 0.4, connectionGroup: 'Dyn11', noLoadLoss: 3050, loadLoss: 15300, impedanceVoltage: 6.0, noLoadCurrent: 0.8, coolingMethod: 'dry', insulationLevel: 'F', weight: 4200 } },
  ],
  cable: [
    { modelNumber: 'PV1-F-1×4', manufacturer: '远东电缆', ratedParams: { conductorMaterial: 'copper', conductorSection: 4, cableType: 'single_core', ratedVoltage: 0.6, currentCapacity: 55, insulationMaterial: 'xlpe', outerDiameter: 6.2, weightPerMeter: 0.08, minBendingRadius: 75, flameRetardant: 'C' } },
    { modelNumber: 'YJV22-8.7/15-3×300', manufacturer: '远东电缆', ratedParams: { conductorMaterial: 'copper', conductorSection: 300, cableType: 'three_core', ratedVoltage: 8.7, currentCapacity: 610, insulationMaterial: 'xlpe', outerDiameter: 82.5, weightPerMeter: 12.5, minBendingRadius: 990, flameRetardant: 'C' } },
    { modelNumber: 'ZC-YJV-8.7/15-3×240', manufacturer: '中天科技', ratedParams: { conductorMaterial: 'copper', conductorSection: 240, cableType: 'three_core', ratedVoltage: 8.7, currentCapacity: 510, insulationMaterial: 'xlpe', outerDiameter: 75.2, weightPerMeter: 10.8, minBendingRadius: 900, flameRetardant: 'C' } },
    { modelNumber: 'H1Z2Z2-K-1×6', manufacturer: '远东电缆', ratedParams: { conductorMaterial: 'copper', conductorSection: 6, cableType: 'single_core', ratedVoltage: 1.5, currentCapacity: 72, insulationMaterial: 'xlpe', outerDiameter: 7.8, weightPerMeter: 0.12, minBendingRadius: 90, flameRetardant: 'B' } },
  ],
  switchgear: [
    { modelNumber: 'KYN28A-12', manufacturer: '正泰电器', ratedParams: { ratedVoltage: 12, ratedCurrent: 1250, shortCircuitBreaking: 31.5, shortCircuitMaking: 80, peakWithstandCurrent: 80, operationMode: 'drawer', insulationMedium: 'air', protectionLevel: 'IP4X', cabinetType: 'kyn', numberOfCircuits: 6 } },
    { modelNumber: 'GGD-2000A', manufacturer: '正泰电器', ratedParams: { ratedVoltage: 0.4, ratedCurrent: 2000, shortCircuitBreaking: 50, shortCircuitMaking: 105, peakWithstandCurrent: 105, operationMode: 'fixed', insulationMedium: 'air', protectionLevel: 'IP3X', cabinetType: 'ggd', numberOfCircuits: 4 } },
    { modelNumber: 'MNS-630A', manufacturer: '大全集团', ratedParams: { ratedVoltage: 0.4, ratedCurrent: 630, shortCircuitBreaking: 25, shortCircuitMaking: 63, peakWithstandCurrent: 63, operationMode: 'drawer', insulationMedium: 'air', protectionLevel: 'IP4X', cabinetType: 'mns', numberOfCircuits: 8 } },
    { modelNumber: 'HXGN-12', manufacturer: '正泰电器', ratedParams: { ratedVoltage: 12, ratedCurrent: 630, shortCircuitBreaking: 20, shortCircuitMaking: 50, peakWithstandCurrent: 50, operationMode: 'sf6', insulationMedium: 'sf6', protectionLevel: 'IP5X', cabinetType: 'hxgn', numberOfCircuits: 4 } },
  ],
  other: [],
}
