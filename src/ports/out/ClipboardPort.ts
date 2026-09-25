/**
 * 出站端口：剪贴板（导出对话框「复制 SVG 源码」）。
 */

export interface ClipboardPort {
  /** 写入剪贴板；成功返回 true（失败不抛错） */
  writeText(text: string): Promise<boolean>;
}
