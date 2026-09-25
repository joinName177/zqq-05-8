/**
 * 力导向布局的 rAF 驱动（**全项目唯一允许出现 requestAnimationFrame 的地方**）。
 *
 * 本文件只负责：
 *   1. 读取视口尺寸并构造 core 的布局参数
 *   2. 在 rAF 回调里调用 core 纯函数 `stepLayout`，把结果写回响应式引用
 *   3. 拖拽时固定节点坐标（fx/fy）、松手释放
 * 任何物理计算都不在这里，全部在 `core/services/forceSimulation.ts`。
 */

import { computed, onBeforeUnmount, ref, shallowRef, watch, type ComputedRef, type Ref } from 'vue';
import { REHEAT_ALPHA_STRUCTURE } from '../../../core/domain/topologyConfig';
import type { LayoutEdgeSeed, LayoutNodeSeed, LayoutState } from '../../../core/domain/TopologyModels';
import {
  createLayout,
  createLayoutParams,
  isLayoutSettled,
  mergeLayoutPositions,
  pinNode,
  reheatLayout,
  releaseNode,
  reseedLayout,
  stepLayout
} from '../../../core/services/forceSimulation';
import { mulberry32 } from '../../../core/services/random';

export interface UseForceLayoutOptions {
  nodeSeeds: ComputedRef<LayoutNodeSeed[]>;
  edgeSeeds: ComputedRef<LayoutEdgeSeed[]>;
  seed: ComputedRef<number>;
}

export interface ForceLayoutApi {
  layout: Ref<LayoutState | null>;
  alpha: ComputedRef<number>;
  tick: ComputedRef<number>;
  /** 仿真循环是否正在运行 */
  running: Ref<boolean>;
  paused: Ref<boolean>;
  settled: ComputedRef<boolean>;
  setViewport(width: number, height: number): void;
  rebuild(keepPositions?: boolean): void;
  /** 重新布局并恢复运行 */
  reheat(): void;
  /** 换种子重排（「重新布局」按钮） */
  reseed(seed: number): void;
  setPaused(value: boolean): void;
  togglePaused(): void;
  beginDrag(id: string): void;
  dragTo(id: string, x: number, y: number): void;
  endDrag(id: string): void;
  stop(): void;
}

const DEFAULT_VIEWPORT_WIDTH = 960;
const DEFAULT_VIEWPORT_HEIGHT = 620;

export function useForceLayout(options: UseForceLayoutOptions): ForceLayoutApi {
  const layout = shallowRef<LayoutState | null>(null);
  const viewport = ref({ width: DEFAULT_VIEWPORT_WIDTH, height: DEFAULT_VIEWPORT_HEIGHT });
  const paused = ref(false);
  const running = ref(false);
  let frameHandle = 0;

  const alpha = computed(() => layout.value?.alpha ?? 0);
  const tick = computed(() => layout.value?.tick ?? 0);
  const settled = computed(() => (layout.value ? isLayoutSettled(layout.value) : true));

  function currentParams() {
    return createLayoutParams(viewport.value.width, viewport.value.height, options.seed.value);
  }

  function stopLoop(): void {
    if (frameHandle !== 0) {
      cancelAnimationFrame(frameHandle);
      frameHandle = 0;
    }
    running.value = false;
  }

  function frame(): void {
    frameHandle = 0;
    const current = layout.value;
    if (!current || paused.value) {
      running.value = false;
      return;
    }
    const next = stepLayout(current, currentParams());
    layout.value = next;
    if (isLayoutSettled(next)) {
      running.value = false;
      return;
    }
    frameHandle = requestAnimationFrame(frame);
  }

  function startLoop(): void {
    if (paused.value || frameHandle !== 0) {
      running.value = false;
      return;
    }
    const current = layout.value;
    if (!current || isLayoutSettled(current)) {
      running.value = false;
      return;
    }
    running.value = true;
    frameHandle = requestAnimationFrame(frame);
  }

  function rebuild(keepPositions = true): void {
    const previous = keepPositions ? layout.value : null;
    const next = createLayout(
      options.nodeSeeds.value,
      options.edgeSeeds.value,
      currentParams(),
      mulberry32(options.seed.value)
    );
    layout.value = mergeLayoutPositions(previous, next);
    startLoop();
  }

  function reheat(): void {
    paused.value = false;
    const current = layout.value;
    if (!current) {
      rebuild(false);
      return;
    }
    // BUG-05-06: reheat keeps the diverging physics state instead of recentering it.
    layout.value = reheatLayout(current, REHEAT_ALPHA_STRUCTURE);
    startLoop();
  }

  function reseed(seed: number): void {
    paused.value = false;
    layout.value = reseedLayout(options.nodeSeeds.value, options.edgeSeeds.value, currentParams(), seed);
    startLoop();
  }

  function setViewport(width: number, height: number): void {
    const safeWidth = Math.max(1, Math.round(width));
    const safeHeight = Math.max(1, Math.round(height));
    if (Math.abs(viewport.value.width - safeWidth) < 2 && Math.abs(viewport.value.height - safeHeight) < 2) return;
    viewport.value = { width: safeWidth, height: safeHeight };
    const current = layout.value;
    if (!current) {
      rebuild(false);
      return;
    }
    layout.value = { ...current, viewport: { width: safeWidth, height: safeHeight } };
    layout.value = reheatLayout(layout.value, REHEAT_ALPHA_STRUCTURE);
    startLoop();
  }

  function setPaused(value: boolean): void {
    paused.value = value;
    if (value) {
      stopLoop();
    } else {
      startLoop();
    }
  }

  function togglePaused(): void {
    setPaused(!paused.value);
  }

  function beginDrag(id: string): void {
    const current = layout.value;
    if (!current) return;
    const node = current.nodes.find((item) => item.id === id);
    if (!node) return;
    layout.value = pinNode(current, id, node.x, node.y);
    startLoop();
  }

  function dragTo(id: string, x: number, y: number): void {
    const current = layout.value;
    if (!current) return;
    layout.value = pinNode(current, id, x, y);
  }

  function endDrag(id: string): void {
    const current = layout.value;
    if (!current) return;
    layout.value = releaseNode(current, id);
    startLoop();
  }

  watch([options.nodeSeeds, options.edgeSeeds], () => rebuild(true));
  watch(options.seed, (value) => reseed(value));

  // 首次装配必须立刻建图：数据可能来自 localStorage 快照（此时 watch 不会触发）
  rebuild(false);

  onBeforeUnmount(stopLoop);

  return {
    layout,
    alpha,
    tick,
    running,
    paused,
    settled,
    setViewport,
    rebuild,
    reheat,
    reseed,
    setPaused,
    togglePaused,
    beginDrag,
    dragTo,
    endDrag,
    stop: stopLoop
  };
}
