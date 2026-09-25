<script setup lang="ts">
/**
 * F1：单个人物卡片（展示组件）。只接收视图模型 + 转发事件。
 */

import type { PersonListCard } from '../viewmodels/personListCards';

interface Props {
  card: PersonListCard;
  active: boolean;
  /** 亲密度条宽度百分比 = 亲密度 × 10 */
  intimacyPercent: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [personId: string];
  edit: [personId: string];
  remove: [personId: string];
}>();
</script>

<template>
  <article
    class="person-card"
    :class="{ 'person-card--active': props.active }"
    :style="{ '--relation-color': props.card.relationColor }"
  >
    <button
      type="button"
      class="person-card__main"
      :aria-label="`查看 ${props.card.person.name} 的详情`"
      @click="emit('select', props.card.person.id)"
    >
      <span class="person-card__avatar" aria-hidden="true">{{ props.card.relationIcon }}</span>

      <span class="person-card__info">
        <span class="person-card__name-row">
          <span class="person-card__name">{{ props.card.person.name }}</span>
          <span
            class="badge"
            :style="{ color: props.card.relationColor, borderColor: props.card.relationColor }"
          >
            {{ props.card.relationLabel }}
          </span>
          <span v-if="props.card.isCore" class="badge badge--core">核心圈层</span>
          <span
            v-if="props.card.dormantLabel"
            class="badge"
            :style="{ color: props.card.dormantColor, borderColor: props.card.dormantColor }"
          >
            {{ props.card.dormantLabel }}
          </span>
        </span>

        <span class="person-card__meta">
          <span class="person-card__intimacy">
            <span class="person-card__bar" aria-hidden="true">
              <span
                class="person-card__bar-fill"
                :style="{ width: `${props.intimacyPercent}%`, background: props.card.relationColor }"
              ></span>
            </span>
            亲密度 {{ props.card.person.intimacy }}/10 · {{ props.card.intimacyLabel }}
          </span>
          <span class="person-card__contact">
            {{ props.card.daysLabel }}（{{ props.card.sourceLabel }}） · 近 90 天
            {{ props.card.count90 }} 次
          </span>
        </span>

        <span v-if="props.card.person.topics.length > 0" class="person-card__topics">
          <span v-for="topic in props.card.person.topics.slice(0, 4)" :key="topic" class="chip">{{ topic }}</span>
          <span v-if="props.card.person.topics.length > 4" class="chip">
            +{{ props.card.person.topics.length - 4 }}
          </span>
        </span>
      </span>
    </button>

    <div class="person-card__actions">
      <button
        type="button"
        class="btn btn--sm btn--ghost"
        :aria-label="`编辑 ${props.card.person.name}`"
        @click="emit('edit', props.card.person.id)"
      >
        ✎
      </button>
      <button
        type="button"
        class="btn btn--sm btn--ghost person-card__delete"
        :aria-label="`删除 ${props.card.person.name}`"
        @click="emit('remove', props.card.person.id)"
      >
        🗑
      </button>
    </div>
  </article>
</template>

<style scoped>
.person-card {
  display: flex;
  align-items: stretch;
  gap: 2px;
  border: 1px solid var(--border);
  border-left: 3px solid var(--relation-color, var(--accent));
  border-radius: var(--radius-md);
  background: var(--surface-soft);
  transition: border-color var(--transition-fast), background var(--transition-fast), transform var(--transition-fast);
  overflow: hidden;
}

.person-card:hover {
  background: var(--surface-hover);
  transform: translateX(2px);
}

.person-card--active {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent-soft);
}

.person-card__main {
  flex: 1;
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  padding: var(--space-3);
  background: transparent;
  border: 0;
  text-align: left;
  cursor: pointer;
  min-width: 0;
}

.person-card__avatar {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--surface);
  border: 1px solid var(--relation-color, var(--border));
  font-size: 15px;
}

.person-card__info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.person-card__name-row {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.person-card__name {
  font-size: 13.5px;
  font-weight: 700;
}

.badge--core {
  color: #8b7cff;
  border-color: rgba(139, 124, 255, 0.55);
  background: rgba(139, 124, 255, 0.12);
}

.person-card__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11.5px;
  color: var(--text-muted);
}

.person-card__intimacy {
  display: flex;
  align-items: center;
  gap: 6px;
}

.person-card__bar {
  display: inline-block;
  width: 54px;
  height: 5px;
  border-radius: var(--radius-pill);
  background: var(--border);
  overflow: hidden;
}

.person-card__bar-fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  transition: width var(--transition);
}

.person-card__contact {
  color: var(--text-faint);
}

.person-card__topics {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.person-card__actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 0 6px;
}

.person-card__delete:hover {
  color: var(--danger);
  background: rgba(255, 107, 129, 0.12);
}

.btn--ghost {
  border-color: transparent;
}
</style>
