<script setup lang="ts">
/**
 * F3：关系类型分布（自绘 SVG 环形图 + 条形图，人数 / 平均亲密度双维度，带 hover 数值提示）。
 */

import { computed, ref } from 'vue';
import type { RelationDistributionBucket } from '../../../core/domain/TopologyModels';
import { buildBarSeries, buildDonutSegments } from '../../../core/services/distributionStats';
import { formatDecimal, formatInteger, formatPercent } from '../../../core/services/formatters';
import EmptyState from './EmptyState.vue';

interface Props {
  buckets: RelationDistributionBucket[];
}

const props = defineProps<Props>();

const DONUT_SIZE = 190;
const geometry = { cx: DONUT_SIZE / 2, cy: DONUT_SIZE / 2, innerRadius: 46, outerRadius: 78 };

const metric = ref<'count' | 'avgIntimacy'>('count');
const hoveredId = ref<string | null>(null);

const segments = computed(() => buildDonutSegments(props.buckets, geometry));
const bars = computed(() => buildBarSeries(props.buckets, metric.value));
const total = computed(() => props.buckets.reduce((sum, bucket) => sum + bucket.count, 0));
const maxBarValue = computed(() => bars.value.reduce((max, bar) => Math.max(max, bar.value), 0));
const activeSegment = computed(() => segments.value.find((segment) => segment.relationType === hoveredId.value) ?? null);

function barWidth(value: number): string {
  if (maxBarValue.value <= 0) return '0%';
  return `${Math.max(4, (value / maxBarValue.value) * 100)}%`;
}
</script>

<template>
  <section class="distribution panel" aria-label="关系类型分布">
    <div class="panel__header">
      <h2 class="panel__title"><span aria-hidden="true">📊</span> 关系类型分布</h2>
      <div class="distribution__switch" role="group" aria-label="条形图维度">
        <button
          type="button"
          class="btn btn--sm"
          :class="{ 'btn--primary': metric === 'count' }"
          aria-label="按人数显示条形图"
          @click="metric = 'count'"
        >
          人数
        </button>
        <button
          type="button"
          class="btn btn--sm"
          :class="{ 'btn--primary': metric === 'avgIntimacy' }"
          aria-label="按平均亲密度显示条形图"
          @click="metric = 'avgIntimacy'"
        >
          平均亲密度
        </button>
      </div>
    </div>

    <div class="panel__body distribution__body">
      <EmptyState
        v-if="total === 0"
        icon="📈"
        compact
        title="暂无分布数据"
        description="录入人物后，这里会显示各关系类型的人数与平均亲密度分布。"
      />

      <template v-else>
        <div class="distribution__donut">
          <svg
            class="distribution__svg"
            :viewBox="`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`"
            role="img"
            :aria-label="`关系类型环形图，共 ${total} 人`"
          >
            <g>
              <path
                v-for="segment in segments"
                :key="segment.relationType"
                :d="segment.path"
                :fill="segment.color"
                :class="{ 'distribution__slice--dim': hoveredId !== null && hoveredId !== segment.relationType }"
                class="distribution__slice"
                tabindex="0"
                :aria-label="`${segment.label}：${segment.count} 人，占比 ${formatPercent(segment.ratio)}，平均亲密度 ${formatDecimal(segment.avgIntimacy, 1)}`"
                @mouseenter="hoveredId = segment.relationType"
                @mouseleave="hoveredId = null"
                @focus="hoveredId = segment.relationType"
                @blur="hoveredId = null"
              />
            </g>
            <text class="distribution__center-value" :x="geometry.cx" :y="geometry.cy - 2" text-anchor="middle">
              {{ activeSegment ? formatInteger(activeSegment.count) : formatInteger(total) }}
            </text>
            <text class="distribution__center-label" :x="geometry.cx" :y="geometry.cy + 16" text-anchor="middle">
              {{ activeSegment ? activeSegment.label : '总人数' }}
            </text>
          </svg>

          <p class="distribution__tooltip" role="status" aria-live="polite">
            <template v-if="activeSegment">
              <strong>{{ activeSegment.label }}</strong>
              · {{ formatInteger(activeSegment.count) }} 人 · {{ formatPercent(activeSegment.ratio) }} · 平均
              {{ formatDecimal(activeSegment.avgIntimacy, 2) }} 分
            </template>
            <template v-else>悬停环形图查看各类型人数与占比</template>
          </p>
        </div>

        <ul class="distribution__bars">
          <li v-for="bar in bars" :key="bar.relationType" class="distribution__bar-row">
            <span class="distribution__bar-label">{{ bar.label }}</span>
            <span class="distribution__bar-track">
              <span
                class="distribution__bar-fill"
                :style="{ width: barWidth(bar.value), background: bar.color }"
                :title="`${bar.label}：${bar.display}`"
              ></span>
            </span>
            <span class="distribution__bar-value">{{ bar.display }}</span>
          </li>
        </ul>

        <ul class="distribution__legend">
          <li v-for="bucket in props.buckets.filter((item) => item.count > 0)" :key="bucket.relationType">
            <span class="distribution__legend-dot" :style="{ background: bucket.color }" aria-hidden="true"></span>
            <span>{{ bucket.icon }} {{ bucket.label }}</span>
            <span class="faint">
              {{ formatInteger(bucket.count) }} 人
              <template v-if="bucket.dormantCount > 0"> · 预警 {{ bucket.dormantCount }}</template>
            </span>
          </li>
        </ul>
      </template>
    </div>
  </section>
</template>

<style scoped>
.distribution__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.distribution__switch {
  display: flex;
  gap: 4px;
}

.distribution__donut {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.distribution__svg {
  width: 100%;
  max-width: 210px;
  height: auto;
}

.distribution__slice {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
  transform-origin: center;
  cursor: pointer;
  outline-offset: 2px;
}

.distribution__slice:hover,
.distribution__slice:focus-visible {
  transform: scale(1.03);
}

.distribution__slice--dim {
  opacity: 0.28;
}

.distribution__center-value {
  fill: var(--text);
  font-size: 22px;
  font-weight: 800;
}

.distribution__center-label {
  fill: var(--text-muted);
  font-size: 11px;
}

.distribution__tooltip {
  font-size: 11.5px;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.6;
  min-height: 32px;
}

.distribution__bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.distribution__bar-row {
  display: grid;
  grid-template-columns: 60px 1fr auto;
  align-items: center;
  gap: var(--space-2);
  font-size: 11.5px;
}

.distribution__bar-label {
  color: var(--text-muted);
}

.distribution__bar-track {
  height: 9px;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  border: 1px solid var(--border);
  overflow: hidden;
}

.distribution__bar-fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  transition: width var(--transition);
}

.distribution__bar-value {
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.distribution__legend {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11.5px;
  color: var(--text-muted);
  border-top: 1px solid var(--border);
  padding-top: var(--space-3);
}

.distribution__legend li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.distribution__legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: 0 0 auto;
}

.distribution__legend .faint {
  margin-left: auto;
}
</style>
