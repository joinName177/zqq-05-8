<script setup lang="ts">
/**
 * F4：新增互动表单（校验：日期不得晚于今天、时长与备注长度、感受区间）。
 */

import { computed, ref, watch } from 'vue';
import { INTERACTION_KINDS, type InteractionDraft } from '../../../core/domain/InteractionModels';
import type { ValidationErrors } from '../../../core/domain/errors';
import {
  MAX_FEELING,
  MAX_INTERACTION_DURATION_MINUTES,
  MAX_INTERACTION_NOTE_LENGTH,
  MIN_FEELING
} from '../../../core/domain/topologyConfig';
import { validateInteraction } from '../../../core/services/personValidator';

interface Props {
  today: string;
  defaultFeeling: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  submit: [draft: InteractionDraft];
}>();

const draft = ref<InteractionDraft>({
  date: props.today,
  kind: 'meet',
  durationMinutes: null,
  note: '',
  feeling: props.defaultFeeling
});
const submitted = ref(false);
const expanded = ref(false);

const errors = computed<ValidationErrors>(() => {
  if (!submitted.value) return {};
  return validateInteraction(draft.value, props.today).errors;
});

watch(
  () => props.today,
  (today) => {
    if (draft.value.date > today) draft.value = { ...draft.value, date: today };
  }
);

function reset(): void {
  draft.value = {
    date: props.today,
    kind: 'meet',
    durationMinutes: null,
    note: '',
    feeling: props.defaultFeeling
  };
  submitted.value = false;
}

function onSubmit(): void {
  submitted.value = true;
  const result = validateInteraction(draft.value, props.today);
  if (!result.valid) return;
  emit('submit', { ...draft.value, note: draft.value.note.trim() });
  reset();
  expanded.value = false;
}

function onDurationInput(event: Event): void {
  const raw = (event.target as HTMLInputElement).value;
  draft.value = { ...draft.value, durationMinutes: raw.length === 0 ? null : Number(raw) };
}
</script>

<template>
  <form class="interaction-form" novalidate @submit.prevent="onSubmit">
    <div class="interaction-form__head">
      <p class="interaction-form__title">
        <span aria-hidden="true">➕</span> 新增互动记录
      </p>
      <button
        type="button"
        class="btn btn--sm btn--ghost"
        :aria-expanded="expanded"
        aria-controls="interaction-form-body"
        @click="expanded = !expanded"
      >
        {{ expanded ? '收起' : '展开' }}
      </button>
    </div>

    <div v-show="expanded" id="interaction-form-body" class="interaction-form__body">
      <div class="field">
        <label class="field__label" for="interaction-date">互动日期</label>
        <input
          id="interaction-date"
          v-model="draft.date"
          class="input"
          :class="{ 'input--invalid': errors.date }"
          type="date"
          :max="props.today"
        />
        <p v-if="errors.date" class="field__error" role="alert">⚠ {{ errors.date }}</p>
      </div>

      <div class="field">
        <span class="field__label">互动类型</span>
        <div class="interaction-form__kinds" role="radiogroup" aria-label="互动类型">
          <button
            v-for="kind in INTERACTION_KINDS"
            :key="kind.id"
            type="button"
            class="chip interaction-form__kind"
            :class="{ 'chip--active': draft.kind === kind.id }"
            role="radio"
            :aria-checked="draft.kind === kind.id"
            @click="draft = { ...draft, kind: kind.id }"
          >
            <span aria-hidden="true">{{ kind.icon }}</span> {{ kind.label }}
          </button>
        </div>
        <p v-if="errors.kind" class="field__error" role="alert">⚠ {{ errors.kind }}</p>
      </div>

      <div class="interaction-form__grid">
        <div class="field">
          <label class="field__label" for="interaction-duration">
            时长（分钟，可选）
            <span class="field__hint">≤ {{ MAX_INTERACTION_DURATION_MINUTES }}</span>
          </label>
          <input
            id="interaction-duration"
            class="input"
            :class="{ 'input--invalid': errors.durationMinutes }"
            type="number"
            min="1"
            :max="MAX_INTERACTION_DURATION_MINUTES"
            step="1"
            placeholder="例如 45"
            :value="draft.durationMinutes ?? ''"
            @input="onDurationInput"
          />
          <p v-if="errors.durationMinutes" class="field__error" role="alert">⚠ {{ errors.durationMinutes }}</p>
        </div>

        <div class="field">
          <label class="field__label" for="interaction-feeling">
            主观感受
            <span class="field__hint">{{ draft.feeling }}/{{ MAX_FEELING }}</span>
          </label>
          <input
            id="interaction-feeling"
            v-model.number="draft.feeling"
            class="range"
            type="range"
            :min="MIN_FEELING"
            :max="MAX_FEELING"
            step="1"
          />
          <p v-if="errors.feeling" class="field__error" role="alert">⚠ {{ errors.feeling }}</p>
        </div>
      </div>

      <div class="field">
        <label class="field__label" for="interaction-note">
          备注
          <span class="field__hint">{{ draft.note.length }}/{{ MAX_INTERACTION_NOTE_LENGTH }}</span>
        </label>
        <input
          id="interaction-note"
          v-model="draft.note"
          class="input"
          :class="{ 'input--invalid': errors.note }"
          type="text"
          :maxlength="MAX_INTERACTION_NOTE_LENGTH"
          placeholder="聊了什么、感受如何"
        />
        <p v-if="errors.note" class="field__error" role="alert">⚠ {{ errors.note }}</p>
      </div>

      <button type="submit" class="btn btn--primary btn--block">保存互动记录</button>
    </div>
  </form>
</template>

<style scoped>
.interaction-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface-soft);
}

.interaction-form__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.interaction-form__title {
  font-size: 13px;
  font-weight: 700;
}

.interaction-form__body {
  display: flex;
  flex-direction: column;
}

.interaction-form__kinds {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.interaction-form__kind {
  cursor: pointer;
}

.interaction-form__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

@media (max-width: 767px) {
  .interaction-form__grid {
    grid-template-columns: 1fr;
  }
}
</style>
