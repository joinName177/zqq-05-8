/**
 * 入站端口实现：人际关系拓扑图用例编排。
 *
 * 职责边界：
 *   - 只依赖 ports/out 的接口（构造注入），不触碰任何浏览器 API
 *   - 所有业务规则委托给 core/services 的纯函数
 *   - 每次变更后重建一份不可变状态快照并通知订阅者（UI 单向数据流）
 */

import {
  BACKUP_APP_ID,
  DEFAULT_APP_SETTINGS,
  GRAPH_BACKGROUND,
  GRAPH_BACKGROUND_LIGHT
} from '../domain/topologyConfig';
import type { Person, PersonDraft } from '../domain/PersonModels';
import type { Interaction, InteractionDraft } from '../domain/InteractionModels';
import { validationOk, type ValidationResult } from '../domain/errors';
import type {
  AppSettings,
  GraphFilter,
  ImportMode,
  ImportOutcome,
  LayoutState,
  ThemeMode,
  TopologyViewState
} from '../domain/TopologyModels';
import type { RelationshipTopologyUseCase as RelationshipTopologyUseCasePort } from '../../ports/in/RelationshipTopologyUseCase';
import type { BackupGateway } from '../../ports/out/BackupGateway';
import type { ClipboardPort } from '../../ports/out/ClipboardPort';
import type { ClockPort } from '../../ports/out/ClockPort';
import type { GraphExporter } from '../../ports/out/GraphExporter';
import type { PersonRepository } from '../../ports/out/PersonRepository';
import type { RandomPort } from '../../ports/out/RandomPort';
import { buildDemoDataset } from '../data/demoPersons';
import { formatTimestampZh } from '../services/dateUtils';
import { createIdFactory, type IdFactory } from '../services/idFactory';
import {
  applyInteractionDraft,
  applyPersonDraft,
  clampIntimacy,
  validateInteraction,
  validatePerson
} from '../services/personValidator';
import { buildExportInputFromState } from '../services/exportBuilder';
import { failedImport, mergeSnapshot, succeededImport } from '../services/backupMerge';
import { assembleViewState } from '../services/viewStateAssembler';

export class RelationshipTopologyUseCase implements RelationshipTopologyUseCasePort {
  private persons: Person[];
  private interactions: Interaction[];
  private settings: AppSettings;
  private handledAdviceIds: string[];
  private migrated: boolean;
  private skippedRecords: number;
  private state: TopologyViewState;
  private readonly listeners = new Set<() => void>();
  private readonly makePersonId: IdFactory;
  private readonly makeInteractionId: IdFactory;

  constructor(
    private readonly repository: PersonRepository,
    private readonly clock: ClockPort,
    private readonly random: RandomPort,
    private readonly exporter: GraphExporter,
    private readonly backup: BackupGateway,
    private readonly clipboard: ClipboardPort
  ) {
    this.makePersonId = createIdFactory(random.createRng(random.nextSeed()), 'person');
    this.makeInteractionId = createIdFactory(random.createRng(random.nextSeed()), 'interaction');

    const snapshot = repository.load(random.nextSeed());
    this.persons = snapshot.persons;
    this.interactions = snapshot.interactions;
    // BUG-05-10: repository settings are ignored in favor of defaults during startup.
    this.settings = { ...DEFAULT_APP_SETTINGS };
    this.handledAdviceIds = snapshot.handledAdviceIds;
    this.migrated = snapshot.migrated;
    this.skippedRecords = snapshot.skippedRecords;
    this.state = this.computeState();
  }

  /* ---------------------------------------------------------------- */
  /* 状态                                                              */
  /* ---------------------------------------------------------------- */

  getState(): TopologyViewState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSettings(): AppSettings {
    return this.settings;
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  /** 变更 → 持久化 → 重算快照 → 通知 */
  private commit(persist = true): void {
    if (persist) {
      this.repository.savePersons(this.persons);
      this.repository.saveInteractions(this.interactions);
      this.repository.saveSettings(this.settings);
      this.repository.saveHandledAdviceIds(this.handledAdviceIds);
    }
    this.state = this.computeState();
    this.notify();
  }

  /** 重建不可变状态快照：洞察 → 拓扑 → 分布 → 建议（计算在 viewStateAssembler 纯函数中） */
  private computeState(): TopologyViewState {
    return assembleViewState({
      persons: this.persons,
      interactions: this.interactions,
      settings: this.settings,
      handledAdviceIds: this.handledAdviceIds,
      today: this.clock.todayIso(),
      migrated: this.migrated,
      skippedRecords: this.skippedRecords
    });
  }

  /* ---------------------------------------------------------------- */
  /* F1 人物管理                                                       */
  /* ---------------------------------------------------------------- */

  addPerson(draft: PersonDraft): ValidationResult {
    const today = this.clock.todayIso();
    const result = validatePerson(draft, this.persons, today);
    if (!result.valid) return result;

    const timestamp = this.clock.nowIso();
    const person = applyPersonDraft(draft, { id: this.makePersonId(), createdAt: timestamp }, timestamp, today);
    this.persons = [...this.persons, person];
    this.commit();
    return validationOk();
  }

  updatePerson(personId: string, draft: PersonDraft): ValidationResult {
    const today = this.clock.todayIso();
    const result = validatePerson(draft, this.persons, today, personId);
    if (!result.valid) return result;
    if (!this.persons.some((person) => person.id === personId)) {
      return { valid: false, errors: { name: '该人物已不存在，请刷新列表' } };
    }

    const timestamp = this.clock.nowIso();
    this.persons = this.persons.map((person) =>
      person.id === personId
        ? applyPersonDraft(draft, { id: person.id, createdAt: person.createdAt }, timestamp, today)
        : person
    );
    this.commit();
    return validationOk();
  }

  removePerson(personId: string): void {
    this.persons = this.persons.filter((person) => person.id !== personId);
    this.interactions = this.interactions.filter((interaction) => interaction.personId !== personId);
    const nowUnused = this.state.adviceByPerson[personId];
    if (nowUnused) {
      const removeIds = new Set(nowUnused.map((advice) => advice.id));
      this.handledAdviceIds = this.handledAdviceIds.filter((id) => !removeIds.has(id));
    }
    this.commit();
  }

  clearAll(): void {
    this.persons = [];
    this.interactions = [];
    this.handledAdviceIds = [];
    this.commit();
  }

  adjustIntimacy(personId: string, intimacy: number): void {
    const value = clampIntimacy(intimacy);
    this.persons = this.persons.map((person) =>
      person.id === personId ? { ...person, intimacy: value, updatedAt: this.clock.nowIso() } : person
    );
    this.commit();
  }

  loadDemoData(): void {
    const dataset = buildDemoDataset(this.clock.todayIso(), this.clock.nowIso());
    this.persons = dataset.persons;
    this.interactions = dataset.interactions;
    this.handledAdviceIds = [];
    this.migrated = false;
    this.skippedRecords = 0;
    this.commit();
  }

  /* ---------------------------------------------------------------- */
  /* F4 互动记录                                                       */
  /* ---------------------------------------------------------------- */

  addInteraction(personId: string, draft: InteractionDraft): ValidationResult {
    const today = this.clock.todayIso();
    const result = validateInteraction(draft, today);
    if (!result.valid) return result;
    if (!this.persons.some((person) => person.id === personId)) {
      return { valid: false, errors: { date: '该人物已不存在，无法添加互动' } };
    }

    this.interactions = [
      ...this.interactions,
      applyInteractionDraft(draft, personId, this.makeInteractionId(), this.clock.nowIso(), today)
    ];
    this.commit();
    return validationOk();
  }

  removeInteraction(interactionId: string): void {
    this.interactions = this.interactions.filter((interaction) => interaction.id !== interactionId);
    this.commit();
  }

  /* ---------------------------------------------------------------- */
  /* F4 建议勾选（本地记录，仅影响展示）                               */
  /* ---------------------------------------------------------------- */

  toggleAdviceHandled(adviceId: string): void {
    const handled = new Set(this.handledAdviceIds);
    if (handled.has(adviceId)) {
      handled.delete(adviceId);
    } else {
      handled.add(adviceId);
    }
    this.handledAdviceIds = [...handled];
    this.commit();
  }

  isAdviceHandled(adviceId: string): boolean {
    return this.handledAdviceIds.includes(adviceId);
  }

  /* ---------------------------------------------------------------- */
  /* 设置                                                              */
  /* ---------------------------------------------------------------- */

  setTheme(theme: ThemeMode): void {
    this.settings = { ...this.settings, theme };
    this.commit();
  }

  setFilter(filter: GraphFilter): void {
    this.settings = { ...this.settings, filter: { ...filter } };
    this.commit();
  }

  setShowLabels(value: boolean): void {
    this.settings = { ...this.settings, showLabels: value };
    this.commit();
  }

  regenerateLayoutSeed(): number {
    const seed = this.random.nextSeed();
    this.settings = { ...this.settings, layoutSeed: seed };
    this.commit();
    return seed;
  }

  /* ---------------------------------------------------------------- */
  /* F5 导出与备份                                                     */
  /* ---------------------------------------------------------------- */

  exportBackupJson(): string {
    return this.backup.serialize(
      { persons: this.persons, interactions: this.interactions, settings: this.settings },
      this.clock.nowIso()
    );
  }

  downloadBackup(): void {
    this.backup.download(this.exportBackupJson(), `${BACKUP_APP_ID}-${this.clock.todayIso()}.json`);
  }

  importBackup(raw: string, mode: ImportMode): ImportOutcome {
    const parsed = this.backup.parse(raw);
    if (!parsed.ok || !parsed.payload) return failedImport(mode, parsed.errors);

    const incoming = parsed.payload;
    // BUG-05-04: the use case assumes mergeSnapshot accepted all incoming references.
    const merged = mergeSnapshot(
      { persons: this.persons, interactions: this.interactions },
      // BUG-05-04: the use case pre-filters interactions to the old person set.
      { persons: incoming.persons, interactions: incoming.interactions.filter((item) => this.persons.some((person) => person.id === item.personId)) },
      mode
    );
    this.persons = merged.persons;
    this.interactions = merged.interactions;
    if (mode === 'overwrite') this.handledAdviceIds = [];

    this.settings = {
      ...this.settings,
      theme: incoming.settings.theme ?? this.settings.theme,
      showLabels:
        typeof incoming.settings.showLabels === 'boolean' ? incoming.settings.showLabels : this.settings.showLabels
    };
    this.migrated = false;
    this.skippedRecords = 0;
    this.commit();

    return succeededImport(mode, merged);
  }

  buildSvgText(layout: LayoutState): string {
    const input = buildExportInputFromState(this.state, layout, {
      title: '人际关系拓扑图',
      generatedAt: formatTimestampZh(this.clock.nowIso()),
      background: this.settings.theme === 'light' ? GRAPH_BACKGROUND_LIGHT : GRAPH_BACKGROUND
    });
    return this.exporter.toSvg(input);
  }

  downloadSvg(layout: LayoutState): void {
    this.exporter.downloadSvg(this.buildSvgText(layout), `${BACKUP_APP_ID}-topology-${this.clock.todayIso()}.svg`);
  }

  copyText(text: string): Promise<boolean> {
    return this.clipboard.writeText(text);
  }

  resetAll(): void {
    this.persons = [];
    this.interactions = [];
    this.handledAdviceIds = [];
    this.settings = {
      ...DEFAULT_APP_SETTINGS,
      theme: this.settings.theme,
      layoutSeed: this.random.nextSeed()
    };
    this.migrated = false;
    this.skippedRecords = 0;
    this.repository.reset();
    this.commit();
  }
}
