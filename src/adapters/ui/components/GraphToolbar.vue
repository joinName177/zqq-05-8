<script setup lang="ts">
/**
 * F2：拓扑图工具栏（筛选模式 / 关系类型 / 暂停继续 / 重新布局 / 缩放指示）。
 * 纯展示组件：状态来自 props，操作通过 emit 交给容器。
 */

import { RELATION_TYPES } from '../../../core/data/relationTypes';
import { ZOOM_MAX, ZOOM_MIN } from '../../../core/domain/topologyConfig';
import type { GraphFilter, GraphFilterMode, RelationFilter } from '../../../core/domain/TopologyModels';

interface Props {
  filter: GraphFilter;
  paused: boolean;
  zoom: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  filterMode: [mode: GraphFilterMode];
  relationFilter: [relationType: RelationFilter];
  togglePause: [];
  relayout: [];
}>();

const MODE_BUTTONS: readonly { mode: GraphFilterMode; label: string; ariaLabel: string }[] = [
  { mode: 'all', label: '全部', ariaLabel: '显示全部人物' },
  { mode: 'core', label: '核心圈层', ariaLabel: '仅显示核心圈层' },
  { mode: 'dormant', label: '疏远预警', ariaLabel: '仅显示疏远预警' }
];

function onRelationChange(event: Event): void {
  emit('relationFilter', (event.target as HTMLSelectElement).value as RelationFilter);
}
</script>

<template>
  <div class="graph__toolbar">
    <div class="graph__group" role="group" aria-label="筛选模式">
      <button
        v-for="item in MODE_BUTTONS"
        :key="item.mode"
        type="button"
        class="btn btn--sm"
        :class="{ 'btn--primary': props.filter.mode === item.mode }"
        :aria-label="item.ariaLabel"
        :aria-pressed="props.filter.mode === item.mode"
        @click="emit('filterMode', item.mode)"
      >
        {{ item.label }}
      </button>
    </div>

    <label class="sr-only" for="relation-filter">按关系类型筛选</label>
    <select
      id="relation-filter"
      class="select graph__select"
      :value="props.filter.relationType"
      @change="onRelationChange"
    >
      <option value="all">全部关系类型</option>
      <option v-for="meta in RELATION_TYPES" :key="meta.id" :value="meta.id">
        {{ meta.icon }} {{ meta.label }}
      </option>
    </select>

    <button
      type="button"
      class="btn btn--sm"
      :aria-label="props.paused ? '继续物理仿真' : '暂停物理仿真'"
      :aria-pressed="props.paused"
      @click="emit('togglePause')"
    >
      <span aria-hidden="true">{{ props.paused ? '▶' : '⏸' }}</span>
      {{ props.paused ? '继续' : '暂停' }}
    </button>

    <button type="button" class="btn btn--sm" aria-label="使用新种子重新布局" @click="emit('relayout')">
      <span aria-hidden="true">🔄</span> 重新布局
    </button>

    <span class="chip">缩放 {{ props.zoom.toFixed(2) }}×（{{ ZOOM_MIN }}–{{ ZOOM_MAX }}）</span>
  </div>
</template>
