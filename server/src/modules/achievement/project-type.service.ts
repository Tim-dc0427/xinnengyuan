import { db } from '../../config/database.js'

export interface ProjectType {
  id: string
  name: string
  code: string
  description?: string
  sort_order?: number
  created_at?: string
}

export interface ProjectTypeField {
  id: string
  type_id: string
  field_code: string
  field_name: string
  field_type: string
  field_options?: string
  is_required: number
  sort_order: number
  created_at?: string
}

export class ProjectTypeService {
  async listTypes() {
    return db('project_types').orderBy('sort_order', 'asc')
  }

  async getType(id: string) {
    return db('project_types').where('id', id).first()
  }

  async getTypeByCode(code: string) {
    return db('project_types').where('code', code).first()
  }

  async createType(data: { name: string; code: string; description?: string; sortOrder?: number }) {
    const [type] = await db('project_types').insert({
      id: crypto.randomUUID(),
      name: data.name,
      code: data.code,
      description: data.description,
      sort_order: data.sortOrder || 0,
      created_at: new Date().toISOString(),
    }).returning('*')
    return type
  }

  async updateType(id: string, data: { name?: string; description?: string; sortOrder?: number }) {
    const [type] = await db('project_types').where('id', id).update({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.sortOrder !== undefined && { sort_order: data.sortOrder }),
    }).returning('*')
    return type
  }

  async deleteType(id: string) {
    await db('project_type_fields').where('type_id', id).delete()
    await db('project_types').where('id', id).delete()
  }

  // ==================== 类型字段管理 ====================
  async listFields(typeId: string) {
    return db('project_type_fields').where('type_id', typeId).orderBy('sort_order', 'asc')
  }

  async saveFields(typeId: string, fields: Array<{
    fieldCode: string; fieldName: string; fieldType: string
    fieldOptions?: string; isRequired: boolean; sortOrder: number
  }>) {
    await db('project_type_fields').where('type_id', typeId).delete()
    if (fields.length > 0) {
      await db('project_type_fields').insert(
        fields.map((f) => ({
          id: crypto.randomUUID(),
          type_id: typeId,
          field_code: f.fieldCode,
          field_name: f.fieldName,
          field_type: f.fieldType,
          field_options: f.fieldOptions || null,
          is_required: f.isRequired ? 1 : 0,
          sort_order: f.sortOrder,
          created_at: new Date().toISOString(),
        })),
      )
    }
    return this.listFields(typeId)
  }

  /** 获取某类型的字段定义（附带类型 code），用于前端动态表单渲染 */
  async getTypeWithFields(typeIdOrCode: string) {
    let type = await db('project_types').where('id', typeIdOrCode).first()
    if (!type) {
      type = await db('project_types').where('code', typeIdOrCode).first()
    }
    if (!type) return null
    const fields = await this.listFields(type.id)
    return { type, fields }
  }

  async getAllTypesWithFields() {
    const types = await this.listTypes()
    const result = []
    for (const t of types) {
      const fields = await this.listFields(t.id)
      result.push({ ...t, fields })
    }
    return result
  }
}
