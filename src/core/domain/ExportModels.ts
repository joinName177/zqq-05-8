/**
 * 导出（SVG / JSON 备份）与示例数据 领域模型。
 *
 * 从 `TopologyModels.ts` 拆出：这部分只描述「数据如何离开应用 / 进入应用」。
 * 由 `TopologyModels.ts` 统一再导出。
 */

import type { Person } from './PersonModels';
import type { Interaction } from './InteractionModels';
import type { AppSettings } from './TopologyModels';

/* ------------------------------------------------------------------ */
/* SVG / JSON 导出                                                     */
/* ------------------------------------------------------------------ */

export type SvgLegendShape = 'node' | 'line' | 'dashed' | 'halo' | 'pulse';

export interface SvgLegendItem {
  label: string;
  color: string;
  shape: SvgLegendShape;
  note: string;
}

export interface SvgExportNode {
  id: string;
  x: number;
  y: number;
  r: number;
  fill: string;
  label: string;
  core: boolean;
  dormant: boolean;
  labelVisible: boolean;
}

export interface SvgExportEdge {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  color: string;
  dashed: boolean;
}

export interface SvgExportInput {
  width: number;
  height: number;
  viewBox: string;
  title: string;
  subtitle: string;
  generatedAt: string;
  nodes: SvgExportNode[];
  edges: SvgExportEdge[];
  legend: SvgLegendItem[];
  stats: string[];
  background: string;
}

export interface BackupPayload {
  version: number;
  app: string;
  exportedAt: string;
  persons: Person[];
  interactions: Interaction[];
  settings: Partial<AppSettings>;
}

export interface BackupParseResult {
  ok: boolean;
  errors: string[];
  payload: BackupPayload | null;
}

export type ImportMode = 'merge' | 'overwrite';

export interface ImportOutcome {
  ok: boolean;
  mode: ImportMode;
  importedPersons: number;
  importedInteractions: number;
  skipped: number;
  errors: string[];
}


/* ------------------------------------------------------------------ */
/* 示例数据                                                            */
/* ------------------------------------------------------------------ */

export interface DemoDataset {
  persons: Person[];
  interactions: Interaction[];
}
