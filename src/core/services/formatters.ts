/**
 * 统一数值 / 文案格式化工具（重构项：消除组件内重复的 format 逻辑）。
 *
 * 所有输出都保证不含 NaN / undefined / Invalid Date。
 */

import { INTIMACY_LABELS } from '../domain/topologyConfig';
import type { AdvicePriority, DormancyLevel } from '../domain/TopologyModels';

/** 保留 n 位小数并去掉多余的 0 */
export function formatDecimal(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '0';
  const fixed = value.toFixed(digits);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

/** 整数显示（非法值显示 0） */
export function formatInteger(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value)) : '0';
}

/** 0.375 → 37.5% */
export function formatPercent(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return '0%';
  return `${formatDecimal(ratio * 100, digits)}%`;
}

/** 天数文案：`46 天` */
export function formatDays(days: number): string {
  return `${formatInteger(Math.max(0, days))} 天`;
}

/** 未联系天数文案 */
export function formatIdleDays(days: number): string {
  if (!Number.isFinite(days) || days < 0) return '0 天';
  return `${Math.round(days)} 天`;
}

/** 亲密度 1–10 对应文案（1 = 点头之交 … 10 = 无话不谈） */
export function formatIntimacyLabel(intimacy: number): string {
  const key = Math.round(intimacy);
  return INTIMACY_LABELS[key] ?? '未知';
}

/** `8/10 · 亲密好友` */
export function formatIntimacy(intimacy: number): string {
  return `${formatInteger(intimacy)}/10 · ${formatIntimacyLabel(intimacy)}`;
}

const DORMANCY_LEVEL_TEXT: Record<DormancyLevel, string> = {
  notice: '提醒',
  warning: '警告',
  severe: '严重'
};

export function formatDormancyLevel(level: DormancyLevel): string {
  return DORMANCY_LEVEL_TEXT[level] ?? '提醒';
}

const ADVICE_PRIORITY_TEXT: Record<AdvicePriority, string> = {
  high: '高优先级',
  medium: '中优先级',
  low: '低优先级'
};

export function formatAdvicePriority(priority: AdvicePriority): string {
  return ADVICE_PRIORITY_TEXT[priority] ?? '低优先级';
}

/** 时长文案：null → 未记录 */
export function formatDuration(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes) || minutes <= 0) return '未记录时长';
  if (minutes < 60) return `${Math.round(minutes)} 分钟`;
  const hours = minutes / 60;
  return `${formatDecimal(hours, 1)} 小时`;
}

/** 平均间隔文案 */
export function formatInterval(days: number | null): string {
  if (days === null || !Number.isFinite(days)) return '暂无足够互动';
  return `平均每 ${formatDecimal(days, 1)} 天一次`;
}

/** 通用安全文本（undefined / null → 占位符） */
export function safeText(value: string | null | undefined, fallback = '—'): string {
  if (value === null || value === undefined) return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

/** 截断长文本 */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}
