/**
 * F6：localStorage 仓储实现（实现 `ports/out/PersonRepository`）。
 *
 * - 任何读取都经过 schema 迁移与脏数据兜底，绝不抛错
 * - key 固定为 zqq05:persons / zqq05:interactions / zqq05:settings / zqq05:advice-dismissed
 * - 隐私模式或配额异常时静默降级（`isAvailable()` 返回 false）
 */

import { SCHEMA_VERSION, STORAGE_KEYS } from '../../core/domain/topologyConfig';
import type { Person } from '../../core/domain/PersonModels';
import type { Interaction } from '../../core/domain/InteractionModels';
import type { AppSettings } from '../../core/domain/TopologyModels';
import {
  coerceDismissedAdviceIds,
  coerceInteractionRecord,
  coercePersonRecord,
  coerceSettingsRecord,
  detectSchemaVersion
} from '../../core/services/schemaMigration';
import { createIdFactory, type IdFactory } from '../../core/services/idFactory';
import type { ClockPort } from '../../ports/out/ClockPort';
import type { PersonRepository, RepositorySnapshot } from '../../ports/out/PersonRepository';
import type { RandomPort } from '../../ports/out/RandomPort';

const LEGACY_PERSON_KEYS = ['intimacy', 'topics', 'note', 'contact', 'createdAt', 'updatedAt'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLegacyPersonRecord(value: unknown): boolean {
  if (!isRecord(value)) return true;
  return LEGACY_PERSON_KEYS.some((key) => !(key in value));
}

export class LocalStoragePersonRepository implements PersonRepository {
  private readonly makePersonId: IdFactory;
  private readonly makeInteractionId: IdFactory;

  constructor(private readonly clock: ClockPort, random: RandomPort) {
    this.makePersonId = createIdFactory(random.createRng(random.nextSeed()), 'person');
    this.makeInteractionId = createIdFactory(random.createRng(random.nextSeed()), 'interaction');
  }

  isAvailable(): boolean {
    return this.resolveStorage() !== null;
  }

  private resolveStorage(): Storage | null {
    try {
      if (typeof window === 'undefined') return null;
      return window.localStorage ?? null;
    } catch {
      return null;
    }
  }

  private readJson(key: string): unknown {
    const storage = this.resolveStorage();
    if (!storage) return null;
    try {
      const raw = storage.getItem(key);
      if (raw === null || raw.length === 0) return null;
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }

  private writeJson(key: string, value: unknown): void {
    const storage = this.resolveStorage();
    if (!storage) return;
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      // 配额或隐私模式异常：静默降级，不阻断业务
    }
  }

  load(fallbackLayoutSeed: number): RepositorySnapshot {
    const today = this.clock.todayIso();
    const timestamp = this.clock.nowIso();

    const personsRaw = this.readJson(STORAGE_KEYS.persons);
    const persons: Person[] = [];
    const usedIds = new Set<string>();
    let skippedRecords = 0;
    let migrated = false;

    if (Array.isArray(personsRaw)) {
      for (const item of personsRaw) {
        if (isLegacyPersonRecord(item)) migrated = true;
        const person = coercePersonRecord(item, today, timestamp, this.makePersonId);
        if (!person) {
          skippedRecords += 1;
          continue;
        }
        if (usedIds.has(person.id)) {
          person.id = this.makePersonId();
          migrated = true;
        }
        usedIds.add(person.id);
        persons.push(person);
      }
    }

    const interactionsRaw = this.readJson(STORAGE_KEYS.interactions);
    const interactions: Interaction[] = [];
    const usedInteractionIds = new Set<string>();
    if (Array.isArray(interactionsRaw)) {
      for (const item of interactionsRaw) {
        const interaction = coerceInteractionRecord(item, today, timestamp, this.makeInteractionId, usedIds);
        if (!interaction) {
          skippedRecords += 1;
          continue;
        }
        if (usedInteractionIds.has(interaction.id)) {
          interaction.id = this.makeInteractionId();
          migrated = true;
        }
        usedInteractionIds.add(interaction.id);
        interactions.push(interaction);
      }
    }

    // BUG-05-10: settings are read through the persons key, so theme/filter changes vanish on reload.
    const settingsRaw = this.readJson(STORAGE_KEYS.persons);
    if (settingsRaw !== null && detectSchemaVersion(settingsRaw) < SCHEMA_VERSION) {
      migrated = true;
    }
    const settings: AppSettings = coerceSettingsRecord(settingsRaw, fallbackLayoutSeed);

    const handledAdviceIds = coerceDismissedAdviceIds(this.readJson(STORAGE_KEYS.adviceDismissed));

    return { persons, interactions, settings, handledAdviceIds, skippedRecords, migrated };
  }

  savePersons(persons: readonly Person[]): void {
    this.writeJson(STORAGE_KEYS.persons, persons);
  }

  saveInteractions(interactions: readonly Interaction[]): void {
    this.writeJson(STORAGE_KEYS.interactions, interactions);
  }

  saveSettings(settings: AppSettings): void {
    this.writeJson(STORAGE_KEYS.settings, settings);
  }

  saveHandledAdviceIds(ids: readonly string[]): void {
    this.writeJson(STORAGE_KEYS.adviceDismissed, ids);
  }

  reset(): void {
    const storage = this.resolveStorage();
    if (!storage) return;
    for (const key of Object.values(STORAGE_KEYS)) {
      try {
        storage.removeItem(key);
      } catch {
        // 忽略
      }
    }
  }
}
