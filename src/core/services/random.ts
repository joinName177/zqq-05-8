/**
 * 可播种伪随机（mulberry32）与随机工具。
 *
 * core 层禁止 `Math.random()`；一切随机性都来自 `RandomPort` 注入的种子，
 * 因此「同一份输入 + 同一种子 = 同一份输出」，布局可复现。
 */

import { DomainError, ERROR_CODES } from '../domain/errors';
import type { RandomFn } from '../domain/TopologyModels';

/** mulberry32：32 位状态、周期 2^32，质量足够力导向初始抖动使用 */
export function mulberry32(seed: number): RandomFn {
  let state = (Number.isFinite(seed) ? Math.floor(seed) : 0) >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** [min, max) 浮点 */
export function randomFloat(rng: RandomFn, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** [min, max] 整数（含两端） */
export function randomInt(rng: RandomFn, min: number, max: number): number {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  if (high <= low) return low;
  return low + Math.floor(rng() * (high - low + 1));
}

/** 从非空集合中取值；空集合抛领域错误而非返回 undefined */
export function pickOne<T>(rng: RandomFn, items: readonly T[]): T {
  if (items.length === 0) {
    throw new DomainError(ERROR_CODES.EMPTY_POOL, '无法从空集合中随机取值');
  }
  const index = Math.min(items.length - 1, Math.floor(rng() * items.length));
  return items[index] as T;
}

/** Fisher–Yates 洗牌（返回新数组，不改动入参） */
export function shuffle<T>(rng: RandomFn, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const current = result[i] as T;
    result[i] = result[j] as T;
    result[j] = current;
  }
  return result;
}

/** 字符串 → 32 位整数种子（用于把内容稳定的映射为可复现种子） */
export function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
