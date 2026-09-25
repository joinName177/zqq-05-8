/**
 * 联系频率统计、最近联系时间推导、互动时间轴（F2 / F4）。
 *
 * 全部为纯函数：时间参考点由调用方传入（ClockPort → todayIso），不读取系统时间。
 */

import {
  BASELINE_WINDOW_DAYS,
  COOLING_WINDOW_DAYS,
  EDGE_COLOR_HIGH,
  EDGE_COLOR_LOW,
  EDGE_FREQUENCY_LOG_CAP,
  EDGE_WIDTH_MAX,
  EDGE_WIDTH_MIN,
  FEELING_TO_INTIMACY_SCALE,
  FREQUENCY_WINDOW_DAYS,
  RECENT_WINDOW_DAYS
} from '../domain/topologyConfig';
import type { Person } from '../domain/PersonModels';
import type { Interaction } from '../domain/InteractionModels';
import type {
  FeelingTrend,
  FrequencyInfo,
  LastContactSource,
  TimelineEntry,
  TimelineMonth
} from '../domain/TopologyModels';
import { daysBetween, formatMonthZh, isValidIsoDate, monthKey } from './dateUtils';

/** 把互动按人物分组（值列表按日期倒序） */
export function groupInteractionsByPerson(interactions: readonly Interaction[]): Map<string, Interaction[]> {
  const grouped = new Map<string, Interaction[]>();
  for (const interaction of interactions) {
    const list = grouped.get(interaction.personId);
    if (list) {
      list.push(interaction);
    } else {
      grouped.set(interaction.personId, [interaction]);
    }
  }
  for (const [personId, list] of grouped) {
    grouped.set(personId, sortInteractionsDesc(list));
  }
  return grouped;
}

/** 日期倒序（同日按 createdAt 倒序，保证顺序稳定） */
export function sortInteractionsDesc(interactions: readonly Interaction[]): Interaction[] {
  return [...interactions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}

/** 统计窗口内（距今 ≤ windowDays 天）的互动次数 */
export function countInWindow(interactions: readonly Interaction[], todayIso: string, windowDays: number): number {
  let count = 0;
  for (const interaction of interactions) {
    const daysAgo = daysBetween(interaction.date, todayIso);
    // BUG-05-02: contact counters omit interactions exactly on the window edge.
    if (daysAgo >= 0 && daysAgo < windowDays) count += 1;
  }
  return count;
}

/**
 * F4：最近联系时间推导 —— 有互动记录时取最近一次互动日期，否则回落到录入值。
 */
export function deriveLastContact(
  person: Person,
  interactionsDesc: readonly Interaction[],
  todayIso: string
): { iso: string; source: LastContactSource; days: number } {
  const newest = interactionsDesc[0];
  if (newest && isValidIsoDate(newest.date)) {
    return { iso: newest.date, source: 'interaction', days: Math.max(0, daysBetween(newest.date, todayIso)) };
  }
  const fallback = isValidIsoDate(person.lastContactDate) ? person.lastContactDate : todayIso;
  return { iso: fallback, source: 'record', days: Math.max(0, daysBetween(fallback, todayIso)) };
}

/** 十六进制颜色线性插值（t ∈ [0,1]） */
export function mixHexColors(from: string, to: string, t: number): string {
  const ratio = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  const parse = (hex: string): [number, number, number] => {
    const normalized = hex.replace('#', '');
    const full =
      normalized.length === 3
        ? normalized
            .split('')
            .map((char) => char + char)
            .join('')
        : normalized;
    const value = Number.parseInt(full.slice(0, 6), 16);
    if (!Number.isFinite(value)) return [128, 128, 128];
    return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
  };
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const channel = (a: number, b: number): string =>
    Math.round(a + (b - a) * ratio)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r1, r2)}${channel(g1, g2)}${channel(b1, b2)}`;
}

/** F2：连线粗细 = 近 90 天互动次数的对数映射（0.8–8px） */
export function edgeWidthFromFrequency(count: number): number {
  const capped = Math.min(Math.max(count, 0), EDGE_FREQUENCY_LOG_CAP);
  const normalized = Math.log1p(capped) / Math.log1p(EDGE_FREQUENCY_LOG_CAP);
  return EDGE_WIDTH_MIN + normalized * (EDGE_WIDTH_MAX - EDGE_WIDTH_MIN);
}

/** F2：连线颜色 = 淡灰（低频）→ 青绿（高频） */
export function edgeColorFromFrequency(count: number): string {
  const capped = Math.min(Math.max(count, 0), EDGE_FREQUENCY_LOG_CAP);
  const normalized = Math.log1p(capped) / Math.log1p(EDGE_FREQUENCY_LOG_CAP);
  return mixHexColors(EDGE_COLOR_LOW, EDGE_COLOR_HIGH, normalized);
}

/** 平均互动间隔天数（少于 2 次互动无法计算间隔 → null） */
export function averageIntervalDays(interactionsDesc: readonly Interaction[]): number | null {
  if (interactionsDesc.length < 2) return null;
  const newest = interactionsDesc[0];
  const oldest = interactionsDesc[interactionsDesc.length - 1];
  if (!newest || !oldest) return null;
  const span = Math.abs(daysBetween(oldest.date, newest.date));
  const intervals = interactionsDesc.length - 1;
  return intervals > 0 ? span / intervals : null;
}

/** 汇总单人联系频率与连线视觉映射 */
export function computeFrequency(
  person: Person,
  interactionsDesc: readonly Interaction[],
  todayIso: string
): FrequencyInfo {
  const count30 = countInWindow(interactionsDesc, todayIso, RECENT_WINDOW_DAYS);
  const count60 = countInWindow(interactionsDesc, todayIso, BASELINE_WINDOW_DAYS);
  const count90 = countInWindow(interactionsDesc, todayIso, FREQUENCY_WINDOW_DAYS);
  const derived = deriveLastContact(person, interactionsDesc, todayIso);
  const feelings = interactionsDesc.map((item) => item.feeling).filter((feeling) => Number.isFinite(feeling));
  const avgFeeling = feelings.length > 0 ? feelings.reduce((sum, value) => sum + value, 0) / feelings.length : null;

  return {
    personId: person.id,
    count30,
    count60,
    count90,
    total: interactionsDesc.length,
    lastContactIso: derived.iso,
    lastContactSource: derived.source,
    daysSinceLastContact: derived.days,
    edgeWidth: edgeWidthFromFrequency(count90),
    edgeColor: edgeColorFromFrequency(count90),
    avgFeeling
  };
}

/** F4：时间轴条目 —— 每条标注「距上次联系 N 天」/「距上一次互动间隔 N 天」 */
export function buildTimeline(interactionsDesc: readonly Interaction[], todayIso: string): TimelineEntry[] {
  return interactionsDesc.map((interaction, index) => {
    const daysAgo = Math.max(0, daysBetween(interaction.date, todayIso));
    const previous = index > 0 ? interactionsDesc[index - 1] : undefined;
    const gapDays = previous ? Math.max(0, daysBetween(interaction.date, previous.date)) : null;
    const distanceLabel =
      index === 0
        ? daysAgo === 0
          ? '今天刚联系过'
          : `距上次联系 ${daysAgo} 天`
        : `距上一次互动间隔 ${gapDays ?? 0} 天`;
    return {
      interaction,
      daysAgo,
      gapDays,
      distanceLabel,
      monthKey: monthKey(interaction.date)
    };
  });
}

/** 时间轴按月分组（保持倒序） */
export function groupTimelineByMonth(entries: readonly TimelineEntry[]): TimelineMonth[] {
  const months: TimelineMonth[] = [];
  const index = new Map<string, TimelineMonth>();
  for (const entry of entries) {
    let month = index.get(entry.monthKey);
    if (!month) {
      month = { monthKey: entry.monthKey, monthLabel: formatMonthZh(entry.monthKey), entries: [], count: 0, avgFeeling: 0 };
      index.set(entry.monthKey, month);
      months.push(month);
    }
    month.entries.push(entry);
  }
  for (const month of months) {
    month.count = month.entries.length;
    const feelings = month.entries.map((entry) => entry.interaction.feeling).filter((value) => Number.isFinite(value));
    month.avgFeeling =
      feelings.length > 0 ? feelings.reduce((sum, value) => sum + value, 0) / feelings.length : 0;
  }
  return months;
}

/**
 * F4 规则 6 的趋势代理指标：
 * 互动记录只保存 1–5 的主观感受，因此按 FEELING_TO_INTIMACY_SCALE 换算到 1–10 亲密度刻度后比较。
 */
export function computeFeelingTrend(interactionsDesc: readonly Interaction[], todayIso: string): FeelingTrend {
  const recent: number[] = [];
  const baseline: number[] = [];
  for (const interaction of interactionsDesc) {
    const daysAgo = daysBetween(interaction.date, todayIso);
    if (daysAgo < 0) continue;
    const scaled = interaction.feeling * FEELING_TO_INTIMACY_SCALE;
    if (daysAgo <= COOLING_WINDOW_DAYS) {
      recent.push(scaled);
    } else if (daysAgo <= COOLING_WINDOW_DAYS + BASELINE_WINDOW_DAYS) {
      baseline.push(scaled);
    }
  }
  const average = (values: readonly number[]): number | null =>
    values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const recentAvg = average(recent);
  const baselineAvg = average(baseline);
  const hasBaseline = recentAvg !== null && baselineAvg !== null;
  return {
    recentAvg,
    baselineAvg,
    delta: hasBaseline ? (recentAvg as number) - (baselineAvg as number) : 0,
    recentCount: recent.length,
    baselineCount: baseline.length,
    hasBaseline
  };
}
