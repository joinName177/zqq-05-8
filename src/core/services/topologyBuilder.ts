/**
 * 拓扑图数据装配（F2）：把人物 + 互动 + 洞察结论组装成节点/连线，并派生力导向布局种子。
 * 导出画布的坐标映射见 `exportBuilder.ts`。
 *
 * 关键映射：
 *   节点半径 = 6 + 亲密度 × 2.2；颜色 = 关系类型；核心圈层光晕；疏远预警脉冲虚线环
 *   连线粗细 = 双方近 90 天互动频次均值的对数映射（0.8–8px）；颜色淡灰 → 青绿；预测疏远用虚线
 */

import {
  CORE_HALO_EXTRA,
  DORMANT_PULSE_EXTRA,
  EDGE_DORMANT_FORECAST_DAYS,
  EDGE_MAX_PER_NODE,
  EDGE_MIN_WEIGHT,
  EDGE_WEIGHT_CORE_PAIR,
  EDGE_WEIGHT_FAMILY_BONUS,
  EDGE_WEIGHT_SAME_RELATION,
  EDGE_WEIGHT_SHARED_TOPIC,
  PERFORMANCE_NODE_WARNING
} from '../domain/topologyConfig';
import type { Person } from '../domain/PersonModels';
import type { Interaction } from '../domain/InteractionModels';
import type {
  GraphFilter,
  InsightResult,
  LayoutEdgeSeed,
  LayoutNodeSeed,
  TopologyData,
  TopologyEdge,
  TopologyNode
} from '../domain/TopologyModels';
import { getRelationType } from '../data/relationTypes';
import { computeFrequency, edgeColorFromFrequency, edgeWidthFromFrequency, groupInteractionsByPerson } from './contactFrequency';
import { computeNodeRadius, computeSpringStrength } from './layoutMetrics';

/** 判断节点是否命中当前筛选条件（未命中者淡出） */
export function matchesFilter(node: TopologyNode, filter: GraphFilter): boolean {
  if (filter.relationType !== 'all' && node.person.relationType !== filter.relationType) return false;
  // BUG-05-03: the graph's dormant mode is inverted while the list remains correct.
  if (filter.mode === 'dormant') return !node.isDormant;
  if (filter.mode === 'core') return node.isCore;
  return true;
}

interface EdgeCandidate {
  source: string;
  target: string;
  sharedTopics: string[];
  sameRelation: boolean;
  weight: number;
  frequency: number;
  predictedDormant: boolean;
}

function sharedTopicsOf(a: Person, b: Person): string[] {
  const ownedByB = new Set(b.topics.map((topic) => topic.toLowerCase()));
  return a.topics.filter((topic) => ownedByB.has(topic.toLowerCase()));
}

/** 关系推断 + 单节点连线数上限裁剪（优先保留强关系） */
function deriveEdges(
  persons: readonly Person[],
  frequencyById: Map<string, TopologyNode['frequency']>,
  coreIds: ReadonlySet<string>
): TopologyEdge[] {
  const candidates: EdgeCandidate[] = [];

  for (let i = 0; i < persons.length; i += 1) {
    const a = persons[i] as Person;
    const frequencyA = frequencyById.get(a.id);
    if (!frequencyA) continue;
    for (let j = i + 1; j < persons.length; j += 1) {
      const b = persons[j] as Person;
      const frequencyB = frequencyById.get(b.id);
      if (!frequencyB) continue;

      const shared = sharedTopicsOf(a, b);
      const sameRelation = a.relationType === b.relationType;
      const bothCore = coreIds.has(a.id) && coreIds.has(b.id);
      const bothFamily = a.relationType === 'family' && b.relationType === 'family';

      let weight = 0;
      if (shared.length > 0) weight += EDGE_WEIGHT_SHARED_TOPIC * Math.min(1, shared.length / 2 + 0.5);
      if (sameRelation) weight += EDGE_WEIGHT_SAME_RELATION;
      if (bothCore) weight += EDGE_WEIGHT_CORE_PAIR;
      if (bothFamily) weight += EDGE_WEIGHT_FAMILY_BONUS;
      weight = Math.min(1, weight);
      if (weight < EDGE_MIN_WEIGHT) continue;

      const frequency = (frequencyA.count90 + frequencyB.count90) / 2;
      const predictedDormant =
        // BUG-05-01: edge forecasts disagree with insight alerts at the boundary.
        frequencyA.daysSinceLastContact > EDGE_DORMANT_FORECAST_DAYS ||
        frequencyB.daysSinceLastContact > EDGE_DORMANT_FORECAST_DAYS;

      candidates.push({
        source: a.id,
        target: b.id,
        sharedTopics: shared,
        sameRelation,
        weight,
        frequency,
        predictedDormant
      });
    }
  }

  candidates.sort((a, b) => b.weight - a.weight || b.frequency - a.frequency);

  const degree = new Map<string, number>();
  const edges: TopologyEdge[] = [];
  for (const candidate of candidates) {
    const sourceDegree = degree.get(candidate.source) ?? 0;
    const targetDegree = degree.get(candidate.target) ?? 0;
    if (sourceDegree >= EDGE_MAX_PER_NODE || targetDegree >= EDGE_MAX_PER_NODE) continue;
    degree.set(candidate.source, sourceDegree + 1);
    degree.set(candidate.target, targetDegree + 1);
    edges.push({
      id: `${candidate.source}~${candidate.target}`,
      source: candidate.source,
      target: candidate.target,
      sharedTopics: candidate.sharedTopics,
      sameRelation: candidate.sameRelation,
      weight: candidate.weight,
      strength: computeSpringStrength(candidate.weight),
      frequency: candidate.frequency,
      width: edgeWidthFromFrequency(candidate.frequency),
      color: edgeColorFromFrequency(candidate.frequency),
      predictedDormant: candidate.predictedDormant
    });
  }
  return edges;
}

/** 装配完整拓扑数据（节点 + 连线 + 筛选命中集合 + 性能提示） */
export function buildTopology(
  persons: readonly Person[],
  interactions: readonly Interaction[],
  insights: InsightResult,
  todayIso: string,
  filter: GraphFilter
): TopologyData {
  const grouped = groupInteractionsByPerson(interactions);
  const coreIds = new Set(insights.core.map((member) => member.personId));
  const dormantLevelById = new Map(insights.dormant.map((alert) => [alert.personId, alert.level] as const));

  const nodes: TopologyNode[] = persons.map((person) => {
    const frequency = computeFrequency(person, grouped.get(person.id) ?? [], todayIso);
    const meta = getRelationType(person.relationType);
    return {
      person,
      frequency,
      isCore: coreIds.has(person.id),
      isDormant: dormantLevelById.has(person.id),
      dormantLevel: dormantLevelById.get(person.id) ?? null,
      radius: computeNodeRadius(person.intimacy),
      color: meta.color,
      matchesFilter: true
    };
  });

  for (const node of nodes) node.matchesFilter = matchesFilter(node, filter);

  const frequencyById = new Map(nodes.map((node) => [node.person.id, node.frequency] as const));
  const edges = deriveEdges(persons, frequencyById, coreIds);
  const maxFrequency = edges.reduce((max, edge) => Math.max(max, edge.frequency), 0);

  return {
    nodes,
    edges,
    visibleNodeIds: nodes.filter((node) => node.matchesFilter).map((node) => node.person.id),
    performanceWarning: nodes.length > PERFORMANCE_NODE_WARNING,
    maxFrequency
  };
}

/** 拓扑数据 → 力导向仿真的输入种子 */
export function buildLayoutSeeds(topology: TopologyData): {
  nodeSeeds: LayoutNodeSeed[];
  edgeSeeds: LayoutEdgeSeed[];
} {
  const nodeSeeds: LayoutNodeSeed[] = topology.nodes.map((node) => ({
    id: node.person.id,
    intimacy: node.person.intimacy,
    core: node.isCore,
    dormant: node.isDormant,
    weight: node.frequency.count90 + node.person.intimacy
  }));
  const edgeSeeds: LayoutEdgeSeed[] = topology.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    strength: edge.strength,
    frequency: edge.frequency,
    predictedDormant: edge.predictedDormant
  }));
  return { nodeSeeds, edgeSeeds };
}

/** 核心圈层光晕半径 / 疏远预警脉冲环半径（模板不得内联 +6 / +9） */
export function haloRadius(node: { radius: number }): number {
  return node.radius + CORE_HALO_EXTRA;
}

export function pulseRadius(node: { radius: number }): number {
  return node.radius + DORMANT_PULSE_EXTRA;
}
