/**
 * 轻量提示状态（Toast）：成功 / 信息 / 错误三态，超时自动消失，可手动关闭。
 */

import { onBeforeUnmount, ref, type Ref } from 'vue';

export type NoticeTone = 'success' | 'info' | 'error';

export interface NoticeMessage {
  id: number;
  tone: NoticeTone;
  text: string;
}

export interface NoticesApi {
  notices: Ref<NoticeMessage[]>;
  notify(text: string, tone?: NoticeTone): void;
  dismissNotice(id: number): void;
}

const AUTO_DISMISS_MS = 3600;

export function useNotices(): NoticesApi {
  const notices = ref<NoticeMessage[]>([]);
  let sequence = 0;
  let timer = 0;

  function notify(text: string, tone: NoticeTone = 'info'): void {
    sequence += 1;
    notices.value = [...notices.value, { id: sequence, tone, text }];
    if (timer !== 0) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      notices.value = notices.value.slice(1);
      timer = 0;
    }, AUTO_DISMISS_MS);
  }

  function dismissNotice(id: number): void {
    notices.value = notices.value.filter((notice) => notice.id !== id);
  }

  onBeforeUnmount(() => {
    if (timer !== 0) window.clearTimeout(timer);
  });

  return { notices, notify, dismissNotice };
}
