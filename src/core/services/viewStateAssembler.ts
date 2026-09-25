/**
 * 视图状态装配（纯函数）：把「原始数据 + 设置」组装成 UI 直接消费的不可变快照。
 *
 * 从 `RelationshipTopologyUseCase` 拆出，保证用例只负责「变更与持久化」，
 * 派生数据的计算链路（洞察 → 拓扑 → 分布 → 建议）集中在这里，便于单独推理与测试。
 */

import type { Person } from '../domain/PersonModels';
import type { Interaction } from '../domain/InteractionModels';
import type {
  AdviceContext,
  AdviceViewItem,
  AppSettings,
  MaintenanceAdvice,
  TopologyViewState
} from '../domain/TopologyModels';
import { RELATION_TYPES } from '../data/relationTypes';
import { buildRelationDistribution, buildTopicSuggestions } from './distributionStats';
import { groupInteractionsByPerson } from './contactFrequency';
import { detectInsights } from './insightDetector';
import { nextContactIntervalDays, recommendMaintenance } from './maintenanceAdvisor';
import { buildTopology } from './topologyBuilder';

export interface ViewStateInput {
  persons: readonly Person[];
  interactions: readonly Interaction[];
  settings: AppSettings;
  handledAdviceIds: readonly string[];
  today: string;
  migrated: boolean;
  skippedRecords: number;
}

export function assembleViewState(input: ViewStateInput): TopologyViewState {
  const { persons, interactions, settings, today } = input;

  const insights = detectInsights(persons, interactions, today);
  const topology = buildTopology(persons, interactions, insights, today, settings.filter);
  const distribution = buildRelationDistribution(persons, insights);
  const grouped = groupInteractionsByPerson(interactions);

  const interactionIndex: Record<string, Interaction[]> = {};
  const adviceByPerson: Record<string, MaintenanceAdvice[]> = {};

  for (const person of persons) {
    const personInteractions = grouped.get(person.id) ?? [];
    interactionIndex[person.id] = personInteractions;

    const context: AdviceContext = {
      relationLabel: RELATION_TYPES.find((meta) => meta.id === person.relationType)?.label ?? '其他',
      topicSuggestions: buildTopicSuggestions(person, persons),
      nextContactIntervalDays: nextContactIntervalDays(person.intimacy)
    };
    adviceByPerson[person.id] = recommendMaintenance(person, personInteractions, today, context);
  }

  return {
    persons: [...persons],
    interactions: [...interactions],
    settings: { ...settings, filter: { ...settings.filter } },
    insights,
    topology,
    distribution,
    adviceByPerson,
    handledAdviceIds: [...input.handledAdviceIds],
    interactionIndex,
    today,
    migrated: input.migrated,
    skippedRecords: input.skippedRecords
  };
}

/** 建议行（附加本地「已处理」勾选状态），供详情抽屉直接渲染 */
export function toAdviceViewItems(
  advice: readonly MaintenanceAdvice[],
  handledAdviceIds: readonly string[]
): AdviceViewItem[] {
  const handled = new Set(handledAdviceIds);
  return advice.map((item) => ({ advice: item, handled: handled.has(item.id) }));
}
