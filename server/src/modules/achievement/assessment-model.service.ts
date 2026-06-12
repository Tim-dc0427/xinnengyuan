import { db } from '../../config/database.js'
import { v4 as uuid } from 'uuid'

export interface AssessmentModelField {
  id: string
  field_code: string
  field_name: string
  field_desc: string | null
  field_type: 'numeric' | 'text'
  dimension: 'resource' | 'grid' | 'investment' | 'environment'
  base_value: number | null
  score_rule: string
  text_map: string | null
  match_value: string | null
  max_score: number
  fail_score: number
  sort_order: number
  is_active: number
  created_at: string
  updated_at: string | null
}

export interface ModelFieldInput {
  fieldCode: string
  fieldName: string
  fieldDesc?: string
  fieldType: 'numeric' | 'text'
  dimension: 'resource' | 'grid' | 'investment' | 'environment'
  baseValue?: number | null
  scoreRule: string
  textMap?: Record<string, number> | null
  matchValue?: string | null
  maxScore?: number
  failScore?: number
  sortOrder?: number
}

export class AssessmentModelService {
  // ==================== CRUD ====================

  async listFields(): Promise<AssessmentModelField[]> {
    return db('assessment_model_fields')
      .where('is_active', 1)
      .orderBy('dimension')
      .orderBy('sort_order')
  }

  async getField(id: string): Promise<AssessmentModelField | undefined> {
    return db('assessment_model_fields').where('id', id).first()
  }

  async createField(data: ModelFieldInput): Promise<AssessmentModelField> {
    const [row] = await db('assessment_model_fields')
      .insert({
        id: uuid(),
        field_code: data.fieldCode,
        field_name: data.fieldName,
        field_desc: data.fieldDesc || null,
        field_type: data.fieldType,
        dimension: data.dimension,
        base_value: data.baseValue ?? null,
        score_rule: data.scoreRule,
        text_map: data.textMap ? JSON.stringify(data.textMap) : null,
        match_value: data.matchValue ?? null,
        max_score: data.maxScore ?? 100,
        fail_score: data.failScore ?? 0,
        sort_order: data.sortOrder ?? 0,
        is_active: 1,
        created_at: new Date().toISOString(),
      })
      .returning('*')
    return row
  }

  async updateField(id: string, data: Partial<ModelFieldInput>): Promise<AssessmentModelField | undefined> {
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
    if (data.fieldCode !== undefined) updateData.field_code = data.fieldCode
    if (data.fieldName !== undefined) updateData.field_name = data.fieldName
    if (data.fieldDesc !== undefined) updateData.field_desc = data.fieldDesc
    if (data.fieldType !== undefined) updateData.field_type = data.fieldType
    if (data.dimension !== undefined) updateData.dimension = data.dimension
    if (data.baseValue !== undefined) updateData.base_value = data.baseValue
    if (data.scoreRule !== undefined) updateData.score_rule = data.scoreRule
    if (data.textMap !== undefined) updateData.text_map = data.textMap ? JSON.stringify(data.textMap) : null
    if (data.matchValue !== undefined) updateData.match_value = data.matchValue
    if (data.maxScore !== undefined) updateData.max_score = data.maxScore
    if (data.failScore !== undefined) updateData.fail_score = data.failScore
    if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder

    const [row] = await db('assessment_model_fields').where('id', id).update(updateData).returning('*')
    return row
  }

  async deleteField(id: string): Promise<void> {
    await db('assessment_model_fields')
      .where('id', id)
      .update({ is_active: 0, updated_at: new Date().toISOString() })
  }

  // ==================== 恢复默认 ====================

  async resetToDefaults(): Promise<AssessmentModelField[]> {
    // 软删全部激活字段
    await db('assessment_model_fields')
      .where('is_active', 1)
      .update({ is_active: 0, updated_at: new Date().toISOString() })

    // 重新执行种子逻辑
    const { seed } = await import('../../common/db/seeds/070_assessment_model_fields.js')
    await seed(db)

    return this.listFields()
  }

  // ==================== 获取活跃模型供计算使用 ====================

  async getActiveModel(): Promise<{
    fields: AssessmentModelField[]
    dimensionFields: Record<string, AssessmentModelField[]>
  }> {
    const fields = await this.listFields()
    const dimensionFields: Record<string, AssessmentModelField[]> = {
      resource: [],
      grid: [],
      investment: [],
      environment: [],
    }
    for (const f of fields) {
      if (dimensionFields[f.dimension]) {
        dimensionFields[f.dimension].push(f)
      }
    }
    return { fields, dimensionFields }
  }
}
