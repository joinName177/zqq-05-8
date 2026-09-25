<script setup lang="ts">
/**
 * F4：互动历史时间轴（按月分组，倒序）。每条标注「距上次联系 N 天」/「距上一次互动间隔 N 天」。
 */

import type { TimelineMonth } from '../../../core/domain/TopologyModels';
import { getInteractionKindMeta } from '../../../core/domain/InteractionModels';
import { formatDisplayDate } from '../../../core/services/dateUtils';
import { formatDecimal, formatDuration } from '../../../core/services/formatters';
import EmptyState from './EmptyState.vue';

interface Props {
  months: TimelineMonth[];
  personName: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  remove: [interactionId: string];
}>();

function toneClass(tone: 'positive' | 'neutral' | 'negative'): string {
  return `timeline__item--${tone}`;
}
</script>

<template>
  <div class="timeline">
    <EmptyState
      v-if="props.months.length === 0"
      icon="🗓"
      compact
      title="还没有互动记录"
      :description="`添加第一条互动后，「最近联系时间」会自动推导为最近一次互动日期，并立即重算预警与建议。`"
    />

    <div v-for="month in props.months" :key="month.monthKey" class="timeline__month">
      <div class="timeline__month-header">
        <span class="timeline__month-label">{{ month.monthLabel }}</span>
        <span class="chip">{{ month.count }} 次</span>
        <span class="chip">平均感受 {{ formatDecimal(month.avgFeeling, 1) }}/5</span>
      </div>

      <ul class="timeline__list">
        <li
          v-for="entry in month.entries"
          :key="entry.interaction.id"
          class="timeline__item"
          :class="toneClass(getInteractionKindMeta(entry.interaction.kind).tone)"
        >
          <span class="timeline__dot" aria-hidden="true">
            {{ getInteractionKindMeta(entry.interaction.kind).icon }}
          </span>

          <div class="timeline__content">
            <div class="timeline__row">
              <span class="timeline__kind">{{ getInteractionKindMeta(entry.interaction.kind).label }}</span>
              <time class="timeline__date" :datetime="entry.interaction.date">
                {{ formatDisplayDate(entry.interaction.date) }}
              </time>
              <span class="chip timeline__distance">{{ entry.distanceLabel }}</span>
              <span class="chip">感受 {{ entry.interaction.feeling }}/5</span>
              <span class="chip">{{ formatDuration(entry.interaction.durationMinutes) }}</span>
            </div>
            <p v-if="entry.interaction.note" class="timeline__note" :title="entry.interaction.note">
              {{ entry.interaction.note }}
            </p>
          </div>

          <button
            type="button"
            class="btn btn--sm btn--ghost timeline__remove"
            :aria-label="`删除 ${formatDisplayDate(entry.interaction.date)} 的${getInteractionKindMeta(entry.interaction.kind).label}记录`"
            @click="emit('remove', entry.interaction.id)"
          >
            🗑
          </button>
        </li>
      </ul>
    </div>

    <p v-if="props.months.length > 0" class="timeline__footer">
      共 {{ props.months.reduce((sum, month) => sum + month.count, 0) }} 条互动记录 ·
      {{ props.personName }} 的最近联系时间由最新一条互动推导
    </p>
  </div>
</template>

<style scoped>
.timeline {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.timeline__month-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.timeline__month-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.timeline__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-left: 2px solid var(--border);
  padding-left: var(--space-4);
  margin-left: 6px;
}

.timeline__item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--surface-soft);
  border: 1px solid var(--border);
  transition: border-color var(--transition-fast), background var(--transition-fast);
}

.timeline__item:hover {
  border-color: var(--border-strong);
  background: var(--surface-hover);
}

.timeline__item--positive {
  border-left: 3px solid var(--success);
}

.timeline__item--neutral {
  border-left: 3px solid var(--accent);
}

.timeline__item--negative {
  border-left: 3px solid var(--danger);
  background: rgba(255, 107, 129, 0.08);
}

.timeline__dot {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--surface);
  border: 1px solid var(--border);
  font-size: 12px;
}

.timeline__content {
  flex: 1;
  min-width: 0;
}

.timeline__row {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.timeline__kind {
  font-size: 12.5px;
  font-weight: 700;
}

.timeline__date {
  font-size: 11.5px;
  color: var(--text-muted);
}

.timeline__distance {
  color: var(--accent);
  border-color: var(--accent-soft);
  background: var(--accent-soft);
}

.timeline__note {
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
  word-break: break-word;
}

.timeline__remove {
  flex: 0 0 auto;
  border-color: transparent;
  opacity: 0.6;
}

.timeline__remove:hover {
  opacity: 1;
  color: var(--danger);
  background: rgba(255, 107, 129, 0.12);
}

.timeline__footer {
  font-size: 11.5px;
  color: var(--text-faint);
  text-align: center;
}

@media (max-width: 767px) {
  .timeline__list {
    padding-left: var(--space-3);
  }
}
</style>
