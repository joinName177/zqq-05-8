/**
 * 出站端口：随机性。
 *
 * core 层禁止 `Math.random()`：种子由适配器提供，随机源由适配器基于 core 的
 * 可播种算法（mulberry32）构造，保证「同种子 → 同结果」。
 */

import type { RandomFn } from '../../core/domain/TopologyModels';

export interface RandomPort {
  /** 生成一个新的、不可预测的种子 */
  nextSeed(): number;
  /** 由种子构造可复现的伪随机源 */
  createRng(seed: number): RandomFn;
}
