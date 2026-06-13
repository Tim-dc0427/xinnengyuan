/**
 * 时间格式化工具
 * 统一将 ISO 时间字符串转换为中国本地时间 (UTC+8) 的人性化格式
 */
import dayjs from 'dayjs'

/**
 * 完整日期时间：YYYY-MM-DD HH:mm:ss
 * 用于表格列、详情展示等
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  return dayjs(iso).format('YYYY-MM-DD HH:mm:ss')
}

/**
 * 仅日期：YYYY-MM-DD
 * 用于只需展示日期的场景
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  return dayjs(iso).format('YYYY-MM-DD')
}

/**
 * 仅时间：HH:mm:ss
 */
export function formatTimeOnly(iso: string | null | undefined): string {
  if (!iso) return '-'
  return dayjs(iso).format('HH:mm:ss')
}

/**
 * 月份：YYYY-MM
 * 用于按月分组展示
 */
export function formatMonth(iso: string | null | undefined): string {
  if (!iso) return '-'
  return dayjs(iso).format('YYYY-MM')
}

/**
 * 相对时间：X 秒前 / X 分钟前 / X 小时前 / X 天前
 * 用于实时监控、异常告警等
 */
export function formatRelativeTime(ms: number): string {
  if (ms < 60000) return `${Math.floor(ms / 1000)} 秒前`
  if (ms < 3600000) return `${Math.floor(ms / 60000)} 分钟前`
  if (ms < 86400000) return `${Math.floor(ms / 3600000)} 小时前`
  return `${Math.floor(ms / 86400000)} 天前`
}

/**
 * 获取当前时间的 ISO 日期字符串 (YYYY-MM-DD)
 * 用于日期选择器默认值、导出文件名等
 */
export function todayStr(): string {
  return dayjs().format('YYYY-MM-DD')
}
