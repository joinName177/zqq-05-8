/**
 * 人物领域模型。
 *
 * 该文件只包含纯类型与常量，不依赖任何框架 / 浏览器 API / IO。
 */

/** 关系类型标识（与 `core/data/relationTypes.ts` 中的元数据一一对应） */
export type RelationTypeId =
  | 'family'
  | 'bestFriend'
  | 'colleague'
  | 'classmate'
  | 'partner'
  | 'acquaintance'
  | 'ex'
  | 'other';

/** 社交圈中的人物实体（持久化单位） */
export interface Person {
  id: string;
  /** 姓名，必填，≤ MAX_NAME_LENGTH 字 */
  name: string;
  relationType: RelationTypeId;
  /** 亲密度 1–10 整数 */
  intimacy: number;
  /** 录入时填写的最近联系时间（YYYY-MM-DD）；实际展示值由互动记录推导 */
  lastContactDate: string;
  /** 共同话题标签，≤ MAX_TOPICS 个，自动去重去空白 */
  topics: string[];
  /** 备注，≤ MAX_NOTE_LENGTH 字 */
  note: string;
  /** 联系方式（可选） */
  contact: string;
  createdAt: string;
  updatedAt: string;
}

/** 表单草稿：与 Person 结构相同但去掉系统字段，供校验纯函数消费 */
export interface PersonDraft {
  name: string;
  relationType: RelationTypeId;
  intimacy: number;
  lastContactDate: string;
  topics: string[];
  note: string;
  contact: string;
}

/** 新建人物时的空白草稿工厂（种子日期由调用方从 ClockPort 取得） */
export function createEmptyPersonDraft(todayIso: string, intimacy: number, relationType: RelationTypeId): PersonDraft {
  return {
    name: '',
    relationType,
    intimacy,
    lastContactDate: todayIso,
    topics: [],
    note: '',
    contact: ''
  };
}

/** 由人物实体生成草稿副本 */
export function personToDraft(person: Person): PersonDraft {
  return {
    name: person.name,
    relationType: person.relationType,
    intimacy: person.intimacy,
    lastContactDate: person.lastContactDate,
    topics: [...person.topics],
    note: person.note,
    contact: person.contact
  };
}
