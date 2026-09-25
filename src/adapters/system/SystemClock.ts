/**
 * 出站端口 ClockPort 的系统实现。
 *
 * 只有适配器层可以触碰 `new Date()` / `Date.now()`。
 */

import type { ClockPort } from '../../ports/out/ClockPort';

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

export class SystemClock implements ClockPort {
  todayIso(): string {
    const now = new Date();
    return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  nowIso(): string {
    const now = new Date();
    return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
      now.getHours()
    )}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  timestampMillis(): number {
    return Date.now();
  }
}
