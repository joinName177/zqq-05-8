<script setup lang="ts">
/**
 * 通用二次确认对话框（删除人物 / 清空 / 重置 / 覆盖导入）。
 */

interface Props {
  open: boolean;
  title: string;
  message: string;
  detail?: string;
  confirmText?: string;
  tone?: 'danger' | 'primary';
}

const props = withDefaults(defineProps<Props>(), {
  detail: '',
  confirmText: '确认',
  tone: 'danger'
});

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <div
    v-if="props.open"
    class="overlay"
    role="dialog"
    aria-modal="true"
    :aria-label="props.title"
    @click.self="emit('cancel')"
  >
    <div class="dialog confirm-dialog">
      <div class="dialog__header">
        <h2 class="dialog__title">{{ props.title }}</h2>
      </div>
      <div class="dialog__body">
        <p class="confirm-dialog__message">{{ props.message }}</p>
        <p v-if="props.detail" class="confirm-dialog__detail">{{ props.detail }}</p>
      </div>
      <div class="dialog__footer">
        <button type="button" class="btn" @click="emit('cancel')">取消</button>
        <button
          type="button"
          class="btn"
          :class="props.tone === 'danger' ? 'btn--danger' : 'btn--primary'"
          @click="emit('confirm')"
        >
          {{ props.confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-dialog {
  width: min(440px, 100%);
}

.confirm-dialog__message {
  font-size: 14px;
  line-height: 1.7;
}

.confirm-dialog__detail {
  margin-top: var(--space-3);
  font-size: 12.5px;
  color: var(--text-muted);
  line-height: 1.7;
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--surface-soft);
  border: 1px solid var(--border);
}
</style>
