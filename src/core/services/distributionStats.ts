/**
 * F3：关系类型分布统计（自绘 SVG 环形图 + 条形图的数据与几何计算）。
 *
 * 几何计算写成纯函数，组件只负责把 path / 坐标渲染成 SVG。
 */

import { TOPIC_SUGGESTION_COUNT } from '../domain/topologyConfig';
import type { Person, RelationTypeId } from '../domain/PersonModels';
import type {
  BarDatum,
  DonutSegment,
  InsightResult,
  RelationDistributionBucket
} from '../domain/TopologyModels';
import { RELATION_TYPES, getRelationType } from '../data/relationTypes';
import { fallbackTopics } from '../data/topicLexicon';
import { formatInteger, formatPercent } from './formatters';

/** 环形图几何参数 */
export interface DonutGeometry {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
}

/** 极坐标 → 直角坐标（angle 以 12 点方向为 0°，顺时针增大） */
export function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 生成一段环形扇区的 path（角度顺时针，0° 在 12 点方向） */
export function describeDonutSegment(
  geometry: DonutGeometry,
  startAngle: number,
  endAngle: number
): string {
  const sweep = endAngle - startAngle;
  if (sweep <= 0.01) return '';
  if (sweep >= 359.99) {
    // SVG 圆弧无法一次画满 360°，拆成两个半环
    return [
      describeDonutSegment(geometry, 0, 180),
      describeDonutSegment(geometry, 180, 360)
    ]
      .filter((part) => part.length > 0)
      .join(' ');
  }
  const { cx, cy, innerRadius, outerRadius } = geometry;
  const largeArc = sweep > 180 ? 1 : 0;
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  return [
    `M ${round(outerStart.x)} ${round(outerStart.y)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${round(outerEnd.x)} ${round(outerEnd.y)}`,
    `L ${round(innerEnd.x)} ${round(innerEnd.y)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${round(innerStart.x)} ${round(innerStart.y)}`,
    'Z'
  ].join(' ');
}

/** 按关系类型聚合：人数 / 占比 / 平均亲密度 / 核心圈人数 / 预警人数 */
export function buildRelationDistribution(
  persons: readonly Person[],
  insights?: InsightResult | null
): RelationDistributionBucket[] {
  const total = persons.length;
  const coreIds = new Set((insights?.core ?? []).map((member) => member.personId));
  const dormantIds = new Set((insights?.dormant ?? []).map((alert) => alert.personId));

  return RELATION_TYPES.map((meta) => {
    const members = persons.filter((person) => person.relationType === meta.id);
    const intimacySum = members.reduce((sum, person) => sum + person.intimacy, 0);
    return {
      relationType: meta.id,
      label: meta.label,
      color: meta.color,
      icon: meta.icon,
      count: members.length,
      ratio: total > 0 ? members.length / total : 0,
      avgIntimacy: members.length > 0 ? intimacySum / members.length : 0,
      coreCount: members.filter((person) => coreIds.has(person.id)).length,
      dormantCount: members.filter((person) => dormantIds.has(person.id)).length
    };
  });
}

/** 生成环形图扇区（跳过人数为 0 的关系类型） */
export function buildDonutSegments(
  buckets: readonly RelationDistributionBucket[],
  geometry: DonutGeometry
): DonutSegment[] {
  const visible = buckets.filter((bucket) => bucket.count > 0);
  const total = visible.reduce((sum, bucket) => sum + bucket.count, 0);
  if (total === 0) return [];
  const labelRadius = (geometry.innerRadius + geometry.outerRadius) / 2;
  const segments: DonutSegment[] = [];
  let cursor = 0;
  for (const bucket of visible) {
    const ratio = bucket.count / total;
    const startAngle = cursor * 360;
    const endAngle = (cursor + ratio) * 360;
    cursor += ratio;
    const midAngle = (startAngle + endAngle) / 2;
    const labelPoint = polarToCartesian(geometry.cx, geometry.cy, labelRadius, midAngle);
    segments.push({
      relationType: bucket.relationType,
      label: bucket.label,
      color: bucket.color,
      path: describeDonutSegment(geometry, startAngle, endAngle),
      // BUG-05-05: segment ratios use the global bucket ratio after zero buckets are removed.
      ratio,
      count: bucket.count,
      avgIntimacy: bucket.avgIntimacy,
      midAngle,
      labelX: round(labelPoint.x),
      labelY: round(labelPoint.y)
    });
  }
  return segments;
}

/** 条形图数据：人数维度 / 平均亲密度维度，均按值降序 */
export function buildBarSeries(
  buckets: readonly RelationDistributionBucket[],
  metric: 'count' | 'avgIntimacy'
): BarDatum[] {
  const series = buckets
    .filter((bucket) => bucket.count > 0)
    .map((bucket) => ({
      relationType: bucket.relationType,
      label: bucket.label,
      color: bucket.color,
      value: metric === 'count' ? bucket.count : bucket.avgIntimacy,
      display:
        metric === 'count'
          ? `${formatInteger(bucket.count)} 人 · ${formatPercent(bucket.ratio)}`
          : `${bucket.avgIntimacy.toFixed(1)} 分`
    }));
  return series.sort((a, b) => b.value - a.value);
}

/**
 * F4 规则 5：同类型人物的高频标签聚合（排除自己与已有标签）。
 */
export function aggregateTopicsByRelationType(
  persons: readonly Person[],
  relationType: RelationTypeId,
  excludePersonId?: string
): string[] {
  const counts = new Map<string, number>();
  for (const person of persons) {
    if (person.relationType !== relationType) continue;
    if (excludePersonId !== undefined && person.id === excludePersonId) continue;
    for (const topic of person.topics) {
      const key = topic.trim();
      if (key.length === 0) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN'))
    .map(([topic]) => topic);
}

/**
 * 组合话题建议：优先同类型高频标签，不足时用 topicLexicon 兜底，最后去掉本人已有标签。
 */
export function buildTopicSuggestions(
  person: Person,
  persons: readonly Person[],
  count = TOPIC_SUGGESTION_COUNT
): string[] {
  const own = new Set(person.topics.map((topic) => topic.toLowerCase()));
  const aggregated = aggregateTopicsByRelationType(persons, person.relationType, person.id);
  const merged = [...aggregated, ...fallbackTopics(person.relationType, count + person.topics.length + count)];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const topic of merged) {
    const key = topic.toLowerCase();
    if (seen.has(key) || own.has(key)) continue;
    seen.add(key);
    result.push(topic);
    if (result.length >= count) break;
  }
  return result;
}

/** 图例用：某关系类型的元数据（保证颜色与人物节点一致） */
export function relationLegend(): { id: RelationTypeId; label: string; color: string; icon: string }[] {
  return RELATION_TYPES.map((meta) => ({ id: meta.id, label: meta.label, color: meta.color, icon: meta.icon }));
}

/** 安全获取关系类型元数据（转发给 data 层，避免组件直接依赖 data） */
export { getRelationType };
