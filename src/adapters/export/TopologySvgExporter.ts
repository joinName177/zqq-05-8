/**
 * F5：手写 SVG 字符串导出器（实现 `ports/out/GraphExporter`）。
 *
 * 产出内容：标题 + 生成时间 + 统计摘要 + 图例 + 节点（含核心圈层光晕、疏远预警脉冲环）+ 连线。
 * 不含任何第三方库，也不使用 DOM（纯字符串拼接），因此可在非浏览器环境复用。
 */

import {
  CORE_HALO_EXTRA,
  DORMANT_PULSE_EXTRA,
  EDGE_DASH_PATTERN,
  EXPORT_FOOTER_HEIGHT,
  EXPORT_HEADER_HEIGHT,
  EXPORT_PADDING,
  GRAPH_CORE_HALO_COLOR,
  GRAPH_LABEL_COLOR,
  SEVERITY_COLORS
} from '../../core/domain/topologyConfig';
import type { SvgExportInput, SvgLegendItem } from '../../core/domain/TopologyModels';
import { downloadTextFile } from './BrowserFileDownloader';

const FONT_STACK = "'Noto Sans SC','Plus Jakarta Sans','PingFang SC','Microsoft YaHei',sans-serif";
const MUTED = 'rgba(232,237,255,0.68)';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function renderLegendSwatch(item: SvgLegendItem, x: number, y: number): string {
  switch (item.shape) {
    case 'line':
      return `<line x1="${x}" y1="${y}" x2="${x + 26}" y2="${y}" stroke="${item.color}" stroke-width="4" stroke-linecap="round"/>`;
    case 'dashed':
      return `<line x1="${x}" y1="${y}" x2="${x + 26}" y2="${y}" stroke="${item.color}" stroke-width="2" stroke-dasharray="${EDGE_DASH_PATTERN}" stroke-linecap="round"/>`;
    case 'halo':
      return `<circle cx="${x + 13}" cy="${y}" r="9" fill="none" stroke="${GRAPH_CORE_HALO_COLOR}" stroke-width="2" opacity="0.75"/>`;
    case 'pulse':
      return `<circle cx="${x + 13}" cy="${y}" r="9" fill="none" stroke="${SEVERITY_COLORS.severe}" stroke-width="1.5" stroke-dasharray="4 4"/>`;
    case 'node':
    default:
      return `<circle cx="${x + 13}" cy="${y}" r="8" fill="${item.color}" stroke="rgba(255,255,255,0.85)" stroke-width="1"/>`;
  }
}

export class TopologySvgExporter {
  toSvg(input: SvgExportInput): string {
    const parts: string[] = [];
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}" viewBox="${input.viewBox}" role="img" aria-label="${escapeXml(input.title)}" font-family="${FONT_STACK}">`
    );
    parts.push(this.renderDefs());
    parts.push(
      `<rect x="0" y="0" width="${input.width}" height="${input.height}" fill="${input.background}"/>`
    );
    parts.push(this.renderHeader(input));
    parts.push('<g id="topology-edges">');
    for (const edge of input.edges) {
      const dash = edge.dashed ? ` stroke-dasharray="${EDGE_DASH_PATTERN}"` : '';
      parts.push(
        `<line x1="${edge.x1}" y1="${edge.y1}" x2="${edge.x2}" y2="${edge.y2}" stroke="${edge.color}" stroke-width="${edge.width}"${dash} stroke-linecap="round" opacity="0.9"/>`
      );
    }
    parts.push('</g>');
    parts.push('<g id="topology-nodes">');
    for (const node of input.nodes) {
      if (node.core) {
        parts.push(
          `<circle cx="${node.x}" cy="${node.y}" r="${round(node.r + CORE_HALO_EXTRA)}" fill="none" stroke="${GRAPH_CORE_HALO_COLOR}" stroke-width="2.5" opacity="0.7"/>`
        );
      }
      if (node.dormant) {
        parts.push(
          `<circle cx="${node.x}" cy="${node.y}" r="${round(node.r + DORMANT_PULSE_EXTRA)}" fill="none" stroke="${SEVERITY_COLORS.severe}" stroke-width="2" stroke-dasharray="5 5" opacity="0.95"/>`
        );
      }
      parts.push(
        `<circle cx="${node.x}" cy="${node.y}" r="${node.r}" fill="${node.fill}" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/>`
      );
      if (node.labelVisible) {
        parts.push(
          `<text x="${node.x}" y="${round(node.y - node.r - 8)}" text-anchor="middle" font-size="13" fill="${GRAPH_LABEL_COLOR}">${escapeXml(node.label)}</text>`
        );
      }
    }
    parts.push('</g>');
    parts.push(this.renderFooter(input));
    parts.push('</svg>');
    return parts.join('\n');
  }

  downloadSvg(svg: string, filename: string): void {
    downloadTextFile(svg, filename, 'image/svg+xml');
  }

  private renderDefs(): string {
    return [
      '<defs>',
      `<radialGradient id="graphGlow" cx="50%" cy="50%" r="50%">`,
      `<stop offset="0%" stop-color="${GRAPH_CORE_HALO_COLOR}" stop-opacity="0.22"/>`,
      `<stop offset="100%" stop-color="${GRAPH_CORE_HALO_COLOR}" stop-opacity="0"/>`,
      '</radialGradient>',
      '</defs>'
    ].join('');
  }

  private renderHeader(input: SvgExportInput): string {
    const centerX = input.width / 2;
    const centerY = input.height / 2;
    const glowRadius = Math.max(input.width, input.height) * 0.42;
    return [
      '<g id="topology-header">',
      `<circle cx="${centerX}" cy="${centerY}" r="${round(glowRadius)}" fill="url(#graphGlow)"/>`,
      `<text x="${EXPORT_PADDING}" y="52" font-size="28" font-weight="700" fill="${GRAPH_LABEL_COLOR}">${escapeXml(input.title)}</text>`,
      `<text x="${EXPORT_PADDING}" y="80" font-size="15" fill="${MUTED}">${escapeXml(input.subtitle)}</text>`,
      `<text x="${input.width - EXPORT_PADDING}" y="52" text-anchor="end" font-size="14" fill="${MUTED}">生成时间：${escapeXml(input.generatedAt)}</text>`,
      `<text x="${input.width - EXPORT_PADDING}" y="80" text-anchor="end" font-size="13" fill="${MUTED}">导出自 zqq-05 人际关系拓扑图</text>`,
      `<line x1="${EXPORT_PADDING}" y1="${EXPORT_HEADER_HEIGHT - 12}" x2="${input.width - EXPORT_PADDING}" y2="${EXPORT_HEADER_HEIGHT - 12}" stroke="rgba(124,140,255,0.35)" stroke-width="1"/>`,
      '</g>'
    ].join('');
  }

  private renderFooter(input: SvgExportInput): string {
    const top = input.height - EXPORT_FOOTER_HEIGHT;
    const legendWidth = input.width * 0.58;
    const statsX = EXPORT_PADDING + legendWidth + 32;
    const parts: string[] = ['<g id="topology-footer">'];
    parts.push(
      `<line x1="${EXPORT_PADDING}" y1="${top}" x2="${input.width - EXPORT_PADDING}" y2="${top}" stroke="rgba(124,140,255,0.35)" stroke-width="1"/>`
    );
    parts.push(
      `<text x="${EXPORT_PADDING}" y="${top + 28}" font-size="15" font-weight="600" fill="${GRAPH_LABEL_COLOR}">图例</text>`
    );

    input.legend.forEach((item, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = EXPORT_PADDING + column * (legendWidth / 2);
      const y = top + 54 + row * 26;
      parts.push(renderLegendSwatch(item, x, y));
      parts.push(
        `<text x="${x + 36}" y="${y + 5}" font-size="12.5" fill="${GRAPH_LABEL_COLOR}">${escapeXml(item.label)}</text>`
      );
    });

    parts.push(
      `<text x="${statsX}" y="${top + 28}" font-size="15" font-weight="600" fill="${GRAPH_LABEL_COLOR}">统计摘要</text>`
    );
    input.stats.forEach((line, index) => {
      parts.push(
        `<text x="${statsX}" y="${top + 54 + index * 22}" font-size="12.5" fill="${MUTED}">${escapeXml(line)}</text>`
      );
    });

    parts.push('</g>');
    return parts.join('');
  }
}
