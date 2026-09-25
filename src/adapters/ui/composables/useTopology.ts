/**
 * 组合根（唯一）：在这里完成「适配器实现 → 用例」的依赖注入，并向 Vue 组件暴露状态与意图。
 *
 * 依赖方向：components → useTopology → usecases → ports/out ← adapters
 * 组件不得自行 new 任何适配器，也不得直接 import core/services。
 */

import {
  computed,
  onBeforeUnmount,
  shallowRef,
  watchEffect,
  type ComputedRef,
  type Ref,
  type ShallowRef
} from 'vue';
import type { Person, PersonDraft } from '../../../core/domain/PersonModels';
import type { InteractionDraft } from '../../../core/domain/InteractionModels';
import { firstValidationError } from '../../../core/domain/errors';
import { demoPersonCount } from '../../../core/data/demoPersons';
import type {
  AdviceViewItem,
  FrequencyInfo,
  LayoutState,
  GraphFilterMode,
  ImportMode,
  ImportOutcome,
  RelationFilter,
  ThemeMode,
  TimelineMonth,
  TopologyViewState
} from '../../../core/domain/TopologyModels';
import { buildTimeline, groupTimelineByMonth } from '../../../core/services/contactFrequency';
import { buildLayoutSeeds } from '../../../core/services/topologyBuilder';
import { RelationshipTopologyUseCase } from '../../../core/usecases/RelationshipTopologyUseCase';
import { BrowserClipboard } from '../../export/BrowserClipboard';
import { JsonBackupGateway } from '../../export/JsonBackupGateway';
import { TopologySvgExporter } from '../../export/TopologySvgExporter';
import { LocalStoragePersonRepository } from '../../storage/LocalStoragePersonRepository';
import { SeededRandomProvider } from '../../system/SeededRandomProvider';
import { SystemClock } from '../../system/SystemClock';
import { useBackupActions } from './useBackupActions';
import { useDrawer, type DrawerApi } from './useDrawer';
import { useForceLayout, type ForceLayoutApi } from './useForceLayout';
import { useNotices, type NoticeMessage } from './useNotices';
import { usePersonActions } from './usePersonActions';

export type { NoticeMessage } from './useNotices';

export interface TopologyApp {
  state: ShallowRef<TopologyViewState>;
  persons: ComputedRef<Person[]>;
  settings: ComputedRef<TopologyViewState['settings']>;
  insights: ComputedRef<TopologyViewState['insights']>;
  stats: ComputedRef<TopologyViewState['insights']['stats']>;
  topology: ComputedRef<TopologyViewState['topology']>;
  distribution: ComputedRef<TopologyViewState['distribution']>;
  today: ComputedRef<string>;
  personById: ComputedRef<Record<string, Person>>;
  storageAvailable: ComputedRef<boolean>;
  demoCount: number;

  graph: ForceLayoutApi;
  /** 以下四项直接暴露给模板（避免模板里写 graph.layout.value 这类嵌套 ref 访问） */
  layout: ComputedRef<LayoutState | null>;
  graphAlpha: ComputedRef<number>;
  graphPaused: ComputedRef<boolean>;
  graphRunning: ComputedRef<boolean>;
  graphSettled: ComputedRef<boolean>;
  drawer: DrawerApi;
  drawerOpen: ComputedRef<boolean>;
  selectedPersonId: ComputedRef<string | null>;
  selectPerson(personId: string): void;
  closeDrawer(): void;

  notices: Ref<NoticeMessage[]>;
  notify(text: string, tone?: NoticeMessage['tone']): void;
  dismissNotice(id: number): void;

  newPersonDraft(): PersonDraft;
  editPersonDraft(person: Person): PersonDraft;
  newInteractionDraft(): InteractionDraft;

  savePerson(personId: string | null, draft: PersonDraft): boolean;
  removePerson(personId: string): void;
  clearAll(): void;
  loadDemoData(): void;
  resetAll(): void;
  adjustIntimacy(personId: string, intimacy: number): void;

  addInteraction(personId: string, draft: InteractionDraft): boolean;
  removeInteraction(interactionId: string): void;

  adviceFor(personId: string): AdviceViewItem[];
  timelineFor(personId: string): TimelineMonth[];
  frequencyFor(personId: string): FrequencyInfo | null;

  toggleAdviceHandled(adviceId: string): void;
  setFilterMode(mode: GraphFilterMode): void;
  setRelationFilter(relationType: RelationFilter): void;
  setTheme(theme: ThemeMode): void;
  toggleTheme(): void;
  setShowLabels(value: boolean): void;
  relayout(): void;

  exportBackupJson(): string;
  downloadBackup(): void;
  importBackup(raw: string, mode: ImportMode): ImportOutcome;
  buildSvgText(): string;
  downloadSvg(): void;
  copySvgText(): Promise<boolean>;
}

export function useTopology(): TopologyApp {
  /* ---------------- 适配器（出站端口实现） ---------------- */
  const clock = new SystemClock();
  const random = new SeededRandomProvider();
  const repository = new LocalStoragePersonRepository(clock, random);
  const exporter = new TopologySvgExporter();
  const backupGateway = new JsonBackupGateway(clock, random);
  const clipboard = new BrowserClipboard();

  /* ---------------- 用例（注入完成） ---------------- */
  const useCase = new RelationshipTopologyUseCase(repository, clock, random, exporter, backupGateway, clipboard);

  const state = shallowRef<TopologyViewState>(useCase.getState());
  const unsubscribe = useCase.subscribe(() => {
    state.value = useCase.getState();
  });
  onBeforeUnmount(unsubscribe);

  const drawer = useDrawer();
  const layoutSeeds = computed(() => buildLayoutSeeds(state.value.topology));
  const graph = useForceLayout({
    nodeSeeds: computed(() => layoutSeeds.value.nodeSeeds),
    edgeSeeds: computed(() => layoutSeeds.value.edgeSeeds),
    seed: computed(() => state.value.settings.layoutSeed)
  });

  /* ---------------- 主题令牌写入 <html data-theme> ---------------- */
  watchEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = state.value.settings.theme;
  });

  /* ---------------- 轻量提示 ---------------- */
  const noticesApi = useNotices();

  /* ---------------- 派生状态 ---------------- */
  const persons = computed(() => state.value.persons);
  const settings = computed(() => state.value.settings);
  const insights = computed(() => state.value.insights);
  const stats = computed(() => state.value.insights.stats);
  const topology = computed(() => state.value.topology);
  const distribution = computed(() => state.value.distribution);
  const today = computed(() => state.value.today);
  const storageAvailable = computed(() => repository.isAvailable());
  const personById = computed(() => {
    const map: Record<string, Person> = {};
    for (const person of state.value.persons) map[person.id] = person;
    return map;
  });
  const handledAdviceIds = computed(() => new Set(state.value.handledAdviceIds));
  const layout = computed(() => graph.layout.value);
  const graphAlpha = computed(() => graph.alpha.value);
  const graphPaused = computed(() => graph.paused.value);
  const graphRunning = computed(() => graph.running.value);
  const graphSettled = computed(() => graph.settled.value);
  const drawerOpen = computed(() => drawer.isOpen.value);
  const selectedPersonId = computed(() => drawer.selectedPersonId.value);

  function selectPerson(personId: string): void {
    drawer.open(personId);
  }

  function closeDrawer(): void {
    drawer.close();
  }

  if (!repository.isAvailable()) {
    noticesApi.notify('浏览器禁用了 localStorage，本次数据仅保存在内存中', 'error');
  } else if (state.value.migrated) {
    noticesApi.notify('检测到旧版本数据，已自动补齐字段完成迁移', 'info');
  }

  /* ---------------- 意图 ---------------- */

  const personActions = usePersonActions(useCase, {
    getToday: () => state.value.today,
    getPersonById: () => personById.value,
    notify: noticesApi.notify,
    closeDrawer: () => drawer.close()
  });

  function addInteraction(personId: string, draft: InteractionDraft): boolean {
    const result = useCase.addInteraction(personId, draft);
    if (!result.valid) {
      noticesApi.notify(firstValidationError(result), 'error');
      return false;
    }
    noticesApi.notify('已新增互动记录，最近联系时间与预警已重算', 'success');
    return true;
  }

  function removeInteraction(interactionId: string): void {
    useCase.removeInteraction(interactionId);
    noticesApi.notify('已删除该条互动记录', 'success');
  }

  function adviceFor(personId: string): AdviceViewItem[] {
    const list = state.value.adviceByPerson[personId] ?? [];
    return list.map((advice) => ({ advice, handled: handledAdviceIds.value.has(advice.id) }));
  }

  function timelineFor(personId: string): TimelineMonth[] {
    const list = state.value.interactionIndex[personId] ?? [];
    return groupTimelineByMonth(buildTimeline(list, state.value.today));
  }

  function frequencyFor(personId: string): FrequencyInfo | null {
    const node = state.value.topology.nodes.find((item) => item.person.id === personId);
    return node ? node.frequency : null;
  }

  function toggleAdviceHandled(adviceId: string): void {
    useCase.toggleAdviceHandled(adviceId);
  }

  function setFilterMode(mode: GraphFilterMode): void {
    useCase.setFilter({ ...state.value.settings.filter, mode });
  }

  function setRelationFilter(relationType: RelationFilter): void {
    useCase.setFilter({ ...state.value.settings.filter, relationType });
  }

  function setTheme(theme: ThemeMode): void {
    useCase.setTheme(theme);
  }

  function toggleTheme(): void {
    useCase.setTheme(state.value.settings.theme === 'dark' ? 'light' : 'dark');
  }

  function setShowLabels(value: boolean): void {
    useCase.setShowLabels(value);
  }

  function relayout(): void {
    const seed = useCase.regenerateLayoutSeed();
    graph.reseed(seed);
    noticesApi.notify('已使用新种子重新布局', 'success');
  }

  const backupActions = useBackupActions(useCase, {
    getLayout: () => graph.layout.value,
    notify: noticesApi.notify,
    onImported: () => graph.reheat()
  });

  return {
    state,
    persons,
    settings,
    insights,
    stats,
    topology,
    distribution,
    today,
    personById,
    storageAvailable,
    demoCount: demoPersonCount(),
    graph,
    layout,
    graphAlpha,
    graphPaused,
    graphRunning,
    graphSettled,
    drawer,
    drawerOpen,
    selectedPersonId,
    selectPerson,
    closeDrawer,
    notices: noticesApi.notices,
    notify: noticesApi.notify,
    dismissNotice: noticesApi.dismissNotice,
    newPersonDraft: personActions.newPersonDraft,
    editPersonDraft: personActions.editPersonDraft,
    newInteractionDraft: personActions.newInteractionDraft,
    savePerson: personActions.savePerson,
    removePerson: personActions.removePerson,
    clearAll: personActions.clearAll,
    loadDemoData: personActions.loadDemoData,
    resetAll: personActions.resetAll,
    adjustIntimacy: personActions.adjustIntimacy,
    addInteraction,
    removeInteraction,
    adviceFor,
    timelineFor,
    frequencyFor,
    toggleAdviceHandled,
    setFilterMode,
    setRelationFilter,
    setTheme,
    toggleTheme,
    setShowLabels,
    relayout,
    exportBackupJson: backupActions.exportBackupJson,
    downloadBackup: backupActions.downloadBackup,
    importBackup: backupActions.importBackup,
    buildSvgText: backupActions.buildSvgText,
    downloadSvg: backupActions.downloadSvg,
    copySvgText: backupActions.copySvgText
  };
}
