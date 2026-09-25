/**
 * F6：schema 版本迁移 / 脏数据兜底。
 *
 * 目标：旧数据缺字段时补默认值，**绝不抛错**，也绝不产生 NaN / Invalid Date。
 * 全部为纯函数，时间参考点与 ID 工厂由调用方注入。
 */

import {
  DEFAULT_FEELING,
  DEFAULT_INTIMACY,
  MAX_CONTACT_LENGTH,
  MAX_FEELING,
  MAX_INTIMACY,
  MAX_INTERACTION_DURATION_MINUTES,
  MAX_INTERACTION_NOTE_LENGTH,
  MAX_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  SCHEMA_VERSION,
  STORAGE_KEYS
} from '../domain/topologyConfig';
import type { Person } from '../domain/PersonModels';
import type { Interaction } from '../domain/InteractionModels';
import { isInteractionKind } from '../domain/InteractionModels';
import type { AppSettings, GraphFilter, GraphFilterMode, RelationFilter, ThemeMode } from '../domain/TopologyModels';
import { isRelationTypeId } from '../data/relationTypes';
import { clampToToday, isValidIsoDate } from './dateUtils';
import { normalizeName, normalizeTopics } from './personValidator';
import { truncate } from './formatters';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string, fallback = ''): string {
  const value = source[key];
  return typeof value === 'string' ? value : fallback;
}

function readClampedInt(source: Record<string, unknown>, key: string, fallback: number, min: number, max: number): number {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  return Math.min(max, Math.max(min, rounded));
}

function readBoolean(source: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = source[key];
  return typeof value === 'boolean' ? value : fallback;
}

/** 任意输入 → 字符串数组（去空、去重、去空白） */
export function coerceStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (trimmed.length === 0) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

/** 合法的持久化 key 列表（用于诊断） */
export function storageKeyList(): string[] {
  return [STORAGE_KEYS.persons, STORAGE_KEYS.interactions, STORAGE_KEYS.settings, STORAGE_KEYS.adviceDismissed];
}

/**
 * 读取数据中的 schema 版本号：
 *  - 设置对象用 `schemaVersion`，备份文件用 `version`，两种都兼容
 *  - 缺失或非法时视为 v1（触发全量默认值补齐）
 *  - **不做上界夹取**，否则「备份版本高于当前支持版本」将无法被拒绝
 */
export function detectSchemaVersion(raw: unknown): number {
  if (!isRecord(raw)) return 1;
  const candidate = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : raw.version;
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return Math.max(1, Math.round(candidate));
  }
  return 1;
}

/** 脏数据 → 合法 Person；姓名缺失等不可恢复的记录返回 null（调用方跳过） */
export function coercePersonRecord(
  raw: unknown,
  todayIso: string,
  timestampIso: string,
  makeId: () => string
): Person | null {
  if (!isRecord(raw)) return null;
  const name = normalizeName(readString(raw, 'name')).slice(0, MAX_NAME_LENGTH);
  if (name.length === 0) return null;

  const rawLastContact = readString(raw, 'lastContactDate');
  const lastContactDate = isValidIsoDate(rawLastContact) ? clampToToday(rawLastContact, todayIso) : todayIso;

  const relationTypeRaw = readString(raw, 'relationType', 'other');
  const id = readString(raw, 'id').trim();

  return {
    id: id.length > 0 ? id : makeId(),
    name,
    relationType: isRelationTypeId(relationTypeRaw) ? relationTypeRaw : 'other',
    intimacy: readClampedInt(raw, 'intimacy', DEFAULT_INTIMACY, 1, MAX_INTIMACY),
    lastContactDate,
    topics: normalizeTopics(coerceStringArray(raw.topics)),
    note: truncate(readString(raw, 'note'), MAX_NOTE_LENGTH),
    contact: truncate(readString(raw, 'contact'), MAX_CONTACT_LENGTH),
    createdAt: readString(raw, 'createdAt', timestampIso) || timestampIso,
    updatedAt: readString(raw, 'updatedAt', timestampIso) || timestampIso
  };
}

/** 脏数据 → 合法 Interaction；personId 缺失或指向不存在的人物时返回 null */
export function coerceInteractionRecord(
  raw: unknown,
  todayIso: string,
  timestampIso: string,
  makeId: () => string,
  validPersonIds?: ReadonlySet<string>
): Interaction | null {
  if (!isRecord(raw)) return null;
  const personId = readString(raw, 'personId').trim();
  if (personId.length === 0) return null;
  if (validPersonIds && !validPersonIds.has(personId)) return null;

  const rawDate = readString(raw, 'date');
  const date = isValidIsoDate(rawDate) ? clampToToday(rawDate, todayIso) : todayIso;

  const kindRaw = readString(raw, 'kind', 'message');
  const durationRaw = raw.durationMinutes;
  let durationMinutes: number | null = null;
  if (typeof durationRaw === 'number' && Number.isFinite(durationRaw) && durationRaw > 0) {
    durationMinutes = Math.min(MAX_INTERACTION_DURATION_MINUTES, Math.round(durationRaw));
  }

  const id = readString(raw, 'id').trim();

  return {
    id: id.length > 0 ? id : makeId(),
    personId,
    date,
    kind: isInteractionKind(kindRaw) ? kindRaw : 'message',
    durationMinutes,
    note: truncate(readString(raw, 'note'), MAX_INTERACTION_NOTE_LENGTH),
    feeling: readClampedInt(raw, 'feeling', DEFAULT_FEELING, 1, MAX_FEELING),
    createdAt: readString(raw, 'createdAt', timestampIso) || timestampIso
  };
}

const FILTER_MODES: readonly GraphFilterMode[] = ['all', 'dormant', 'core'];

/** 脏数据 → 合法 AppSettings（含 filter 与主题） */
export function coerceSettingsRecord(raw: unknown, fallbackSeed: number): AppSettings {
  const source = isRecord(raw) ? raw : {};
  const themeRaw = readString(source, 'theme', 'dark');
  const theme: ThemeMode = themeRaw === 'light' ? 'light' : 'dark';

  const filterRaw = isRecord(source.filter) ? source.filter : {};
  const modeRaw = readString(filterRaw, 'mode', 'all');
  const mode = FILTER_MODES.includes(modeRaw as GraphFilterMode) ? (modeRaw as GraphFilterMode) : 'all';
  const relationRaw = readString(filterRaw, 'relationType', 'all');
  const relationType: RelationFilter = isRelationTypeId(relationRaw) ? relationRaw : 'all';
  const filter: GraphFilter = { mode, relationType };

  const seedRaw = source.layoutSeed;
  const layoutSeed =
    typeof seedRaw === 'number' && Number.isFinite(seedRaw) ? Math.max(0, Math.floor(seedRaw)) : fallbackSeed;

  return {
    schemaVersion: SCHEMA_VERSION,
    theme,
    layoutSeed,
    filter,
    showLabels: readBoolean(source, 'showLabels', false)
  };
}

/** 已处理建议 ID 列表 */
export function coerceDismissedAdviceIds(raw: unknown): string[] {
  return coerceStringArray(raw);
}

/** 判断是否为空设置（用于决定是否需要写入默认值） */
export function isDefaultSettings(settings: AppSettings): boolean {
  return (
    settings.filter.mode === 'all' &&
    settings.filter.relationType === 'all' &&
    settings.theme === 'dark' &&
    settings.showLabels === false
  );
}
