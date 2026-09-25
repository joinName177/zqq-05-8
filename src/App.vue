<script setup lang="ts">
/**
 * App Shell（容器组件）。
 *
 * 职责：注入组合根 `useTopology()`、管理对话框/确认框等 UI 状态、把 props 传给展示组件。
 * 三栏工作区布局在 `TopologyWorkspace.vue`，提示在 `ToastStack.vue`，确认框状态在 `useConfirmDialog.ts`。
 * 本文件不写任何业务阈值判断。
 */

import { computed, ref, watch } from 'vue';
import type { Person, PersonDraft } from './core/domain/PersonModels';
import type { InteractionDraft } from './core/domain/InteractionModels';
import type { ImportMode } from './core/domain/TopologyModels';
import { useTopology } from './adapters/ui/composables/useTopology';
import { useConfirmDialog } from './adapters/ui/composables/useConfirmDialog';
import AppHeader from './adapters/ui/components/AppHeader.vue';
import ConfirmDialog from './adapters/ui/components/ConfirmDialog.vue';
import ExportDialog from './adapters/ui/components/ExportDialog.vue';
import MetricCards from './adapters/ui/components/MetricCards.vue';
import PersonDetailDrawer from './adapters/ui/components/PersonDetailDrawer.vue';
import PersonFormDialog from './adapters/ui/components/PersonFormDialog.vue';
import ToastStack from './adapters/ui/components/ToastStack.vue';
import TopologyWorkspace from './adapters/ui/components/TopologyWorkspace.vue';

const app = useTopology();
const confirmDialog = useConfirmDialog();

/** 嵌套 ref 不会被 <script setup> 的 proxyRefs 自动解包，这里显式取出给模板使用 */
const notices = computed(() => app.notices.value);

/* ------------------------- 人物表单对话框 ------------------------- */

const formOpen = ref(false);
const editingPerson = ref<Person | null>(null);

function openCreateForm(): void {
  editingPerson.value = null;
  formOpen.value = true;
}

function openEditForm(personId: string): void {
  editingPerson.value = app.personById.value[personId] ?? null;
  formOpen.value = true;
}

function onSubmitPerson(draft: PersonDraft): void {
  const ok = app.savePerson(editingPerson.value ? editingPerson.value.id : null, draft);
  if (ok) {
    formOpen.value = false;
    editingPerson.value = null;
  }
}

/* --------------------------- 导出对话框 --------------------------- */

const exportOpen = ref(false);
const svgText = ref('');
const backupJson = ref('');

watch(exportOpen, (open) => {
  if (!open) return;
  svgText.value = app.buildSvgText();
  backupJson.value = app.exportBackupJson();
});

function onDownloadSvg(): void {
  app.downloadSvg();
  svgText.value = app.buildSvgText();
}

function onCopySvg(): void {
  void app.copySvgText();
}

function onDownloadBackup(): void {
  backupJson.value = app.exportBackupJson();
  app.downloadBackup();
}

/* ---------------------------- 危险操作 ---------------------------- */

function onRemovePerson(personId: string): void {
  const person = app.personById.value[personId];
  if (!person) return;
  const interactionCount = (app.state.value.interactionIndex[personId] ?? []).length;
  confirmDialog.ask({
    title: '删除人物',
    message: `确定要删除「${person.name}」吗？`,
    detail:
      interactionCount > 0
        ? `该人物名下的 ${interactionCount} 条互动记录会一并删除，且无法撤销。`
        : '该操作无法撤销。',
    confirmText: '删除',
    action: () => app.removePerson(personId)
  });
}

function onClearAll(): void {
  confirmDialog.ask({
    title: '清空全部数据',
    message: `确定要清空全部 ${app.persons.value.length} 位人物及其互动记录吗？`,
    detail: '清空后可随时重新录入或载入 12 人示例数据，但当前内容无法恢复。',
    confirmText: '清空',
    action: () => app.clearAll()
  });
}

function onResetAll(): void {
  confirmDialog.ask({
    title: '重置本地数据',
    message: '确定要清空 localStorage 中的全部数据并恢复默认设置吗？',
    detail: '涉及 key：zqq05:persons、zqq05:interactions、zqq05:settings、zqq05:advice-dismissed。',
    confirmText: '重置',
    action: () => app.resetAll()
  });
}

function onLoadDemo(): void {
  if (app.persons.value.length === 0) {
    app.loadDemoData();
    return;
  }
  confirmDialog.ask({
    title: '载入示例数据',
    message: `载入 ${app.demoCount} 人示例数据会替换当前 ${app.persons.value.length} 位人物。`,
    detail: '示例数据覆盖核心圈层、疏远预警、正常维护三类场景，并包含历史互动记录。',
    confirmText: '载入并替换',
    tone: 'primary',
    action: () => app.loadDemoData()
  });
}

function onImport(raw: string, mode: ImportMode): void {
  if (mode !== 'overwrite') {
    app.importBackup(raw, mode);
    backupJson.value = app.exportBackupJson();
    return;
  }
  confirmDialog.ask({
    title: '覆盖导入确认',
    message: '覆盖模式会清空当前全部人物与互动记录，并整体替换为备份内容。',
    detail: '如需保留现有数据，请先切换为「合并」模式。',
    confirmText: '覆盖导入',
    action: () => {
      app.importBackup(raw, mode);
      backupJson.value = app.exportBackupJson();
    }
  });
}

/* --------------------------- 抽屉数据 ----------------------------- */

const selectedPerson = computed<Person | null>(() => {
  const id = app.selectedPersonId.value;
  return id ? app.personById.value[id] ?? null : null;
});

const selectedFrequency = computed(() =>
  app.selectedPersonId.value ? app.frequencyFor(app.selectedPersonId.value) : null
);

const selectedMonths = computed(() =>
  app.selectedPersonId.value ? app.timelineFor(app.selectedPersonId.value) : []
);

const selectedAdvice = computed(() =>
  app.selectedPersonId.value ? app.adviceFor(app.selectedPersonId.value) : []
);

function onAddInteraction(personId: string, draft: InteractionDraft): void {
  if (personId.length === 0) return;
  app.addInteraction(personId, draft);
}

const hasData = computed(() => app.persons.value.length > 0);
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#topology-graph">跳到拓扑图</a>

    <AppHeader
      :theme="app.settings.value.theme"
      :total-persons="app.stats.value.totalPersons"
      :dormant-count="app.stats.value.dormantCount"
      :has-data="hasData"
      :storage-available="app.storageAvailable.value"
      @add="openCreateForm"
      @demo="onLoadDemo"
      @open-export="exportOpen = true"
      @toggle-theme="app.toggleTheme"
      @clear-all="onClearAll"
      @reset-all="onResetAll"
    />

    <main class="app-main">
      <MetricCards :stats="app.stats.value" />

      <TopologyWorkspace
        :app="app"
        @create-person="openCreateForm"
        @edit-person="openEditForm"
        @remove-person="onRemovePerson"
        @load-demo="onLoadDemo"
      />

      <p v-if="app.state.value.migrated" class="app-main__notice" role="status">
        ⓘ 检测到旧版本数据，已自动补齐缺失字段完成迁移（schema v{{ app.settings.value.schemaVersion }}）。
      </p>
      <p v-if="app.state.value.skippedRecords > 0" class="app-main__notice" role="status">
        ⚠ 载入时跳过了 {{ app.state.value.skippedRecords }} 条无法恢复的脏记录，其余数据正常加载。
      </p>
    </main>

    <PersonDetailDrawer
      :open="app.drawerOpen.value"
      :person="selectedPerson"
      :frequency="selectedFrequency"
      :months="selectedMonths"
      :advice="selectedAdvice"
      :today="app.today.value"
      @close="app.closeDrawer"
      @edit="openEditForm"
      @intimacy="app.adjustIntimacy"
      @add-interaction="onAddInteraction"
      @remove-interaction="app.removeInteraction"
      @toggle-advice="app.toggleAdviceHandled"
    />

    <PersonFormDialog
      :open="formOpen"
      :person="editingPerson"
      :persons="app.persons.value"
      :today="app.today.value"
      @submit="onSubmitPerson"
      @cancel="formOpen = false"
    />

    <ExportDialog
      :open="exportOpen"
      :svg-text="svgText"
      :backup-json="backupJson"
      :person-count="app.persons.value.length"
      :interaction-count="app.state.value.interactions.length"
      @close="exportOpen = false"
      @download-svg="onDownloadSvg"
      @copy-svg="onCopySvg"
      @download-backup="onDownloadBackup"
      @import="onImport"
    />

    <ConfirmDialog
      :open="confirmDialog.state.value.open"
      :title="confirmDialog.state.value.title"
      :message="confirmDialog.state.value.message"
      :detail="confirmDialog.state.value.detail"
      :confirm-text="confirmDialog.state.value.confirmText"
      :tone="confirmDialog.state.value.tone"
      @confirm="confirmDialog.resolve"
      @cancel="confirmDialog.cancel"
    />

    <ToastStack :notices="notices" @dismiss="app.dismissNotice" />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  padding: 8px 14px;
  background: var(--accent);
  color: #fff;
  border-radius: 0 0 var(--radius-sm) 0;
  z-index: 200;
}

.skip-link:focus {
  left: 0;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5) var(--space-5);
  min-height: 0;
}

.app-main__notice {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
}

@media (max-width: 767px) {
  .app-main {
    padding: var(--space-3);
    gap: var(--space-3);
  }
}
</style>
