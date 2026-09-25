/**
 * 出站端口 ClipboardPort 的浏览器实现（带 execCommand 兜底）。
 */

import type { ClipboardPort } from '../../ports/out/ClipboardPort';

export class BrowserClipboard implements ClipboardPort {
  async writeText(text: string): Promise<boolean> {
    try {
      const clipboard = navigator.clipboard;
      if (clipboard && typeof clipboard.writeText === 'function') {
        await clipboard.writeText(text);
        return true;
      }
    } catch {
      // 降级到 execCommand
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', 'readonly');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}
