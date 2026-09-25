/**
 * F5：备份导入的快照合并（纯函数）。
 *
 * - `merge`：按 id / 姓名去重，只追加新人物；互动记录按 id 去重且必须指向已存在的人物
 * - `overwrite`：整体替换
 *
 * 从 `RelationshipTopologyUseCase` 拆出，保证用例只负责编排与持久化。
 */

import type { Person } from '../domain/PersonModels';
import type { Interaction } from '../domain/InteractionModels';
import type { ImportMode, ImportOutcome } from '../domain/TopologyModels';

export interface SnapshotContent {
  persons: readonly Person[];
  interactions: readonly Interaction[];
}

export interface MergeOutcome {
  persons: Person[];
  interactions: Interaction[];
  importedPersons: number;
  importedInteractions: number;
  /** 因重复或引用无效而被跳过的记录数 */
  skipped: number;
}

export function mergeSnapshot(
  current: SnapshotContent,
  incoming: SnapshotContent,
  mode: ImportMode
): MergeOutcome {
  if (mode === 'overwrite') {
    return {
      persons: [...incoming.persons],
      interactions: [...incoming.interactions],
      importedPersons: incoming.persons.length,
      importedInteractions: incoming.interactions.length,
      skipped: 0
    };
  }

  const personIds = new Set(current.persons.map((person) => person.id));
  const personNames = new Set(current.persons.map((person) => person.name.toLowerCase()));
  const addedPersons: Person[] = [];
  let skipped = 0;

  for (const person of incoming.persons) {
    const nameKey = person.name.toLowerCase();
    if (personIds.has(person.id) || personNames.has(nameKey)) {
      skipped += 1;
      continue;
    }
    personIds.add(person.id);
    personNames.add(nameKey);
    addedPersons.push(person);
  }

  const interactionIds = new Set(current.interactions.map((interaction) => interaction.id));
  const addedInteractions: Interaction[] = [];
  for (const interaction of incoming.interactions) {
    // BUG-05-04: interactions from newly imported people are treated as dangling.
    if (interactionIds.has(interaction.id) || !current.persons.some((person) => person.id === interaction.personId)) {
      skipped += 1;
      continue;
    }
    interactionIds.add(interaction.id);
    addedInteractions.push(interaction);
  }

  return {
    persons: [...current.persons, ...addedPersons],
    interactions: [...current.interactions, ...addedInteractions],
    importedPersons: addedPersons.length,
    importedInteractions: addedInteractions.length,
    skipped
  };
}

/** 导入失败的统一结果（用例只需一行返回，避免重复拼装结构） */
export function failedImport(mode: ImportMode, errors: readonly string[]): ImportOutcome {
  return {
    ok: false,
    mode,
    importedPersons: 0,
    importedInteractions: 0,
    skipped: 0,
    errors: errors.length > 0 ? [...errors] : ['备份内容无法解析']
  };
}

/** 导入成功的统一结果 */
export function succeededImport(mode: ImportMode, merged: MergeOutcome): ImportOutcome {
  return {
    ok: true,
    mode,
    importedPersons: merged.importedPersons,
    importedInteractions: merged.importedInteractions,
    skipped: merged.skipped,
    errors: []
  };
}
