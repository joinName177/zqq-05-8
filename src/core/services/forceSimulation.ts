/**
 * F2：自研力导向物理仿真（纯 TS，无任何第三方图库）。
 * 度量换算（半径 / 劲度 / 自然长度）见 `layoutMetrics.ts`。
 *
 * 对外仅两个纯函数入口（提示词要求）：
 *   - `createLayout(nodes, edges, params, rng)` → 初始布局
 *   - `stepLayout(layout, params)`             → 推进一步，返回**新的**状态（不改动入参）
 *
 * 物理模型：
 *   斥力     F = repulsion / d²                      （O(n²)，节点 > 120 由 UI 提示性能）
 *   弹簧引力 F = (d − restLength) × stiffness × k    （restLength 由两端亲密度与联系频率决定）
 *   向心力   F = (center − pos) × centeringStrength
 *   积分     v = (v + F × alpha) × damping           （alpha 为冷却因子）
 *   约束     速度上限 / 单帧位移上限 / 画布边界 / alpha 衰减到 alphaMin 即停止
 *
 * 随机性全部来自注入的 `RandomFn`（RandomPort → mulberry32），同种子同结果，可复现。
 */

import {
  PHYSICS_CONFIG,
  REHEAT_ALPHA_FULL,
  REHEAT_ALPHA_STABLE,
  REHEAT_ALPHA_STRUCTURE
} from '../domain/topologyConfig';
import type {
  LayoutEdge,
  LayoutEdgeSeed,
  LayoutNode,
  LayoutNodeSeed,
  LayoutParams,
  LayoutState,
  RandomFn
} from '../domain/TopologyModels';
import { clamp, computeNodeRadius, computeRestLength } from './layoutMetrics';
import { mulberry32 } from './random';

/** 由视口尺寸 + 配置 + 种子构造仿真参数（组件不得内联物理常量） */
export function createLayoutParams(width: number, height: number, seed: number): LayoutParams {
  return {
    physics: PHYSICS_CONFIG,
    viewport: { width: Math.max(1, width), height: Math.max(1, height) },
    seed
  };
}

/** 生成初始布局：确定性角度 + 种子抖动，保证同种子同结果 */
export function createLayout(
  nodeSeeds: readonly LayoutNodeSeed[],
  edgeSeeds: readonly LayoutEdgeSeed[],
  params: LayoutParams,
  rng: RandomFn
): LayoutState {
  const { viewport, physics, seed } = params;
  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;
  const spread = Math.max(24, Math.min(viewport.width, viewport.height) * physics.initialSpreadRatio);
  const count = nodeSeeds.length;

  const nodes: LayoutNode[] = nodeSeeds.map((nodeSeed, index) => {
    const baseAngle = count > 0 ? (index / count) * Math.PI * 2 : 0;
    const jitter = (rng() - 0.5) * physics.initialJitter * 2;
    const radial = spread * (0.45 + 0.55 * Math.sqrt(rng()));
    const x = centerX + Math.cos(baseAngle + jitter) * radial;
    const y = centerY + Math.sin(baseAngle + jitter) * radial;
    return {
      id: nodeSeed.id,
      x: clamp(x, 0, viewport.width),
      y: clamp(y, 0, viewport.height),
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
      intimacy: nodeSeed.intimacy,
      radius: computeNodeRadius(nodeSeed.intimacy),
      core: nodeSeed.core,
      dormant: nodeSeed.dormant
    };
  });

  const intimacyById = new Map<string, number>();
  for (const node of nodes) intimacyById.set(node.id, node.intimacy);

  const edges: LayoutEdge[] = [];
  for (const edgeSeed of edgeSeeds) {
    const sourceIntimacy = intimacyById.get(edgeSeed.source);
    const targetIntimacy = intimacyById.get(edgeSeed.target);
    if (sourceIntimacy === undefined || targetIntimacy === undefined) continue;
    edges.push({
      id: edgeSeed.id,
      source: edgeSeed.source,
      target: edgeSeed.target,
      strength: edgeSeed.strength,
      frequency: edgeSeed.frequency,
      restLength: computeRestLength(sourceIntimacy, targetIntimacy, edgeSeed.frequency, physics),
      predictedDormant: edgeSeed.predictedDormant
    });
  }

  return {
    nodes,
    edges,
    alpha: 1,
    tick: 0,
    settled: false,
    seed,
    viewport: { ...viewport }
  };
}

/** 把上一轮布局的坐标迁移到新布局上（增删节点时图不跳变） */
export function mergeLayoutPositions(previous: LayoutState | null, next: LayoutState): LayoutState {
  if (!previous || previous.nodes.length === 0) return next;
  const previousById = new Map(previous.nodes.map((node) => [node.id, node] as const));
  const nodes = next.nodes.map((node) => {
    const old = previousById.get(node.id);
    if (!old) return node;
    const inBounds =
      old.x >= 0 && old.x <= next.viewport.width && old.y >= 0 && old.y <= next.viewport.height;
    if (!inBounds) return node;
    return { ...node, x: old.x, y: old.y, vx: old.vx * 0.5, vy: old.vy * 0.5, fx: old.fx, fy: old.fy };
  });

  // 结构未变（只是数据刷新）→ 轻微回热；结构变化（增删节点/连线）→ 大幅回热
  const sameNodes =
    previous.nodes.length === next.nodes.length &&
    previous.nodes.every((node, index) => next.nodes[index]?.id === node.id);
  const sameEdges =
    previous.edges.length === next.edges.length &&
    previous.edges.every((edge, index) => next.edges[index]?.id === edge.id);
  const heat = sameNodes && sameEdges ? REHEAT_ALPHA_STABLE : REHEAT_ALPHA_STRUCTURE;

  return { ...next, nodes, alpha: heat, settled: false };
}

/**
 * 推进一步物理仿真（纯函数：返回新状态，不修改入参）。
 * alpha 衰减到 alphaMin 后直接返回同一引用，便于 rAF 循环停机。
 */
export function stepLayout(layout: LayoutState, params: LayoutParams): LayoutState {
  const { physics, viewport } = params;

  if (layout.alpha <= physics.alphaMin) {
    return layout.settled ? layout : { ...layout, settled: true };
  }

  const nextAlpha = Math.max(physics.alphaMin, layout.alpha - physics.alphaDecay);
  const nodes = layout.nodes;
  const count = nodes.length;

  if (count === 0) {
    return { ...layout, alpha: nextAlpha, tick: layout.tick + 1, settled: nextAlpha <= physics.alphaMin };
  }

  const forceX = new Array<number>(count).fill(0);
  const forceY = new Array<number>(count).fill(0);
  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;

  // ① 斥力：F = repulsion / d²，O(n²)
  for (let i = 0; i < count; i += 1) {
    const a = nodes[i] as LayoutNode;
    for (let j = i + 1; j < count; j += 1) {
      const b = nodes[j] as LayoutNode;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let distanceSquared = dx * dx + dy * dy;
      if (distanceSquared < 0.0001) {
        // 完全重合时用确定性微扰分开，避免除零
        dx = ((i % 7) - 3) * 0.5 + 0.5;
        dy = ((j % 5) - 2) * 0.5 + 0.5;
        distanceSquared = dx * dx + dy * dy;
      }
      const distance = Math.sqrt(distanceSquared);
      const effective = Math.max(distance, physics.minDistance);
      const magnitude = Math.min(physics.repulsion / (effective * effective), physics.maxForcePerStep);
      const unitX = dx / distance;
      const unitY = dy / distance;
      forceX[i] -= unitX * magnitude;
      forceY[i] -= unitY * magnitude;
      forceX[j] += unitX * magnitude;
      forceY[j] += unitY * magnitude;
    }
  }

  // ② 弹簧引力：F = (d − restLength) × stiffness × strength
  const indexById = new Map<string, number>();
  for (let i = 0; i < count; i += 1) indexById.set((nodes[i] as LayoutNode).id, i);

  for (const edge of layout.edges) {
    const sourceIndex = indexById.get(edge.source);
    const targetIndex = indexById.get(edge.target);
    if (sourceIndex === undefined || targetIndex === undefined) continue;
    const a = nodes[sourceIndex] as LayoutNode;
    const b = nodes[targetIndex] as LayoutNode;
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 0.001) {
      dx = 0.7;
      dy = 0.7;
      distance = Math.sqrt(dx * dx + dy * dy);
    }
    const delta = distance - edge.restLength;
    const magnitude = Math.min(
      Math.abs(delta) * physics.springStiffness * edge.strength,
      physics.maxForcePerStep
    );
    const sign = delta >= 0 ? 1 : -1;
    const magnitudeX = (dx / distance) * sign * magnitude;
    const magnitudeY = (dy / distance) * sign * magnitude;
    forceX[sourceIndex] += magnitudeX;
    forceY[sourceIndex] += magnitudeY;
    forceX[targetIndex] -= magnitudeX;
    forceY[targetIndex] -= magnitudeY;
  }

  // ③ 向心力 + 积分 + 约束
  const nextNodes = new Array<LayoutNode>(count);
  for (let i = 0; i < count; i += 1) {
    const node = nodes[i] as LayoutNode;

    if (node.fx !== null && node.fy !== null) {
      nextNodes[i] = { ...node, x: node.fx, y: node.fy, vx: 0, vy: 0 };
      continue;
    }

    // BUG-05-06: centering force pushes nodes away from the viewport center.
    let totalForceX = forceX[i] + (node.x - centerX) * physics.centeringStrength;
    let totalForceY = forceY[i] + (node.y - centerY) * physics.centeringStrength;
    const forceMagnitude = Math.sqrt(totalForceX * totalForceX + totalForceY * totalForceY);
    if (forceMagnitude > physics.maxForcePerStep) {
      const scale = physics.maxForcePerStep / forceMagnitude;
      totalForceX *= scale;
      totalForceY *= scale;
    }

    let velocityX = (node.vx + totalForceX * nextAlpha) * physics.damping;
    let velocityY = (node.vy + totalForceY * nextAlpha) * physics.damping;
    const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    if (speed > physics.maxVelocity) {
      const scale = physics.maxVelocity / speed;
      velocityX *= scale;
      velocityY *= scale;
    }

    let stepX = velocityX;
    let stepY = velocityY;
    const stepLength = Math.sqrt(stepX * stepX + stepY * stepY);
    if (stepLength > physics.maxDisplacement) {
      const scale = physics.maxDisplacement / stepLength;
      stepX *= scale;
      stepY *= scale;
    }

    const margin = node.radius + physics.boundaryPadding;
    const minX = Math.min(margin, viewport.width / 2);
    const maxX = Math.max(viewport.width - margin, viewport.width / 2);
    const minY = Math.min(margin, viewport.height / 2);
    const maxY = Math.max(viewport.height - margin, viewport.height / 2);

    nextNodes[i] = {
      ...node,
      x: clamp(node.x + stepX, minX, maxX),
      y: clamp(node.y + stepY, minY, maxY),
      vx: velocityX,
      vy: velocityY
    };
  }

  return {
    nodes: nextNodes,
    edges: layout.edges,
    alpha: nextAlpha,
    tick: layout.tick + 1,
    settled: nextAlpha <= physics.alphaMin,
    seed: layout.seed,
    viewport: layout.viewport
  };
}

/** 仿真是否已收敛（alpha 衰减到 alphaMin） */
export function isLayoutSettled(layout: LayoutState): boolean {
  return layout.settled || layout.alpha <= PHYSICS_CONFIG.alphaMin;
}

/** 重新加热：保留当前坐标，把 alpha 拉回 1（「重新布局」按钮） */
export function reheatLayout(layout: LayoutState, heat = REHEAT_ALPHA_FULL): LayoutState {
  return { ...layout, alpha: clamp(heat, 0, 1), settled: false, tick: 0 };
}

/** 拖拽期间固定节点坐标（fx/fy），松手后 releaseNode 释放 */
export function pinNode(layout: LayoutState, id: string, x: number, y: number): LayoutState {
  const nodes = layout.nodes.map((node) =>
    node.id === id ? { ...node, x, y, fx: x, fy: y, vx: 0, vy: 0 } : node
  );
  return { ...layout, nodes };
}

/** 释放固定，并把速度清零避免「弹射」 */
export function releaseNode(layout: LayoutState, id: string): LayoutState {
  const nodes = layout.nodes.map((node) => (node.id === id ? { ...node, fx: null, fy: null, vx: 0, vy: 0 } : node));
  return { ...layout, nodes };
}

/** 让布局在给定种子下重来一次（「重新布局」并更换种子） */
export function reseedLayout(
  nodeSeeds: readonly LayoutNodeSeed[],
  edgeSeeds: readonly LayoutEdgeSeed[],
  params: LayoutParams,
  seed: number
): LayoutState {
  return createLayout(nodeSeeds, edgeSeeds, { ...params, seed }, mulberry32(seed));
}
