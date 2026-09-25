/**
 * 浏览器文件下载（Blob + <a download>）。
 */

export function downloadTextFile(content: string, filename: string, mimeType: string): void {
  try {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // 下载失败不阻断业务（例如无痕模式限制），由 UI 提供「复制源码」作为兜底
  }
}
