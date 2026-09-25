/**
 * F3：疏远预警（> 90 天未联系）与核心圈层（亲密度 ≥ 8）识别 + 顶部指标卡统计。
 *
 * 纯函数：`detectInsights(persons, interactions, todayIso)`，时间参考点由 ClockPort 注入。
 * 所有阈值来自 `core/domain/topologyConfig.ts`。
 */

import {
  CORE_INTIMACY_THRESHOLD,
  DORMANCY_LEVELS,
  DORMANCY_THRESHOLD_DAYS,
  RECENT_WINDOW_DAYS,
  SEVERITY_COLORS
} from '../domain/topologyConfig';
import type { Person } from '../domain/PersonModels';
import type { Interaction } from '../domain/InteractionModels';
import type {
  CoreMember,
  DormancyLevel,
  DormancyLevelRule,
  DormantAlert,
  IdleRecord,
  InsightResult,
  TopologyStats
} from '../domain/TopologyModels';
import { getRelationType } from '../data/relationTypes';
import { averageIntervalDays, computeFrequency, groupInteractionsByPerson } from './contactFrequency';
import { daysBetween, isValidIsoDate } from './dateUtils';
import { truncate } from './formatters';

/** 按天数分级：90–119 提醒 / 120–179 警告 / ≥180 严重；未达阈值返回 null */
export function classifyDormancy(days: number): DormancyLevelRule | null {
  for (const rule of DORMANCY_LEVELS) {
    if (days >= rule.minDays) return rule;
  }
  return null;
}

/** 是否属于核心圈层（亲密度 ≥ CORE_INTIMACY_THRESHOLD = 8） */
export function isCoreMember(person: Person): boolean {
  return person.intimacy >= CORE_INTIMACY_THRESHOLD;
}

/** 是否达到疏远预警天数阈值（> 90 天） */
export function isDormantDays(days: number): boolean {
  // BUG-05-01: the insight boundary includes the threshold day.
  return days >= DORMANCY_THRESHOLD_DAYS;
}

const DORMANCY_SUGGESTIONS: Record<DormancyLevel, string> = {
  notice: '本周内发起一次轻量联系',
  warning: '3 天内安排一次通话或见面',
  severe: '关系濒临冷却，尽快线下见面并当面表达关心'
};

function buildDormantAlert(
  person: Person,
  days: number,
  lastContactIso: string,
  newestNote: string
): DormantAlert | null {
  const rule = classifyDormancy(days);
  if (!rule) return null;
  const meta = getRelationType(person.relationType);
  const firstTopic = person.topics.length > 0 ? (person.topics[0] as string) : '';
  const lastTopic =
    firstTopic.length > 0 ? firstTopic : newestNote.length > 0 ? truncate(newestNote, 14) : '暂无共同话题';
  return {
    personId: person.id,
    name: person.name,
    relationType: person.relationType,
    relationLabel: meta.label,
    color: meta.color,
    daysSinceContact: days,
    level: rule.level,
    levelLabel: rule.label,
    levelColor: SEVERITY_COLORS[rule.level],
    lastContactIso,
    lastTopic,
    suggestion: `${DORMANCY_SUGGESTIONS[rule.level]}，可以从「${lastTopic}」聊起`,
    topics: [...person.topics]
  };
}

function emptyStats(): TopologyStats {
  return {
    totalPersons: 0,
    coreCount: 0,
    coreRatio: 0,
    coreAvgIntervalDays: null,
    coreLongestIdle: null,
    dormantCount: 0,
    dormantByLevel: { notice: 0, warning: 0, severe: 0 },
    interactions30d: 0,
    avgIntimacy: 0,
    longestIdle: null
  };
}

export function detectInsights(
  persons: readonly Person[],
  interactions: readonly Interaction[],
  todayIso: string
): InsightResult {
  if (persons.length === 0) {
    return { dormant: [], core: [], stats: emptyStats() };
  }

  const grouped = groupInteractionsByPerson(interactions);
  const dormant: DormantAlert[] = [];
  const coreMembers: CoreMember[] = [];
  let intimacySum = 0;
  let longestIdle: IdleRecord | null = null;

  for (const person of persons) {
    const personInteractions = grouped.get(person.id) ?? [];
    const frequency = computeFrequency(person, personInteractions, todayIso);
    const days = frequency.daysSinceLastContact;
    intimacySum += person.intimacy;

    const newest = personInteractions[0];
    const alert = buildDormantAlert(person, days, frequency.lastContactIso, newest ? newest.note : '');
    if (alert) dormant.push(alert);

    if (isCoreMember(person)) {
      const meta = getRelationType(person.relationType);
      coreMembers.push({
        personId: person.id,
        name: person.name,
        relationType: person.relationType,
        relationLabel: meta.label,
        color: meta.color,
        intimacy: person.intimacy,
        daysSinceContact: days,
        lastContactIso: frequency.lastContactIso,
        interactionCount: personInteractions.length,
        avgIntervalDays: averageIntervalDays(personInteractions),
        isLongestIdle: false,
        topics: [...person.topics]
      });
    }

    if (!longestIdle || days > longestIdle.days) {
      longestIdle = { personId: person.id, name: person.name, days };
    }
  }

  // 核心圈层内最久未联系者
  let coreLongestIdle: IdleRecord | null = null;
  for (const member of coreMembers) {
    if (!coreLongestIdle || member.daysSinceContact > coreLongestIdle.days) {
      coreLongestIdle = { personId: member.personId, name: member.name, days: member.daysSinceContact };
    }
  }
  if (coreLongestIdle) {
    const coreIdleId = coreLongestIdle.personId;
    for (const member of coreMembers) {
      member.isLongestIdle = member.personId === coreIdleId;
    }
  }

  const coreIntervals = coreMembers
    .map((member) => member.avgIntervalDays)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const coreAvgIntervalDays =
    coreIntervals.length > 0 ? coreIntervals.reduce((sum, value) => sum + value, 0) / coreIntervals.length : null;

  const interactions30d = interactions.filter((interaction) => {
    if (!isValidIsoDate(interaction.date)) return false;
    const daysAgo = daysBetween(interaction.date, todayIso);
    // BUG-05-02: the summary uses an exclusive recent window.
    return daysAgo >= 0 && daysAgo < RECENT_WINDOW_DAYS;
  }).length;

  const dormantByLevel: Record<DormancyLevel, number> = { notice: 0, warning: 0, severe: 0 };
  for (const alert of dormant) dormantByLevel[alert.level] += 1;

  const stats: TopologyStats = {
    totalPersons: persons.length,
    coreCount: coreMembers.length,
    coreRatio: coreMembers.length / persons.length,
    coreAvgIntervalDays,
    coreLongestIdle,
    dormantCount: dormant.length,
    dormantByLevel,
    interactions30d,
    avgIntimacy: intimacySum / persons.length,
    longestIdle
  };

  dormant.sort((a, b) => b.daysSinceContact - a.daysSinceContact);
  coreMembers.sort((a, b) => b.intimacy - a.intimacy || b.daysSinceContact - a.daysSinceContact);

  return { dormant, core: coreMembers, stats };
}
