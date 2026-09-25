/**
 * 全量业务阈值 / 物理参数 / 颜色映射常量 —— 项目唯一的「魔法数字」归宿。
 *
 * 约束：`core/services`、`core/usecases`、`adapters/ui` 内**不得**内联这些数值，
 * 必须从此文件导入，保证验收时可逐条核对（90 天 / 8 分 / 30 天 / 60 天 / 阻尼 0.82 …）。
 */

import type { RelationTypeId } from './PersonModels';
import type {
  AdvicePriority,
  AppSettings,
  DormancyLevel,
  DormancyLevelRule,
  PhysicsParams
} from './TopologyModels';

/* ================================================================== */
/* 1. 录入字段限制与校验                                               */
/* ================================================================== */

/** F1：姓名必填且 ≤ 20 字 */
export const MAX_NAME_LENGTH = 20;
/** F1：共同话题标签 ≤ 8 个 */
export const MAX_TOPICS = 8;
/** F1：备注 ≤ 100 字 */
export const MAX_NOTE_LENGTH = 100;
/** F1：联系方式可选，≤ 60 字 */
export const MAX_CONTACT_LENGTH = 60;
/** F4：单条互动备注 ≤ 80 字 */
export const MAX_INTERACTION_NOTE_LENGTH = 80;
/** F1：亲密度区间 1–10 整数 */
export const MIN_INTIMACY = 1;
export const MAX_INTIMACY = 10;
export const DEFAULT_INTIMACY = 5;
/** F4：主观感受区间 1–5 */
export const MIN_FEELING = 1;
export const MAX_FEELING = 5;
export const DEFAULT_FEELING = 3;
/** F4：单次互动时长上限（分钟，24 小时） */
export const MAX_INTERACTION_DURATION_MINUTES = 1440;

/** F1：亲密度滑杆文案（1 = 点头之交 … 10 = 无话不谈） */
export const INTIMACY_LABELS: Record<number, string> = {
  1: '点头之交',
  2: '略有交集',
  3: '普通熟人',
  4: '偶尔来往',
  5: '常来常往',
  6: '比较熟络',
  7: '交情不错',
  8: '亲密好友',
  9: '知己好友',
  10: '无话不谈'
};

/* ================================================================== */
/* 2. 洞察阈值（F3）                                                   */
/* ================================================================== */

/** F3：疏远预警阈值 —— 超过 90 天未联系即预警 */
export const DORMANCY_THRESHOLD_DAYS = 90;

/** F3：疏远预警分级 —— 90–119 提醒 / 120–179 警告 / ≥180 严重（降序匹配） */
export const DORMANCY_LEVELS: readonly DormancyLevelRule[] = [
  { level: 'severe', minDays: 180, label: '严重疏远' },
  { level: 'warning', minDays: 120, label: '警告' },
  { level: 'notice', minDays: DORMANCY_THRESHOLD_DAYS, label: '提醒' }
];

/** F3：核心圈层阈值 —— 亲密度 ≥ 8 */
export const CORE_INTIMACY_THRESHOLD = 8;

/** F4 规则 2：核心圈层成员超过 30 天未联系 → 高优先级提醒 */
export const CORE_STALE_DAYS = 30;

/** F4 规则 3：低亲密度阈值（≤ 4） */
export const LOW_INTIMACY_THRESHOLD = 4;
/** F4 规则 3：近 30 天互动次数 ≥ 5 次即视为投入错位 */
export const MISMATCH_INTERACTION_COUNT = 5;

/** F4 规则 4：近 60 天内出现「冲突」 */
export const CONFLICT_LOOKBACK_DAYS = 60;
/** F4 规则 4：冲突之后 ≥ 14 天无任何互动 */
export const CONFLICT_SILENCE_DAYS = 14;

/** F4 规则 6：亲密度近 30 天均值 对比 前 60 天均值 */
export const COOLING_WINDOW_DAYS = 30;
export const COOLING_BASELINE_WINDOW_DAYS = 60;
/** F4 规则 6：下降 ≥ 2 分即提示关系降温 */
export const COOLING_DROP_THRESHOLD = 2;

/** 主观感受 1–5 换算到亲密度 1–10 刻度的倍率（用于规则 6 的趋势代理指标） */
export const FEELING_TO_INTIMACY_SCALE = 2;

/** F4 规则 5：话题建议条数 */
export const TOPIC_SUGGESTION_COUNT = 3;

/** F4 规则 7：按亲密度分档的建议下次联系间隔（降序匹配） */
export const NEXT_CONTACT_TIERS: readonly { minIntimacy: number; days: number; label: string }[] = [
  { minIntimacy: CORE_INTIMACY_THRESHOLD, days: 7, label: '核心关系（亲密度 ≥ 8）' },
  { minIntimacy: 5, days: 21, label: '稳定关系（亲密度 5–7）' },
  { minIntimacy: MIN_INTIMACY, days: 60, label: '弱连接（亲密度 ≤ 4）' }
];

/** 建议优先级排序权重（数值越小越靠前） */
export const ADVICE_PRIORITY_ORDER: Record<AdvicePriority, number> = { high: 0, medium: 1, low: 2 };

/* ================================================================== */
/* 3. 联系频率与连线映射（F2 / F3）                                    */
/* ================================================================== */

/** F2/F3：联系频率统计窗口 —— 近 90 天 */
export const FREQUENCY_WINDOW_DAYS = 90;
/** F3：指标卡「近 30 天互动次数」窗口 */
export const RECENT_WINDOW_DAYS = 30;
/** F4 规则 6：基准窗口 60 天 */
export const BASELINE_WINDOW_DAYS = 60;

/** F2：连线粗细区间（px） */
export const EDGE_WIDTH_MIN = 0.8;
export const EDGE_WIDTH_MAX = 8;
/** F2：对数映射的计数饱和值（≥ 该次数即取最粗） */
export const EDGE_FREQUENCY_LOG_CAP = 16;

/** F2：连线颜色渐变端点：淡灰（低频）→ 青绿（高频） */
export const EDGE_COLOR_LOW = '#8f9bb3';
export const EDGE_COLOR_HIGH = '#2ee6c5';
/** F2：预测将疏远的关系使用虚线 */
export const EDGE_DASH_PATTERN = '7 6';
/** F2：判定「预测将疏远」的天数（未达 90 天阈值但已过半） */
export const EDGE_DORMANT_FORECAST_DAYS = 60;

/** F2：关系推断权重（共享话题 / 同类型 / 双核心圈） */
export const EDGE_WEIGHT_SHARED_TOPIC = 0.45;
export const EDGE_WEIGHT_SAME_RELATION = 0.35;
export const EDGE_WEIGHT_CORE_PAIR = 0.2;
export const EDGE_WEIGHT_FAMILY_BONUS = 0.15;
/** 低于该权重的疑似关系不连线 */
export const EDGE_MIN_WEIGHT = 0.34;
/** 单节点最大连线数，保证图例可读 */
export const EDGE_MAX_PER_NODE = 6;
/** 关系权重 → 弹簧强度倍率区间 */
export const EDGE_STRENGTH_MIN = 0.6;
export const EDGE_STRENGTH_MAX = 2.4;

/** F2：节点半径 r = NODE_RADIUS_BASE + intimacy × NODE_RADIUS_PER_INTIMACY */
export const NODE_RADIUS_BASE = 6;
export const NODE_RADIUS_PER_INTIMACY = 2.2;
/** F2：核心圈层光晕外扩半径 */
export const CORE_HALO_EXTRA = 6;
/** F2：疏远预警脉冲虚线环外扩半径 */
export const DORMANT_PULSE_EXTRA = 9;
/** F2：脉冲动画周期（秒） */
export const DORMANT_PULSE_DURATION_S = 2.4;

/* ================================================================== */
/* 4. 关系类型颜色映射（F1：每种关系绑定固定颜色）                     */
/* ================================================================== */

export const RELATION_TYPE_COLORS: Record<RelationTypeId, string> = {
  family: '#ff8a5c',
  bestFriend: '#2ee6c5',
  colleague: '#6aa6ff',
  classmate: '#b18cff',
  partner: '#ffd166',
  acquaintance: '#8b9ab3',
  ex: '#ff6b9d',
  other: '#9ee493'
};

/** 疏远预警等级颜色 */
export const SEVERITY_COLORS: Record<DormancyLevel, string> = {
  notice: '#f6c34a',
  warning: '#f59e42',
  severe: '#ef4d5a'
};

/** 建议优先级颜色与文案 */
export const PRIORITY_META: Record<AdvicePriority, { label: string; color: string }> = {
  high: { label: '高优先级', color: '#ff6b81' },
  medium: { label: '中优先级', color: '#f6c34a' },
  low: { label: '低优先级', color: '#6aa6ff' }
};

/** 图上其它视觉常量 */
export const GRAPH_BACKGROUND = '#080c18';
export const GRAPH_BACKGROUND_LIGHT = '#f4f6fc';
export const GRAPH_CENTER_COLOR = 'rgba(124,140,255,0.16)';
export const GRAPH_CORE_HALO_COLOR = '#8b7cff';
export const GRAPH_LABEL_COLOR = '#e8edff';
export const GRAPH_LABEL_COLOR_LIGHT = '#1d2438';
export const GRAPH_NODE_STROKE = 'rgba(255,255,255,0.85)';
export const GRAPH_ACCENT = '#7c8cff';

/* ================================================================== */
/* 5. 物理仿真参数（F2）                                               */
/* ================================================================== */

export const PHYSICS_CONFIG: PhysicsParams = {
  repulsion: 16000,
  minDistance: 26,
  maxForcePerStep: 90,
  springStiffness: 0.045,
  restLengthMax: 240,
  restLengthMin: 72,
  frequencyRestLengthBoost: 30,
  centeringStrength: 0.02,
  damping: 0.82,
  maxVelocity: 18,
  maxDisplacement: 14,
  alphaDecay: 0.0085,
  alphaMin: 0.008,
  boundaryPadding: 30,
  initialSpreadRatio: 0.32,
  initialJitter: 0.45
};

/** 图交互缩放范围与步进 */
export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 1.12;

/** 数据刷新（结构未变）时的 alpha 回热强度，避免每次勾选建议都让图抖动 */
export const REHEAT_ALPHA_STABLE = 0.28;
/** 结构变化（增删人物 / 连线）或手动重排时的 alpha 回热强度 */
export const REHEAT_ALPHA_STRUCTURE = 0.75;
/** 「重新布局」按钮使用的满血回热强度 */
export const REHEAT_ALPHA_FULL = 1;

/** 标签优先级权重附加项：核心圈层 / 疏远预警节点优先显示标签 */
export const LABEL_WEIGHT_CORE_BONUS = 12;
export const LABEL_WEIGHT_DORMANT_BONUS = 8;
/** 标签相对节点顶部的额外上移距离（px） */
export const LABEL_OFFSET_Y = 8;
/** 画布中心氛围光半径 = max(视口宽, 视口高) × 该比例 */
export const GRAPH_CENTER_GLOW_RATIO = 0.34;
/** 节点高光球相对半径的偏移与尺寸比例 */
export const NODE_SHINE_OFFSET_X_RATIO = 0.3;
export const NODE_SHINE_OFFSET_Y_RATIO = 0.35;
export const NODE_SHINE_RADIUS_RATIO = 0.55;

/** 指针位移小于该像素值时判定为「点击」而非「拖拽」 */
export const DRAG_CLICK_THRESHOLD_PX = 3;

/** F2：标签显示策略 */
export const LABEL_ZOOM_THRESHOLD = 1.15;
export const LABEL_MIN_FONT_SIZE = 10;
export const LABEL_MAX_FONT_SIZE = 14;
export const LABEL_FONT_PER_RADIUS = 0.32;
export const MAX_VISIBLE_LABELS = 26;
export const LABEL_OVERLAP_PADDING = 4;

/** F2：节点数超过该值时提示性能（O(n²) 斥力） */
export const PERFORMANCE_NODE_WARNING = 120;

/* ================================================================== */
/* 6. 持久化（F6）                                                     */
/* ================================================================== */

export const STORAGE_KEYS = {
  persons: 'zqq05:persons',
  interactions: 'zqq05:interactions',
  settings: 'zqq05:settings',
  adviceDismissed: 'zqq05:advice-dismissed'
} as const;

/** 当前 schema 版本，用于缺字段迁移 */
export const SCHEMA_VERSION = 2;

/** 应用默认设置（重置与首次载入使用） */
export const DEFAULT_APP_SETTINGS = {
  schemaVersion: SCHEMA_VERSION,
  theme: 'dark',
  layoutSeed: 1,
  filter: { mode: 'all', relationType: 'all' },
  showLabels: false
} as const satisfies AppSettings;
export const BACKUP_APP_ID = 'zqq-05-relationship-topology';

/* ================================================================== */
/* 7. 日期与文案                                                       */
/* ================================================================== */

export const WEEKDAY_LABELS_ZH: readonly string[] = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** F2：SVG 导出画布尺寸与留白 */
export const EXPORT_CANVAS_WIDTH = 1280;
export const EXPORT_CANVAS_HEIGHT = 860;
export const EXPORT_PADDING = 72;
/** 顶部标题区高度（标题 / 生成时间 / 副标题） */
export const EXPORT_HEADER_HEIGHT = 108;
/** 底部图例与统计区高度 */
export const EXPORT_FOOTER_HEIGHT = 196;

/** 示例数据规模（验收要求 12 人） */
export const DEMO_PERSON_COUNT = 12;
