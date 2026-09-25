/**
 * 互动记录领域模型。纯类型 + 常量，无副作用。
 */

/** 互动类型（7 种，与提示词 F4 一致） */
export type InteractionKind = 'meet' | 'call' | 'message' | 'gift' | 'activity' | 'conflict' | 'apology';

/** 一次互动记录 */
export interface Interaction {
  id: string;
  personId: string;
  /** 互动日期 YYYY-MM-DD（不得晚于今天） */
  date: string;
  kind: InteractionKind;
  /** 时长（分钟，可选，未填为 null） */
  durationMinutes: number | null;
  /** 备注，≤ MAX_INTERACTION_NOTE_LENGTH 字 */
  note: string;
  /** 互动后主观感受 1–5 */
  feeling: number;
  /** 记录创建时间（由 ClockPort 提供） */
  createdAt: string;
}

/** 新增互动表单草稿 */
export interface InteractionDraft {
  date: string;
  kind: InteractionKind;
  durationMinutes: number | null;
  note: string;
  feeling: number;
}

/** 互动类型元数据：中文名 + 图标 + 情感极性（用于时间轴着色与冲突判定） */
export interface InteractionKindMeta {
  id: InteractionKind;
  label: string;
  icon: string;
  tone: 'positive' | 'neutral' | 'negative';
}

/** 互动类型元数据表（纯数据，供 UI 与规则共用） */
export const INTERACTION_KINDS: readonly InteractionKindMeta[] = [
  { id: 'meet', label: '见面', icon: '☕', tone: 'positive' },
  { id: 'call', label: '通话', icon: '📞', tone: 'positive' },
  { id: 'message', label: '消息', icon: '💬', tone: 'neutral' },
  { id: 'gift', label: '礼物', icon: '🎁', tone: 'positive' },
  { id: 'activity', label: '共同活动', icon: '🎯', tone: 'positive' },
  { id: 'conflict', label: '冲突', icon: '⚡', tone: 'negative' },
  { id: 'apology', label: '道歉', icon: '🕊️', tone: 'positive' }
];

const INTERACTION_KIND_MAP: Record<InteractionKind, InteractionKindMeta> = {
  meet: INTERACTION_KINDS[0],
  call: INTERACTION_KINDS[1],
  message: INTERACTION_KINDS[2],
  gift: INTERACTION_KINDS[3],
  activity: INTERACTION_KINDS[4],
  conflict: INTERACTION_KINDS[5],
  apology: INTERACTION_KINDS[6]
};

/** 安全获取互动类型元数据（未知值回落到「消息」） */
export function getInteractionKindMeta(id: InteractionKind): InteractionKindMeta {
  return INTERACTION_KIND_MAP[id] ?? INTERACTION_KIND_MAP.message;
}

/** 判断是否为合法的互动类型 */
export function isInteractionKind(value: unknown): value is InteractionKind {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(INTERACTION_KIND_MAP, value);
}

/** 空互动草稿工厂 */
export function createEmptyInteractionDraft(todayIso: string, feeling: number): InteractionDraft {
  return { date: todayIso, kind: 'meet', durationMinutes: null, note: '', feeling };
}
