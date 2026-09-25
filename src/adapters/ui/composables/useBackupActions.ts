/**
 * F5：导出 / 备份 / 导入的意图封装。
 *
 * 组合根仍唯一（适配器只在 `useTopology.ts` 里构造）——本文件只是把「导出相关的意图」
 * 从组合根里拆出来，接收已注入完成的用例与少量回调。
 */

import type { ImportMode, ImportOutcome, LayoutState } from '../../../core/domain/TopologyModels';
import type { RelationshipTopologyUseCase } from '../../../ports/in/RelationshipTopologyUseCase';
import type { NoticeTone } from './useNotices';

export interface BackupActionHooks {
  /** 取当前力导向布局（用于 SVG 导出复用坐标） */
  getLayout(): LayoutState | null;
  notify(text: string, tone?: NoticeTone): void;
  /** 导入完成后重新加热布局 */
  onImported(): void;
}

export interface BackupActionsApi {
  exportBackupJson(): string;
  downloadBackup(): void;
  importBackup(raw: string, mode: ImportMode): ImportOutcome;
  buildSvgText(): string;
  downloadSvg(): void;
  copySvgText(): Promise<boolean>;
}

export function useBackupActions(
  useCase: RelationshipTopologyUseCase,
  hooks: BackupActionHooks
): BackupActionsApi {
  function exportBackupJson(): string {
    return useCase.exportBackupJson();
  }

  function downloadBackup(): void {
    useCase.downloadBackup();
    hooks.notify('JSON 备份已导出', 'success');
  }

  function importBackup(raw: string, mode: ImportMode): ImportOutcome {
    const outcome = useCase.importBackup(raw, mode);
    if (!outcome.ok) {
      hooks.notify(outcome.errors[0] ?? '导入失败', 'error');
      return outcome;
    }
    hooks.onImported();
    hooks.notify(
      `导入完成：人物 ${outcome.importedPersons} 条、互动 ${outcome.importedInteractions} 条${
        outcome.skipped > 0 ? `，跳过 ${outcome.skipped} 条重复/无效记录` : ''
      }`,
      'success'
    );
    return outcome;
  }

  function buildSvgText(): string {
    const layout = hooks.getLayout();
    return layout ? useCase.buildSvgText(layout) : '';
  }

  function downloadSvg(): void {
    const layout = hooks.getLayout();
    if (!layout) {
      hooks.notify('布局尚未就绪，请稍后重试', 'error');
      return;
    }
    useCase.downloadSvg(layout);
    hooks.notify('拓扑图 SVG 已导出', 'success');
  }

  async function copySvgText(): Promise<boolean> {
    const text = buildSvgText();
    if (text.length === 0) {
      hooks.notify('布局尚未就绪，请稍后重试', 'error');
      return false;
    }
    const ok = await useCase.copyText(text);
    hooks.notify(ok ? 'SVG 源码已复制到剪贴板' : '复制失败，请手动选择文本复制', ok ? 'success' : 'error');
    return ok;
  }

  return { exportBackupJson, downloadBackup, importBackup, buildSvgText, downloadSvg, copySvgText };
}
