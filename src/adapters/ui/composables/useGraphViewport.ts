/**
 * 拓扑图视口交互（缩放 / 平移 / 拖拽节点）——纯指针数学，不含任何物理计算。
 *
 * 这是适配器层的 UI 组合逻辑：只做「屏幕坐标 ↔ 世界坐标」换算与指针捕获，
 * 物理推进仍然只发生在 `useForceLayout`（唯一 rAF 处），阈值来自 core 配置。
 */

import { ref, type Ref } from 'vue';
import { DRAG_CLICK_THRESHOLD_PX, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '../../../core/domain/topologyConfig';

export interface GraphViewport {
  k: number;
  tx: number;
  ty: number;
}

export interface GraphViewportOptions {
  onNodeDragStart(personId: string): void;
  onNodeDrag(personId: string, x: number, y: number): void;
  onNodeDragEnd(personId: string): void;
  onNodeSelect(personId: string): void;
}

export interface GraphViewportApi {
  view: Ref<GraphViewport>;
  resetView(): void;
  onWheel(event: WheelEvent): void;
  onBackgroundPointerDown(event: PointerEvent): void;
  onNodePointerDown(event: PointerEvent, personId: string): void;
  onPointerMove(event: PointerEvent): void;
  onPointerUp(event: PointerEvent): void;
}

type PointerState =
  | { kind: 'idle' }
  | { kind: 'pan'; startX: number; startY: number; originTx: number; originTy: number }
  | { kind: 'node'; personId: string; startX: number; startY: number; moved: boolean };

export function useGraphViewport(
  svgRef: Ref<SVGSVGElement | null>,
  options: GraphViewportOptions
): GraphViewportApi {
  const view = ref<GraphViewport>({ k: 1, tx: 0, ty: 0 });
  let pointerState: PointerState = { kind: 'idle' };

  function capturePointer(pointerId: number): void {
    try {
      svgRef.value?.setPointerCapture(pointerId);
    } catch {
      // 某些浏览器在指针已释放时会抛错，忽略即可
    }
  }

  function releasePointer(pointerId: number): void {
    try {
      if (svgRef.value?.hasPointerCapture(pointerId)) svgRef.value.releasePointerCapture(pointerId);
    } catch {
      // 忽略
    }
  }

  function screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = svgRef.value?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - view.value.tx) / view.value.k,
      y: (clientY - rect.top - view.value.ty) / view.value.k
    };
  }

  function resetView(): void {
    view.value = { k: 1, tx: 0, ty: 0 };
  }

  /** 以光标为锚点缩放，缩放范围由 ZOOM_MIN / ZOOM_MAX 限定 */
  function onWheel(event: WheelEvent): void {
    const rect = svgRef.value?.getBoundingClientRect();
    if (!rect) return;
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    const nextScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, view.value.k * factor));
    const ratio = nextScale / view.value.k;
    view.value = {
      k: nextScale,
      tx: pointerX - (pointerX - view.value.tx) * ratio,
      ty: pointerY - (pointerY - view.value.ty) * ratio
    };
  }

  function onBackgroundPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    capturePointer(event.pointerId);
    pointerState = {
      kind: 'pan',
      startX: event.clientX,
      startY: event.clientY,
      originTx: view.value.tx,
      originTy: view.value.ty
    };
  }

  function onNodePointerDown(event: PointerEvent, personId: string): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    capturePointer(event.pointerId);
    pointerState = {
      kind: 'node',
      personId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
    options.onNodeDragStart(personId);
  }

  function onPointerMove(event: PointerEvent): void {
    if (pointerState.kind === 'pan') {
      view.value = {
        k: view.value.k,
        tx: pointerState.originTx + (event.clientX - pointerState.startX),
        ty: pointerState.originTy + (event.clientY - pointerState.startY)
      };
      return;
    }
    if (pointerState.kind === 'node') {
      const distance = Math.hypot(event.clientX - pointerState.startX, event.clientY - pointerState.startY);
      if (distance > DRAG_CLICK_THRESHOLD_PX) pointerState.moved = true;
      const world = screenToWorld(event.clientX, event.clientY);
      options.onNodeDrag(pointerState.personId, world.x, world.y);
    }
  }

  function onPointerUp(event: PointerEvent): void {
    if (pointerState.kind === 'idle') return;
    const state = pointerState;
    pointerState = { kind: 'idle' };
    releasePointer(event.pointerId);
    if (state.kind === 'node') {
      options.onNodeDragEnd(state.personId);
      if (!state.moved) options.onNodeSelect(state.personId);
    }
  }

  return {
    view,
    resetView,
    onWheel,
    onBackgroundPointerDown,
    onNodePointerDown,
    onPointerMove,
    onPointerUp
  };
}
