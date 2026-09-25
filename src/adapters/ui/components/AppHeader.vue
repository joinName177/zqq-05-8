<script setup lang="ts">
/**
 * 顶部品牌栏 + 全局操作（展示组件：只接收 props / 转发事件）。
 */

import type { ThemeMode } from '../../../core/domain/TopologyModels';

interface Props {
  theme: ThemeMode;
  totalPersons: number;
  dormantCount: number;
  hasData: boolean;
  storageAvailable: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  add: [];
  demo: [];
  openExport: [];
  toggleTheme: [];
  clearAll: [];
  resetAll: [];
}>();
</script>

<template>
  <header class="app-header">
    <div class="brand">
      <span class="brand__mark" aria-hidden="true">🕸️</span>
      <div class="brand__text">
        <h1 class="brand__title">人际关系拓扑图</h1>
        <p class="brand__subtitle">
          自研力导向物理仿真 · 核心圈层与疏远预警识别 · 关系维护建议
        </p>
      </div>
    </div>

    <div class="header-status" role="status" aria-live="polite">
      <span class="chip">{{ props.totalPersons }} 人</span>
      <span class="chip" :class="{ 'chip--warn': props.dormantCount > 0 }">
        预警 {{ props.dormantCount }}
      </span>
      <span v-if="!props.storageAvailable" class="chip chip--danger" title="localStorage 不可用">
        仅内存存储
      </span>
    </div>

    <nav class="header-actions" aria-label="全局操作">
      <button type="button" class="btn btn--sm" aria-label="载入 12 人示例数据" @click="emit('demo')">
        <span aria-hidden="true">✨</span> 载入示例
      </button>
      <button
        type="button"
        class="btn btn--sm btn--primary"
        aria-label="新增人物"
        @click="emit('add')"
      >
        <span aria-hidden="true">＋</span> 新增人物
      </button>
      <button type="button" class="btn btn--sm" aria-label="导出与备份" @click="emit('openExport')">
        <span aria-hidden="true">⬇</span> 导出/备份
      </button>
      <button
        type="button"
        class="btn btn--sm btn--ghost"
        :aria-label="props.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'"
        @click="emit('toggleTheme')"
      >
        <span aria-hidden="true">{{ props.theme === 'dark' ? '🌙' : '☀️' }}</span>
        {{ props.theme === 'dark' ? '深色' : '浅色' }}
      </button>
      <button
        type="button"
        class="btn btn--sm btn--ghost"
        :disabled="!props.hasData"
        aria-label="清空全部数据"
        @click="emit('clearAll')"
      >
        清空
      </button>
      <button type="button" class="btn btn--sm btn--ghost" aria-label="重置本地存储" @click="emit('resetAll')">
        重置
      </button>
    </nav>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  backdrop-filter: blur(16px);
  flex-wrap: wrap;
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.brand__mark {
  font-size: 26px;
  line-height: 1;
  filter: drop-shadow(0 4px 12px rgba(124, 140, 255, 0.5));
}

.brand__title {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.brand__subtitle {
  font-size: 11.5px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}

.chip--warn {
  color: var(--warn);
  border-color: rgba(246, 195, 74, 0.45);
  background: rgba(246, 195, 74, 0.12);
}

.chip--danger {
  color: var(--danger);
  border-color: rgba(255, 107, 129, 0.45);
  background: rgba(255, 107, 129, 0.12);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

@media (max-width: 1199px) {
  .header-status {
    margin-left: 0;
    order: 3;
    width: 100%;
  }

  .header-actions {
    margin-left: auto;
  }
}

@media (max-width: 767px) {
  .app-header {
    padding: var(--space-3) var(--space-4);
  }

  .brand__subtitle {
    display: none;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-start;
    overflow-x: auto;
    padding-bottom: 2px;
  }
}
</style>
