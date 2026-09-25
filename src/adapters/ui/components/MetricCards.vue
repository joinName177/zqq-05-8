<script setup lang="ts">
/**
 * 顶部指标卡（F3）：总人数 / 核心圈人数 / 预警人数 / 近 30 天互动 / 平均亲密度 / 最久未联系。
 * 全部数值来自 core 的 detectInsights，模板只做展示与格式化。
 */

import type { TopologyStats } from '../../../core/domain/TopologyModels';
import { formatDecimal, formatInteger, formatPercent } from '../../../core/services/formatters';
import { DORMANCY_THRESHOLD_DAYS, CORE_INTIMACY_THRESHOLD, RECENT_WINDOW_DAYS } from '../../../core/domain/topologyConfig';

interface Props {
  stats: TopologyStats;
}

const props = defineProps<Props>();
</script>

<template>
  <section class="metrics" aria-label="关系指标概览">
    <article class="metric-card">
      <p class="metric-card__label">总人数</p>
      <p class="metric-card__value">{{ formatInteger(props.stats.totalPersons) }}</p>
      <p class="metric-card__hint">社交圈人物总数</p>
    </article>

    <article class="metric-card metric-card--core">
      <p class="metric-card__label">核心圈层</p>
      <p class="metric-card__value">
        {{ formatInteger(props.stats.coreCount) }}
        <span class="metric-card__unit">
          / {{ formatPercent(props.stats.coreRatio) }}
        </span>
      </p>
      <p class="metric-card__hint">
        亲密度 ≥ {{ CORE_INTIMACY_THRESHOLD }}
        <template v-if="props.stats.coreAvgIntervalDays !== null">
          · 平均 {{ formatDecimal(props.stats.coreAvgIntervalDays, 1) }} 天一次
        </template>
      </p>
    </article>

    <article class="metric-card" :class="{ 'metric-card--alert': props.stats.dormantCount > 0 }">
      <p class="metric-card__label">疏远预警</p>
      <p class="metric-card__value">{{ formatInteger(props.stats.dormantCount) }}</p>
      <p class="metric-card__hint">
        提醒 {{ props.stats.dormantByLevel.notice }} · 警告 {{ props.stats.dormantByLevel.warning }} · 严重
        {{ props.stats.dormantByLevel.severe }}
        <span class="faint">（>{{ DORMANCY_THRESHOLD_DAYS }} 天）</span>
      </p>
    </article>

    <article class="metric-card">
      <p class="metric-card__label">近 {{ RECENT_WINDOW_DAYS }} 天互动</p>
      <p class="metric-card__value">{{ formatInteger(props.stats.interactions30d) }}</p>
      <p class="metric-card__hint">全部人物互动次数合计</p>
    </article>

    <article class="metric-card">
      <p class="metric-card__label">平均亲密度</p>
      <p class="metric-card__value">
        {{ formatDecimal(props.stats.avgIntimacy, 2) }}
        <span class="metric-card__unit">/ 10</span>
      </p>
      <p class="metric-card__hint">全圈平均关系强度</p>
    </article>

    <article class="metric-card">
      <p class="metric-card__label">最久未联系</p>
      <p class="metric-card__value metric-card__value--name">
        {{ props.stats.longestIdle ? props.stats.longestIdle.name : '—' }}
      </p>
      <p class="metric-card__hint">
        <template v-if="props.stats.longestIdle">
          已 {{ formatInteger(props.stats.longestIdle.days) }} 天未联系
        </template>
        <template v-else>暂无人物数据</template>
      </p>
    </article>
  </section>
</template>

<style scoped>
.metrics {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: var(--space-3);
}

.metric-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  box-shadow: var(--shadow-sm);
  transition: border-color var(--transition-fast), transform var(--transition-fast);
  min-width: 0;
}

.metric-card:hover {
  border-color: var(--border-strong);
  transform: translateY(-2px);
}

.metric-card--core {
  border-color: rgba(139, 124, 255, 0.5);
}

.metric-card--alert {
  border-color: rgba(255, 107, 129, 0.5);
}

.metric-card__label {
  font-size: 11.5px;
  color: var(--text-muted);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.metric-card__value {
  font-size: 24px;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-card__value--name {
  font-size: 19px;
}

.metric-card__unit {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

.metric-card__hint {
  font-size: 11px;
  color: var(--text-faint);
  line-height: 1.5;
}

@media (max-width: 1199px) {
  .metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-card__value {
    font-size: 20px;
  }
}
</style>
