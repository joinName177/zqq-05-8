<script setup lang="ts">
/**
 * 轻量提示堆栈（成功 / 信息 / 错误三态，自动消失，可手动关闭）。
 */

import type { NoticeMessage } from '../composables/useTopology';

interface Props {
  notices: NoticeMessage[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  dismiss: [noticeId: number];
}>();
</script>

<template>
  <div class="toasts" role="status" aria-live="polite">
    <div v-for="notice in props.notices" :key="notice.id" class="toast" :class="`toast--${notice.tone}`">
      <span class="toast__icon" aria-hidden="true">
        {{ notice.tone === 'success' ? '✓' : notice.tone === 'error' ? '⚠' : 'ⓘ' }}
      </span>
      <span>{{ notice.text }}</span>
      <button type="button" class="toast__close" aria-label="关闭提示" @click="emit('dismiss', notice.id)">
        ✕
      </button>
    </div>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  right: var(--space-5);
  bottom: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  z-index: var(--z-toast);
  max-width: min(360px, 90vw);
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-strong);
  background: var(--surface-strong);
  box-shadow: var(--shadow-lg);
  font-size: 12.5px;
  animation: zqq-fade-in var(--transition) both;
}

.toast__icon {
  font-weight: 700;
}

.toast--success {
  border-color: rgba(61, 220, 151, 0.5);
}

.toast--success .toast__icon {
  color: var(--success);
}

.toast--error {
  border-color: rgba(255, 107, 129, 0.55);
  color: var(--danger);
}

.toast__close {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.6;
  font-size: 11px;
  margin-left: auto;
}

.toast__close:hover {
  opacity: 1;
}

@media (max-width: 767px) {
  .toasts {
    right: var(--space-3);
    left: var(--space-3);
    bottom: var(--space-3);
    max-width: none;
  }
}
</style>
