/**
 * 拓扑图 / 力导向仿真 / 洞察 / 建议 / 导入导出 的领域模型。
 *
 * 只含纯类型与纯数据，不含任何实现、框架、浏览器 API。
 */

import type { Person, RelationTypeId } from './PersonModels';
import type { Interaction } from './InteractionModels';
// 再导出不会把类型引入本文件作用域，本文件内部用到的类型需要单独 import type
import type { DormancyLevel, FrequencyInfo, InsightResult, MaintenanceAdvice } from './InsightModels';

/** 可播种伪随机源（由 RandomPort 注入，core 内不得直接使用 Math.random） */
export type RandomFn = () => number;

/* 洞察 / 建议 / 频率时间轴：定义在 InsightModels.ts，此处统一再导出，调用方只需 import TopologyModels */
export type {
  DormancyLevel,
  DormancyLevelRule,
  DormantAlert,
  CoreMember,
  IdleRecord,
  TopologyStats,
  InsightResult,
  AdvicePriority,
  MaintenanceAdvice,
  AdviceViewItem,
  AdviceContext,
  LastContactSource,
  FrequencyInfo,
  TimelineEntry,
  TimelineMonth,
  FeelingTrend
} from './InsightModels';

/* 导出与备份：定义在 ExportModels.ts，此处统一再导出 */
export type {
  SvgLegendShape,
  SvgLegendItem,
  SvgExportNode,
  SvgExportEdge,
  SvgExportInput,
  BackupPayload,
  BackupParseResult,
  ImportMode,
  ImportOutcome,
  DemoDataset
} from './ExportModels';

/* ------------------------------------------------------------------ */
/* 设置与筛选                                                          */
/* ------------------------------------------------------------------ */

export type ThemeMode = 'dark' | 'light';

/** 图筛选模式：全部 / 仅疏远预警 / 仅核心圈层 */
export type GraphFilterMode = 'all' | 'dormant' | 'core';

export type RelationFilter = RelationTypeId | 'all';

export interface GraphFilter {
  mode: GraphFilterMode;
  relationType: RelationFilter;
}

export interface AppSettings {
  schemaVersion: number;
  theme: ThemeMode;
  /** 力导向初始布局种子，保证同一份数据 + 同一种子可复现 */
  layoutSeed: number;
  filter: GraphFilter;
  /** 是否强制显示全部标签（默认按缩放级别自动决定） */
  showLabels: boolean;
}


/* ------------------------------------------------------------------ */
/* 力导向物理仿真                                                      */
/* ------------------------------------------------------------------ */

export interface LayoutViewport {
  width: number;
  height: number;
}

/** 物理参数（全部来自 core/domain/topologyConfig.ts，仿真内不得内联数值） */
export interface PhysicsParams {
  /** 斥力系数：F = repulsion / d² */
  repulsion: number;
  /** 斥力最小作用距离，避免 d → 0 时数值爆炸 */
  minDistance: number;
  /** 单节点单帧受力上限 */
  maxForcePerStep: number;
  /** 弹簧劲度系数：F = (d − restLength) * stiffness */
  springStiffness: number;
  /** 最疏远关系对应的弹簧自然长度 */
  restLengthMax: number;
  /** 最亲密关系对应的弹簧自然长度 */
  restLengthMin: number;
  /** 联系频率越高，自然长度越短的附加收缩量 */
  frequencyRestLengthBoost: number;
  /** 向心力强度 */
  centeringStrength: number;
  /** 速度阻尼 */
  damping: number;
  /** 单帧速度上限 */
  maxVelocity: number;
  /** 单帧位移上限 */
  maxDisplacement: number;
  /** alpha 每帧衰减量 */
  alphaDecay: number;
  /** alpha 下限（衰减到此值即停止仿真） */
  alphaMin: number;
  /** 画布边界内边距 */
  boundaryPadding: number;
  /** 初始抛撒半径 = min(width,height) × 该比例 */
  initialSpreadRatio: number;
  /** 初始位置的种子抖动幅度（弧度） */
  initialJitter: number;
}

export interface LayoutParams {
  physics: PhysicsParams;
  viewport: LayoutViewport;
  /** 本次布局使用的随机种子（可复现） */
  seed: number;
}

/** createLayout 的节点输入 */
export interface LayoutNodeSeed {
  id: string;
  intimacy: number;
  core: boolean;
  dormant: boolean;
  /** 关系权重，用于初始半径分布 */
  weight: number;
}

/** createLayout 的连线输入 */
export interface LayoutEdgeSeed {
  id: string;
  source: string;
  target: string;
  /** 弹簧强度倍率（关系越强弹簧越硬） */
  strength: number;
  /** 双方近 90 天互动频次均值，影响自然长度 */
  frequency: number;
  /** 预测将疏远（两端之一接近 90 天阈值） */
  predictedDormant: boolean;
}

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 拖拽期间的固定坐标；null 表示自由 */
  fx: number | null;
  fy: number | null;
  intimacy: number;
  radius: number;
  core: boolean;
  dormant: boolean;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  strength: number;
  frequency: number;
  /** 由两端亲密度与联系频率推导的弹簧自然长度 */
  restLength: number;
  predictedDormant: boolean;
}

export interface LayoutState {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  alpha: number;
  tick: number;
  settled: boolean;
  seed: number;
  viewport: LayoutViewport;
}


/* ------------------------------------------------------------------ */
/* 拓扑图数据                                                          */
/* ------------------------------------------------------------------ */

export interface TopologyNode {
  person: Person;
  frequency: FrequencyInfo;
  isCore: boolean;
  isDormant: boolean;
  dormantLevel: DormancyLevel | null;
  /** r = 6 + intimacy × 2.2 */
  radius: number;
  color: string;
  /** 是否命中当前筛选条件（未命中者淡出而非移除） */
  matchesFilter: boolean;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  sharedTopics: string[];
  sameRelation: boolean;
  /** 关系强度 0–1 */
  weight: number;
  /** 弹簧强度倍率 */
  strength: number;
  /** 双方近 90 天互动频次均值 */
  frequency: number;
  width: number;
  color: string;
  predictedDormant: boolean;
}

export interface TopologyData {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  visibleNodeIds: string[];
  /** 节点数 > 120 时给出性能提示 */
  performanceWarning: boolean;
  maxFrequency: number;
}


/* ------------------------------------------------------------------ */
/* 关系类型分布统计                                                    */
/* ------------------------------------------------------------------ */

export interface RelationDistributionBucket {
  relationType: RelationTypeId;
  label: string;
  color: string;
  icon: string;
  count: number;
  ratio: number;
  avgIntimacy: number;
  coreCount: number;
  dormantCount: number;
}

export interface DonutSegment {
  relationType: RelationTypeId;
  label: string;
  color: string;
  path: string;
  ratio: number;
  count: number;
  avgIntimacy: number;
  /** 用于定位 hover 标签的角度（度） */
  midAngle: number;
  labelX: number;
  labelY: number;
}

export interface BarDatum {
  relationType: RelationTypeId;
  label: string;
  color: string;
  value: number;
  display: string;
}


/* ------------------------------------------------------------------ */
/* 标签显示规划                                                        */
/* ------------------------------------------------------------------ */

export interface LabelCandidate {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  /** 优先级权重（越大越优先显示） */
  weight: number;
  /** 悬停 / 选中 / 邻接节点，必须显示 */
  pinned: boolean;
}


/* ------------------------------------------------------------------ */
/* 视图状态（usecase → UI 的单向数据快照）                             */
/* ------------------------------------------------------------------ */

export interface TopologyViewState {
  persons: Person[];
  interactions: Interaction[];
  settings: AppSettings;
  insights: InsightResult;
  topology: TopologyData;
  distribution: RelationDistributionBucket[];
  adviceByPerson: Record<string, MaintenanceAdvice[]>;
  handledAdviceIds: string[];
  interactionIndex: Record<string, Interaction[]>;
  today: string;
  /** 本次载入是否发生了旧 schema 迁移 */
  migrated: boolean;
  /** 本次载入被跳过的不可恢复脏记录数 */
  skippedRecords: number;
}
