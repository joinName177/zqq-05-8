/**
 * 标签显示规划（F2：标签在缩放足够或悬停/选中时显示，重叠时隐藏低优先级标签）。
 *
 * 纯函数 + 纯几何计算，供 ForceGraph 每帧调用（节点规模 ≤ 数百，O(n²) 可接受）。
 */

import {
  LABEL_FONT_PER_RADIUS,
  LABEL_MAX_FONT_SIZE,
  LABEL_MIN_FONT_SIZE,
  LABEL_OVERLAP_PADDING,
  LABEL_ZOOM_THRESHOLD,
  MAX_VISIBLE_LABELS
} from '../domain/topologyConfig';
import type { LabelCandidate } from '../domain/TopologyModels';

export interface LabelPlanOptions {
  zoomThreshold?: number;
  maxLabels?: number;
  padding?: number;
}

interface LabelBox {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** 字号随节点半径变化，并限制在 [LABEL_MIN_FONT_SIZE, LABEL_MAX_FONT_SIZE] */
export function labelFontSize(radius: number): number {
  const size = LABEL_MIN_FONT_SIZE + radius * LABEL_FONT_PER_RADIUS;
  return Math.min(LABEL_MAX_FONT_SIZE, Math.max(LABEL_MIN_FONT_SIZE, Math.round(size)));
}

function measure(name: string, fontSize: number, x: number, y: number, padding: number): LabelBox {
  // 中文按 1 个字宽 ≈ 1 个 font-size 估算，英文按 0.55 折算
  let units = 0;
  for (const char of name) {
    units += /[\u4e00-\u9fa5\uff00-\uffef]/.test(char) ? 1 : 0.55;
  }
  const width = Math.max(fontSize, units * fontSize);
  const height = fontSize * 1.2;
  const labelY = y - 12 - fontSize / 2;
  return {
    id: '',
    left: x - width / 2 - padding,
    right: x + width / 2 + padding,
    top: labelY - height / 2 - padding,
    bottom: labelY + height / 2 + padding
  };
}

function overlaps(a: LabelBox, b: LabelBox): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

/**
 * 选出需要渲染标签的节点 id。
 *  - zoom < zoomThreshold：只显示 pinned（悬停 / 选中 / 邻接）
 *  - zoom ≥ zoomThreshold：pinned 全部显示，其余按权重降序贪心避让，最多 maxLabels 个
 */
export function selectVisibleLabels(
  candidates: readonly LabelCandidate[],
  zoom: number,
  options: LabelPlanOptions = {}
): string[] {
  const zoomThreshold = options.zoomThreshold ?? LABEL_ZOOM_THRESHOLD;
  const maxLabels = options.maxLabels ?? MAX_VISIBLE_LABELS;
  const padding = options.padding ?? LABEL_OVERLAP_PADDING;

  const pinned = candidates.filter((candidate) => candidate.pinned);
  if (!Number.isFinite(zoom) || zoom < zoomThreshold) {
    return pinned.map((candidate) => candidate.id);
  }

  const ordered = [...candidates].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.id.localeCompare(b.id);
  });

  const acceptedBoxes: LabelBox[] = [];
  const accepted: string[] = [];

  for (const candidate of ordered) {
    if (accepted.length >= maxLabels) break;
    const box = measure(candidate.name, labelFontSize(candidate.radius), candidate.x, candidate.y, padding);
    const collides = acceptedBoxes.some((existing) => overlaps(existing, box));
    if (collides && !candidate.pinned) continue;
    accepted.push(candidate.id);
    acceptedBoxes.push(box);
  }

  return accepted;
}
