/**
 * F4：关系维护建议清单生成（≥ 7 条规则，按优先级排序）。
 *
 * `recommendMaintenance(person, interactionsDesc, todayIso, context)` 为纯函数，
 * 所有阈值来自 `core/domain/topologyConfig.ts`，模板层只做渲染与勾选。
 */

import {
  ADVICE_PRIORITY_ORDER,
  BASELINE_WINDOW_DAYS,
  CONFLICT_LOOKBACK_DAYS,
  CONFLICT_SILENCE_DAYS,
  CORE_INTIMACY_THRESHOLD,
  CORE_STALE_DAYS,
  COOLING_DROP_THRESHOLD,
  DORMANCY_THRESHOLD_DAYS,
  LOW_INTIMACY_THRESHOLD,
  MISMATCH_INTERACTION_COUNT,
  NEXT_CONTACT_TIERS,
  RECENT_WINDOW_DAYS,
  TOPIC_SUGGESTION_COUNT
} from '../domain/topologyConfig';
import type { Person } from '../domain/PersonModels';
import type { Interaction } from '../domain/InteractionModels';
import type { AdviceContext, MaintenanceAdvice } from '../domain/TopologyModels';
import { daysBetween, addDays, formatDisplayDate, isValidIsoDate } from './dateUtils';
import { formatDays, formatDecimal } from './formatters';
import { computeFeelingTrend, countInWindow, deriveLastContact } from './contactFrequency';
import { stableId } from './idFactory';

interface AdviceSeed {
  key: string;
  priority: MaintenanceAdvice['priority'];
  title: string;
  detail: string;
  action: string;
  reason: string;
}

/** F4 规则 7：按亲密度分档的建议下次联系间隔天数（≥8 → 7 天 / 5–7 → 21 天 / ≤4 → 60 天） */
export function nextContactIntervalDays(intimacy: number): number {
  for (const tier of NEXT_CONTACT_TIERS) {
    if (intimacy >= tier.minIntimacy) return tier.days;
  }
  const last = NEXT_CONTACT_TIERS[NEXT_CONTACT_TIERS.length - 1];
  return last ? last.days : 60;
}

/** 该亲密度档位的说明文案（用于建议 reason） */
export function nextContactTierLabel(intimacy: number): string {
  for (const tier of NEXT_CONTACT_TIERS) {
    if (intimacy >= tier.minIntimacy) return tier.label;
  }
  return '弱连接';
}

/** 找到最近一次「冲突」互动（仅看 CONFLICT_LOOKBACK_DAYS 天内的记录） */
function latestConflict(interactionsDesc: readonly Interaction[], todayIso: string): Interaction | null {
  for (const interaction of interactionsDesc) {
    if (interaction.kind !== 'conflict') continue;
    const daysAgo = daysBetween(interaction.date, todayIso);
    if (daysAgo >= 0 && daysAgo <= CONFLICT_LOOKBACK_DAYS) return interaction;
  }
  return null;
}

function buildSeeds(
  person: Person,
  interactionsDesc: readonly Interaction[],
  todayIso: string,
  context: AdviceContext
): AdviceSeed[] {
  const seeds: AdviceSeed[] = [];
  const derived = deriveLastContact(person, interactionsDesc, todayIso);
  const daysSince = derived.days;
  const count30 = countInWindow(interactionsDesc, todayIso, RECENT_WINDOW_DAYS);
  const topic = person.topics.length > 0 ? (person.topics[0] as string) : '你们的共同话题';
  const topicText = person.topics.length > 0 ? person.topics.join('、') : '（尚未记录共同话题）';

  // 规则 1：未联系 > 90 天
  if (daysSince > DORMANCY_THRESHOLD_DAYS) {
    seeds.push({
      key: 'dormant',
      priority: 'high',
      title: '已超过 90 天未联系',
      detail: `${person.name}（${context.relationLabel}）上次联系是 ${formatDisplayDate(derived.iso)}，已经 ${formatDays(daysSince)}没有互动。`,
      action: `本周内发起一次轻量联系：围绕「${topic}」发一条不施压的问候消息。`,
      reason: `判定规则：未联系天数 ${daysSince} > 阈值 ${DORMANCY_THRESHOLD_DAYS} 天。`
    });
  }

  // 规则 2：亲密度 ≥ 8 且 > 30 天未联系
  if (person.intimacy >= CORE_INTIMACY_THRESHOLD && daysSince > CORE_STALE_DAYS) {
    seeds.push({
      key: 'core-stale',
      priority: 'high',
      title: '核心关系正在被日常挤占',
      detail: `${person.name} 属于核心圈层（亲密度 ${person.intimacy}/10），但已 ${formatDays(daysSince)}未联系，超过核心圈层的 ${CORE_STALE_DAYS} 天维护线。`,
      action: '先定下一次见面的具体时间（而不是「有空再约」），并把提醒写进日历。',
      reason: `判定规则：亲密度 ${person.intimacy} ≥ ${CORE_INTIMACY_THRESHOLD} 且未联系 ${daysSince} > ${CORE_STALE_DAYS} 天。`
    });
  }

  // 规则 3：亲密度 ≤ 4 但近 30 天互动 ≥ 5 次
  if (person.intimacy <= LOW_INTIMACY_THRESHOLD && count30 >= MISMATCH_INTERACTION_COUNT) {
    seeds.push({
      key: 'mismatch',
      priority: 'medium',
      title: '投入与亲密度错位',
      detail: `近 ${RECENT_WINDOW_DAYS} 天你们互动了 ${count30} 次，但亲密度只有 ${person.intimacy}/10，投入明显高于关系定位。`,
      action: '确认是否值得深交：若值得，把亲密度调高并升级关系定位；若不值得，明确边界、降低互动频率。',
      reason: `判定规则：亲密度 ${person.intimacy} ≤ ${LOW_INTIMACY_THRESHOLD} 且近 ${RECENT_WINDOW_DAYS} 天互动 ${count30} ≥ ${MISMATCH_INTERACTION_COUNT} 次。`
    });
  }

  // 规则 4：近 60 天存在「冲突」且之后 ≥ 14 天无任何互动
  const conflict = latestConflict(interactionsDesc, todayIso);
  if (conflict) {
    const newest = interactionsDesc[0];
    const hasLaterInteraction = newest !== undefined && newest.id !== conflict.id;
    const silenceDays = daysBetween(conflict.date, todayIso);
    if (!hasLaterInteraction && silenceDays >= CONFLICT_SILENCE_DAYS) {
      seeds.push({
        key: 'conflict-repair',
        priority: 'high',
        title: '冲突后已沉默，建议主动修复',
        detail: `${formatDisplayDate(conflict.date)} 的一次冲突之后，你们已经 ${formatDays(silenceDays)}没有任何互动。`,
        action: '先就事论事地承认当时的情绪，再提出一个小而具体的和解动作（一顿饭 / 一次通话）。',
        reason: `判定规则：近 ${CONFLICT_LOOKBACK_DAYS} 天内有「冲突」记录，且之后 ${silenceDays} ≥ ${CONFLICT_SILENCE_DAYS} 天无互动。`
      });
    }
  }

  // 规则 5：话题标签为空
  if (person.topics.length === 0) {
    const suggestions = context.topicSuggestions.slice(0, TOPIC_SUGGESTION_COUNT);
    const suggestionText = suggestions.length > 0 ? suggestions.map((item) => `「${item}」`).join('、') : '「近况」';
    seeds.push({
      key: 'no-topic',
      priority: 'low',
      title: '尚未沉淀共同话题',
      detail: `${person.name} 还没有任何共同话题标签，关系缺少可持续的沟通抓手。`,
      action: `下次联系时试探 ${suggestionText}，把对方真正回应的话题记下来并补充为标签。`,
      reason: `判定规则：话题标签数量为 0；参考话题来自同类型（${context.relationLabel}）人物的高频标签聚合。`
    });
  }

  // 规则 6：亲密度（由主观感受换算）近 30 天均值比前 60 天下降 ≥ 2
  const trend = computeFeelingTrend(interactionsDesc, todayIso);
  if (trend.hasBaseline && trend.recentAvg !== null && trend.baselineAvg !== null) {
    const drop = trend.baselineAvg - trend.recentAvg;
    if (drop >= COOLING_DROP_THRESHOLD) {
      seeds.push({
        key: 'cooling',
        priority: 'medium',
        title: '关系正在降温',
        detail: `近 ${RECENT_WINDOW_DAYS} 天互动的平均感受为 ${formatDecimal(trend.recentAvg, 1)}/10，低于此前 ${BASELINE_WINDOW_DAYS} 天的 ${formatDecimal(trend.baselineAvg, 1)}/10。`,
        action: '安排一次不设议程的长聊，先问对方最近最难的一件事，再谈你们之间发生了什么。',
        reason: `判定规则：亲密度代理值（主观感受 × 2）近 ${RECENT_WINDOW_DAYS} 天均值较前 ${BASELINE_WINDOW_DAYS} 天下降 ${formatDecimal(drop, 1)} ≥ ${COOLING_DROP_THRESHOLD}。`
      });
    }
  }

  // 规则 7：无任何建议 → 关系维护良好 + 建议下次联系日期
  if (seeds.length === 0) {
    // BUG-05-07: advice schedules the next contact twice as far out as its tier.
    const interval = context.nextContactIntervalDays * 2;
    const nextDate = isValidIsoDate(addDays(todayIso, interval)) ? addDays(todayIso, interval) : todayIso;
    seeds.push({
      key: 'healthy',
      priority: 'low',
      title: '关系维护良好',
      detail: `最近一次联系是 ${formatDisplayDate(derived.iso)}（${formatDays(daysSince)}前），近 ${RECENT_WINDOW_DAYS} 天互动 ${count30} 次，暂无需干预。`,
      action: `建议下次联系日期：${formatDisplayDate(nextDate)}（间隔 ${interval} 天）。话题储备：${topicText}。`,
      reason: `判定规则：未触发任何预警规则；下次联系间隔按「${nextContactTierLabel(person.intimacy)}」分档取 ${interval} 天。`
    });
  }

  return seeds;
}

/**
 * 生成建议清单（已按优先级 high → medium → low 排序）。
 * 建议 ID 稳定：同一人物 + 同一规则 → 同一 ID，便于持久化「已处理」勾选状态。
 */
export function recommendMaintenance(
  person: Person,
  interactionsDesc: readonly Interaction[],
  todayIso: string,
  context: AdviceContext
): MaintenanceAdvice[] {
  return sortAdvice(
    buildSeeds(person, interactionsDesc, todayIso, context).map((seed) => ({
      id: stableId([person.id, seed.key]),
      personId: person.id,
      priority: seed.priority,
      title: seed.title,
      detail: seed.detail,
      action: seed.action,
      reason: seed.reason
    }))
  );
}

/** 按优先级排序（同优先级保持规则声明顺序） */
export function sortAdvice(advice: readonly MaintenanceAdvice[]): MaintenanceAdvice[] {
  return advice
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const diff = ADVICE_PRIORITY_ORDER[a.item.priority] - ADVICE_PRIORITY_ORDER[b.item.priority];
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map((entry) => entry.item);
}

/** 建议清单摘要（用于指标卡与 SVG 导出） */
export function summarizeAdvice(advice: readonly MaintenanceAdvice[]): string {
  const high = advice.filter((item) => item.priority === 'high').length;
  if (advice.length === 0) return '暂无建议';
  if (high > 0) return `${advice.length} 条建议（${high} 条高优先级）`;
  return `${advice.length} 条建议`;
}
