/**
 * F5：拓扑图导出数据构建（纯函数）。
 *
 * 从 `topologyBuilder.ts` 拆出：只负责「把当前布局坐标与拓扑数据映射成导出画布」，
 * 字符串序列化交给 `adapters/export/TopologySvgExporter.ts`。
 */

import {
  EXPORT_CANVAS_HEIGHT,
  EXPORT_CANVAS_WIDTH,
  EXPORT_FOOTER_HEIGHT,
  EXPORT_HEADER_HEIGHT,
  EXPORT_PADDING,
  GRAPH_BACKGROUND,
  LABEL_ZOOM_THRESHOLD
} from '../domain/topologyConfig';
import type {
  InsightResult,
  LayoutState,
  SvgExportInput,
  SvgExportNode,
  SvgLegendItem,
  TopologyData,
  TopologyViewState
} from '../domain/TopologyModels';
import { relationLegend } from './distributionStats';
import { formatDecimal, formatInteger, formatPercent, truncate } from './formatters';
import { selectVisibleLabels } from './labelPlanner';

/** 导出用统计摘要文案 */
export function buildExportSummaryLines(insights: InsightResult, distributionCount: number): string[] {
  const stats = insights.stats;
  return [
    `总人数 ${formatInteger(stats.totalPersons)}`,
    `核心圈层 ${formatInteger(stats.coreCount)} 人（占比 ${formatPercent(stats.coreRatio)}）`,
    `疏远预警 ${formatInteger(stats.dormantCount)} 人（提醒 ${stats.dormantByLevel.notice} / 警告 ${stats.dormantByLevel.warning} / 严重 ${stats.dormantByLevel.severe}）`,
    `近 30 天互动 ${formatInteger(stats.interactions30d)} 次`,
    `平均亲密度 ${formatDecimal(stats.avgIntimacy, 2)}/10`,
    stats.longestIdle
      ? `最久未联系：${stats.longestIdle.name}（${formatInteger(stats.longestIdle.days)} 天）`
      : '最久未联系：暂无数据',
    `关系类型分布 ${formatInteger(distributionCount)} 类`
  ];
}

/** 导出用图例 */
export function buildExportLegend(topology: TopologyData, relationLegend: readonly SvgLegendItem[]): SvgLegendItem[] {
  const maxEdge = topology.edges[0];
  return [
    { label: '节点大小 = 亲密度（r = 6 + 亲密度 × 2.2）', color: '#7c8cff', shape: 'node', note: '越大人际关系越亲密' },
    {
      label: '连线粗细 = 近 90 天联系频率（0.8–8px 对数映射）',
      color: maxEdge ? maxEdge.color : '#2ee6c5',
      shape: 'line',
      note: '越粗联系越频繁'
    },
    { label: '虚线连线 = 预测将疏远（≥ 60 天未联系）', color: '#8f9bb3', shape: 'dashed', note: '需要提前维护' },
    { label: '光晕环 = 核心圈层（亲密度 ≥ 8）', color: '#8b7cff', shape: 'halo', note: '重点维护对象' },
    { label: '脉冲虚线环 = 疏远预警（> 90 天未联系）', color: '#ef4d5a', shape: 'pulse', note: '建议本周内联系' },
    ...relationLegend
  ];
}

export interface SvgExportOptions {
  title: string;
  subtitle: string;
  generatedAt: string;
  legend: SvgLegendItem[];
  stats: string[];
  background?: string;
}

/**
 * F5：把当前布局坐标映射到导出画布（等比缩放 + 居中），供 SVG 导出器直接序列化。
 */
export function buildSvgExportInput(
  topology: TopologyData,
  layout: LayoutState,
  options: SvgExportOptions
): SvgExportInput {
  const layoutById = new Map(layout.nodes.map((node) => [node.id, node] as const));

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const node of layout.nodes) {
    minX = Math.min(minX, node.x - node.radius);
    minY = Math.min(minY, node.y - node.radius);
    maxX = Math.max(maxX, node.x + node.radius);
    maxY = Math.max(maxY, node.y + node.radius);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    minX = 0;
    minY = 0;
    maxX = 1;
    maxY = 1;
  }

  const availableWidth = EXPORT_CANVAS_WIDTH - EXPORT_PADDING * 2;
  const availableHeight = EXPORT_CANVAS_HEIGHT - EXPORT_HEADER_HEIGHT - EXPORT_FOOTER_HEIGHT;
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.min(availableWidth / spanX, availableHeight / spanY, 1.8);
  const offsetX = EXPORT_PADDING + (availableWidth - spanX * scale) / 2 - minX * scale;
  const offsetY = EXPORT_HEADER_HEIGHT + (availableHeight - spanY * scale) / 2 - minY * scale;
  const mapX = (x: number): number => Math.round((x * scale + offsetX) * 100) / 100;
  const mapY = (y: number): number => Math.round((y * scale + offsetY) * 100) / 100;

  const exportNodes: SvgExportNode[] = [];
  for (const node of topology.nodes) {
    const positioned = layoutById.get(node.person.id);
    if (!positioned) continue;
    exportNodes.push({
      id: node.person.id,
      // BUG-05-09: exported nodes use an unscaled coordinate origin.
      x: Math.round((positioned.x + offsetX) * 100) / 100,
      y: Math.round((positioned.y + offsetY) * 100) / 100,
      r: Math.max(4, Math.round(node.radius * scale * 10) / 10),
      fill: node.color,
      label: truncate(node.person.name, 10),
      core: node.isCore,
      dormant: node.isDormant,
      labelVisible: false
    });
  }

  const exportEdges = topology.edges
    .map((edge) => {
      const source = layoutById.get(edge.source);
      const target = layoutById.get(edge.target);
      if (!source || !target) return null;
      return {
        id: edge.id,
        x1: mapX(source.x),
        y1: mapY(source.y),
        x2: mapX(target.x),
        y2: mapY(target.y),
        width: Math.max(1, Math.round(edge.width * 10) / 10),
        color: edge.color,
        dashed: edge.predictedDormant
      };
    })
    .filter((edge): edge is NonNullable<typeof edge> => edge !== null);

  const visibleIds = new Set(
    selectVisibleLabels(
      exportNodes.map((node) => ({
        id: node.id,
        name: node.label,
        x: node.x,
        y: node.y,
        radius: node.r,
        weight: node.r,
        pinned: node.core || node.dormant
      })),
      LABEL_ZOOM_THRESHOLD + 1
    )
  );
  for (const node of exportNodes) node.labelVisible = visibleIds.has(node.id);

  return {
    width: EXPORT_CANVAS_WIDTH,
    height: EXPORT_CANVAS_HEIGHT,
    viewBox: `0 0 ${EXPORT_CANVAS_WIDTH} ${EXPORT_CANVAS_HEIGHT}`,
    title: options.title,
    subtitle: options.subtitle,
    generatedAt: options.generatedAt,
    nodes: exportNodes,
    edges: exportEdges,
    legend: options.legend,
    stats: options.stats,
    background: options.background ?? GRAPH_BACKGROUND
  };
}

export interface ExportInputOptions {
  title: string;
  /** 已格式化的生成时间文案 */
  generatedAt: string;
  /** 画布底色（随主题切换） */
  background: string;
}

/**
 * 由「视图状态 + 当前布局」直接构建导出输入（用例只需调用这一个函数）。
 */
export function buildExportInputFromState(
  state: TopologyViewState,
  layout: LayoutState,
  options: ExportInputOptions
): SvgExportInput {
  const stats = state.insights.stats;
  const relationItems: SvgLegendItem[] = relationLegend().map((item) => ({
    label: `${item.label}（${item.id}）`,
    color: item.color,
    shape: 'node',
    note: `节点颜色 = ${item.label}`
  }));

  return buildSvgExportInput(state.topology, layout, {
    title: options.title,
    subtitle: `共 ${state.persons.length} 人 · 核心圈层 ${stats.coreCount} 人 · 疏远预警 ${stats.dormantCount} 人`,
    generatedAt: options.generatedAt,
    legend: buildExportLegend(state.topology, relationItems),
    stats: buildExportSummaryLines(state.insights, state.distribution.filter((item) => item.count > 0).length),
    background: options.background
  });
}
