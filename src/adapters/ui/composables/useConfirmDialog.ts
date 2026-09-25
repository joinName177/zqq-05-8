/**
 * 二次确认对话框的状态机（App Shell 层复用：删除 / 清空 / 重置 / 覆盖导入）。
 */

import { ref, type Ref } from 'vue';

export interface ConfirmOptions {
  title: string;
  message: string;
  detail?: string;
  confirmText?: string;
  tone?: 'danger' | 'primary';
  action: () => void;
}

export interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  detail: string;
  confirmText: string;
  tone: 'danger' | 'primary';
  action: () => void;
}

export interface ConfirmDialogApi {
  state: Ref<ConfirmState>;
  ask(options: ConfirmOptions): void;
  resolve(): void;
  cancel(): void;
}

export function useConfirmDialog(): ConfirmDialogApi {
  const state = ref<ConfirmState>({
    open: false,
    title: '',
    message: '',
    detail: '',
    confirmText: '确认',
    tone: 'danger',
    action: () => undefined
  });

  function ask(options: ConfirmOptions): void {
    state.value = {
      open: true,
      title: options.title,
      message: options.message,
      detail: options.detail ?? '',
      confirmText: options.confirmText ?? '确认',
      tone: options.tone ?? 'danger',
      action: options.action
    };
  }

  function resolve(): void {
    const { action } = state.value;
    state.value = { ...state.value, open: false };
    action();
  }

  function cancel(): void {
    state.value = { ...state.value, open: false };
  }

  return { state, ask, resolve, cancel };
}
