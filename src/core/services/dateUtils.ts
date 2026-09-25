/**
 * 纯函数日期工具（core 层，禁止 `new Date()` / `Date.now()`）。
 *
 * 采用 Howard Hinnant 的 civil-from-days / days-from-civil 算法自行完成历法换算，
 * 因此结果与宿主机时区完全无关，天然可测试、可复现。
 * 非法输入一律返回安全值（0 / 原字符串），保证 UI 永不出现 NaN / Invalid Date。
 */

import { WEEKDAY_LABELS_ZH } from '../domain/topologyConfig';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

/** 闰年判定 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** 指定年月的天数 */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
  return 31;
}

/** 解析 YYYY-MM-DD；非法（含 2024-02-31 这类越界）返回 null */
export function parseIsoDate(value: string): CivilDate | null {
  if (typeof value !== 'string') return null;
  const match = ISO_DATE_PATTERN.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isValidIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null;
}

/** 公历 → 以 1970-01-01 为 0 的连续天数 */
export function toDayNumber(date: CivilDate): number {
  const y = date.year - (date.month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const monthShift = date.month + (date.month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * monthShift + 2) / 5) + date.day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

/** 连续天数 → 公历 */
export function fromDayNumber(dayNumber: number): CivilDate {
  const shifted = dayNumber + 719468;
  const era = Math.floor(shifted / 146097);
  const dayOfEra = shifted - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365
  );
  const year = yearOfEra + era * 400;
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthPrime = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthPrime + 2) / 5) + 1;
  const month = monthPrime + (monthPrime < 10 ? 3 : -9);
  return { year: year + (month <= 2 ? 1 : 0), month, day };
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

export function formatIsoDate(date: CivilDate): string {
  return `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}

/** ISO → 连续天数；非法返回 null */
export function isoToDayNumber(iso: string): number | null {
  const parsed = parseIsoDate(iso);
  return parsed ? toDayNumber(parsed) : null;
}

/** 连续天数 → ISO */
export function dayNumberToIso(dayNumber: number): string {
  return formatIsoDate(fromDayNumber(dayNumber));
}

/** `to − from` 的天数差（结果可为负）；任一非法则返回 0（避免 NaN 传染 UI） */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = isoToDayNumber(fromIso);
  const to = isoToDayNumber(toIso);
  if (from === null || to === null) return 0;
  return to - from;
}

/** 日期加减天数；非法输入原样返回 */
export function addDays(iso: string, days: number): string {
  const dayNumber = isoToDayNumber(iso);
  if (dayNumber === null) return iso;
  return dayNumberToIso(dayNumber + days);
}

/** 字典序即为时间序，返回 -1 / 0 / 1 */
export function compareIsoDate(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** 取较晚的日期（非法值被忽略） */
export function maxIsoDate(a: string, b: string): string {
  const aOk = isValidIsoDate(a);
  const bOk = isValidIsoDate(b);
  if (!aOk) return bOk ? b : a;
  if (!bOk) return a;
  return a >= b ? a : b;
}

/** 取较早的日期（非法值被忽略） */
export function minIsoDate(a: string, b: string): string {
  const aOk = isValidIsoDate(a);
  const bOk = isValidIsoDate(b);
  if (!aOk) return bOk ? b : a;
  if (!bOk) return a;
  return a <= b ? a : b;
}

/** 0 = 周日 … 6 = 周六；非法返回 0 */
export function weekdayIndex(iso: string): number {
  const dayNumber = isoToDayNumber(iso);
  if (dayNumber === null) return 0;
  // 1970-01-01 是周四（索引 4）
  return (((dayNumber + 4) % 7) + 7) % 7;
}

export function weekdayLabelZh(iso: string): string {
  const index = weekdayIndex(iso);
  return WEEKDAY_LABELS_ZH[index] ?? '';
}

/** `2025-03-08 周六` */
export function formatDisplayDate(iso: string): string {
  if (!isValidIsoDate(iso)) return iso;
  return `${iso} ${weekdayLabelZh(iso)}`;
}

/** 按月分组键 `YYYY-MM` */
export function monthKey(iso: string): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return '未知';
  return `${pad(parsed.year, 4)}-${pad(parsed.month, 2)}`;
}

/** `2025-03` → `2025 年 3 月` */
export function formatMonthZh(key: string): string {
  const [year, month] = key.split('-');
  if (!year || !month) return key;
  return `${Number(year)} 年 ${Number(month)} 月`;
}

/** 是否晚于今天（严格大于） */
export function isFutureDate(iso: string, todayIso: string): boolean {
  if (!isValidIsoDate(iso)) return false;
  return compareIsoDate(iso, todayIso) > 0;
}

/** 把未来日期夹回今天 */
export function clampToToday(iso: string, todayIso: string): string {
  return isFutureDate(iso, todayIso) ? todayIso : iso;
}

/** 距今相对天数文案：今天 / 昨天 / N 天前 / N 天后 */
export function relativeDaysLabel(days: number): string {
  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  return `${days} 天前`;
}

/** 距下次建议联系的天数文案 */
export function futureDaysLabel(days: number): string {
  if (days <= 0) return '今天';
  if (days === 1) return '明天';
  return `${days} 天后`;
}

/** `2025-03-08T14:05:00` → `2025-03-08 周六 14:05` */
export function formatTimestampZh(timestamp: string): string {
  if (typeof timestamp !== 'string') return '';
  const match = ISO_DATE_TIME_PATTERN.exec(timestamp.trim());
  const datePart = match ? match[1] : timestamp.trim();
  if (!isValidIsoDate(datePart)) return timestamp;
  const base = formatDisplayDate(datePart);
  if (!match) return base;
  return `${base} ${match[2]}:${match[3]}`;
}

/** 生成 `YYYY-MM-DDTHH:mm:ss`（时间部分由适配器提供，core 只负责拼接） */
export function composeTimestamp(iso: string, time: string): string {
  const trimmed = typeof time === 'string' ? time.slice(0, 8) : '';
  const safeTime = /^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)
    ? trimmed.length === 5
      ? `${trimmed}:00`
      : trimmed
    : '00:00:00';
  return `${iso}T${safeTime}`;
}
