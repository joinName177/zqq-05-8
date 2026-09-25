<script setup lang="ts">
/**
 * F1：人物录入 / 编辑对话框。
 *
 * 校验通过 core 纯函数 `validatePerson` 完成，错误就近展示在字段下方。
 */

import { computed, ref, watch } from 'vue';
import type { Person, PersonDraft } from '../../../core/domain/PersonModels';
import { createEmptyPersonDraft } from '../../../core/domain/PersonModels';
import type { ValidationErrors } from '../../../core/domain/errors';
import {
  MAX_CONTACT_LENGTH,
  MAX_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_TOPICS,
  MAX_INTIMACY,
  MIN_INTIMACY
} from '../../../core/domain/topologyConfig';
import { RELATION_TYPES } from '../../../core/data/relationTypes';
import { formatIntimacyLabel } from '../../../core/services/formatters';
import { normalizeTopics, parseTopics, validatePerson } from '../../../core/services/personValidator';

interface Props {
  open: boolean;
  person: Person | null;
  persons: Person[];
  today: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  submit: [draft: PersonDraft];
  cancel: [];
}>();

const draft = ref<PersonDraft>(createEmptyPersonDraft('2024-01-01', 5, 'colleague'));
const topicInput = ref('');
const submitted = ref(false);

const isEdit = computed(() => props.person !== null);
const title = computed(() => (isEdit.value ? '编辑人物' : '新增人物'));

const errors = computed<ValidationErrors>(() => {
  if (!submitted.value) return {};
  const result = validatePerson(draft.value, props.persons, props.today, props.person?.id);
  return result.errors;
});

const topicsFull = computed(() => draft.value.topics.length >= MAX_TOPICS);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    submitted.value = false;
    topicInput.value = '';
    draft.value = props.person
      ? {
          name: props.person.name,
          relationType: props.person.relationType,
          intimacy: props.person.intimacy,
          lastContactDate: props.person.lastContactDate,
          topics: [...props.person.topics],
          note: props.person.note,
          contact: props.person.contact
        }
      : createEmptyPersonDraft(props.today, 5, 'colleague');
  },
  { immediate: true }
);

function commitTopics(): void {
  const parsed = parseTopics(topicInput.value);
  if (parsed.length > 0) {
    // BUG-05-08: the form bypasses the core's case-insensitive topic merge.
    draft.value = { ...draft.value, topics: [...draft.value.topics, ...parsed].slice(0, MAX_TOPICS) };
    topicInput.value = '';
  }
}

function onTopicKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
    event.preventDefault();
    commitTopics();
    return;
  }
  if (event.key === 'Backspace' && topicInput.value.length === 0 && draft.value.topics.length > 0) {
    draft.value = { ...draft.value, topics: draft.value.topics.slice(0, -1) };
  }
}

function removeTopic(topic: string): void {
  draft.value = { ...draft.value, topics: draft.value.topics.filter((item) => item !== topic) };
}

function onSubmit(): void {
  submitted.value = true;
  commitTopics();
  const result = validatePerson(draft.value, props.persons, props.today, props.person?.id);
  if (!result.valid) return;
  emit('submit', {
    ...draft.value,
    name: draft.value.name.trim(),
    topics: normalizeTopics(draft.value.topics),
    note: draft.value.note.trim(),
    contact: draft.value.contact.trim()
  });
}
</script>

<template>
  <div v-if="props.open" class="overlay" role="dialog" aria-modal="true" :aria-label="title" @click.self="emit('cancel')">
    <div class="dialog">
      <div class="dialog__header">
        <h2 class="dialog__title">{{ title }}</h2>
        <button type="button" class="btn btn--sm btn--ghost" aria-label="关闭对话框" @click="emit('cancel')">
          ✕
        </button>
      </div>

      <form class="dialog__body" novalidate @submit.prevent="onSubmit">
        <div class="field">
          <label class="field__label" for="person-name">
            姓名 <span class="field__required" aria-hidden="true">*</span>
            <span class="field__hint">{{ draft.name.length }}/{{ MAX_NAME_LENGTH }}</span>
          </label>
          <input
            id="person-name"
            v-model="draft.name"
            class="input"
            :class="{ 'input--invalid': errors.name }"
            type="text"
            :maxlength="MAX_NAME_LENGTH"
            placeholder="例如：林悦"
            autocomplete="off"
            :aria-invalid="Boolean(errors.name)"
            aria-describedby="person-name-error"
          />
          <p v-if="errors.name" id="person-name-error" class="field__error" role="alert">⚠ {{ errors.name }}</p>
        </div>

        <div class="field">
          <span class="field__label">关系类型 <span class="field__required" aria-hidden="true">*</span></span>
          <div class="relation-grid" role="radiogroup" aria-label="关系类型">
            <button
              v-for="meta in RELATION_TYPES"
              :key="meta.id"
              type="button"
              class="relation-option"
              :class="{ 'relation-option--active': draft.relationType === meta.id }"
              role="radio"
              :aria-checked="draft.relationType === meta.id"
              :style="{ '--relation-color': meta.color }"
              @click="draft = { ...draft, relationType: meta.id }"
            >
              <span aria-hidden="true">{{ meta.icon }}</span> {{ meta.label }}
            </button>
          </div>
          <p v-if="errors.relationType" class="field__error" role="alert">⚠ {{ errors.relationType }}</p>
        </div>

        <div class="field">
          <label class="field__label" for="person-intimacy">
            亲密度
            <span class="field__hint">{{ draft.intimacy }}/10 · {{ formatIntimacyLabel(draft.intimacy) }}</span>
          </label>
          <input
            id="person-intimacy"
            v-model.number="draft.intimacy"
            class="range"
            type="range"
            :min="MIN_INTIMACY"
            :max="MAX_INTIMACY"
            step="1"
            :aria-valuetext="`${draft.intimacy} 分：${formatIntimacyLabel(draft.intimacy)}`"
          />
          <div class="intimacy-scale" aria-hidden="true">
            <span>{{ MIN_INTIMACY }} 点头之交</span>
            <span>{{ MAX_INTIMACY }} 无话不谈</span>
          </div>
          <p v-if="errors.intimacy" class="field__error" role="alert">⚠ {{ errors.intimacy }}</p>
        </div>

        <div class="field">
          <label class="field__label" for="person-date">
            最近联系时间
            <span class="field__hint">不得晚于今天（{{ props.today }}）</span>
          </label>
          <input
            id="person-date"
            v-model="draft.lastContactDate"
            class="input"
            :class="{ 'input--invalid': errors.lastContactDate }"
            type="date"
            :max="props.today"
          />
          <p class="field__hint">若该人物已有互动记录，展示时会以最近一次互动日期为准并标注来源。</p>
          <p v-if="errors.lastContactDate" class="field__error" role="alert">⚠ {{ errors.lastContactDate }}</p>
        </div>

        <div class="field">
          <label class="field__label" for="person-topics">
            共同话题标签
            <span class="field__hint">{{ draft.topics.length }}/{{ MAX_TOPICS }}（逗号或回车录入，自动去重）</span>
          </label>
          <div class="topic-input">
            <span v-for="topic in draft.topics" :key="topic" class="chip chip--accent">
              {{ topic }}
              <button
                type="button"
                class="chip__remove"
                :aria-label="`移除话题 ${topic}`"
                @click="removeTopic(topic)"
              >
                ✕
              </button>
            </span>
            <input
              id="person-topics"
              v-model="topicInput"
              class="topic-input__field"
              type="text"
              :disabled="topicsFull"
              :placeholder="topicsFull ? '已达上限' : '输入后回车 / 逗号'"
              @keydown="onTopicKeydown"
              @blur="commitTopics"
            />
          </div>
          <p v-if="errors.topics" class="field__error" role="alert">⚠ {{ errors.topics }}</p>
        </div>

        <div class="field">
          <label class="field__label" for="person-note">
            备注
            <span class="field__hint">{{ draft.note.length }}/{{ MAX_NOTE_LENGTH }}</span>
          </label>
          <textarea
            id="person-note"
            v-model="draft.note"
            class="textarea"
            :class="{ 'textarea--invalid': errors.note }"
            :maxlength="MAX_NOTE_LENGTH"
            placeholder="这段关系对你的意义、需要注意的边界……"
          ></textarea>
          <p v-if="errors.note" class="field__error" role="alert">⚠ {{ errors.note }}</p>
        </div>

        <div class="field">
          <label class="field__label" for="person-contact">
            联系方式（可选）
            <span class="field__hint">{{ draft.contact.length }}/{{ MAX_CONTACT_LENGTH }}</span>
          </label>
          <input
            id="person-contact"
            v-model="draft.contact"
            class="input"
            :class="{ 'input--invalid': errors.contact }"
            type="text"
            :maxlength="MAX_CONTACT_LENGTH"
            placeholder="例如：微信 / linyue_wx"
          />
          <p v-if="errors.contact" class="field__error" role="alert">⚠ {{ errors.contact }}</p>
        </div>
      </form>

      <div class="dialog__footer">
        <p v-if="submitted && Object.keys(errors).length > 0" class="field__error" role="alert">
          ⚠ 请先修正 {{ Object.keys(errors).length }} 处校验错误
        </p>
        <button type="button" class="btn" @click="emit('cancel')">取消</button>
        <button type="button" class="btn btn--primary" @click="onSubmit">
          {{ isEdit ? '保存修改' : '添加人物' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.relation-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.relation-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 7px 6px;
  font-size: 12.5px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-soft);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.relation-option:hover {
  border-color: var(--relation-color, var(--accent));
  color: var(--text);
}

.relation-option--active {
  border-color: var(--relation-color, var(--accent));
  color: var(--text);
  font-weight: 700;
  box-shadow: inset 0 0 0 1px var(--relation-color, var(--accent));
  background: var(--surface-hover);
}

.intimacy-scale {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-faint);
}

.topic-input {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-soft);
  min-height: 42px;
}

.topic-input:focus-within {
  border-color: var(--accent);
}

.topic-input__field {
  flex: 1;
  min-width: 120px;
  border: 0;
  background: transparent;
  padding: 3px 0;
  outline: none;
}

.chip__remove {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0 0 0 2px;
  font-size: 10px;
  line-height: 1;
}

.dialog__footer {
  align-items: center;
}

@media (max-width: 767px) {
  .relation-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
