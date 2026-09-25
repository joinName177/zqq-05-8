/**
 * 关系类型元数据（纯数据）：中文名 + 固定颜色 + 图标。
 *
 * 颜色映射常量本身集中在 `core/domain/topologyConfig.ts`（RELATION_TYPE_COLORS），
 * 此处负责把「标识 / 名称 / 颜色 / 图标」组装成 UI 可直接消费的元数据。
 */

import type { RelationTypeId } from '../domain/PersonModels';
import { RELATION_TYPE_COLORS } from '../domain/topologyConfig';

export interface RelationTypeMeta {
  id: RelationTypeId;
  label: string;
  color: string;
  icon: string;
  description: string;
}

export const RELATION_TYPES: readonly RelationTypeMeta[] = [
  { id: 'family', label: '家人', color: RELATION_TYPE_COLORS.family, icon: '🏠', description: '血缘与家庭纽带' },
  { id: 'bestFriend', label: '挚友', color: RELATION_TYPE_COLORS.bestFriend, icon: '🫂', description: '可托付的深度关系' },
  { id: 'colleague', label: '同事', color: RELATION_TYPE_COLORS.colleague, icon: '💼', description: '工作协作关系' },
  { id: 'classmate', label: '同学', color: RELATION_TYPE_COLORS.classmate, icon: '🎓', description: '同窗与校友' },
  { id: 'partner', label: '合作伙伴', color: RELATION_TYPE_COLORS.partner, icon: '🤝', description: '事业与商业伙伴' },
  { id: 'acquaintance', label: '泛社交', color: RELATION_TYPE_COLORS.acquaintance, icon: '🌐', description: '弱连接与点头之交' },
  { id: 'ex', label: '前任', color: RELATION_TYPE_COLORS.ex, icon: '💔', description: '已结束的亲密关系' },
  { id: 'other', label: '其他', color: RELATION_TYPE_COLORS.other, icon: '✨', description: '未分类关系' }
];

const RELATION_TYPE_MAP: Record<RelationTypeId, RelationTypeMeta> = RELATION_TYPES.reduce(
  (accumulator, meta) => {
    accumulator[meta.id] = meta;
    return accumulator;
  },
  {} as Record<RelationTypeId, RelationTypeMeta>
);

/** 判断任意值是否合法关系类型 */
export function isRelationTypeId(value: unknown): value is RelationTypeId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(RELATION_TYPE_MAP, value);
}

/** 安全获取元数据（未知值回落到「其他」） */
export function getRelationType(id: RelationTypeId): RelationTypeMeta {
  return RELATION_TYPE_MAP[id] ?? (RELATION_TYPE_MAP.other as RelationTypeMeta);
}

export function relationLabel(id: RelationTypeId): string {
  return getRelationType(id).label;
}

export function relationColor(id: RelationTypeId): string {
  return getRelationType(id).color;
}
