/**
 * 出站端口：JSON 备份导出 / 导入（F5）。
 */

import type { Person } from '../../core/domain/PersonModels';
import type { Interaction } from '../../core/domain/InteractionModels';
import type { AppSettings, BackupParseResult } from '../../core/domain/TopologyModels';

export interface BackupSource {
  persons: readonly Person[];
  interactions: readonly Interaction[];
  settings: AppSettings;
}

export interface BackupGateway {
  /** 序列化为带版本号的 JSON 文本 */
  serialize(source: BackupSource, exportedAt: string): string;
  /** 解析 + 格式校验 + 缺字段兜底；失败时返回 errors 而不抛错 */
  parse(raw: string): BackupParseResult;
  /** 触发浏览器下载 */
  download(json: string, filename: string): void;
}
