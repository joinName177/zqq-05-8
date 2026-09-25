/**
 * 统一 ID 生成（重构项：消除各组件自己拼 `Date.now() + Math.random()` 的做法）。
 *
 * ID 由注入的伪随机源 + 单调递增计数构成：
 *  - 同一随机源顺序调用结果稳定（可复现、可测试）
 *  - 计数保证同一会话内绝不重复
 */

import type { RandomFn } from '../domain/TopologyModels';

export type IdFactory = () => string;

/**
 * @param rng   来自 RandomPort 的可播种随机源
 * @param prefix 业务前缀（person / interaction / demo …）
 */
export function createIdFactory(rng: RandomFn, prefix: string): IdFactory {
  let counter = 0;
  return function nextId(): string {
    counter += 1;
    const random = Math.floor(rng() * 0x1000000)
      .toString(36)
      .padStart(5, '0');
    return `${prefix}_${random}${counter.toString(36)}`;
  };
}

/** 基于内容生成稳定 ID（用于建议项：同一规则 + 同一人 → 同一 ID） */
export function stableId(parts: readonly (string | number)[]): string {
  return parts.map((part) => String(part).replace(/\s+/g, '_')).join('::');
}
