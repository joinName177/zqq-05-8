/**
 * 出站端口 RandomPort 的实现：种子来自系统时间 ⊕ 加密随机源，
 * 随机源本身使用 core 的可播种 mulberry32，保证「同种子 → 同布局」（可复现）。
 */

import type { RandomFn } from '../../core/domain/TopologyModels';
import { mulberry32 } from '../../core/services/random';
import type { RandomPort } from '../../ports/out/RandomPort';

export class SeededRandomProvider implements RandomPort {
  nextSeed(): number {
    const time = Date.now() >>> 0;
    let entropy = 0;
    const cryptoApi = typeof globalThis.crypto === 'undefined' ? null : globalThis.crypto;
    if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
      const buffer = new Uint32Array(1);
      cryptoApi.getRandomValues(buffer);
      entropy = buffer[0];
    } else {
      entropy = Math.floor(Math.random() * 0xffffffff) >>> 0;
    }
    return (time ^ entropy) >>> 0;
  }

  createRng(seed: number): RandomFn {
    return mulberry32(seed);
  }
}
