/**
 * 力导向仿真的度量换算（F2 视觉映射相关的纯算术）。
 *
 * 从 `forceSimulation.ts` 拆出：只负责「亲密度 / 关系权重 / 联系频率 → 半径、劲度、自然长度」，
 * 不含任何积分与迭代逻辑。所有阈值取自 `core/domain/topologyConfig.ts`。
 */

import {
  EDGE_FREQUENCY_LOG_CAP,
  EDGE_STRENGTH_MAX,
  EDGE_STRENGTH_MIN,
  MAX_INTIMACY,
  MIN_INTIMACY,
  NODE_RADIUS_BASE,
  NODE_RADIUS_PER_INTIMACY
} from '../domain/topologyConfig';
import type { PhysicsParams } from '../domain/TopologyModels';

/** 数值夹取；非法值回落到下界，保证仿真永不出现 NaN */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/** 夹取到 [0, 1] */
export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/** F2 视觉映射：r = 6 + intimacy × 2.2 */
export function computeNodeRadius(intimacy: number): number {
  return NODE_RADIUS_BASE + clamp(intimacy, MIN_INTIMACY, MAX_INTIMACY) * NODE_RADIUS_PER_INTIMACY;
}

/** 关系权重 0–1 → 弹簧强度倍率 */
export function computeSpringStrength(weight: number): number {
  return EDGE_STRENGTH_MIN + clamp01(weight) * (EDGE_STRENGTH_MAX - EDGE_STRENGTH_MIN);
}

/**
 * F2 弹簧自然长度：越亲密越近，联系越频繁越近。
 *   restLength = restLengthMax − 亲密度影响项 − 频率影响项
 */
export function computeRestLength(
  intimacyA: number,
  intimacyB: number,
  frequency: number,
  physics: PhysicsParams
): number {
  const average = (clamp(intimacyA, MIN_INTIMACY, MAX_INTIMACY) + clamp(intimacyB, MIN_INTIMACY, MAX_INTIMACY)) / 2;
  const normalized = clamp01((average - MIN_INTIMACY) / (MAX_INTIMACY - MIN_INTIMACY));
  const base = physics.restLengthMax - normalized * (physics.restLengthMax - physics.restLengthMin);
  const frequencyBoost = clamp01(frequency / EDGE_FREQUENCY_LOG_CAP) * physics.frequencyRestLengthBoost;
  const floor = physics.restLengthMin - physics.frequencyRestLengthBoost;
  return Math.max(floor, base - frequencyBoost);
}
