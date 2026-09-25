# zqq-05 人际关系拓扑图（zqq-05-relationship-topology）

> 纯前端人际关系拓扑图：录入社交圈人物与互动记录，用**自研力导向物理仿真**自动布局成一张可交互的关系网络图，自动识别**核心圈层（亲密度 ≥ 8）**与**疏远预警（> 90 天未联系）**，并为每个人生成按优先级排序的**关系维护建议清单**。

- 技术栈：Vue 3（Composition API + `<script setup lang="ts">`）+ TypeScript 严格模式 + Vite 6 + **100% 原生 CSS**
- 运行时依赖：**只有 `vue`**（无 d3 / cytoscape / vis.js / echarts / lodash / dayjs / pinia / vue-router）
- 力导向布局、环形图/条形图、SVG 导出、日期历法换算**全部自研**
- 样式：`styles/main.css`（设计令牌/reset）+ `components.css` / `forms.css` / `animations.css` / `graph.css` + 组件内 `<style scoped>`
- 分层架构：`adapters → ports → core`，业务规则与阈值 100% 收敛在 `core`
- 开发端口 `5177`，Docker/Nginx 端口 `8085`

---

## 目录

1. [🌟 核心特色与功能设计](#-核心特色与功能设计)
2. [🏗 架构说明](#-架构说明)
3. [🚀 启动与部署](#-启动与部署)
4. [🧪 数据与持久化](#-数据与持久化)
5. [🔧 高内聚低耦合重构说明](#-高内聚低耦合重构说明)
6. [✅ 验收自检](#-验收自检)

---

## 🌟 核心特色与功能设计

### F1 人物录入与管理

| 需求点 | 实现位置 | 规则 / 数值 |
| --- | --- | --- |
| 录入字段 | `core/domain/PersonModels.ts`（`Person` / `PersonDraft`）、`adapters/ui/components/PersonFormDialog.vue` | 姓名 ≤ **20 字**、亲密度 **1–10** 整数、共同话题 ≤ **8 个**、备注 ≤ **100 字**、联系方式可选 ≤ **60 字** |
| 关系类型 + 固定颜色 | `core/data/relationTypes.ts` + `core/domain/topologyConfig.ts` 的 `RELATION_TYPE_COLORS` | 家人 `#ff8a5c`、挚友 `#2ee6c5`、同事 `#6aa6ff`、同学 `#b18cff`、合作伙伴 `#ffd166`、泛社交 `#8b9ab3`、前任 `#ff6b9d`、其他 `#9ee493` |
| 亲密度文案 | `core/domain/topologyConfig.ts` 的 `INTIMACY_LABELS`，经 `formatters.formatIntimacyLabel` 输出 | 1 = 点头之交 → 5 = 常来常往 → 8 = 亲密好友 → **10 = 无话不谈**；滑杆下方实时显示 |
| 话题标签录入 | `core/services/personValidator.ts` 的 `parseTopics` / `normalizeTopics` | 支持逗号 `,`、中文逗号 `，`、顿号 `、`、分号 `;`/`；`、回车混合录入；自动去首尾空白、去 `#` 前缀、忽略大小写去重、截断到 8 个 |
| 校验纯函数 | `core/services/personValidator.ts` 的 `validatePerson(draft, persons, todayIso, editingId?)` | ① 姓名必填且 ≤ 20 字；② **重名拦截**（编辑时用 `editingId` 排除自身，忽略大小写）；③ 亲密度必须为 1–10 整数；④ 日期必须合法且**不得晚于今天**；⑤ 标签不得重复 / 不得为空；⑥ 备注与联系方式长度。错误就近显示在字段下方（`aria-invalid` + `role="alert"`） |
| 列表 / 卡片视图 | `adapters/ui/components/PersonListPanel.vue` | 搜索（姓名 + 话题标签，忽略大小写）、按关系类型筛选、5 种排序（最久未联系 / 最近联系 / 亲密度升降 / 姓名）、亲密度进度条、关系类型色条、核心圈层与预警徽标 |
| 删除 / 清空 | `App.vue` 的 `onRemovePerson` / `onClearAll` + `adapters/ui/components/ConfirmDialog.vue` | 均走二次确认；删除人物会级联删除其互动记录与被删除的建议勾选状态 |
| 12 人示例数据 | `core/data/demoPersons.ts` → `buildDemoDataset(todayIso, timestampIso)` | **12 人**（`DEMO_PERSON_COUNT`），全部日期按「距今天数偏移」生成，因此任何时间载入都能复现三类场景；覆盖见下表 |

**示例数据的三类场景覆盖**

| 场景 | 人物 | 关键数值 |
| --- | --- | --- |
| 核心圈层（≥ 8） | 妈妈 10 / 爸爸 9 / 林悦 9 / 陈默 8 | 共 4 人 |
| 疏远预警（> 90 天） | 王志远 **96 天**（提醒）、何嘉 **150 天**（警告）、李阿姨 **210 天**（严重） | 三级各 1 人 |
| 正常维护 | 周雨桐 21 天 / 苏晴 8 天 | 触发规则 7「关系维护良好」 |
| 两种「最近联系来源」 | 其余人 → 由最新互动推导；**李阿姨无互动记录 → 回落录入值** | `LastContactSource = 'interaction' \| 'record'` |

### F2 力导向拓扑图（自研物理仿真）

**核心文件**：`core/services/forceSimulation.ts`（唯一物理内核）、`adapters/ui/composables/useForceLayout.ts`（唯一 rAF 驱动）、`adapters/ui/components/ForceGraph.vue`（SVG 渲染与指针交互）。

对外只有两个纯函数入口：

```ts
createLayout(nodes, edges, params, rng): LayoutState   // 初始布局
stepLayout(layout, params): LayoutState                // 推进一步，返回新状态，不改动入参
```

物理模型（全部参数来自 `core/domain/topologyConfig.ts` 的 `PHYSICS_CONFIG`）：

| 力 | 公式 | 参数 |
| --- | --- | --- |
| 斥力 | `F = repulsion / d²`（O(n²)，`d` 下限 `minDistance` 防爆） | `repulsion = 16000`、`minDistance = 26` |
| 弹簧引力 | `F = (d − restLength) × stiffness × strength` | `springStiffness = 0.045` |
| 弹簧自然长度 | `restLength = restLengthMax − 亲密度影响项 − 频率影响项` | `restLengthMax = 240`、`restLengthMin = 72`、`frequencyRestLengthBoost = 30` |
| 向心力 | `F = (center − pos) × centeringStrength` | `centeringStrength = 0.02` |
| 积分 | `v = (v + F × alpha) × damping` | **`damping = 0.82`** |
| 约束 | 单帧速度 ≤ `maxVelocity`(18)、单帧位移 ≤ `maxDisplacement`(14)、合力 ≤ `maxForcePerStep`(90)、节点始终被夹在画布边界内（含 `boundaryPadding = 30` + 节点半径） | — |
| 冷却 | `alpha` 从 **1** 线性衰减 `alphaDecay = 0.0085` 到 **`alphaMin = 0.008`** 即停机（约 117 帧 ≈ 2 秒收敛） | 收敛后 `stepLayout` 直接返回同一引用，rAF 循环自然停止 |
| 可复现 | 初始位置 = 确定性角度 `index/count × 2π` + 种子抖动 `initialJitter = 0.45`，随机源为 `mulberry32(seed)` | **同一份数据 + 同一种子 = 同一份坐标**（已用断言验证） |

交互（`ForceGraph.vue`）：

| 能力 | 实现 |
| --- | --- |
| 拖拽节点 | `pointerdown` 固定 `fx/fy` → `pointermove` 换算世界坐标 → `pointerup` 释放（位移 < 3px 判定为「点击」并打开详情） |
| 拖空白平移 | 背景 `pointerdown` 记录起点，`pointermove` 平移 `tx/ty` |
| 滚轮缩放 | 以光标为锚点缩放，范围 **0.4–3**（`ZOOM_MIN`/`ZOOM_MAX`，步进 `ZOOM_STEP = 1.12`） |
| 双击空白复位 | 缩放与平移复位到 `k=1, tx=0, ty=0` |
| 暂停 / 继续 | 停止 / 重启 rAF 循环（`paused` 期间不再调用 `stepLayout`） |
| 重新布局 | `regenerateLayoutSeed()` 生成新种子 → `reseedLayout()` 满血回热重排 |
| 悬停高亮 | 悬停节点 + 其邻接节点与连线保持不透明，其余淡出到 `opacity: 0.12 / 0.16` |
| 筛选 | 全部 / 仅核心圈层 / 仅疏远预警 + 按关系类型；未命中节点**淡出而非移除**，配合 `transition: opacity` 实现淡入淡出 |
| 性能提示 | 节点数 > **120**（`PERFORMANCE_NODE_WARNING`）时图例区显示「O(n²) 斥力可能掉帧」 |

视觉映射（README 与图上 `GraphLegend.vue` 图例双向对应）：

| 视觉 | 映射 | 常量 |
| --- | --- | --- |
| 节点半径 | `r = 6 + 亲密度 × 2.2` | `NODE_RADIUS_BASE = 6`、`NODE_RADIUS_PER_INTIMACY = 2.2` |
| 节点颜色 | 关系类型固定色 | `RELATION_TYPE_COLORS` |
| 核心圈层光晕 | 外扩 **+6px** 的紫色描边圆环 `#8b7cff` | `CORE_HALO_EXTRA = 6` |
| 疏远预警脉冲 | 外扩 **+9px** 的红色虚线圆环，周期 **2.4s** 的 `zqq-pulse-ring` 缩放淡出动画 | `DORMANT_PULSE_EXTRA = 9`、`DORMANT_PULSE_DURATION_S = 2.4` |
| 连线粗细 | 双方近 **90 天**互动频次均值的**对数映射**：`min + (max−min) × ln(1+n)/ln(1+16)`，范围 **0.8–8px** | `EDGE_WIDTH_MIN/MAX`、`EDGE_FREQUENCY_LOG_CAP = 16` |
| 连线颜色 | 淡灰 `#8f9bb3` → 青绿 `#2ee6c5` 线性插值（同一个对数归一化因子） | `EDGE_COLOR_LOW/HIGH` |
| 虚线连线 | 任一端 ≥ **60 天**未联系即判定「预测将疏远」，使用 `stroke-dasharray: 7 6` 并带流动动画 | `EDGE_DORMANT_FORECAST_DAYS = 60`、`EDGE_DASH_PATTERN` |
| 关系推断 | 共享话题 `0.45` + 同关系类型 `0.35` + 双核心圈 `0.2` + 双家人 `0.15`，权重 **< 0.34** 不连线；单节点最多 **6** 条连线（按权重优先保留） | `EDGE_WEIGHT_*`、`EDGE_MIN_WEIGHT`、`EDGE_MAX_PER_NODE` |
| 标签显示 | 缩放 < **1.15** 时只显示悬停 / 选中 / 邻接标签；≥ 1.15 时按权重贪心避让，最多 **26** 个；字号 10–14px 随半径变化 | `LABEL_ZOOM_THRESHOLD`、`MAX_VISIBLE_LABELS`、`labelPlanner.ts` |

### F3 疏远预警与核心圈层识别

**核心文件**：`core/services/insightDetector.ts` → `detectInsights(persons, interactions, todayIso)` 返回 `{ dormant, core, stats }`。

- **疏远预警阈值：`DORMANCY_THRESHOLD_DAYS = 90`**（常量，模板中不出现 90 这个数字）
  - 分级（`DORMANCY_LEVELS`，降序匹配）：**90–119 提醒** → **120–179 警告** → **≥180 严重**
  - 每条预警包含：未联系天数、上次话题（优先取人物标签，回落到最近一条互动备注）、建议动作、等级颜色
- **核心圈层阈值：`CORE_INTIMACY_THRESHOLD = 8`**
  - 输出人数（`stats.coreCount`）、占总人数比例（`stats.coreRatio`）、核心圈平均联系间隔天数（各成员相邻互动间隔的平均值，`stats.coreAvgIntervalDays`）、圈层内最久未联系者（`stats.coreLongestIdle`）
- **顶部指标卡（6 张）**：`adapters/ui/components/MetricCards.vue`
  1. 总人数 2. 核心圈人数 + 占比 + 平均间隔 3. 预警人数 + 三级分布（>90 天） 4. 近 **30 天**互动次数（`RECENT_WINDOW_DAYS = 30`） 5. 平均亲密度 6. 最久未联系的人（含天数）
- **关系类型分布图**：`adapters/ui/components/RelationDistributionChart.vue` + `core/services/distributionStats.ts`
  - 自绘 SVG **环形图**（`describeDonutSegment` 生成 path，整圆自动拆成两段弧）带 hover 数值提示与中心数字
  - 自绘 **条形图** 双维度切换：人数 / 平均亲密度，按值降序
  - 数据：每类的人数、占比、平均亲密度、核心圈人数、预警人数

### F4 互动历史时间轴与关系维护建议

**互动记录模型**：`core/domain/InteractionModels.ts`
- 类型 7 种：见面 / 通话 / 消息 / 礼物 / 共同活动 / 冲突 / 道歉（`INTERACTION_KINDS`，带图标与情感极性 `tone`）
- 字段：日期（`YYYY-MM-DD`，不得晚于今天）、时长（可选，1–**1440** 分钟）、备注 ≤ **80 字**、主观感受 **1–5**

**最近联系时间自动推导**：`core/services/contactFrequency.ts` → `deriveLastContact(person, interactionsDesc, todayIso)`
- 有互动记录 → 取最新一条互动日期，`source = 'interaction'`，UI 标注「由最新互动推导」
- 无互动记录 → 回落 `person.lastContactDate`，`source = 'record'`，UI 标注「取自录入值（暂无互动记录）」
- 新增互动后 `commit()` 立刻重算洞察、拓扑、分布、建议 —— 图与预警即时更新

**详情抽屉**：`adapters/ui/components/PersonDetailDrawer.vue`（窄屏 < 768px 变为全屏面板）
- 关键指标（最近联系 + 来源、近 30 天 / 近 90 天互动次数、互动总数、平均感受、当前连线粗细）
- 亲密度快速调整滑杆 → `adjustIntimacy()` 即时保存并重算图与预警
- 话题标签云、备注、联系方式
- **互动时间轴**：`InteractionTimeline.vue` + `buildTimeline` / `groupTimelineByMonth`
  - 按时间倒序、**按月分组**（`2025 年 6 月`），每月显示次数与平均感受
  - 每条标注距离文案：最新一条 → `距上次联系 N 天`（当天为「今天刚联系过」）；更早的 → `距上一次互动间隔 M 天`
  - 每条可删除（二次确认由 `ConfirmDialog` 承担）
- **新增互动表单**：`InteractionForm.vue` + `validateInteraction`（未来日期拦截、时长区间、备注长度、感受区间）

**建议清单**：`core/services/maintenanceAdvisor.ts` → `recommendMaintenance(person, interactionsDesc, todayIso, context)`

返回 `{ id, priority: 'high' | 'medium' | 'low', title, detail, action, reason }[]`，按 `high → medium → low` 稳定排序，ID 为 `${personId}::${规则名}`（**稳定**，可持久化勾选状态）。7 条规则：

| # | 触发条件（含具体阈值） | 优先级 | 标题 |
| --- | --- | --- | --- |
| 1 | 未联系 **> 90 天** | high | 已超过 90 天未联系（文案引用其共同话题） |
| 2 | 亲密度 **≥ 8** 且 **> 30 天**未联系 | high | 核心关系正在被日常挤占 |
| 3 | 亲密度 **≤ 4** 但近 **30 天**互动 **≥ 5 次** | medium | 投入与亲密度错位，确认是否值得深交或明确边界 |
| 4 | 近 **60 天**内存在「冲突」且之后 **≥ 14 天**无任何互动 | high | 冲突后已沉默，建议主动修复 |
| 5 | 话题标签为空 | low | 尚未沉淀共同话题（给出 **3** 个参考话题，来自同类型人物高频标签聚合，回落到 `topicLexicon.ts`） |
| 6 | 亲密度代理值近 **30 天**均值比前 **60 天**下降 **≥ 2** | medium | 关系正在降温 |
| 7 | 以上均未触发 | low | 关系维护良好 + 建议下次联系日期（**≥8 → 7 天 / 5–7 → 21 天 / ≤4 → 60 天**） |

> 规则 6 的说明：数据模型只保存互动后的**主观感受 1–5**，没有亲密度历史。因此按 `FEELING_TO_INTIMACY_SCALE = 2` 把感受换算到 1–10 亲密度刻度后比较（`core/services/contactFrequency.ts` 的 `computeFeelingTrend`）。
> 每条建议都带 `reason` 字段，用等宽字体显示触发时的真实数值（如「亲密度 3 ≤ 4 且近 30 天互动 6 ≥ 5 次」），保证规则可审计。

**勾选「已处理」**：`MaintenanceAdviceList.vue` → `toggleAdviceHandled()`，写入 `zqq05:advice-dismissed`，**仅影响展示**（已处理项置灰 + 删除线 + 计数），不改变任何原始数据。

### F5 导出与备份

| 能力 | 实现位置 | 说明 |
| --- | --- | --- |
| 拓扑图 SVG | `core/services/topologyBuilder.ts` 的 `buildSvgExportInput` + `adapters/export/TopologySvgExporter.ts` | 复用**当前布局坐标**；`buildSvgExportInput` 计算包围盒 → 等比缩放居中到 `1280 × 860` 画布（顶部 108px 标题区、底部 196px 图例/统计区）；导出器**手写 SVG 字符串**，含标题、生成时间、图例（5 条映射说明 + 8 种关系类型配色）、7 行统计摘要、节点（光晕 + 脉冲环 + 标签）、连线（粗细 / 颜色 / 虚线） |
| 下载 / 复制 | `adapters/export/BrowserFileDownloader.ts`、`adapters/export/BrowserClipboard.ts` | Blob + `<a download>`；剪贴板优先 `navigator.clipboard`，失败降级 `execCommand` |
| JSON 备份导出 | `adapters/export/JsonBackupGateway.ts` 的 `serialize` | 携带 `version`(schema 版本) / `app` / `exportedAt` 元信息 + `persons` / `interactions` / `settings` |
| JSON 备份导入 | `JsonBackupGateway.parse` + 用例 `importBackup(raw, mode)` | 格式校验（JSON 合法性、根节点为对象、`persons` 必须为数组）、**版本校验（高于当前 schema 版本直接拒绝）**、逐条字段兜底；两种模式：**合并**（按 id / 姓名去重，跳过重复与孤儿互动）与**覆盖**（整体替换，需二次确认）；导入后所有指标、预警、建议、布局**立即重算** |

### F6 持久化

见 [🧪 数据与持久化](#-数据与持久化) 章节。

---

## 🏗 架构说明

### 目录结构

```
zqq-05/
├─ index.html                      # lang="zh-CN"，🕸️ SVG favicon，标题含项目中文名
├─ package.json                    # dependencies 只有 vue
├─ tsconfig.json                   # strict + noUnusedLocals + noUnusedParameters + noFallthroughCasesInSwitch
├─ vite.config.ts                  # server.port = 5177, host: true
├─ Dockerfile / nginx.conf / docker-compose.yml / .dockerignore
├─ README.md / .gitignore
└─ src/
   ├─ core/                        # ① 核心层：零框架、零浏览器 API、零 IO
   │  ├─ domain/                   #    实体 / 值对象 / 全部阈值与物理参数
   │  │  ├─ PersonModels.ts             Person / PersonDraft / RelationTypeId
   │  │  ├─ InteractionModels.ts        Interaction / 7 种互动类型元数据
   │  │  ├─ TopologyModels.ts           布局、拓扑渲染、分布、筛选、视图状态
   │  │  ├─ InsightModels.ts            疏远预警、核心圈层、指标、建议、频率时间轴
   │  │  ├─ ExportModels.ts             SVG / JSON 备份 / 示例数据
   │  │  ├─ topologyConfig.ts           ★ 唯一「魔法数字」归宿（90 / 8 / 30 / 60 / 0.82 / 2.2 …）
   │  │  └─ errors.ts                   DomainError / ValidationResult
   │  ├─ services/                 #    纯函数算法（输入 → 输出，无副作用）
   │  │  ├─ forceSimulation.ts          ★ 自研力导向物理仿真（createLayout / stepLayout）
   │  │  ├─ layoutMetrics.ts            半径 / 弹簧劲度 / 自然长度的度量换算
   │  │  ├─ topologyBuilder.ts          节点连线装配、关系推断、筛选、布局种子
   │  │  ├─ exportBuilder.ts            SVG 导出画布的坐标映射与图例/统计摘要
   │  │  ├─ insightDetector.ts          ★ 疏远预警 + 核心圈层 + 指标统计
   │  │  ├─ maintenanceAdvisor.ts       ★ 7 条关系维护建议规则
   │  │  ├─ contactFrequency.ts         频率统计 / 最近联系推导 / 时间轴 / 趋势
   │  │  ├─ distributionStats.ts        关系类型分布 + 环形图弧线与条形图数据
   │  │  ├─ viewStateAssembler.ts       视图状态快照装配（洞察→拓扑→分布→建议）
   │  │  ├─ backupMerge.ts              导入快照的合并 / 覆盖与结果工厂
   │  │  ├─ personValidator.ts          人物与互动校验、标签解析、草稿落地
   │  │  ├─ labelPlanner.ts             标签显示规划（缩放阈值 + 重叠避让）
   │  │  ├─ dateUtils.ts                自研历法换算（禁止 new Date）
   │  │  ├─ random.ts                   mulberry32 可播种伪随机
   │  │  ├─ idFactory.ts                统一 ID 生成
   │  │  ├─ schemaMigration.ts          脏数据兜底 / schema 版本迁移
   │  │  └─ formatters.ts               统一数值 / 文案格式化
   │  ├─ usecases/
   │  │  └─ RelationshipTopologyUseCase.ts  ★ 用例编排，构造注入全部 out 端口
   │  └─ data/                     #    纯数据语料
   │     ├─ relationTypes.ts            8 种关系类型（名称 + 颜色 + 图标）
   │     ├─ topicLexicon.ts             话题词库（话题建议兜底）
   │     └─ demoPersons.ts              ★ 12 人示例数据 + 互动记录
   ├─ ports/                       # ② 端口层：只有 interface / type，无实现
   │  ├─ in/RelationshipTopologyUseCase.ts   入站端口（UI 可调用的业务能力面）
   │  └─ out/
   │     ├─ PersonRepository.ts          仓储抽象（含 RepositorySnapshot）
   │     ├─ ClockPort.ts                 时间抽象（todayIso / nowIso / timestampMillis）
   │     ├─ RandomPort.ts                随机抽象（nextSeed / createRng）
   │     ├─ GraphExporter.ts             SVG 导出抽象
   │     ├─ BackupGateway.ts             JSON 备份抽象
   │     └─ ClipboardPort.ts             剪贴板抽象
   ├─ adapters/                    # ③ 适配器层：唯一可触碰浏览器 API 与 Vue 的地方
   │  ├─ storage/LocalStoragePersonRepository.ts   localStorage（4 个 key + 迁移）
   │  ├─ export/
   │  │  ├─ TopologySvgExporter.ts       手写 SVG 字符串
   │  │  ├─ JsonBackupGateway.ts         JSON 序列化 / 解析 / 校验
   │  │  ├─ BrowserFileDownloader.ts     Blob 下载
   │  │  └─ BrowserClipboard.ts          剪贴板
   │  ├─ system/
   │  │  ├─ SystemClock.ts               new Date() 唯一出处
   │  │  └─ SeededRandomProvider.ts      Date.now() ⊕ crypto 生成种子
   │  └─ ui/
   │     ├─ composables/                 组合式逻辑（每个文件一个关注点）
   │     │  ├─ useTopology.ts            ★★ 唯一组合根（构造适配器 + 注入用例 + 对外 API）
   │     │  ├─ useForceLayout.ts         ★ 唯一 rAF 驱动（只调用 core 纯函数 stepLayout）
   │     │  ├─ useGraphViewport.ts       缩放 / 平移 / 拖拽节点的指针数学
   │     │  ├─ useGraphPresentation.ts   渲染数据派生（尺寸/颜色/淡化/标签可见性）
   │     │  ├─ usePersonActions.ts       人物管理意图（增删改 / 示例数据 / 重置）
   │     │  ├─ useBackupActions.ts       导出与备份意图
   │     │  ├─ useNotices.ts             轻量提示（Toast）状态
   │     │  ├─ useConfirmDialog.ts       二次确认状态机
   │     │  └─ useDrawer.ts              详情抽屉开关
   │     ├─ viewmodels/
   │     │  └─ personListCards.ts        人物卡片视图模型（搜索 + 筛选 + 排序）
   │     └─ components/                  19 个组件
   │        ├─ AppHeader.vue             ToastStack.vue          EmptyState.vue
   │        ├─ MetricCards.vue           GraphLegend.vue         GraphToolbar.vue
   │        ├─ ForceGraph.vue            TopologyWorkspace.vue
   │        ├─ PersonListPanel.vue       PersonCard.vue          PersonFormDialog.vue
   │        ├─ PersonDetailDrawer.vue    PersonOverview.vue
   │        ├─ InteractionTimeline.vue   InteractionForm.vue     MaintenanceAdviceList.vue
   │        ├─ RelationDistributionChart.vue  ExportDialog.vue    ConfirmDialog.vue
   ├─ styles/                      #    纯原生 CSS，按职责拆分并由 main.css 统一 @import
   │  ├─ main.css                      入口：设计令牌（CSS 变量）/ reset / 无障碍降级
   │  ├─ components.css                UI 套件：面板 / 按钮 / 徽标 / 工具类 / 对话框
   │  ├─ forms.css                     表单控件：字段 / 输入 / 下拉 / 滑杆 / 复选框
   │  ├─ animations.css                动画关键帧与响应式辅助
   │  └─ graph.css                     拓扑图 SVG 视觉（节点 / 连线 / 光晕 / 脉冲）
   ├─ App.vue                      App Shell（容器）
   └─ main.ts                      挂载入口
```

### 三层职责与依赖方向

```
        ┌──────────────────────── adapters ────────────────────────┐
        │  storage / export / system / ui(components + composables)│
        └───────────────┬─────────────────────────────────────────┘
                        │ 依赖（允许）
        ┌───────────────▼───────────────┐
        │            ports              │  只有 interface / type
        │  in/RelationshipTopologyUseCase│  out/PersonRepository,ClockPort,
        │                               │      RandomPort,GraphExporter,
        │                               │      BackupGateway,ClipboardPort
        └───────────────┬───────────────┘
                        │ 依赖（允许）
        ┌───────────────▼───────────────┐
        │             core              │  零框架、零浏览器 API、零 IO
        │  domain / services / usecases │
        │  data                         │
        └───────────────────────────────┘
```

**依赖方向只能是 `adapters → ports → core`**，反向依赖为零。可人工验证的硬性规则：

1. `core/**` 中**不存在** `vue` / `window` / `document` / `localStorage` / `Math.random()` / `Date.now()` / `new Date()` / `setTimeout` / `fetch`。
   - 时间 → `ClockPort`（`SystemClock` 是 `new Date()` 的唯一出处）
   - 随机 → `RandomPort`（`SeededRandomProvider` 提供种子，算法是 core 的 `mulberry32`）
   - 唯一 ID → `core/services/idFactory.ts`，随机源由端口注入
   - 日期历法换算 → `core/services/dateUtils.ts` 自研 civil-from-days / days-from-civil（与宿主机时区无关）
2. `ports/**` 只允许 `import type` 引用 `core/domain` 的类型，无任何函数体实现。
3. `requestAnimationFrame` **只出现在** `adapters/ui/composables/useForceLayout.ts`，且每次 tick 只调用 core 纯函数 `stepLayout`。
4. **组合根唯一**：`adapters/ui/composables/useTopology.ts`。它 `new` 出全部适配器并注入用例；组件只接收 props、只 emit 事件，不自行构造任何依赖。
5. 所有阈值 / 物理参数 / 颜色映射集中在 `core/domain/topologyConfig.ts`；组件与仿真中**没有内联魔法数字**（连 `r = 6 + intimacy*2.2` 的 `+6/+9` 光晕半径都来自 `CORE_HALO_EXTRA` / `DORMANT_PULSE_EXTRA`）。

---

## 🚀 启动与部署

### 本地开发（端口 5177）

```bash
cd zqq-05
npm install --cache /Users/chengzhiqiang/Documents/solokimi/origin-project/.npm-cache --no-audit --no-fund
npm run dev                # http://localhost:5177
```

### 生产构建与预览

```bash
npm run build              # vue-tsc -b && vite build（严格模式 0 error）
ls dist/index.html dist/assets
npm run preview
```

### Docker（Nginx 托管，端口 8085）

```bash
docker compose up -d --build      # 构建镜像并启动
# 访问 http://localhost:8085
docker compose down
```

或手动构建：

```bash
docker build -t zqq-05-relationship-topology .
docker run -d --name zqq-05 -p 8085:80 zqq-05-relationship-topology
```

`Dockerfile` 为多阶段构建（`node:22-alpine` 构建 → `nginx:1.27-alpine` 托管）；`nginx.conf` 开启 gzip（含 `application/javascript`、`application/json`）、静态资源 30 天缓存、`try_files $uri $uri/ /index.html` SPA fallback、安全响应头与 `error_page 500 502 503 504 /50x.html`。

---

## 🧪 数据与持久化

### localStorage 键名

| Key | 内容 | 结构 |
| --- | --- | --- |
| `zqq05:persons` | 人物数组 | `Person[]`：`{ id, name, relationType, intimacy, lastContactDate, topics[], note, contact, createdAt, updatedAt }` |
| `zqq05:interactions` | 互动记录数组（**独立 key**，不内嵌于 persons） | `Interaction[]`：`{ id, personId, date, kind, durationMinutes, note, feeling, createdAt }` |
| `zqq05:settings` | 设置 | `AppSettings`：`{ schemaVersion, theme: 'dark'\|'light', layoutSeed, filter: { mode: 'all'\|'core'\|'dormant', relationType }, showLabels }` |
| `zqq05:advice-dismissed` | 已处理的建议 ID 数组 | `string[]`（ID 形如 `personId::ruleName`，稳定可复现） |

> 互动记录采用**独立 key** 而非内嵌：单条互动增删只重写 `zqq05:interactions`，避免人物对象整体重写；同时便于按 `personId` 建立索引。

### schema 版本与迁移

- 当前 `SCHEMA_VERSION = 2`（`core/domain/topologyConfig.ts`）
- 载入时 `core/services/schemaMigration.ts` 逐条兜底：
  - 缺失 `intimacy` → `DEFAULT_INTIMACY = 5`；缺失 `topics` → `[]`；缺失 `relationType` → `other`
  - 非法或未来日期 → 夹回今天；**绝不抛错，也不产生 `Invalid Date`**
  - 重复 `id` 自动重新生成；指向不存在人物的互动记录被跳过并计数（`skippedRecords`）
  - 版本号兼容 `version`（备份文件）与 `schemaVersion`（设置对象）两种字段名
- 迁移发生后，界面上会显示「检测到旧版本数据，已自动补齐字段完成迁移（schema v2）」；存在被跳过的脏记录时另行提示条数
- 导入备份时若 `version > SCHEMA_VERSION`，直接拒绝并提示升级应用

### 导入 / 导出 / 重置

- **导出**：顶栏「导出/备份」→ SVG 标签页（复制源码 / 下载 `.svg`）或 JSON 标签页（下载 `zqq-05-relationship-topology-YYYY-MM-DD.json`）
- **导入**：JSON 标签页粘贴或选择文件 → 选择「合并」（按 id / 姓名去重，追加新数据）或「覆盖」（清空后整体替换，二次确认）→ 确认后所有派生数据立即重算
- **清空**：顶栏「清空」按钮（二次确认），只清空人物与互动，保留主题等设置
- **重置**：顶栏「重置」按钮（二次确认），删除全部 4 个 key 并恢复默认设置

---

## 🔧 高内聚低耦合重构说明

按「先实现 → 再显式重构」的要求，项目完成一轮结构化重构，共 10 项：

| # | 重构前的问题 | 重构后的措施 | 落地位置 |
| --- | --- | --- | --- |
| 1 | 阈值散落：`90`、`8`、`30`、`60`、`2.2`、`0.82`、`0.4–3` 等直接写在模板与循环里，改一个口径要全局搜 | 全部阈值 / 物理参数 / 配色收敛到 `core/domain/topologyConfig.ts`；组件与仿真一律 import 常量，连光晕外扩 `+6` / 脉冲外扩 `+9` / 回热 alpha 都有具名常量与注释 | `topologyConfig.ts`、`forceSimulation.ts`、`GraphLegend.vue`、`MetricCards.vue` |
| 2 | 业务算法写在组件里：组件内直接比较天数、算频次、拼建议文案 | 全部抽成 `core/services` 纯函数（`insightDetector` / `maintenanceAdvisor` / `contactFrequency` / `distributionStats` / `topologyBuilder` / `labelPlanner`）；组件只做渲染与事件转发 | `core/services/**`、`adapters/ui/components/**` |
| 3 | 组件直接 `localStorage.getItem/setItem`，脏数据导致 `Invalid Date` | 改为 `ports/out/PersonRepository` 接口 + `adapters/storage/LocalStoragePersonRepository` 实现；读取路径全部经过 `schemaMigration` 兜底，异常静默降级不阻断业务 | `ports/out/PersonRepository.ts`、`adapters/storage/LocalStoragePersonRepository.ts`、`core/services/schemaMigration.ts` |
| 4 | 组件里用 `Date.now()` 取「今天」、用 `Math.random()` 做初始布局，导致结果不可复现、无法测试 | 引入 `ClockPort` / `RandomPort` 出站端口，由构造注入；`core` 内彻底移除时间与随机 API；力导向初始布局改为 `mulberry32(seed)`，**同数据 + 同种子 = 同坐标** | `ports/out/ClockPort.ts`、`ports/out/RandomPort.ts`、`adapters/system/**`、`core/services/random.ts` |
| 5 | 一个巨型组件同时承担表单、列表、图、抽屉、导出，单文件超千行、职责混杂 | 按「容器组件 + 展示组件」拆分：`App.vue` 与 `PersonDetailDrawer.vue` 作为容器负责数据装配，13 个展示组件只接收 props / emit 事件；物理仿真从组件中剥离到 `useForceLayout`，物理计算再下沉到 `core` | `App.vue`、`adapters/ui/components/**`、`adapters/ui/composables/useForceLayout.ts` |
| 6 | ID、日期、数值各自为政：有的拼 `Date.now()+random`，有的写 `toLocaleDateString`，格式不统一且会输出 `Invalid Date` | 统一 ID 工厂 `createIdFactory(rng, prefix)`；统一 `dateUtils`（自研历法换算 + `YYYY-MM-DD` / 中文星期 / 月份 key）；统一 `formatters`（数字、百分比、天数、亲密度文案、时长、间隔），非法输入返回安全值 | `core/services/idFactory.ts`、`core/services/dateUtils.ts`、`core/services/formatters.ts` |
| 7 | 图与列表的状态各自维护，出现「筛选改了图没变」「改亲密度指标不同步」 | 唯一数据源：`RelationshipTopologyUseCase` 持有数据并在每次变更后重建不可变快照；`useTopology` 订阅快照并暴露只读派生状态，图 / 列表 / 指标卡 / 分布图共享同一份 `state` | `core/usecases/RelationshipTopologyUseCase.ts`、`adapters/ui/composables/useTopology.ts` |
| 8 | 适配器到处 `new`（组件里直接 import 实现类），替换存储或导出方式要改多个文件 | 组合根唯一：`useTopology.ts` 集中完成「实现 → 用例」注入；组件通过 `provide`/props 拿到统一 API，`ports/out` 的 5 个接口可独立替换（例如把 localStorage 换成 IndexedDB 只需新增一个适配器） | `adapters/ui/composables/useTopology.ts`、`ports/out/**` |

| 9 | 单文件过长：`ForceGraph.vue` 736 行、`App.vue` 542 行、`PersonListPanel.vue` 458 行、`PersonDetailDrawer.vue` 427 行，一个文件里混着模板、交互数学与样式，改一处要读全文 | 按职责拆成「一个文件一个主职责」：图组件拆出 `GraphToolbar`（工具栏）、`useGraphViewport`（指针数学）、`useGraphPresentation`（渲染数据派生）；App 拆出 `TopologyWorkspace`（三栏布局）、`ToastStack`（提示）、`useConfirmDialog`（确认状态机）；列表拆出 `PersonCard` 与 `personListCards` 视图模型；抽屉拆出 `PersonOverview`；`TopologyModels` 拆成 insight / export 两个模型文件并统一再导出；`forceSimulation` 拆出 `layoutMetrics`；`topologyBuilder` 拆出 `exportBuilder`；用例拆出 `viewStateAssembler` + `backupMerge`；组合根拆出 `usePersonActions` + `useBackupActions` + `useNotices`。所有 `.ts` ≤ 350 行、组件 ≤ 400 行 | 全量 `src/**` |
| 10 | 样式全塞在一个 `main.css` 与各组件的 `<style scoped>` 里，令牌、控件、动画、图视觉混在一起 | `main.css` 只保留设计令牌 / reset / 无障碍降级，其余按职责拆为 `components.css`（UI 套件）、`forms.css`（表单控件）、`animations.css`（动画与响应式）、`graph.css`（拓扑图 SVG 视觉），由 `main.css` 统一 `@import`（构建时内联，不产生额外请求） | `src/styles/*.css` |

此外还做了三项配套清理：
- `core/services/topologyBuilder.ts` 把「关系推断 + 连线数裁剪」与「导出坐标映射」分离，导出器只负责序列化字符串。
- `core/services/labelPlanner.ts` 把「标签何时显示 / 如何避让重叠」从渲染循环里抽出为纯函数，避免每帧在组件里写布局算法。
- `core/services/personValidator.ts` 新增 `applyPersonDraft` / `applyInteractionDraft`，把「草稿 → 实体」的字段拼装从用例中收口，消除新增与编辑两处重复代码。

---

## ✅ 验收自检

```bash
cd /Users/chengzhiqiang/Documents/solokimi/origin-project/zqq-05
npm install --cache /Users/chengzhiqiang/Documents/solokimi/origin-project/.npm-cache --no-audit --no-fund
npm run build                 # 必须 0 error
ls dist dist/assets           # dist/index.html + dist/assets/*
git log --oneline             # 至少一条 initial commit
git status --short            # 应为空
find src -type f | sort
```

**验收清单对照**

| 验收项 | 状态 | 位置 |
| --- | --- | --- |
| 1. `npm install` 成功 | ✅ | 使用共享缓存 `.npm-cache` |
| 2. `npm run build` 0 error（`vue-tsc` 严格模式） | ✅ | `package.json` → `vue-tsc -b && vite build` |
| 3. `dist/index.html` 与 `dist/assets/*` 生成 | ✅ | 见最后自检输出 |
| 4. `git init` + initial commit + `git status --short` 为空 | ✅ | 提交信息见下 |
| 5. `Dockerfile` / `nginx.conf` / `docker-compose.yml` / `.dockerignore` / `README.md` / `.gitignore` 齐全，compose 端口 `8085:80` | ✅ | 仓库根目录 |
| 6. 分层与依赖方向符合规范；README 含「高内聚低耦合重构说明」（≥6 条） | ✅ | 上文 10 条重构说明 |
| 7. 无 `any` / `@ts-ignore`；`dependencies` 只有 `vue` | ✅ | `package.json` |
| 8. 示例数据下同时可见核心圈层光晕、疏远预警脉冲、不同颜色/粗细连线；点击节点可见时间轴与建议清单 | ✅ | 「载入示例」后：核心圈层 4 个光晕环、疏远预警 3 个脉冲环（提醒/警告/严重各 1）、连线粗细覆盖 0.8–8px 区间并含虚线 |

**无障碍与降级**

- 所有可交互元素均有 `:hover` / `:focus-visible` / `:disabled` 态，并有 `aria-label` 或可见文本；图上节点可 `Tab` 聚焦、`Enter` / `Space` 打开详情
- 三态齐全：**空态**（`EmptyState` 引导载入示例 / 新增人物）、**加载进行中态**（布局计算中的 spinner + 图例区 alpha/运行状态）、**校验错误态**（字段就近 `role="alert"` + 表单底部汇总）
- `@media (prefers-reduced-motion: reduce)` 关闭全部动画与过渡
- 响应式三档：**≥1200** 三栏（列表 / 拓扑图+图例 / 分布图）、**768–1199** 两栏（分布图整行下移）、**<768** 单栏 + 抽屉改全屏面板，任何档位都不出现横向滚动
