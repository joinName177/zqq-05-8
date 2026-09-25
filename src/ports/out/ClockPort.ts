/**
 * 出站端口：时间。
 *
 * core 层禁止 `Date.now()` / `new Date()`，一切「现在」都从这里注入。
 */

export interface ClockPort {
  /** 本地日期 `YYYY-MM-DD` */
  todayIso(): string;
  /** 本地时间戳 `YYYY-MM-DDTHH:mm:ss` */
  nowIso(): string;
  /** 毫秒时间戳（用于随机种子等） */
  timestampMillis(): number;
}
