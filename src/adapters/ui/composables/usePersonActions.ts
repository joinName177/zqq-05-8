/**
 * F1：人物管理意图（新增 / 编辑 / 删除 / 清空 / 示例数据 / 重置 / 亲密度调整）。
 *
 * 组合根仍唯一（`useTopology.ts` 负责构造适配器与用例），本文件只承载「人物相关意图」，
 * 便于与交互、筛选、导出等意图分开阅读与维护。
 */

import { DEFAULT_FEELING, DEFAULT_INTIMACY } from '../../../core/domain/topologyConfig';
import { createEmptyPersonDraft, personToDraft, type Person, type PersonDraft } from '../../../core/domain/PersonModels';
import { createEmptyInteractionDraft, type InteractionDraft } from '../../../core/domain/InteractionModels';
import { firstValidationError } from '../../../core/domain/errors';
import { demoPersonCount } from '../../../core/data/demoPersons';
import type { RelationshipTopologyUseCase } from '../../../ports/in/RelationshipTopologyUseCase';
import type { NoticeTone } from './useNotices';

export interface PersonActionHooks {
  /** 取「今天」（来自 ClockPort）与人物索引 */
  getToday(): string;
  getPersonById(): Record<string, Person>;
  notify(text: string, tone?: NoticeTone): void;
  closeDrawer(): void;
}

export interface PersonActionsApi {
  newPersonDraft(): PersonDraft;
  editPersonDraft(person: Person): PersonDraft;
  newInteractionDraft(): InteractionDraft;
  savePerson(personId: string | null, draft: PersonDraft): boolean;
  removePerson(personId: string): void;
  clearAll(): void;
  loadDemoData(): void;
  resetAll(): void;
  adjustIntimacy(personId: string, intimacy: number): void;
}

export function usePersonActions(
  useCase: RelationshipTopologyUseCase,
  hooks: PersonActionHooks
): PersonActionsApi {
  function newPersonDraft(): PersonDraft {
    return createEmptyPersonDraft(hooks.getToday(), DEFAULT_INTIMACY, 'colleague');
  }

  function editPersonDraft(person: Person): PersonDraft {
    return personToDraft(person);
  }

  function newInteractionDraft(): InteractionDraft {
    return createEmptyInteractionDraft(hooks.getToday(), DEFAULT_FEELING);
  }

  function savePerson(personId: string | null, draft: PersonDraft): boolean {
    const result = personId === null ? useCase.addPerson(draft) : useCase.updatePerson(personId, draft);
    if (!result.valid) {
      hooks.notify(firstValidationError(result), 'error');
      return false;
    }
    hooks.notify(personId === null ? `已添加「${draft.name.trim()}」` : `已更新「${draft.name.trim()}」`, 'success');
    return true;
  }

  function removePerson(personId: string): void {
    const person = hooks.getPersonById()[personId];
    useCase.removePerson(personId);
    hooks.closeDrawer();
    hooks.notify(person ? `已删除「${person.name}」及其互动记录` : '已删除该人物', 'success');
  }

  function clearAll(): void {
    useCase.clearAll();
    hooks.closeDrawer();
    hooks.notify('已清空全部人物与互动记录', 'success');
  }

  function loadDemoData(): void {
    useCase.loadDemoData();
    hooks.closeDrawer();
    hooks.notify(`已载入 ${demoPersonCount()} 人示例数据`, 'success');
  }

  function resetAll(): void {
    useCase.resetAll();
    hooks.closeDrawer();
    hooks.notify('已重置本地数据', 'success');
  }

  function adjustIntimacy(personId: string, intimacy: number): void {
    useCase.adjustIntimacy(personId, intimacy);
  }

  return {
    newPersonDraft,
    editPersonDraft,
    newInteractionDraft,
    savePerson,
    removePerson,
    clearAll,
    loadDemoData,
    resetAll,
    adjustIntimacy
  };
}
