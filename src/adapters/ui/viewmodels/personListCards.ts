/**
 * 人物列表卡片的视图模型（适配器层 UI 关注点）。
 *
 * 把「人物 + 互动 + 洞察 + 筛选/搜索/排序条件」映射成卡片直接可渲染的数据，
 * 计算全部复用 core 的纯函数，组件只负责画出来。
 */

import type { Person } from '../../../core/domain/PersonModels';
import type { Interaction } from '../../../core/domain/InteractionModels';
import type { GraphFilter, InsightResult } from '../../../core/domain/TopologyModels';
import { getRelationType } from '../../../core/data/relationTypes';
import { computeFrequency } from '../../../core/services/contactFrequency';
import { formatIntimacyLabel } from '../../../core/services/formatters';
import { relativeDaysLabel } from '../../../core/services/dateUtils';

export type PersonSortKey = 'intimacy-desc' | 'intimacy-asc' | 'recent-asc' | 'recent-desc' | 'name-asc';

export interface PersonListCard {
  person: Person;
  relationLabel: string;
  relationIcon: string;
  relationColor: string;
  intimacyLabel: string;
  /** 未联系天数（用于排序） */
  days: number;
  daysLabel: string;
  sourceLabel: string;
  count90: number;
  isCore: boolean;
  dormantLabel: string;
  dormantColor: string;
}

export interface PersonListCardQuery {
  persons: readonly Person[];
  interactionIndex: Record<string, readonly Interaction[]>;
  insights: InsightResult;
  filter: GraphFilter;
  today: string;
  keyword: string;
  sortKey: PersonSortKey;
}

function compareBy(sortKey: PersonSortKey): (a: PersonListCard, b: PersonListCard) => number {
  switch (sortKey) {
    case 'intimacy-asc':
      return (a, b) => a.person.intimacy - b.person.intimacy || a.days - b.days;
    case 'recent-asc':
      return (a, b) => a.days - b.days;
    case 'recent-desc':
      return (a, b) => b.days - a.days;
    case 'name-asc':
      return (a, b) => a.person.name.localeCompare(b.person.name, 'zh-Hans-CN');
    case 'intimacy-desc':
    default:
      return (a, b) => b.person.intimacy - a.person.intimacy || b.days - a.days;
  }
}

/** 搜索（姓名 + 标签）→ 筛选（关系类型 + 状态模式）→ 排序 */
export function buildPersonListCards(query: PersonListCardQuery): PersonListCard[] {
  const keyword = query.keyword.trim().toLowerCase();
  const coreIds = new Set(query.insights.core.map((member) => member.personId));
  const dormantById = new Map(query.insights.dormant.map((alert) => [alert.personId, alert] as const));
  const cards: PersonListCard[] = [];

  for (const person of query.persons) {
    const matchesKeyword =
      keyword.length === 0 ||
      person.name.toLowerCase().includes(keyword) ||
      person.topics.some((topic) => topic.toLowerCase().includes(keyword));
    if (!matchesKeyword) continue;
    if (query.filter.relationType !== 'all' && person.relationType !== query.filter.relationType) continue;

    const alert = dormantById.get(person.id) ?? null;
    const isCore = coreIds.has(person.id);
    if (query.filter.mode === 'core' && !isCore) continue;
    if (query.filter.mode === 'dormant' && alert === null) continue;

    const meta = getRelationType(person.relationType);
    const frequency = computeFrequency(person, query.interactionIndex[person.id] ?? [], query.today);
    cards.push({
      person,
      relationLabel: meta.label,
      relationIcon: meta.icon,
      relationColor: meta.color,
      intimacyLabel: formatIntimacyLabel(person.intimacy),
      days: frequency.daysSinceLastContact,
      daysLabel: relativeDaysLabel(frequency.daysSinceLastContact),
      sourceLabel: frequency.lastContactSource === 'interaction' ? '互动推导' : '录入值',
      count90: frequency.count90,
      isCore,
      dormantLabel: alert ? alert.levelLabel : '',
      dormantColor: alert ? alert.levelColor : ''
    });
  }

  return cards.sort(compareBy(query.sortKey));
}
