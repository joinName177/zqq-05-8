<script setup lang="ts">
/**
 * F5：导出与备份对话框。
 *  - 拓扑图 SVG：预览源码、下载文件、复制源码（复用当前布局坐标）
 *  - 数据 JSON：导出备份 / 导入（合并或覆盖两种模式，含格式校验提示）
 */

import { computed, ref, watch } from 'vue';
import type { ImportMode } from '../../../core/domain/TopologyModels';
import { formatInteger } from '../../../core/services/formatters';

interface Props {
  open: boolean;
  svgText: string;
  backupJson: string;
  personCount: number;
  interactionCount: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  downloadSvg: [];
  copySvg: [];
  downloadBackup: [];
  import: [raw: string, mode: ImportMode];
}>();

const tab = ref<'svg' | 'json'>('svg');
const importMode = ref<ImportMode>('merge');
const importText = ref('');
const importError = ref('');
const fileName = ref('');

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    tab.value = 'svg';
    importText.value = '';
    importError.value = '';
    fileName.value = '';
    importMode.value = 'merge';
  }
);

const svgSize = computed(() => `${formatInteger(props.svgText.length / 1024)} KB`);
const backupSize = computed(() => `${formatInteger(props.backupJson.length / 1024)} KB`);

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  fileName.value = file.name;
  const reader = new FileReader();
  reader.onload = () => {
    importText.value = typeof reader.result === 'string' ? reader.result : '';
    importError.value = importText.value.length === 0 ? '文件内容为空' : '';
  };
  reader.onerror = () => {
    importError.value = '文件读取失败，请重试';
  };
  reader.readAsText(file);
  input.value = '';
}

function onImport(): void {
  const raw = importText.value.trim();
  if (raw.length === 0) {
    importError.value = '请粘贴备份 JSON 或选择备份文件';
    return;
  }
  if (!raw.startsWith('{')) {
    importError.value = '内容看起来不是 JSON 对象（应以 { 开头）';
    return;
  }
  importError.value = '';
  emit('import', raw, importMode.value);
}
</script>

<template>
  <div v-if="props.open" class="overlay" role="dialog" aria-modal="true" aria-label="导出与备份" @click.self="emit('close')">
    <div class="dialog export-dialog">
      <div class="dialog__header">
        <h2 class="dialog__title">导出与备份</h2>
        <button type="button" class="btn btn--sm btn--ghost" aria-label="关闭导出对话框" @click="emit('close')">
          ✕
        </button>
      </div>

      <div class="export-dialog__tabs" role="tablist" aria-label="导出类型">
        <button
          type="button"
          class="export-dialog__tab"
          :class="{ 'export-dialog__tab--active': tab === 'svg' }"
          role="tab"
          :aria-selected="tab === 'svg'"
          @click="tab = 'svg'"
        >
          🖼 拓扑图 SVG
        </button>
        <button
          type="button"
          class="export-dialog__tab"
          :class="{ 'export-dialog__tab--active': tab === 'json' }"
          role="tab"
          :aria-selected="tab === 'json'"
          @click="tab = 'json'"
        >
          🗄 数据 JSON 备份
        </button>
      </div>

      <div class="dialog__body">
        <template v-if="tab === 'svg'">
          <p class="export-dialog__hint">
            使用当前力导向布局坐标导出：含标题、生成时间、图例、统计摘要、节点（核心圈层光晕 / 疏远预警脉冲环）与连线。
            <strong>{{ svgSize }}</strong>
          </p>
          <textarea class="textarea export-dialog__preview" readonly :value="props.svgText" aria-label="SVG 源码预览"></textarea>
        </template>

        <template v-else>
          <p class="export-dialog__hint">
            当前数据：{{ formatInteger(props.personCount) }} 位人物 · {{ formatInteger(props.interactionCount) }} 条互动记录 ·
            备份大小约 <strong>{{ backupSize }}</strong>
          </p>

          <div class="field">
            <span class="field__label">导入模式</span>
            <div class="export-dialog__modes" role="radiogroup" aria-label="导入模式">
              <label class="export-dialog__mode" :class="{ 'export-dialog__mode--active': importMode === 'merge' }">
                <input v-model="importMode" type="radio" value="merge" name="import-mode" />
                <span>
                  <strong>合并</strong>
                  <em>按 ID / 姓名去重，只追加新数据，保留现有记录</em>
                </span>
              </label>
              <label class="export-dialog__mode" :class="{ 'export-dialog__mode--active': importMode === 'overwrite' }">
                <input v-model="importMode" type="radio" value="overwrite" name="import-mode" />
                <span>
                  <strong>覆盖</strong>
                  <em>清空现有数据后整体替换（需二次确认）</em>
                </span>
              </label>
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="import-text">粘贴备份 JSON</label>
            <textarea
              id="import-text"
              v-model="importText"
              class="textarea export-dialog__preview"
              placeholder='{ "version": 2, "persons": [...], "interactions": [...] }'
              @input="importError = ''"
            ></textarea>
          </div>

          <div class="field">
            <label class="field__label" for="import-file">或选择备份文件（.json）</label>
            <input id="import-file" class="input" type="file" accept="application/json,.json" @change="onFileChange" />
            <p v-if="fileName" class="field__hint">已选择：{{ fileName }}</p>
          </div>

          <p v-if="importError" class="field__error" role="alert">⚠ {{ importError }}</p>

          <button type="button" class="btn btn--primary btn--block" @click="onImport">开始导入</button>
        </template>
      </div>

      <div class="dialog__footer">
        <button type="button" class="btn" @click="emit('close')">关闭</button>
        <template v-if="tab === 'svg'">
          <button type="button" class="btn" @click="emit('copySvg')">复制源码</button>
          <button type="button" class="btn btn--primary" @click="emit('downloadSvg')">下载 SVG</button>
        </template>
        <template v-else>
          <button type="button" class="btn btn--primary" @click="emit('downloadBackup')">下载 JSON 备份</button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.export-dialog {
  width: min(680px, 100%);
}

.export-dialog__tabs {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5) 0;
  border-bottom: 1px solid var(--border);
}

.export-dialog__tab {
  padding: 8px 14px;
  border: 1px solid transparent;
  border-bottom: 0;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.export-dialog__tab:hover {
  color: var(--text);
  background: var(--surface-soft);
}

.export-dialog__tab--active {
  color: var(--text);
  background: var(--surface-soft);
  border-color: var(--border);
}

.export-dialog__hint {
  font-size: 12.5px;
  color: var(--text-muted);
  line-height: 1.7;
  margin-bottom: var(--space-3);
}

.export-dialog__preview {
  min-height: 190px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
  line-height: 1.6;
  white-space: pre;
  overflow: auto;
}

.export-dialog__modes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.export-dialog__mode {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-soft);
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.export-dialog__mode--active {
  border-color: var(--accent);
  background: var(--surface-hover);
}

.export-dialog__mode input {
  margin-top: 3px;
  accent-color: var(--accent);
}

.export-dialog__mode strong {
  display: block;
  font-size: 12.5px;
}

.export-dialog__mode em {
  display: block;
  font-style: normal;
  font-size: 11px;
  color: var(--text-faint);
  line-height: 1.55;
  margin-top: 2px;
}

@media (max-width: 767px) {
  .export-dialog__modes {
    grid-template-columns: 1fr;
  }
}
</style>
