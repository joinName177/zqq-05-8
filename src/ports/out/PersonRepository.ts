/**
 * 出站端口：人物 / 互动 / 设置的持久化仓储（F6）。
 *
 * 具体实现见 `adapters/storage/LocalStoragePersonRepository.ts`。
 */

import type { Person } from '../../core/domain/PersonModels';
import type { Interaction } from '../../core/domain/InteractionModels';
import type { AppSettings } from '../../core/domain/TopologyModels';

/** 一次性读出的持久化快照（已完成 schema 迁移与脏数据兜底） */
export interface RepositorySnapshot {
  persons: Person[];
  interactions: Interaction[];
  settings: AppSettings;
  handledAdviceIds: string[];
  /** 载入过程中被跳过的不可恢复记录数（用于 UI 提示，不抛错） */
  skippedRecords: number;
  /** 是否发生了 schema 迁移（旧数据缺字段） */
  migrated: boolean;
}

export interface PersonRepository {
  /** 读取全部数据；缺字段补默认值，不抛错 */
  load(fallbackLayoutSeed: number): RepositorySnapshot;
  savePersons(persons: readonly Person[]): void;
  saveInteractions(interactions: readonly Interaction[]): void;
  saveSettings(settings: AppSettings): void;
  saveHandledAdviceIds(ids: readonly string[]): void;
  /** 清空全部 key */
  reset(): void;
  /** localStorage 是否可用（隐私模式下可能不可用） */
  isAvailable(): boolean;
}
