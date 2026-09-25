<script setup lang="ts">
/**
 * F2：力导向拓扑图（SVG 渲染，展示组件）。
 *
 * 只负责：SVG 结构、尺寸测量、转发指针与筛选事件。
 * 坐标计算在 core（forceSimulation），视口交互在 useGraphViewport，
 * 渲染数据派生在 useGraphPresentation，rAF 只在 useForceLayout。
 */

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { EDGE_DASH_PATTERN, GRAPH_ACCENT, GRAPH_CORE_HALO_COLOR } from '../../../core/domain/topologyConfig';
import type {
  GraphFilter,
  GraphFilterMode,
  LayoutState,
  RelationFilter,
  TopologyData
} from '../../../core/domain/TopologyModels';
import { useGraphPresentation } from '../composables/useGraphPresentation';
import { useGraphViewport } from '../composables/useGraphViewport';
import GraphToolbar from './GraphToolbar.vue';

interface Props {
  topology: TopologyData;
  layout: LayoutState | null;
  filter: GraphFilter;
  selectedId: string | null;
  paused: boolean;
  alpha: number;
  showLabels: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [personId: string];
  filterMode: [mode: GraphFilterMode];
  relationFilter: [relationType: RelationFilter];
  togglePause: [];
  relayout: [];
  resize: [width: number, height: number];
  nodeDragStart: [personId: string];
  nodeDrag: [personId: string, x: number, y: number];
  nodeDragEnd: [personId: string];
}>();

const containerRef = ref<HTMLElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const hoveredId = ref<string | null>(null);
let resizeObserver: ResizeObserver | null = null;

const viewport = useGraphViewport(svgRef, {
  onNodeDragStart: (personId) => emit('nodeDragStart', personId),
  onNodeDrag: (personId, x, y) => emit('nodeDrag', personId, x, y),
  onNodeDragEnd: (personId) => emit('nodeDragEnd', personId),
  onNodeSelect: (personId) => emit('select', personId)
});
const view = viewport.view;

const presentation = useGraphPresentation({
  topology: computed(() => props.topology),
  layout: computed(() => props.layout),
  filter: computed(() => props.filter),
  selectedId: computed(() => props.selectedId),
  showLabels: computed(() => props.showLabels),
  zoom: computed(() => view.value.k),
  hoveredId
});

/* ------------------------------ 尺寸 ------------------------------ */

function measure(): void {
  const element = containerRef.value;
  if (!element) return;
  const rect = element.getBoundingClientRect();
  emit('resize', rect.width, rect.height);
}

onMounted(() => {
  measure();
  if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
    resizeObserver = new ResizeObserver(() => measure());
    resizeObserver.observe(containerRef.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

/* ------------------------------ 键盘 ------------------------------ */

function onNodeKeydown(event: KeyboardEvent, personId: string): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    emit('select', personId);
  }
}

// 仅在「从无到有」时复位视图（例如载入示例数据），避免增删单人时打断用户视角
watch(
  () => props.topology.nodes.length,
  (next, previous) => {
    if (previous === 0 && next > 0) viewport.resetView();
  }
);
</script>

<template>
  <section class="graph panel" aria-label="人际关系拓扑图">
    <div class="panel__header graph__header">
      <h2 class="panel__title"><span aria-hidden="true">🕸️</span> 人际关系拓扑图</h2>
      <GraphToolbar
        :filter="props.filter"
        :paused="props.paused"
        :zoom="view.k"
        @filter-mode="(mode) => emit('filterMode', mode)"
        @relation-filter="(type) => emit('relationFilter', type)"
        @toggle-pause="emit('togglePause')"
        @relayout="emit('relayout')"
      />
    </div>

    <div ref="containerRef" class="graph__stage">
      <svg
        ref="svgRef"
        class="graph__svg"
        role="img"
        aria-label="力导向人际关系拓扑图，可使用 Tab 键在节点间移动，回车打开详情"
        @wheel.prevent="viewport.onWheel"
        @pointermove="viewport.onPointerMove"
        @pointerup="viewport.onPointerUp"
        @pointercancel="viewport.onPointerUp"
      >
        <defs>
          <radialGradient id="zqq-graph-center" cx="50%" cy="50%" r="50%">
            <stop offset="0%" :stop-color="GRAPH_ACCENT" stop-opacity="0.18" />
            <stop offset="100%" :stop-color="GRAPH_ACCENT" stop-opacity="0" />
          </radialGradient>
          <radialGradient id="zqq-node-shine" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55" />
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
          </radialGradient>
        </defs>

        <rect
          class="graph__bg"
          x="0"
          y="0"
          width="100%"
          height="100%"
          @pointerdown="viewport.onBackgroundPointerDown"
          @dblclick="viewport.resetView"
        />

        <g :transform="`translate(${view.tx} ${view.ty}) scale(${view.k})`">
          <circle
            v-if="props.layout"
            :cx="presentation.centerX.value"
            :cy="presentation.centerY.value"
            :r="presentation.centerRadius.value"
            fill="url(#zqq-graph-center)"
          />

          <g class="graph__edges">
            <line
              v-for="edge in presentation.renderedEdges.value"
              :key="edge.id"
              :x1="edge.x1"
              :y1="edge.y1"
              :x2="edge.x2"
              :y2="edge.y2"
              :stroke="edge.color"
              :stroke-width="edge.width"
              :stroke-dasharray="edge.dashed ? EDGE_DASH_PATTERN : undefined"
              :class="{ 'graph__edge--dashed': edge.dashed, 'graph__edge--dim': edge.dimmed }"
              stroke-linecap="round"
            />
          </g>

          <g class="graph__nodes">
            <g
              v-for="node in presentation.renderedNodes.value"
              :key="node.id"
              class="graph__node"
              :class="{ 'graph__node--dim': node.dimmed, 'graph__node--selected': node.selected }"
              role="button"
              tabindex="0"
              :aria-label="`${node.name}，点击查看互动时间轴与维护建议`"
              @pointerdown="viewport.onNodePointerDown($event, node.id)"
              @keydown="onNodeKeydown($event, node.id)"
              @mouseenter="hoveredId = node.id"
              @mouseleave="hoveredId = null"
              @focus="hoveredId = node.id"
              @blur="hoveredId = null"
            >
              <circle
                v-if="node.isCore"
                class="graph__halo"
                :cx="node.x"
                :cy="node.y"
                :r="node.haloRadius"
                :stroke="GRAPH_CORE_HALO_COLOR"
              />
              <circle
                v-if="node.isDormant"
                class="graph__pulse"
                :cx="node.x"
                :cy="node.y"
                :r="node.pulseRadius"
                :style="presentation.pulseStyle"
              />
              <circle class="graph__dot" :cx="node.x" :cy="node.y" :r="node.radius" :fill="node.color" />
              <circle
                class="graph__shine"
                :cx="node.shineX"
                :cy="node.shineY"
                :r="node.shineRadius"
                fill="url(#zqq-node-shine)"
              />
              <text
                v-if="node.labelVisible"
                class="graph__label"
                :x="node.x"
                :y="node.labelY"
                :font-size="node.fontSize"
                text-anchor="middle"
              >
                {{ node.name }}
              </text>
            </g>
          </g>
        </g>
      </svg>

      <div v-if="props.layout === null && !presentation.isEmpty.value" class="graph__loading" role="status">
        <span class="spinner" aria-hidden="true"></span>
        <span>正在计算力导向布局…</span>
      </div>

      <div v-if="presentation.isEmpty.value" class="graph__empty">
        <slot name="empty" />
      </div>

      <p class="graph__hint">
        拖拽节点固定位置 · 拖空白平移 · 滚轮缩放 · 双击空白复位 · alpha {{ props.alpha.toFixed(3) }}
      </p>
    </div>
  </section>
</template>
