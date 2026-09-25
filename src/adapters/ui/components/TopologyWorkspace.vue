<script setup lang="ts">
/**
 * 三栏工作区容器：人物列表 / 拓扑图 + 图例 / 关系类型分布图。
 *
 * 这是「容器组件」：接收组合根 API（`TopologyApp`）并向下转发，展示组件只拿到 props。
 * 响应式三档由样式负责：≥1200 三栏、768–1199 两栏（分布图整行下移）、<768 单栏。
 */

import type { TopologyApp } from '../composables/useTopology';
import EmptyState from './EmptyState.vue';
import ForceGraph from './ForceGraph.vue';
import GraphLegend from './GraphLegend.vue';
import PersonListPanel from './PersonListPanel.vue';
import RelationDistributionChart from './RelationDistributionChart.vue';

interface Props {
  app: TopologyApp;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  createPerson: [];
  editPerson: [personId: string];
  removePerson: [personId: string];
  loadDemo: [];
}>();
</script>

<template>
  <div class="workspace">
    <PersonListPanel
      class="workspace__list"
      :persons="props.app.persons.value"
      :interaction-index="props.app.state.value.interactionIndex"
      :insights="props.app.insights.value"
      :today="props.app.today.value"
      :selected-id="props.app.selectedPersonId.value"
      :filter="props.app.settings.value.filter"
      @select="props.app.selectPerson"
      @edit="(id) => emit('editPerson', id)"
      @remove="(id) => emit('removePerson', id)"
      @add="emit('createPerson')"
      @filter-mode="props.app.setFilterMode"
      @relation-filter="props.app.setRelationFilter"
    />

    <div id="topology-graph" class="workspace__center">
      <ForceGraph
        :topology="props.app.topology.value"
        :layout="props.app.layout.value"
        :filter="props.app.settings.value.filter"
        :selected-id="props.app.selectedPersonId.value"
        :paused="props.app.graphPaused.value"
        :alpha="props.app.graphAlpha.value"
        :show-labels="props.app.settings.value.showLabels"
        @select="props.app.selectPerson"
        @filter-mode="props.app.setFilterMode"
        @relation-filter="props.app.setRelationFilter"
        @toggle-pause="props.app.graph.togglePaused"
        @relayout="props.app.relayout"
        @resize="props.app.graph.setViewport"
        @node-drag-start="props.app.graph.beginDrag"
        @node-drag="props.app.graph.dragTo"
        @node-drag-end="props.app.graph.endDrag"
      >
        <template #empty>
          <EmptyState
            icon="🕸️"
            title="拓扑图还是空的"
            description="录入你社交圈中的人物，系统会用自研力导向物理仿真自动布局；也可以一键载入 12 人示例数据，立刻看到核心圈层光晕、疏远预警脉冲与不同粗细的连线。"
          >
            <template #action>
              <button type="button" class="btn btn--primary" @click="emit('loadDemo')">
                ✨ 载入 12 人示例数据
              </button>
              <button type="button" class="btn" @click="emit('createPerson')">＋ 新增人物</button>
            </template>
          </EmptyState>
        </template>
      </ForceGraph>

      <GraphLegend
        :max-frequency="props.app.topology.value.maxFrequency"
        :paused="props.app.graphPaused.value"
        :alpha="props.app.graphAlpha.value"
        :node-count="props.app.topology.value.nodes.length"
        :edge-count="props.app.topology.value.edges.length"
        :performance-warning="props.app.topology.value.performanceWarning"
      />
    </div>

    <RelationDistributionChart class="workspace__chart" :buckets="props.app.distribution.value" />
  </div>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr) 340px;
  gap: var(--space-4);
  align-items: stretch;
  height: max(600px, calc(100vh - 210px));
  min-height: 0;
}

.workspace__center {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-height: 0;
  min-width: 0;
}

.workspace__center > :first-child {
  flex: 1;
  min-height: 0;
}

.workspace__chart {
  min-height: 0;
  overflow: hidden;
}

.workspace__chart :deep(.panel__body),
.workspace__list :deep(.panel__body) {
  overflow-y: auto;
}

@media (max-width: 1199px) {
  .workspace {
    grid-template-columns: 300px minmax(0, 1fr);
    height: auto;
  }

  .workspace__list :deep(.panel__body) {
    max-height: 520px;
  }

  .workspace__chart {
    grid-column: 1 / -1;
  }

  .workspace__chart :deep(.panel__body) {
    max-height: none;
  }
}

@media (max-width: 767px) {
  .workspace {
    grid-template-columns: minmax(0, 1fr);
  }

  .workspace__chart {
    grid-column: auto;
  }
}
</style>
