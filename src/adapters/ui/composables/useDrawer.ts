/**
 * 详情抽屉的开关状态（纯 UI 状态，与业务数据解耦）。
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue';

export interface DrawerApi {
  selectedPersonId: Ref<string | null>;
  isOpen: ComputedRef<boolean>;
  open(personId: string): void;
  close(): void;
  toggle(personId: string): void;
}

export function useDrawer(): DrawerApi {
  const selectedPersonId = ref<string | null>(null);
  const isOpen = computed(() => selectedPersonId.value !== null);

  function open(personId: string): void {
    selectedPersonId.value = personId;
  }

  function close(): void {
    selectedPersonId.value = null;
  }

  function toggle(personId: string): void {
    selectedPersonId.value = selectedPersonId.value === personId ? null : personId;
  }

  return { selectedPersonId, isOpen, open, close, toggle };
}
