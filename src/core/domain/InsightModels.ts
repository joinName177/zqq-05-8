/**
 * 洞察 / 建议 / 联系频率与时间轴 领域模型。
 *
 * 从 `TopologyModels.ts` 拆出：这部分只描述「关系健康度」与「维护建议」，
 * 与布局、拓扑渲染、导入导出无关。由 `TopologyModels.ts` 统一再导出。
 */

import type { RelationTypeId } from './PersonModels';
import type { Interaction } from './InteractionModels';

/* ------------------------------------------------------------------ */
/* 洞察：疏远预警 / 核心圈层 / 指标                                    */
/* ------------------------------------------------------------------ */

export type DormancyLevel = 'notice' | 'warning' | 'severe';

export interface DormancyLevelRule {
  level: DormancyLevel;
  /** 达到该天数即归入此等级（含） */
  minDays: number;
  label: string;
}

export interface DormantAlert {
  personId: string;
  name: string;
  relationType: RelationTypeId;
  relationLabel: string;
  color: string;
  daysSinceContact: number;
  level: DormancyLevel;
  levelLabel: string;
  levelColor: string;
  lastContactIso: string;
  /** 上次互动涉及的话题（无互动记录时回落到人物标签） */
  lastTopic: string;
  /** 建议动作（由 core 生成，模板不拼业务文案） */
  suggestion: string;
  topics: string[];
}

export interface CoreMember {
  personId: string;
  name: string;
  relationType: RelationTypeId;
  relationLabel: string;
  color: string;
  intimacy: number;
  daysSinceContact: number;
  lastContactIso: string;
  interactionCount: number;
  /** 该人平均互动间隔天数；互动不足 2 次时为 null */
  avgIntervalDays: number | null;
  /** 是否为核心圈层中最久未联系者 */
  isLongestIdle: boolean;
  topics: string[];
}

export interface IdleRecord {
  personId: string;
  name: string;
  days: number;
}

export interface TopologyStats {
  totalPersons: number;
  coreCount: number;
  /** 核心圈人数占比 0–1 */
  coreRatio: number;
  coreAvgIntervalDays: number | null;
  coreLongestIdle: IdleRecord | null;
  dormantCount: number;
  dormantByLevel: Record<DormancyLevel, number>;
  interactions30d: number;
  avgIntimacy: number;
  longestIdle: IdleRecord | null;
}

export interface InsightResult {
  dormant: DormantAlert[];
  core: CoreMember[];
  stats: TopologyStats;
}


/* ------------------------------------------------------------------ */
/* 关系维护建议                                                        */
/* ------------------------------------------------------------------ */

export type AdvicePriority = 'high' | 'medium' | 'low';

export interface MaintenanceAdvice {
  id: string;
  personId: string;
  priority: AdvicePriority;
  title: string;
  detail: string;
  action: string;
  /** 触发原因 + 具体数值，方便用户理解为什么给出该建议 */
  reason: string;
}

/** UI 消费的建议行：建议本身 + 本地「已处理」勾选状态 */
export interface AdviceViewItem {
  advice: MaintenanceAdvice;
  handled: boolean;
}

export interface AdviceContext {
  relationLabel: string;
  /** 来自同类型人物高频标签聚合的话题参考 */
  topicSuggestions: string[];
  /** 按亲密度分档的建议下次联系间隔天数 */
  nextContactIntervalDays: number;
}


/* ------------------------------------------------------------------ */
/* 联系频率与时间轴                                                    */
/* ------------------------------------------------------------------ */

export type LastContactSource = 'interaction' | 'record';

export interface FrequencyInfo {
  personId: string;
  count30: number;
  count60: number;
  count90: number;
  total: number;
  lastContactIso: string;
  lastContactSource: LastContactSource;
  daysSinceLastContact: number;
  /** 连线粗细（对数映射 0.8–8px） */
  edgeWidth: number;
  /** 连线颜色（淡灰 → 青绿） */
  edgeColor: string;
  avgFeeling: number | null;
}

export interface TimelineEntry {
  interaction: Interaction;
  /** 距今天数 */
  daysAgo: number;
  /** 与更近一次互动之间的间隔天数；最新一条为 null */
  gapDays: number | null;
  /** 由 core 生成的距离文案 */
  distanceLabel: string;
  monthKey: string;
}

export interface TimelineMonth {
  monthKey: string;
  monthLabel: string;
  entries: TimelineEntry[];
  count: number;
  avgFeeling: number;
}

export interface FeelingTrend {
  recentAvg: number | null;
  baselineAvg: number | null;
  /** recentAvg − baselineAvg（换算到 1–10 亲密度刻度） */
  delta: number;
  recentCount: number;
  baselineCount: number;
  hasBaseline: boolean;
}
