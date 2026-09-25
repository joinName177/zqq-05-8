<script setup lang="ts">
/**
 * F4：人物详情概览区（关键指标 / 亲密度即时调整 / 话题标签 / 备注联系方式）。
 * 纯展示组件：亲密度变更通过 emit 交给容器写入用例。
 */

import { computed } from 'vue';
import type { Person } from '../../../core/domain/PersonModels';
import type { FrequencyInfo } from '../../../core/domain/TopologyModels';
import {
  CORE_INTIMACY_THRESHOLD,
  MAX_INTIMACY,
  MIN_INTIMACY,
  RECENT_WINDOW_DAYS,
  DORMANCY_THRESHOLD_DAYS
} from '../../../core/domain/topologyConfig';
import { formatDecimal, formatInteger, formatIntimacyLabel, safeText } from '../../../core/services/formatters';
import { relativeDaysLabel } from '../../../core/services/dateUtils';

interface Props {
  person: Person;
  frequency: FrequencyInfo | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  intimacy: [personId: string, value: number];
}>();

const isCore = computed(() => props.person.intimacy >= CORE_INTIMACY_THRESHOLD);
const isDormant = computed(() =>
  props.frequency ? props.frequency.daysSinceLastContact > DORMANCY_THRESHOLD_DAYS : false
);
const sourceLabel = computed(() =>
  props.frequency?.lastContactSource === 'interaction' ? '由最新互动推导' : '取自录入值（暂无互动记录）'
);

function onIntimacyInput(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  if (!Number.isFinite(value)) return;
  emit('intimacy', props.person.id, value);
}
</script>

<template>
  <div class="overview">
    <section class="overview__section">
      <h3 class="overview__section-title">关键指标</h3>
      <dl class="stats">
        <div class="stats__item">
          <dt>最近联系</dt>
          <dd>
            {{ props.frequency ? props.frequency.lastContactIso : '—' }}
            <span class="faint">
              （{{ props.frequency ? relativeDaysLabel(props.frequency.daysSinceLastContact) : '—' }}）
            </span>
          </dd>
          <p class="stats__hint" :class="{ 'stats__hint--warn': props.frequency?.lastContactSource === 'record' }">
            {{ sourceLabel }}
          </p>
        </div>
        <div class="stats__item">
          <dt>近 {{ RECENT_WINDOW_DAYS }} 天互动</dt>
          <dd>{{ props.frequency ? formatInteger(props.frequency.count30) : 0 }} 次</dd>
          <p class="stats__hint">
            近 90 天 {{ props.frequency ? formatInteger(props.frequency.count90) : 0 }} 次
          </p>
        </div>
        <div class="stats__item">
          <dt>互动总数</dt>
          <dd>{{ props.frequency ? formatInteger(props.frequency.total) : 0 }} 次</dd>
          <p class="stats__hint">
            平均感受
            {{
              props.frequency && props.frequency.avgFeeling !== null
                ? formatDecimal(props.frequency.avgFeeling, 1)
                : '—'
            }}/5
          </p>
        </div>
        <div class="stats__item">
          <dt>连线粗细</dt>
          <dd>{{ props.frequency ? formatDecimal(props.frequency.edgeWidth, 1) : '—' }} px</dd>
          <p class="stats__hint">由近 90 天频次对数映射</p>
        </div>
      </dl>
    </section>

    <section class="overview__section">
      <h3 class="overview__section-title">亲密度（即时保存并重算图与预警）</h3>
      <label class="sr-only" :for="`intimacy-${props.person.id}`">调整亲密度</label>
      <input
        :id="`intimacy-${props.person.id}`"
        class="range"
        type="range"
        :min="MIN_INTIMACY"
        :max="MAX_INTIMACY"
        step="1"
        :value="props.person.intimacy"
        :aria-valuetext="`${props.person.intimacy} 分：${formatIntimacyLabel(props.person.intimacy)}`"
        @input="onIntimacyInput"
      />
      <p class="overview__intimacy-label">
        当前 {{ props.person.intimacy }}/{{ MAX_INTIMACY }} · {{ formatIntimacyLabel(props.person.intimacy) }}
        <span v-if="isCore" class="faint">（≥ {{ CORE_INTIMACY_THRESHOLD }} 计入核心圈层）</span>
        <span v-else-if="isDormant" class="overview__warn">（已超过 {{ DORMANCY_THRESHOLD_DAYS }} 天未联系）</span>
      </p>
    </section>

    <section class="overview__section">
      <h3 class="overview__section-title">共同话题标签</h3>
      <div v-if="props.person.topics.length > 0" class="overview__topics">
        <span v-for="topic in props.person.topics" :key="topic" class="chip chip--accent">{{ topic }}</span>
      </div>
      <p v-else class="faint overview__empty-line">
        暂无话题标签 —— 建议清单中的「共建共同话题」会给出可参考方向。
      </p>
    </section>

    <section class="overview__section">
      <h3 class="overview__section-title">备注与联系方式</h3>
      <p class="overview__note">{{ safeText(props.person.note, '暂无备注') }}</p>
      <p class="faint">联系方式：{{ safeText(props.person.contact, '未填写') }}</p>
    </section>
  </div>
</template>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.overview__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.overview__section-title {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
}

.stats__item {
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-soft);
  min-width: 0;
}

.stats__item dt {
  font-size: 11px;
  color: var(--text-faint);
  font-weight: 600;
}

.stats__item dd {
  margin: 2px 0 0;
  font-size: 14px;
  font-weight: 700;
  word-break: break-word;
}

.stats__hint {
  font-size: 10.5px;
  color: var(--text-faint);
  line-height: 1.5;
  margin-top: 2px;
}

.stats__hint--warn {
  color: var(--warn);
}

.overview__intimacy-label {
  font-size: 12px;
  color: var(--text-muted);
}

.overview__warn {
  color: var(--danger);
}

.overview__topics {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.overview__empty-line {
  font-size: 12px;
  line-height: 1.6;
}

.overview__note {
  font-size: 12.5px;
  line-height: 1.7;
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--surface-soft);
  border: 1px solid var(--border);
  word-break: break-word;
}

@media (max-width: 767px) {
  .stats {
    grid-template-columns: 1fr;
  }
}
</style>
