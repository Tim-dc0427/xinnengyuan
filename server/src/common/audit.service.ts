/**
 * 审计日志服务
 * 统一记录系统核心操作的审计日志
 *
 * 使用方式：
 *   import { audit } from '../common/audit.service.js'
 *   audit(req, 'CREATE', 'power_plant', newId, '创建电站', null, newData)
 *   audit(req, 'UPDATE', 'user', userId, '修改角色', oldData, newData)
 *   audit(req, 'DELETE', 'equipment', eqId, '删除设备', deletedData, null)
 *   audit(req, 'EXECUTE', 'calculation', taskId, '启动标准潮流计算', null, params)
 */
 import { db } from '../config/database.js'

 export interface AuditEntry {
   userId?: string
   action: string
   resourceType: string
   resourceId?: string | null
   detail?: string | null
   oldValue?: unknown
   newValue?: unknown
   ipAddress?: string | null
   userAgent?: string | null
 }

 /** 缓存 detail 列是否存在（避免每次都查 schema） */
 let detailColExists: boolean | null = null

 /**
  * 检查 audit_logs 表是否有 detail 列
  */
 async function hasDetailColumn(): Promise<boolean> {
   if (detailColExists !== null) return detailColExists
   try {
     const result = await db.raw(
       "SELECT COUNT(*) as cnt FROM pragma_table_info('audit_logs') WHERE name='detail'",
     )
     detailColExists = (result[0]?.cnt ?? 0) > 0
   } catch {
     detailColExists = false
   }
   return detailColExists
 }

 /**
  * 写入一条审计日志 (fire-and-forget，不阻塞主流程)
  */
 export function writeAudit(entry: AuditEntry): void {
   // fire-and-forget: 不阻塞业务响应
   ;(async () => {
     try {
       const data: Record<string, unknown> = {
         user_id: entry.userId || 'system',
         action: entry.action,
         resource_type: entry.resourceType,
         resource_id: entry.resourceId || null,
         old_value:
           entry.oldValue != null
             ? typeof entry.oldValue === 'string'
               ? entry.oldValue
               : JSON.stringify(entry.oldValue)
             : null,
         new_value:
           entry.newValue != null
             ? typeof entry.newValue === 'string'
               ? entry.newValue
               : JSON.stringify(entry.newValue)
             : null,
         ip_address: entry.ipAddress || null,
         user_agent: entry.userAgent || null,
         created_at: new Date().toISOString(),
       }

       // 如果有 detail，放入 new_value 的 JSON 中也放入 detail 列
       if (entry.detail) {
         if (await hasDetailColumn()) {
           data['detail'] = entry.detail
         } else {
           // 没有 detail 列时，将描述追加到 new_value
           try {
             const nv = typeof data.new_value === 'string' ? JSON.parse(data.new_value as string) : {}
             data.new_value = JSON.stringify({ ...nv, _detail: entry.detail })
           } catch {
             data.new_value = JSON.stringify({ _detail: entry.detail })
           }
         }
       }

       await db('audit_logs').insert(data)
     } catch (err) {
       console.error('[AuditService] 审计日志写入失败:', err)
     }
   })()
 }

 /**
  * 从 Express Request 中提取用户信息和客户端信息，写入审计日志
  * 这是最常用的便捷方法
  */
 export function audit(
   req: { user?: { id?: string; username?: string }; ip?: string; headers?: Record<string, string | string[] | undefined> },
   action: string,
   resourceType: string,
   resourceId?: string | null,
   detail?: string | null,
   oldValue?: unknown,
   newValue?: unknown,
 ): void {
   writeAudit({
     userId: req.user?.id || 'anonymous',
     action,
     resourceType,
     resourceId,
     detail,
     oldValue,
     newValue,
     ipAddress: req.ip || null,
     userAgent: req.headers?.['user-agent'] || null,
   })
 }
