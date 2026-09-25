/**
 * 入站端口：人际关系拓扑图用例（UI 唯一可调用的业务能力面）。
 *
 * 实现见 `core/usecases/RelationshipTopologyUseCase.ts`，
 * 组装见 `adapters/ui/composables/useTopology.ts`（唯一组合根）。
 */

import type { PersonDraft } from '../../core/domain/PersonModels';
import type { InteractionDraft } from '../../core/domain/InteractionModels';
import type { ValidationResult } from '../../core/domain/errors';
import type {
  AppSettings,
  GraphFilter,
  ImportMode,
  ImportOutcome,
  LayoutState,
  ThemeMode,
  TopologyViewState
} from '../../core/domain/TopologyModels';

export interface RelationshipTopologyUseCase {
  /** 当前状态快照（不可变对象，每次变更后整体替换） */
  getState(): TopologyViewState;
  /** 订阅状态变更，返回取消订阅函数 */
  subscribe(listener: () => void): () => void;

  /* F1 人物管理 */
  addPerson(draft: PersonDraft): ValidationResult;
  updatePerson(personId: string, draft: PersonDraft): ValidationResult;
  removePerson(personId: string): void;
  clearAll(): void;
  adjustIntimacy(personId: string, intimacy: number): void;
  loadDemoData(): void;

  /* F4 互动记录 */
  addInteraction(personId: string, draft: InteractionDraft): ValidationResult;
  removeInteraction(interactionId: string): void;

  /* F4 建议勾选 */
  toggleAdviceHandled(adviceId: string): void;
  isAdviceHandled(adviceId: string): boolean;

  /* 设置 */
  setTheme(theme: ThemeMode): void;
  setFilter(filter: GraphFilter): void;
  setShowLabels(value: boolean): void;
  getSettings(): AppSettings;
  regenerateLayoutSeed(): number;

  /* F5 导出与备份 */
  exportBackupJson(): string;
  downloadBackup(): void;
  importBackup(raw: string, mode: ImportMode): ImportOutcome;
  buildSvgText(layout: LayoutState): string;
  downloadSvg(layout: LayoutState): void;
  copyText(text: string): Promise<boolean>;

  /* 重置 */
  resetAll(): void;
}
