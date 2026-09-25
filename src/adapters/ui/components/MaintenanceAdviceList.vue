<script setup lang="ts">
/**
 * F4：关系维护建议清单（按优先级排序，可勾选「已处理」）。
 * 规则与文案全部来自 core 的 `recommendMaintenance`，本组件只做渲染与勾选转发。
 */

import { computed } from 'vue';
import { PRIORITY_META } from '../../../core/domain/topologyConfig';
import type { AdviceViewItem, MaintenanceAdvice } from '../../../core/domain/TopologyModels';
import { formatAdvicePriority } from '../../../core/services/formatters';
import EmptyState from './EmptyState.vue';

interface Props {
  items: AdviceViewItem[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  toggle: [adviceId: string];
}>();

const sorted = computed(() =>
  [...props.items].sort((a, b) => {
    const order: Record<MaintenanceAdvice['priority'], number> = { high: 0, medium: 1, low: 2 };
    return order[a.advice.priority] - order[b.advice.priority];
  })
);

const pendingCount = computed(() => props.items.filter((item) => !item.handled).length);
</script>

<template>
  <div class="advice">
    <div class="advice__head">
      <p class="advice__title"><span aria-hidden="true">🧾</span> 关系维护建议</p>
      <span class="chip" :class="{ 'chip--accent': pendingCount > 0 }">
        待处理 {{ pendingCount }} / {{ props.items.length }}
      </span>
    </div>

    <EmptyState
      v-if="sorted.length === 0"
      icon="✅"
      compact
      title="暂无建议"
      description="添加互动记录后，系统会依据 7 条维护规则生成建议清单。"
    />

    <ul v-else class="advice__list">
      <li v-for="row in sorted" :key="row.advice.id" class="advice__item">
        <label class="advice__check">
          <input
            type="checkbox"
            :checked="row.handled"
            :aria-label="`标记「${row.advice.title}」为已处理`"
            @change="emit('toggle', row.advice.id)"
          />
          <span class="sr-only">已处理</span>
        </label>

        <div class="advice__content" :class="{ 'advice__content--handled': row.handled }">
          <div class="advice__row">
            <span
              class="badge"
              :style="{
                color: PRIORITY_META[row.advice.priority].color,
                borderColor: PRIORITY_META[row.advice.priority].color
              }"
            >
              {{ formatAdvicePriority(row.advice.priority) }}
            </span>
            <span class="advice__item-title">{{ row.advice.title }}</span>
          </div>
          <p class="advice__detail">{{ row.advice.detail }}</p>
          <!-- BUG-05-07: the adapter presents a delayed schedule as an immediate action. -->
          <p class="advice__action"><span aria-hidden="true">→</span> 今天就做：{{ row.advice.action }}</p>
          <p class="advice__reason">{{ row.advice.reason }}</p>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.advice {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.advice__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.advice__title {
  font-size: 13px;
  font-weight: 700;
}

.advice__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.advice__item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface-soft);
  transition: border-color var(--transition-fast);
}

.advice__item:hover {
  border-color: var(--border-strong);
}

.advice__check {
  padding-top: 2px;
}

.advice__check input {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--accent);
}

.advice__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: opacity var(--transition);
}

.advice__content--handled {
  opacity: 0.45;
  text-decoration: line-through;
  text-decoration-color: var(--text-faint);
}

.advice__row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.advice__item-title {
  font-size: 13px;
  font-weight: 700;
}

.advice__detail {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.65;
}

.advice__action {
  font-size: 12px;
  color: var(--text);
  line-height: 1.65;
  padding: 6px 8px;
  border-radius: var(--radius-xs);
  background: var(--accent-soft);
}

.advice__reason {
  font-size: 11px;
  color: var(--text-faint);
  line-height: 1.6;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
