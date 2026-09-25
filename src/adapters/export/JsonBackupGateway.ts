/**
 * F5：JSON 备份导出 / 导入（实现 `ports/out/BackupGateway`）。
 *
 * - 导出带 `version` / `app` / `exportedAt` 元信息
 * - 导入做格式校验 + 版本校验 + 逐条兜底，绝不抛错
 */

import { BACKUP_APP_ID, SCHEMA_VERSION } from '../../core/domain/topologyConfig';
import type { Person } from '../../core/domain/PersonModels';
import type { Interaction } from '../../core/domain/InteractionModels';
import type { BackupParseResult, BackupPayload } from '../../core/domain/TopologyModels';
import {
  coerceInteractionRecord,
  coercePersonRecord,
  coerceSettingsRecord,
  detectSchemaVersion
} from '../../core/services/schemaMigration';
import { createIdFactory, type IdFactory } from '../../core/services/idFactory';
import type { BackupGateway, BackupSource } from '../../ports/out/BackupGateway';
import type { ClockPort } from '../../ports/out/ClockPort';
import type { RandomPort } from '../../ports/out/RandomPort';
import { downloadTextFile } from './BrowserFileDownloader';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string, fallback = ''): string {
  const value = source[key];
  return typeof value === 'string' ? value : fallback;
}

export class JsonBackupGateway implements BackupGateway {
  private readonly makePersonId: IdFactory;
  private readonly makeInteractionId: IdFactory;

  constructor(private readonly clock: ClockPort, random: RandomPort) {
    this.makePersonId = createIdFactory(random.createRng(random.nextSeed()), 'person');
    this.makeInteractionId = createIdFactory(random.createRng(random.nextSeed()), 'interaction');
  }

  serialize(source: BackupSource, exportedAt: string): string {
    const payload: BackupPayload = {
      version: SCHEMA_VERSION,
      app: BACKUP_APP_ID,
      exportedAt,
      persons: source.persons.map((person) => ({ ...person, topics: [...person.topics] })),
      interactions: source.interactions.map((interaction) => ({ ...interaction })),
      settings: { ...source.settings }
    };
    return JSON.stringify(payload, null, 2);
  }

  parse(raw: string): BackupParseResult {
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      return { ok: false, errors: ['备份内容为空'], payload: null };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return { ok: false, errors: ['JSON 解析失败：内容不是合法的 JSON 文本'], payload: null };
    }

    if (!isRecord(parsed)) {
      return { ok: false, errors: ['备份根节点必须是对象（{ version, persons, interactions }）'], payload: null };
    }

    if (!Array.isArray(parsed.persons)) {
      return { ok: false, errors: ['缺少 persons 数组，无法导入'], payload: null };
    }

    const version = detectSchemaVersion(parsed);
    if (version > SCHEMA_VERSION) {
      return {
        ok: false,
        errors: [`备份版本 ${version} 高于当前支持的版本 ${SCHEMA_VERSION}，请升级应用后再导入`],
        payload: null
      };
    }

    const errors: string[] = [];
    if (!Array.isArray(parsed.interactions)) {
      errors.push('interactions 字段缺失或不是数组，已按空数组处理');
    }

    const today = this.clock.todayIso();
    const timestamp = this.clock.nowIso();

    const persons: Person[] = [];
    const usedIds = new Set<string>();
    for (const item of parsed.persons) {
      const person = coercePersonRecord(item, today, timestamp, this.makePersonId);
      if (!person) continue;
      if (usedIds.has(person.id)) person.id = this.makePersonId();
      usedIds.add(person.id);
      persons.push(person);
    }

    const interactions: Interaction[] = [];
    const usedInteractionIds = new Set<string>();
    const rawInteractions = Array.isArray(parsed.interactions) ? parsed.interactions : [];
    for (const item of rawInteractions) {
      const interaction = coerceInteractionRecord(item, today, timestamp, this.makeInteractionId, usedIds);
      if (!interaction) continue;
      if (usedInteractionIds.has(interaction.id)) interaction.id = this.makeInteractionId();
      usedInteractionIds.add(interaction.id);
      interactions.push(interaction);
    }

    if (persons.length === 0 && parsed.persons.length > 0) {
      return { ok: false, errors: ['所有人物记录都缺少必要字段（姓名），无法导入'], payload: null };
    }

    const payload: BackupPayload = {
      version,
      app: readString(parsed, 'app', BACKUP_APP_ID),
      exportedAt: readString(parsed, 'exportedAt', timestamp),
      persons,
      interactions,
      settings: coerceSettingsRecord(parsed.settings, 1)
    };

    return { ok: true, errors, payload };
  }

  download(json: string, filename: string): void {
    downloadTextFile(json, filename, 'application/json');
  }
}
