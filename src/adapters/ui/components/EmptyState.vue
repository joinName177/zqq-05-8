<script setup lang="ts">
/**
 * 空态引导（三态之一：无数据 / 无筛选结果）。
 */

interface Props {
  icon?: string;
  title: string;
  description: string;
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  icon: '🕸️',
  compact: false
});
</script>

<template>
  <div class="empty-state" :class="{ 'empty-state--compact': props.compact }" role="status">
    <span class="empty-state__icon" aria-hidden="true">{{ props.icon }}</span>
    <p class="empty-state__title">{{ props.title }}</p>
    <p class="empty-state__desc">{{ props.description }}</p>
    <div v-if="$slots.action" class="empty-state__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--space-2);
  padding: var(--space-6) var(--space-4);
  color: var(--text-muted);
  min-height: 220px;
}

.empty-state--compact {
  min-height: 140px;
  padding: var(--space-4);
}

.empty-state__icon {
  font-size: 40px;
  line-height: 1;
  opacity: 0.9;
}

.empty-state__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}

.empty-state__desc {
  font-size: 12.5px;
  max-width: 42ch;
  line-height: 1.7;
}

.empty-state__action {
  margin-top: var(--space-2);
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  justify-content: center;
}
</style>
