/**
 * 话题词库（纯数据）：用于 F4 规则 5「共建共同话题」的兜底建议。
 *
 * 首选来源是「同类型人物高频标签聚合」（`distributionStats.aggregateTopicsByRelationType`），
 * 当同类型人物没有标签时，从下面的词库按关系类型回退。
 */

import type { RelationTypeId } from '../domain/PersonModels';

export const TOPIC_LEXICON: Record<RelationTypeId, readonly string[]> = {
  family: ['家常近况', '父母健康', '家族聚会', '童年回忆', '节假日安排'],
  bestFriend: ['近况吐槽', '一起旅行', '共同爱好', '人生规划', '新上映的电影'],
  colleague: ['项目进展', '行业动态', '职业发展', '团队协作', '通勤与加班'],
  classmate: ['同学聚会', '考证与进修', '校园回忆', '行业转行', '共同老师近况'],
  partner: ['合作机会', '商业模式', '资源对接', '行业趋势', '合同与分成'],
  acquaintance: ['共同朋友近况', '兴趣社群', '最近的展览', '城市生活', '轻量问候'],
  ex: ['共同朋友', '该有的边界', '过去的复盘', '各自的近况'],
  other: ['最近在忙什么', '共同兴趣', '读书与播客', '运动健身', '美食与探店']
};

/** 与关系类型无关的通用话题池 */
export const GENERIC_TOPIC_POOL: readonly string[] = [
  '最近的周末安排',
  '正在追的剧或书',
  '运动与健康',
  '工作与生活的平衡',
  '一次久违的见面'
];

/** 取某关系类型的兜底话题（不重复、按给定数量截断） */
export function fallbackTopics(relationType: RelationTypeId, count: number): string[] {
  const specific = TOPIC_LEXICON[relationType] ?? [];
  const merged = [...specific, ...GENERIC_TOPIC_POOL];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const topic of merged) {
    if (seen.has(topic)) continue;
    seen.add(topic);
    result.push(topic);
    if (result.length >= count) break;
  }
  return result;
}
