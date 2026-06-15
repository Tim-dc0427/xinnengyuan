import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import { db } from '../../config/database.js'
import { validatePassword } from '@new-energy/shared'

function parsePermissions(raw: string): { menus: string[]; actions: string[] } {
  try {
    const parsed = JSON.parse(raw || '[]')
    // 兼容旧格式：string[] → { menus: ["*"], actions: [...] }
    if (Array.isArray(parsed)) {
      const arr = parsed as string[]
      if (arr.includes('*')) return { menus: ['*'], actions: ['*'] }
      return { menus: ['*'], actions: arr }
    }
    // 新格式：{ menus: [...], actions: [...] }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        menus: Array.isArray(parsed.menus) ? parsed.menus : ['*'],
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      }
    }
    return { menus: [], actions: [] }
  } catch {
    return { menus: [], actions: [] }
  }
}

export class SystemService {
  // ==================== 部门管理 ====================

  async getDepartments() {
    const rows = await db('departments')
      .select('id', 'name', 'parent_id', 'sort_order', 'created_at')
      .orderBy('sort_order', 'asc')
    return buildTree(rows)
  }

  async createDepartment(body: { name: string; parentId: string | null; sortOrder: number }) {
    const id = uuid()
    await db('departments').insert({
      id,
      name: body.name,
      parent_id: body.parentId || null,
      sort_order: body.sortOrder ?? 0,
      created_at: new Date().toISOString(),
    })
    return { id }
  }

  async updateDepartment(id: string, body: { name: string; parentId: string | null; sortOrder: number }) {
    // 不能把部门设为自身子部门
    if (body.parentId && body.parentId === id) {
      throw new Error('上级部门不能选择自身')
    }
    await db('departments').where('id', id).update({
      name: body.name,
      parent_id: body.parentId || null,
      sort_order: body.sortOrder ?? 0,
    })
  }

  async deleteDepartment(id: string) {
    const childCount = await db('departments').where('parent_id', id).count('* as cnt').first()
    if (childCount && Number(childCount.cnt) > 0) {
      throw new Error('该部门下存在子部门，无法删除')
    }
    const userCount = await db('users').where('department_id', id).count('* as cnt').first()
    if (userCount && Number(userCount.cnt) > 0) {
      throw new Error('该部门下存在用户，无法删除')
    }
    await db('departments').where('id', id).del()
  }

  // ==================== 角色管理 ====================

  async getRoles() {
    const rows = await db('roles')
      .select('id', 'name', 'permissions', 'created_at')
      .orderBy('created_at', 'asc')

    const result = []
    for (const r of rows) {
      const cnt = await db('users').where('role_id', r.id).count('* as cnt').first()
      result.push({
        id: r.id,
        name: r.name,
        permissions: parsePermissions(r.permissions),
        userCount: Number(cnt?.cnt || 0),
        createdAt: r.created_at,
      })
    }
    return result
  }

  async createRole(body: { name: string; permissions: { menus: string[]; actions: string[] } }) {
    const exists = await db('roles').where('name', body.name).first()
    if (exists) throw new Error('角色名已存在')
    const id = uuid()
    await db('roles').insert({
      id,
      name: body.name,
      permissions: JSON.stringify(body.permissions),
      created_at: new Date().toISOString(),
    })
    return { id }
  }

  async updateRole(id: string, body: { name: string; permissions: { menus: string[]; actions: string[] } }) {
    const existing = await db('roles').where('name', body.name).whereNot('id', id).first()
    if (existing) throw new Error('角色名已存在')
    await db('roles').where('id', id).update({
      name: body.name,
      permissions: JSON.stringify(body.permissions),
    })
  }

  async deleteRole(id: string) {
    const cnt = await db('users').where('role_id', id).count('* as cnt').first()
    if (cnt && Number(cnt.cnt) > 0) {
      throw new Error('该角色下存在用户，无法删除')
    }
    await db('roles').where('id', id).del()
  }

  // ==================== 用户管理 ====================

  async getUsers(query: { page?: number; pageSize?: number }) {
    const page = query.page || 1
    const pageSize = query.pageSize || 10
    const offset = (page - 1) * pageSize

    const total = await db('users').count('* as cnt').first()
    const rows = await db('users')
      .leftJoin('roles', 'users.role_id', 'roles.id')
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .select(
        'users.id',
        'users.username',
        'users.display_name',
        'users.role_id',
        'roles.name as role_name',
        'users.department_id',
        'departments.name as department_name',
        'users.is_active',
        'users.last_login_at',
        'users.created_at',
      )
      .orderBy('users.created_at', 'asc')
      .limit(pageSize)
      .offset(offset)

    return {
      list: rows.map(r => ({
        id: r.id,
        username: r.username,
        displayName: r.display_name,
        roleId: r.role_id,
        roleName: r.role_name,
        departmentId: r.department_id || null,
        departmentName: r.department_name || '',
        isActive: r.is_active,
        lastLoginAt: r.last_login_at,
        createdAt: r.created_at,
      })),
      total: Number(total?.cnt || 0),
      page,
      pageSize,
    }
  }

  async createUser(body: { username: string; password: string; displayName: string; roleId: string; departmentId: string | null; isActive: number }) {
    const exists = await db('users').where('username', body.username).first()
    if (exists) throw new Error('用户名已存在')
    const pwdCheck = validatePassword(body.password)
    if (!pwdCheck.valid) throw new Error('密码不符合要求：' + pwdCheck.errors.join('，'))
    const id = uuid()
    const passwordHash = await bcrypt.hash(body.password, 10)
    await db('users').insert({
      id,
      username: body.username,
      password_hash: passwordHash,
      display_name: body.displayName,
      role_id: body.roleId,
      department_id: body.departmentId || null,
      is_active: body.isActive ?? 1,
      created_at: new Date().toISOString(),
    })
    return { id }
  }

  async updateUser(id: string, body: { username?: string; password?: string; displayName?: string; roleId?: string; departmentId?: string | null; isActive?: number }) {
    const existing = await db('users').where('username', body.username).whereNot('id', id).first()
    if (existing) throw new Error('用户名已存在')

    if (body.password) {
      const pwdCheck = validatePassword(body.password)
      if (!pwdCheck.valid) throw new Error('密码不符合要求：' + pwdCheck.errors.join('，'))
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.username !== undefined) updateData.username = body.username
    if (body.displayName !== undefined) updateData.display_name = body.displayName
    if (body.roleId !== undefined) updateData.role_id = body.roleId
    if (body.departmentId !== undefined) updateData.department_id = body.departmentId || null
    if (body.isActive !== undefined) updateData.is_active = body.isActive
    if (body.password) {
      updateData.password_hash = await bcrypt.hash(body.password, 10)
    }

    await db('users').where('id', id).update(updateData)
  }

  async deleteUser(id: string) {
    const user = await db('users').where('id', id).select('username').first()
    if (!user) throw new Error('用户不存在')
    if (user.username === 'admin') throw new Error('不能删除 admin 用户')
    await db('users').where('id', id).del()
  }

  // ==================== 操作日志 ====================

  async getAuditLogs(query: { page?: number; pageSize?: number; userId?: string; action?: string; startDate?: string; endDate?: string }) {
    const page = query.page || 1
    const pageSize = query.pageSize || 15
    const offset = (page - 1) * pageSize

    // 检查 detail 列是否存在（兼容未运行迁移的情况）
    let hasDetail = false
    try {
      const colCheck = await db.raw("SELECT COUNT(*) as cnt FROM pragma_table_info('audit_logs') WHERE name='detail'")
      hasDetail = (colCheck[0]?.cnt ?? 0) > 0
    } catch { /* 忽略 */ }

    const baseColumns = [
      'audit_logs.id',
      'audit_logs.user_id',
      'users.username',
      'users.display_name',
      'audit_logs.action',
      'audit_logs.resource_type',
      'audit_logs.resource_id',
      'audit_logs.old_value',
      'audit_logs.new_value',
      'audit_logs.ip_address',
      'audit_logs.user_agent',
      'audit_logs.created_at',
    ]
    if (hasDetail) baseColumns.push('audit_logs.detail')

    let q = db('audit_logs')
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
      .select(baseColumns)

    if (query.userId) q = q.where('audit_logs.user_id', query.userId)
    if (query.action) q = q.where('audit_logs.action', query.action)
    if (query.startDate) q = q.where('audit_logs.created_at', '>=', query.startDate)
    if (query.endDate) q = q.where('audit_logs.created_at', '<=', query.endDate + 'T23:59:59.999Z')

    const totalQ = q.clone()
    const total = await totalQ.count('* as cnt').first()

    const rows = await q
      .orderBy('audit_logs.created_at', 'desc')
      .limit(pageSize)
      .offset(offset)

    return {
      list: rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        username: r.username || '未知',
        displayName: r.display_name || '',
        action: r.action,
        resourceType: r.resource_type,
        resourceId: r.resource_id,
        detail: r.detail || '',
        oldValue: r.old_value,
        newValue: r.new_value,
        ipAddress: r.ip_address,
        userAgent: r.user_agent,
        createdAt: r.created_at,
      })),
      total: Number(total?.cnt || 0),
      page,
      pageSize,
    }
  }

  async getUserOptions() {
    return db('users').select('id', 'username', 'display_name').orderBy('username', 'asc')
  }

  // ==================== 数据范围 ====================
  async getDataRanges() {
    const tables = ['pv_output_measurements', 'load_measurements', 'voltage_measurements', 'equipment_temperature']
    const result: Record<string, { minTime: string | null; maxTime: string | null; count: number }> = {}
    for (const table of tables) {
      const row = await db(table)
        .select(db.raw('MIN(time) as minTime, MAX(time) as maxTime, COUNT(*) as count'))
        .first() as any
      result[table] = { minTime: row?.minTime || null, maxTime: row?.maxTime || null, count: row?.count || 0 }
    }
    return result
  }
}

// 组装部门树形结构
function buildTree(rows: any[]): any[] {
  const map = new Map<string, any>()
  const roots: any[] = []
  for (const r of rows) {
    map.set(r.id, {
      id: r.id,
      name: r.name,
      parentId: r.parent_id || null,
      sortOrder: r.sort_order,
      createdAt: r.created_at,
      children: [],
    })
  }
  for (const r of rows) {
    const node = map.get(r.id)!
    if (r.parent_id && map.has(r.parent_id)) {
      map.get(r.parent_id).children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}
