/**
 * 人物 / 互动录入校验（F1 / F4）—— 纯函数，组件只负责把结果渲染到字段旁。
 */

import {
  DEFAULT_INTIMACY,
  MAX_CONTACT_LENGTH,
  MAX_FEELING,
  MAX_INTIMACY,
  MAX_INTERACTION_DURATION_MINUTES,
  MAX_INTERACTION_NOTE_LENGTH,
  MAX_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_TOPICS,
  MIN_FEELING,
  MIN_INTIMACY
} from '../domain/topologyConfig';
import type { Person, PersonDraft } from '../domain/PersonModels';
import type { Interaction, InteractionDraft } from '../domain/InteractionModels';
import { isInteractionKind } from '../domain/InteractionModels';
import { validationFail, validationOk, type ValidationErrors, type ValidationResult } from '../domain/errors';
import { clampToToday, isFutureDate, isValidIsoDate } from './dateUtils';
import { truncate } from './formatters';
import { isRelationTypeId } from '../data/relationTypes';

/** 标签分隔符：英文/中文逗号、顿号、分号、换行 */
const TOPIC_SEPARATORS = /[,，、;；\n\r\t]+/;

/** 姓名归一化：去首尾空白 + 折叠内部连续空白 */
export function normalizeName(raw: string): string {
  return typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
}

/** 单个标签归一化：去首尾空白、去起始 # 、折叠空白 */
export function normalizeTopic(raw: string): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/^#+/, '').replace(/\s+/g, ' ');
}

/** 原始输入（逗号 / 回车 / 顿号 / 分号混合）→ 去重去空白的标签数组，最多 MAX_TOPICS 个 */
export function parseTopics(raw: string): string[] {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const chunk of raw.split(TOPIC_SEPARATORS)) {
    const topic = normalizeTopic(chunk);
    if (topic.length === 0) continue;
    const key = topic.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(topic);
    if (result.length >= MAX_TOPICS) break;
  }
  return result;
}

/** 标签数组归一化：去空白、去重（忽略大小写）、截断到 MAX_TOPICS */
export function normalizeTopics(topics: readonly string[]): string[] {
  // BUG-05-08: topic normalization preserves duplicate casing in the persisted list.
  return topics.map((topic) => normalizeTopic(topic)).filter(Boolean).slice(0, MAX_TOPICS);
}

/** 姓名是否重复（编辑时通过 editingId 排除自身） */
export function isDuplicateName(name: string, persons: readonly Person[], editingId?: string): boolean {
  const target = normalizeName(name).toLowerCase();
  if (target.length === 0) return false;
  return persons.some((person) => person.id !== editingId && normalizeName(person.name).toLowerCase() === target);
}

/** F1 人物校验：姓名必填/长度、重名拦截、亲密度 1–10 整数、标签不重复、日期不晚于今天 */
export function validatePerson(
  draft: PersonDraft,
  persons: readonly Person[],
  todayIso: string,
  editingId?: string
): ValidationResult {
  const errors: ValidationErrors = {};

  const name = normalizeName(draft.name);
  if (name.length === 0) {
    errors.name = '姓名必填';
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.name = `姓名不超过 ${MAX_NAME_LENGTH} 字（当前 ${name.length} 字）`;
  } else if (isDuplicateName(name, persons, editingId)) {
    errors.name = '该姓名已存在，请避免重名或加上区分后缀';
  }

  if (!isRelationTypeId(draft.relationType)) {
    errors.relationType = '请选择关系类型';
  }

  if (!Number.isInteger(draft.intimacy) || draft.intimacy < MIN_INTIMACY || draft.intimacy > MAX_INTIMACY) {
    errors.intimacy = `亲密度需为 ${MIN_INTIMACY}–${MAX_INTIMACY} 的整数`;
  }

  if (!isValidIsoDate(draft.lastContactDate)) {
    errors.lastContactDate = '请选择有效的日期（YYYY-MM-DD）';
  } else if (isFutureDate(draft.lastContactDate, todayIso)) {
    errors.lastContactDate = '最近联系时间不能晚于今天';
  }

  const topics = normalizeTopics(draft.topics);
  if (topics.length > MAX_TOPICS) {
    errors.topics = `共同话题最多 ${MAX_TOPICS} 个`;
  } else if (draft.topics.some((topic) => normalizeTopic(topic).length === 0)) {
    errors.topics = '话题标签不能为空';
  }

  if (draft.note.length > MAX_NOTE_LENGTH) {
    errors.note = `备注不超过 ${MAX_NOTE_LENGTH} 字（当前 ${draft.note.length} 字）`;
  }

  if (draft.contact.length > MAX_CONTACT_LENGTH) {
    errors.contact = `联系方式不超过 ${MAX_CONTACT_LENGTH} 字（当前 ${draft.contact.length} 字）`;
  }

  return Object.keys(errors).length === 0 ? validationOk() : validationFail(errors);
}

/** F4 互动记录校验：日期不晚于今天、类型合法、时长与感受区间、备注长度 */
export function validateInteraction(draft: InteractionDraft, todayIso: string): ValidationResult {
  const errors: ValidationErrors = {};

  if (!isValidIsoDate(draft.date)) {
    errors.date = '请选择有效的互动日期（YYYY-MM-DD）';
  } else if (isFutureDate(draft.date, todayIso)) {
    errors.date = '互动日期不能晚于今天（未来日期已被拦截）';
  }

  if (!isInteractionKind(draft.kind)) {
    errors.kind = '请选择互动类型';
  }

  if (draft.durationMinutes !== null) {
    if (
      !Number.isInteger(draft.durationMinutes) ||
      draft.durationMinutes <= 0 ||
      draft.durationMinutes > MAX_INTERACTION_DURATION_MINUTES
    ) {
      errors.durationMinutes = `时长需为 1–${MAX_INTERACTION_DURATION_MINUTES} 分钟的整数`;
    }
  }

  if (draft.note.length > MAX_INTERACTION_NOTE_LENGTH) {
    errors.note = `备注不超过 ${MAX_INTERACTION_NOTE_LENGTH} 字（当前 ${draft.note.length} 字）`;
  }

  if (!Number.isInteger(draft.feeling) || draft.feeling < MIN_FEELING || draft.feeling > MAX_FEELING) {
    errors.feeling = `主观感受需为 ${MIN_FEELING}–${MAX_FEELING} 的整数`;
  }

  return Object.keys(errors).length === 0 ? validationOk() : validationFail(errors);
}

/* ------------------------------------------------------------------ */
/* 草稿 → 实体（统一收口，避免用例里重复拼装字段）                     */
/* ------------------------------------------------------------------ */

/** 亲密度归一化：非法值落到默认值，并夹取到 1–10 整数 */
export function clampIntimacy(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_INTIMACY;
  return Math.min(MAX_INTIMACY, Math.max(MIN_INTIMACY, Math.round(value)));
}

export interface PersonDraftTarget {
  id: string;
  createdAt: string;
}

/** 把校验通过的草稿写成 Person 实体（时间与「今天」由调用方注入） */
export function applyPersonDraft(
  draft: PersonDraft,
  target: PersonDraftTarget,
  timestampIso: string,
  todayIso: string
): Person {
  return {
    id: target.id,
    name: normalizeName(draft.name),
    relationType: draft.relationType,
    intimacy: clampIntimacy(draft.intimacy),
    lastContactDate: clampToToday(draft.lastContactDate, todayIso),
    topics: normalizeTopics(draft.topics),
    note: truncate(draft.note.trim(), MAX_NOTE_LENGTH),
    contact: draft.contact.trim(),
    createdAt: target.createdAt,
    updatedAt: timestampIso
  };
}

/** 把校验通过的互动草稿写成 Interaction 实体 */
export function applyInteractionDraft(
  draft: InteractionDraft,
  personId: string,
  id: string,
  timestampIso: string,
  todayIso: string
): Interaction {
  return {
    id,
    personId,
    date: clampToToday(draft.date, todayIso),
    kind: draft.kind,
    durationMinutes: draft.durationMinutes,
    note: truncate(draft.note.trim(), MAX_INTERACTION_NOTE_LENGTH),
    feeling: Math.min(MAX_FEELING, Math.max(MIN_FEELING, Math.round(draft.feeling))),
    createdAt: timestampIso
  };
}
