<script setup lang="ts">
/**
 * 图例（F2）：节点大小 / 连线粗细与颜色 / 虚实线 / 核心圈层光晕 / 疏远预警脉冲 + 8 种关系类型颜色。
 */

import { RELATION_TYPES } from '../../../core/data/relationTypes';
import {
  CORE_INTIMACY_THRESHOLD,
  DORMANCY_THRESHOLD_DAYS,
  EDGE_DORMANT_FORECAST_DAYS,
  EDGE_COLOR_HIGH,
  EDGE_COLOR_LOW,
  EDGE_WIDTH_MAX,
  EDGE_WIDTH_MIN,
  NODE_RADIUS_BASE,
  NODE_RADIUS_PER_INTIMACY
} from '../../../core/domain/topologyConfig';
import { formatInteger } from '../../../core/services/formatters';

interface Props {
  maxFrequency: number;
  paused: boolean;
  alpha: number;
  nodeCount: number;
  edgeCount: number;
  performanceWarning: boolean;
}

const props = defineProps<Props>();
</script>

<template>
  <section class="legend panel" aria-label="拓扑图图例">
    <div class="panel__header">
      <h2 class="panel__title"><span aria-hidden="true">🧭</span> 图例</h2>
      <span class="panel__subtitle">
        {{ formatInteger(props.nodeCount) }} 节点 · {{ formatInteger(props.edgeCount) }} 连线
      </span>
    </div>

    <div class="panel__body legend__body">
      <ul class="legend__list">
        <li class="legend__item">
          <span class="legend__swatch legend__swatch--node" aria-hidden="true"></span>
          <span>
            节点大小 = 亲密度
            <code class="legend__code">r = {{ NODE_RADIUS_BASE }} + 亲密度 × {{ NODE_RADIUS_PER_INTIMACY }}</code>
          </span>
        </li>
        <li class="legend__item">
          <span class="legend__swatch legend__swatch--core" aria-hidden="true"></span>
          <span>
            光晕环 = 核心圈层
            <code class="legend__code">亲密度 ≥ {{ CORE_INTIMACY_THRESHOLD }}</code>
          </span>
        </li>
        <li class="legend__item">
          <span class="legend__swatch legend__swatch--pulse" aria-hidden="true"></span>
          <span>
            脉冲虚线环 = 疏远预警
            <code class="legend__code">&gt; {{ DORMANCY_THRESHOLD_DAYS }} 天未联系</code>
          </span>
        </li>
        <li class="legend__item">
          <span
            class="legend__swatch legend__swatch--edge"
            :style="{ background: `linear-gradient(90deg, ${EDGE_COLOR_LOW}, ${EDGE_COLOR_HIGH})` }"
            aria-hidden="true"
          ></span>
          <span>
            连线粗细/颜色 = 近 90 天联系频率
            <code class="legend__code">{{ EDGE_WIDTH_MIN }}–{{ EDGE_WIDTH_MAX }}px 对数映射</code>
          </span>
        </li>
        <li class="legend__item">
          <span class="legend__swatch legend__swatch--dashed" aria-hidden="true"></span>
          <span>
            虚线连线 = 预测将疏远
            <code class="legend__code">≥ {{ EDGE_DORMANT_FORECAST_DAYS }} 天</code>
          </span>
        </li>
      </ul>

      <div class="legend__relations">
        <p class="legend__relations-title">关系类型配色</p>
        <ul class="legend__relations-list">
          <li v-for="meta in RELATION_TYPES" :key="meta.id" class="legend__relation">
            <span class="legend__dot" :style="{ background: meta.color }" aria-hidden="true"></span>
            <span aria-hidden="true">{{ meta.icon }}</span>
            <span>{{ meta.label }}</span>
          </li>
        </ul>
      </div>

      <div class="legend__status">
        <span class="chip" :class="{ 'chip--accent': props.paused }">
          {{ props.paused ? '已暂停' : '仿真运行中' }}
        </span>
        <span class="chip">alpha {{ props.alpha.toFixed(3) }}</span>
        <span class="chip">最高频次 {{ formatInteger(props.maxFrequency) }} 次</span>
        <span v-if="props.performanceWarning" class="chip chip--warn">
          节点 &gt; 120，O(n²) 斥力可能掉帧
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.legend__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.legend__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.legend__item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: 12.5px;
  color: var(--text-muted);
  line-height: 1.5;
}

.legend__code {
  font-size: 11px;
  color: var(--text-faint);
  background: var(--surface-soft);
  border-radius: var(--radius-xs);
  padding: 1px 5px;
  margin-left: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.legend__swatch {
  flex: 0 0 auto;
  display: inline-block;
}

.legend__swatch--node {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff 0%, var(--accent) 70%);
}

.legend__swatch--core {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid #8b7cff;
  box-shadow: 0 0 0 3px rgba(139, 124, 255, 0.22);
}

.legend__swatch--pulse {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px dashed var(--danger);
}

.legend__swatch--edge {
  width: 30px;
  height: 6px;
  border-radius: var(--radius-pill);
}

.legend__swatch--dashed {
  width: 30px;
  height: 0;
  border-top: 2px dashed var(--text-muted);
}

.legend__relations-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: var(--space-2);
}

.legend__relations-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
}

.legend__relation {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--text-muted);
  min-width: 0;
}

.legend__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: 0 0 auto;
}

.legend__status {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.chip--warn {
  color: var(--warn);
  border-color: rgba(246, 195, 74, 0.45);
  background: rgba(246, 195, 74, 0.12);
}

@media (max-width: 1199px) {
  .legend__relations-list {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .legend__relations-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
