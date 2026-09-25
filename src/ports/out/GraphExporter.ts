/**
 * 出站端口：拓扑图 SVG 导出（F5）。
 *
 * core 只负责把布局坐标映射成 `SvgExportInput`，字符串序列化交给适配器。
 */

import type { SvgExportInput } from '../../core/domain/TopologyModels';

export interface GraphExporter {
  /** 手写 SVG 字符串（含标题、生成时间、图例、统计摘要、节点与连线） */
  toSvg(input: SvgExportInput): string;
  /** 触发浏览器下载 */
  downloadSvg(svg: string, filename: string): void;
}
