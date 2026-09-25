<script setup lang="ts">
/**
 * F1：人物列表 / 卡片视图（展示组件）。
 * 搜索（姓名 + 标签）、按关系类型与状态筛选、5 种排序、编辑与删除入口。
 * 卡片视图模型由 `viewmodels/personListCards.ts` 计算，本组件只做筛选交互与渲染。
 */

import { computed, ref } from 'vue';
import type { Person } from '../../../core/domain/PersonModels';
import type { Interaction } from '../../../core/domain/InteractionModels';
import type { GraphFilter, GraphFilterMode, InsightResult, RelationFilter } from '../../../core/domain/TopologyModels';
import { MAX_INTIMACY } from '../../../core/domain/topologyConfig';
import { RELATION_TYPES } from '../../../core/data/relationTypes';
import { formatInteger } from '../../../core/services/formatters';
import { buildPersonListCards, type PersonSortKey } from '../viewmodels/personListCards';
import PersonCard from './PersonCard.vue';

interface Props {
  persons: Person[];
  interactionIndex: Record<string, Interaction[]>;
  insights: InsightResult;
  today: string;
  selectedId: string | null;
  filter: GraphFilter;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [personId: string];
  edit: [personId: string];
  remove: [personId: string];
  add: [];
  filterMode: [mode: GraphFilterMode];
  relationFilter: [relationType: RelationFilter];
}>();

const search = ref('');
const sortKey = ref<PersonSortKey>('recent-desc');

const SORT_OPTIONS: readonly { value: PersonSortKey; label: string }[] = [
  { value: 'recent-desc', label: '最久未联系优先' },
  { value: 'recent-asc', label: '最近联系优先' },
  { value: 'intimacy-desc', label: '亲密度 高→低' },
  { value: 'intimacy-asc', label: '亲密度 低→高' },
  { value: 'name-asc', label: '姓名 A→Z' }
];

const MODE_FILTERS: readonly { mode: GraphFilterMode; label: string }[] = [
  { mode: 'all', label: '全部' },
  { mode: 'core', label: '核心圈层' },
  { mode: 'dormant', label: '疏远预警' }
];

const cards = computed(() =>
  buildPersonListCards({
    persons: props.persons,
    interactionIndex: props.interactionIndex,
    insights: props.insights,
    filter: props.filter,
    today: props.today,
    keyword: search.value,
    sortKey: sortKey.value
  })
);

const totalCount = computed(() => props.persons.length);

function modeCount(mode: GraphFilterMode): number {
  if (mode === 'core') return props.insights.stats.coreCount;
  // BUG-05-03: list badge reports the complement of the graph's inverted filter.
  if (mode === 'dormant') return Math.max(0, totalCount.value - props.insights.stats.dormantCount);
  return totalCount.value;
}

function onRelationChange(event: Event): void {
  emit('relationFilter', (event.target as HTMLSelectElement).value as RelationFilter);
}

function onSortChange(event: Event): void {
  sortKey.value = (event.target as HTMLSelectElement).value as PersonSortKey;
}
</script>

<template>
  <section class="person-list panel" aria-label="人物列表">
    <div class="panel__header">
      <h2 class="panel__title">
        <span aria-hidden="true">👥</span> 人物管理
        <span class="panel__subtitle">{{ formatInteger(cards.length) }}/{{ formatInteger(totalCount) }}</span>
      </h2>
      <button type="button" class="btn btn--sm btn--primary" aria-label="新增人物" @click="emit('add')">
        ＋ 新增
      </button>
    </div>

    <div class="panel__body person-list__body scroll-y">
      <div class="person-list__filters">
        <label class="sr-only" for="person-search">搜索人物姓名或话题标签</label>
        <input
          id="person-search"
          v-model="search"
          class="input"
          type="search"
          placeholder="搜索姓名 / 话题标签…"
          autocomplete="off"
        />

        <div class="person-list__filter-row">
          <label class="sr-only" for="list-relation">按关系类型筛选</label>
          <select id="list-relation" class="select" :value="props.filter.relationType" @change="onRelationChange">
            <option value="all">全部关系</option>
            <option v-for="meta in RELATION_TYPES" :key="meta.id" :value="meta.id">{{ meta.label }}</option>
          </select>

          <label class="sr-only" for="list-sort">排序方式</label>
          <select id="list-sort" class="select" :value="sortKey" @change="onSortChange">
            <option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="person-list__modes" role="group" aria-label="状态筛选">
          <button
            v-for="item in MODE_FILTERS"
            :key="item.mode"
            type="button"
            class="chip"
            :class="{ 'chip--active': props.filter.mode === item.mode }"
            :aria-pressed="props.filter.mode === item.mode"
            @click="emit('filterMode', item.mode)"
          >
            {{ item.label }} {{ modeCount(item.mode) }}
          </button>
        </div>
      </div>

      <p v-if="cards.length === 0" class="person-list__placeholder">
        <template v-if="totalCount === 0">还没有人物数据，点击「新增」或「载入示例」开始。</template>
        <template v-else>没有符合当前搜索 / 筛选条件的人物。</template>
      </p>

      <ul v-else class="person-list__items">
        <li v-for="card in cards" :key="card.person.id">
          <PersonCard
            :card="card"
            :active="card.person.id === props.selectedId"
            :intimacy-percent="card.person.intimacy * (100 / MAX_INTIMACY)"
            @select="(id) => emit('select', id)"
            @edit="(id) => emit('edit', id)"
            @remove="(id) => emit('remove', id)"
          />
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.person-list__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.person-list__filters {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.person-list__filter-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.person-list__modes {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.person-list__modes .chip {
  cursor: pointer;
}

.person-list__placeholder {
  font-size: 12.5px;
  color: var(--text-faint);
  text-align: center;
  padding: var(--space-4) var(--space-2);
}

.person-list__items {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

@media (max-width: 767px) {
  .person-list__filter-row {
    grid-template-columns: 1fr;
  }
}
</style>
