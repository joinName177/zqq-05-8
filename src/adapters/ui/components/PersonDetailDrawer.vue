<script setup lang="ts">
/**
 * F4：人物详情抽屉。容器展示组件：身份头部 + 概览 + 新增互动 + 互动时间轴 + 维护建议清单。
 * 窄屏（< 768px）由样式改为全屏面板；Esc 关闭。
 */

import { computed, onBeforeUnmount, onMounted } from 'vue';
import type { Person } from '../../../core/domain/PersonModels';
import type { InteractionDraft } from '../../../core/domain/InteractionModels';
import type { AdviceViewItem, FrequencyInfo, TimelineMonth } from '../../../core/domain/TopologyModels';
import { CORE_INTIMACY_THRESHOLD, DORMANCY_THRESHOLD_DAYS, DEFAULT_FEELING } from '../../../core/domain/topologyConfig';
import { getRelationType } from '../../../core/data/relationTypes';
import InteractionForm from './InteractionForm.vue';
import InteractionTimeline from './InteractionTimeline.vue';
import MaintenanceAdviceList from './MaintenanceAdviceList.vue';
import PersonOverview from './PersonOverview.vue';

interface Props {
  open: boolean;
  person: Person | null;
  frequency: FrequencyInfo | null;
  months: TimelineMonth[];
  advice: AdviceViewItem[];
  today: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  edit: [personId: string];
  intimacy: [personId: string, value: number];
  addInteraction: [personId: string, draft: InteractionDraft];
  removeInteraction: [interactionId: string];
  toggleAdvice: [adviceId: string];
}>();

const relationMeta = computed(() => (props.person ? getRelationType(props.person.relationType) : null));
const isCore = computed(() => (props.person ? props.person.intimacy >= CORE_INTIMACY_THRESHOLD : false));
const isDormant = computed(() =>
  props.frequency ? props.frequency.daysSinceLastContact > DORMANCY_THRESHOLD_DAYS : false
);

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.open) emit('close');
}

onMounted(() => {
  if (typeof window !== 'undefined') window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <aside
    class="drawer"
    :class="{ 'drawer--open': props.open }"
    :aria-hidden="!props.open"
    :aria-label="props.person ? `${props.person.name} 的详情` : '人物详情'"
    role="complementary"
  >
    <template v-if="props.person && relationMeta">
      <header class="drawer__header">
        <div class="drawer__identity">
          <span class="drawer__avatar" :style="{ borderColor: relationMeta.color }" aria-hidden="true">
            {{ relationMeta.icon }}
          </span>
          <div class="drawer__title-block">
            <h2 class="drawer__name">{{ props.person.name }}</h2>
            <p class="drawer__badges">
              <span class="badge" :style="{ color: relationMeta.color, borderColor: relationMeta.color }">
                {{ relationMeta.label }}
              </span>
              <span v-if="isCore" class="badge badge--core">核心圈层</span>
              <span v-if="isDormant" class="badge badge--alert">疏远预警</span>
            </p>
          </div>
        </div>
        <div class="drawer__header-actions">
          <button
            type="button"
            class="btn btn--sm"
            :aria-label="`编辑 ${props.person.name}`"
            @click="emit('edit', props.person.id)"
          >
            ✎ 编辑
          </button>
          <button type="button" class="btn btn--sm btn--ghost" aria-label="关闭详情面板" @click="emit('close')">
            ✕
          </button>
        </div>
      </header>

      <div class="drawer__body scroll-y">
        <PersonOverview
          :person="props.person"
          :frequency="props.frequency"
          @intimacy="(id, value) => emit('intimacy', id, value)"
        />

        <InteractionForm
          :today="props.today"
          :default-feeling="DEFAULT_FEELING"
          @submit="(draft) => emit('addInteraction', props.person?.id ?? '', draft)"
        />

        <section class="drawer__section">
          <h3 class="drawer__section-title">互动时间轴（按月分组）</h3>
          <InteractionTimeline
            :months="props.months"
            :person-name="props.person.name"
            @remove="(id) => emit('removeInteraction', id)"
          />
        </section>

        <section class="drawer__section">
          <MaintenanceAdviceList :items="props.advice" @toggle="(id) => emit('toggleAdvice', id)" />
        </section>
      </div>
    </template>

    <div v-else class="drawer__placeholder">
      <p class="faint">从拓扑图或列表中选择一个人物，查看互动时间轴与维护建议。</p>
    </div>
  </aside>
</template>

<style scoped>
.drawer {
  position: fixed;
  top: var(--header-height);
  right: 0;
  bottom: 0;
  width: var(--drawer-width);
  max-width: 100vw;
  z-index: var(--z-drawer);
  display: none;
}

.drawer--open {
  display: flex;
  flex-direction: column;
  background: var(--surface-strong);
  border-left: 1px solid var(--border-strong);
  box-shadow: var(--shadow-lg);
  min-height: 0;
  animation: zqq-slide-in var(--transition) both;
}

.drawer__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4);
  border-bottom: 1px solid var(--border);
}

.drawer__identity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.drawer__avatar {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 2px solid var(--accent);
  background: var(--surface-soft);
  font-size: 19px;
  flex: 0 0 auto;
}

.drawer__title-block {
  min-width: 0;
}

.drawer__name {
  font-size: 17px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.drawer__badges {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  margin-top: 3px;
}

.badge--core {
  color: #8b7cff;
  border-color: rgba(139, 124, 255, 0.55);
  background: rgba(139, 124, 255, 0.12);
}

.badge--alert {
  color: var(--danger);
  border-color: rgba(255, 107, 129, 0.55);
  background: rgba(255, 107, 129, 0.12);
}

.drawer__header-actions {
  display: flex;
  gap: 4px;
  flex: 0 0 auto;
}

.drawer__body {
  flex: 1;
  min-height: 0;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.drawer__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.drawer__section-title {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.drawer__placeholder {
  padding: var(--space-5);
  display: grid;
  place-items: center;
  flex: 1;
  text-align: center;
  font-size: 12.5px;
}

@media (max-width: 1199px) {
  .drawer {
    max-width: 92vw;
  }
}

@media (max-width: 767px) {
  /* 窄屏：抽屉改为全屏面板，避免横向滚动 */
  .drawer {
    top: 0;
    width: 100vw;
    max-width: none;
  }

  .drawer--open {
    border-left: 0;
  }
}
</style>
