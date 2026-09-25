/**
 * 拓扑图的「渲染数据派生」：把领域数据 + 布局坐标算成 SVG 直接可用的数组。
 *
 * 纯展示层计算（尺寸 / 颜色 / 淡化 / 标签可见性），不含任何业务判断与物理计算，
 * 所有阈值取自 `core/domain/topologyConfig.ts`。
 */

import { computed, type ComputedRef, type Ref } from 'vue';
import {
  CORE_HALO_EXTRA,
  DORMANT_PULSE_DURATION_S,
  DORMANT_PULSE_EXTRA,
  GRAPH_CENTER_GLOW_RATIO,
  LABEL_OFFSET_Y,
  LABEL_WEIGHT_CORE_BONUS,
  LABEL_WEIGHT_DORMANT_BONUS,
  LABEL_ZOOM_THRESHOLD,
  NODE_SHINE_OFFSET_X_RATIO,
  NODE_SHINE_OFFSET_Y_RATIO,
  NODE_SHINE_RADIUS_RATIO
} from '../../../core/domain/topologyConfig';
import type { GraphFilter, LayoutState, TopologyData } from '../../../core/domain/TopologyModels';
import { labelFontSize, selectVisibleLabels } from '../../../core/services/labelPlanner';

export interface RenderedNode {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  haloRadius: number;
  pulseRadius: number;
  color: string;
  isCore: boolean;
  isDormant: boolean;
  dimmed: boolean;
  selected: boolean;
  labelVisible: boolean;
  fontSize: number;
  labelY: number;
  shineX: number;
  shineY: number;
  shineRadius: number;
}

export interface RenderedEdge {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  color: string;
  dashed: boolean;
  dimmed: boolean;
}

export interface GraphPresentationInput {
  topology: ComputedRef<TopologyData>;
  layout: ComputedRef<LayoutState | null>;
  filter: ComputedRef<GraphFilter>;
  selectedId: ComputedRef<string | null>;
  showLabels: ComputedRef<boolean>;
  zoom: ComputedRef<number>;
  hoveredId: Ref<string | null>;
}

export interface GraphPresentationApi {
  renderedNodes: ComputedRef<RenderedNode[]>;
  renderedEdges: ComputedRef<RenderedEdge[]>;
  isEmpty: ComputedRef<boolean>;
  centerX: ComputedRef<number>;
  centerY: ComputedRef<number>;
  centerRadius: ComputedRef<number>;
  pulseStyle: Record<string, string>;
}

export function useGraphPresentation(input: GraphPresentationInput): GraphPresentationApi {
  const adjacency = computed(() => {
    const map = new Map<string, Set<string>>();
    const ensure = (id: string): Set<string> => {
      const existing = map.get(id);
      if (existing) return existing;
      const created = new Set<string>();
      map.set(id, created);
      return created;
    };
    for (const edge of input.topology.value.edges) {
      ensure(edge.source).add(edge.target);
      ensure(edge.target).add(edge.source);
    }
    return map;
  });

  const filterActive = computed(
    () => input.filter.value.mode !== 'all' || input.filter.value.relationType !== 'all'
  );

  const matchesFilterById = computed(() => {
    const map = new Map<string, boolean>();
    for (const node of input.topology.value.nodes) map.set(node.person.id, node.matchesFilter);
    return map;
  });

  function isFilterDimmed(personId: string): boolean {
    if (!filterActive.value) return false;
    return !(matchesFilterById.value.get(personId) ?? false);
  }

  function isNeighborOfHover(personId: string): boolean {
    const hovered = input.hoveredId.value;
    if (hovered === null) return false;
    return adjacency.value.get(hovered)?.has(personId) ?? false;
  }

  function isHoverDimmed(personId: string): boolean {
    const hovered = input.hoveredId.value;
    if (hovered === null || personId === hovered) return false;
    return !isNeighborOfHover(personId);
  }

  const layoutNodeById = computed(() => {
    const map = new Map<string, LayoutState['nodes'][number]>();
    for (const node of input.layout.value?.nodes ?? []) map.set(node.id, node);
    return map;
  });

  const visibleLabelIds = computed(() => {
    const positions = layoutNodeById.value;
    const candidates = input.topology.value.nodes
      .filter((node) => positions.has(node.person.id) && !isFilterDimmed(node.person.id))
      .map((node) => {
        const positioned = positions.get(node.person.id);
        return {
          id: node.person.id,
          name: node.person.name,
          x: positioned?.x ?? 0,
          y: positioned?.y ?? 0,
          radius: node.radius,
          weight:
            node.radius +
            (node.isCore ? LABEL_WEIGHT_CORE_BONUS : 0) +
            (node.isDormant ? LABEL_WEIGHT_DORMANT_BONUS : 0),
          pinned:
            node.person.id === input.selectedId.value ||
            node.person.id === input.hoveredId.value ||
            isNeighborOfHover(node.person.id)
        };
      });
    const ids = selectVisibleLabels(candidates, input.zoom.value, {
      zoomThreshold: input.showLabels.value ? 0 : LABEL_ZOOM_THRESHOLD
    });
    return new Set(ids);
  });

  const renderedEdges = computed<RenderedEdge[]>(() => {
    const positions = layoutNodeById.value;
    const selectedId = input.selectedId.value;
    const hoveredId = input.hoveredId.value;
    const edges: RenderedEdge[] = [];
    for (const edge of input.topology.value.edges) {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      if (!source || !target) continue;
      const dimmed =
        (selectedId !== null && selectedId !== edge.source && selectedId !== edge.target) ||
        (hoveredId !== null && hoveredId !== edge.source && hoveredId !== edge.target) ||
        isFilterDimmed(edge.source) ||
        isFilterDimmed(edge.target);
      edges.push({
        id: edge.id,
        x1: source.x,
        y1: source.y,
        x2: target.x,
        y2: target.y,
        width: edge.width,
        color: edge.color,
        dashed: edge.predictedDormant,
        dimmed
      });
    }
    return edges;
  });

  const renderedNodes = computed<RenderedNode[]>(() => {
    const labels = visibleLabelIds.value;
    const positions = layoutNodeById.value;
    const selectedId = input.selectedId.value;
    const result: RenderedNode[] = [];
    for (const node of input.topology.value.nodes) {
      const positioned = positions.get(node.person.id);
      if (!positioned) continue;
      result.push({
        id: node.person.id,
        name: node.person.name,
        x: positioned.x,
        y: positioned.y,
        radius: node.radius,
        haloRadius: node.radius + CORE_HALO_EXTRA,
        pulseRadius: node.radius + DORMANT_PULSE_EXTRA,
        color: node.color,
        isCore: node.isCore,
        isDormant: node.isDormant,
        dimmed: isFilterDimmed(node.person.id) || isHoverDimmed(node.person.id),
        selected: node.person.id === selectedId,
        labelVisible: labels.has(node.person.id),
        fontSize: labelFontSize(node.radius),
        labelY: positioned.y - node.radius - LABEL_OFFSET_Y,
        shineX: positioned.x - node.radius * NODE_SHINE_OFFSET_X_RATIO,
        shineY: positioned.y - node.radius * NODE_SHINE_OFFSET_Y_RATIO,
        shineRadius: node.radius * NODE_SHINE_RADIUS_RATIO
      });
    }
    return result;
  });

  const isEmpty = computed(() => input.topology.value.nodes.length === 0);
  const centerX = computed(() => (input.layout.value ? input.layout.value.viewport.width / 2 : 0));
  const centerY = computed(() => (input.layout.value ? input.layout.value.viewport.height / 2 : 0));
  const centerRadius = computed(() => {
    const layout = input.layout.value;
    if (!layout) return 0;
    return Math.max(layout.viewport.width, layout.viewport.height) * GRAPH_CENTER_GLOW_RATIO;
  });

  return {
    renderedNodes,
    renderedEdges,
    isEmpty,
    centerX,
    centerY,
    centerRadius,
    pulseStyle: { '--pulse-duration': `${DORMANT_PULSE_DURATION_S}s` } as Record<string, string>
  };
}
