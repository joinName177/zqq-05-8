/**
 * F1：一键载入的 12 人示例数据（含历史互动记录）。
 *
 * 设计目标 —— 覆盖验收清单要求的三类场景 + 全部 7 条维护建议规则：
 *   核心圈层（亲密度 ≥ 8）：妈妈 / 爸爸 / 林悦 / 陈默
 *   疏远预警（> 90 天）：王志远（96 天·提醒）/ 何嘉（150 天·警告）/ 李阿姨（210 天·严重）
 *   正常维护：周雨桐 / 苏晴（规则 7「关系维护良好」）
 *   规则 2：陈默（核心圈层 + 34 天未联系）      规则 3：孙哲（亲密度 3 + 近 30 天 6 次互动）
 *   规则 4：郑宇（45 天前冲突后彻底沉默）        规则 5：李阿姨（无任何话题标签）
 *   规则 6：罗一鸣（主观感受从 5 掉到 2，换算亲密度下降 6 分）
 *   最近联系「来源」两种都覆盖：李阿姨无互动记录 → 回落到录入值
 *
 * 所有日期以「今天」为基准按天偏移生成，因此任何时候载入都能复现三类场景。
 */

import { DEMO_PERSON_COUNT } from '../domain/topologyConfig';
import type { Person, RelationTypeId } from '../domain/PersonModels';
import type { Interaction, InteractionKind } from '../domain/InteractionModels';
import type { DemoDataset } from '../domain/TopologyModels';
import { addDays, composeTimestamp } from '../services/dateUtils';

interface DemoInteractionSeed {
  dayOffset: number;
  kind: InteractionKind;
  durationMinutes: number | null;
  note: string;
  feeling: number;
}

interface DemoPersonSeed {
  id: string;
  name: string;
  relationType: RelationTypeId;
  intimacy: number;
  /** 录入时填写的最近联系时间（无互动记录时作为回落值） */
  lastContactOffset: number;
  topics: string[];
  note: string;
  contact: string;
  interactions: DemoInteractionSeed[];
}

const DEMO_PERSONS: readonly DemoPersonSeed[] = [
  {
    id: 'demo-mom',
    name: '妈妈',
    relationType: 'family',
    intimacy: 10,
    lastContactOffset: 3,
    topics: ['家常近况', '父母健康'],
    note: '每周至少一次视频，习惯报平安。',
    contact: '微信 / 138****0001',
    interactions: [
      { dayOffset: 3, kind: 'call', durationMinutes: 42, note: '聊家里装修和体检报告', feeling: 5 },
      { dayOffset: 10, kind: 'meet', durationMinutes: 180, note: '回家吃饭', feeling: 5 },
      { dayOffset: 25, kind: 'message', durationMinutes: null, note: '发了体检预约截图', feeling: 4 },
      { dayOffset: 40, kind: 'gift', durationMinutes: null, note: '寄了护腰靠垫', feeling: 5 },
      { dayOffset: 55, kind: 'call', durationMinutes: 25, note: '例行问候', feeling: 4 },
      { dayOffset: 70, kind: 'meet', durationMinutes: 240, note: '中秋一起吃饭', feeling: 5 },
      { dayOffset: 85, kind: 'message', durationMinutes: null, note: '提醒加衣服', feeling: 4 }
    ]
  },
  {
    id: 'demo-dad',
    name: '爸爸',
    relationType: 'family',
    intimacy: 9,
    lastContactOffset: 12,
    topics: ['家常近况', '钓鱼'],
    note: '话不多，但对钓鱼话题很健谈。',
    contact: '电话 / 139****0002',
    interactions: [
      { dayOffset: 12, kind: 'call', durationMinutes: 18, note: '问了钓鱼竿的事', feeling: 4 },
      { dayOffset: 30, kind: 'meet', durationMinutes: 200, note: '一起吃饭', feeling: 5 },
      { dayOffset: 50, kind: 'message', durationMinutes: null, note: '分享水库钓点', feeling: 4 },
      { dayOffset: 72, kind: 'activity', durationMinutes: 300, note: '一起去钓鱼', feeling: 5 }
    ]
  },
  {
    id: 'demo-linyue',
    name: '林悦',
    relationType: 'bestFriend',
    intimacy: 9,
    lastContactOffset: 5,
    topics: ['旅行', '电影', '咖啡'],
    note: '大学室友，可以随时打电话吐槽的人。',
    contact: '微信 / linyue_wx',
    interactions: [
      { dayOffset: 5, kind: 'meet', durationMinutes: 150, note: '新开的咖啡馆探店', feeling: 5 },
      { dayOffset: 9, kind: 'message', durationMinutes: null, note: '推荐了一部纪录片', feeling: 5 },
      { dayOffset: 18, kind: 'call', durationMinutes: 66, note: '聊她的转岗纠结', feeling: 5 },
      { dayOffset: 33, kind: 'activity', durationMinutes: 420, note: '周边徒步', feeling: 4 },
      { dayOffset: 61, kind: 'meet', durationMinutes: 120, note: '看完电影吃夜宵', feeling: 5 }
    ]
  },
  {
    id: 'demo-chenmo',
    name: '陈默',
    relationType: 'bestFriend',
    intimacy: 8,
    lastContactOffset: 34,
    topics: ['编程', '桌游'],
    note: '核心圈层里最近被工作挤占的一位。',
    contact: '微信 / chenmo_dev',
    interactions: [
      { dayOffset: 34, kind: 'message', durationMinutes: null, note: '问他项目上线情况', feeling: 4 },
      { dayOffset: 66, kind: 'meet', durationMinutes: 180, note: '桌游局', feeling: 5 },
      { dayOffset: 95, kind: 'call', durationMinutes: 55, note: '聊职业规划', feeling: 4 }
    ]
  },
  {
    id: 'demo-suqing',
    name: '苏晴',
    relationType: 'colleague',
    intimacy: 6,
    lastContactOffset: 8,
    topics: ['项目进展', '加班'],
    note: '同组搭档，配合默契。',
    contact: '企业微信 / suqing',
    interactions: [
      { dayOffset: 8, kind: 'meet', durationMinutes: 60, note: '周会对齐排期', feeling: 4 },
      { dayOffset: 15, kind: 'message', durationMinutes: null, note: '同步接口文档', feeling: 4 },
      { dayOffset: 22, kind: 'activity', durationMinutes: 90, note: '一起加班到很晚', feeling: 3 },
      { dayOffset: 29, kind: 'call', durationMinutes: 30, note: '临时问题排查', feeling: 4 },
      { dayOffset: 44, kind: 'meet', durationMinutes: 45, note: '季度复盘', feeling: 4 }
    ]
  },
  {
    id: 'demo-wangzhiyuan',
    name: '王志远',
    relationType: 'colleague',
    intimacy: 5,
    lastContactOffset: 96,
    topics: ['行业动态', '融资'],
    note: '前同事，行业信息很灵通。',
    contact: '微信 / wzy_industry',
    interactions: [
      { dayOffset: 96, kind: 'call', durationMinutes: 35, note: '聊了他跳槽的进展', feeling: 4 },
      { dayOffset: 130, kind: 'message', durationMinutes: null, note: '转了一篇行业报告', feeling: 3 }
    ]
  },
  {
    id: 'demo-zhouyutong',
    name: '周雨桐',
    relationType: 'classmate',
    intimacy: 7,
    lastContactOffset: 21,
    topics: ['音乐', '考研'],
    note: '高中同学，一直保持低频但稳定的联系。',
    contact: '微信 / zyt_music',
    interactions: [
      { dayOffset: 21, kind: 'message', durationMinutes: null, note: '问她考研复试结果', feeling: 4 },
      { dayOffset: 45, kind: 'meet', durationMinutes: 120, note: '同学小聚', feeling: 4 },
      { dayOffset: 77, kind: 'activity', durationMinutes: 180, note: '一起看现场演出', feeling: 5 }
    ]
  },
  {
    id: 'demo-hejia',
    name: '何嘉',
    relationType: 'classmate',
    intimacy: 4,
    lastContactOffset: 150,
    topics: ['游戏'],
    note: '只在游戏里见过，线下几乎没来往。',
    contact: 'QQ / hejia_game',
    interactions: [
      { dayOffset: 150, kind: 'message', durationMinutes: null, note: '约了一局排位', feeling: 3 },
      { dayOffset: 190, kind: 'activity', durationMinutes: 90, note: '线上开黑', feeling: 4 }
    ]
  },
  {
    id: 'demo-zhengyu',
    name: '郑宇',
    relationType: 'partner',
    intimacy: 6,
    lastContactOffset: 45,
    topics: ['创业', '融资'],
    note: '合作过的创业者，一次分歧后就没再联系。',
    contact: '微信 / zhengyu_biz',
    interactions: [
      { dayOffset: 45, kind: 'conflict', durationMinutes: 40, note: '为分成比例起了争执', feeling: 2 },
      { dayOffset: 90, kind: 'meet', durationMinutes: 75, note: '谈项目二期方案', feeling: 4 },
      { dayOffset: 120, kind: 'message', durationMinutes: null, note: '发了合同初稿', feeling: 4 }
    ]
  },
  {
    id: 'demo-liayi',
    name: '李阿姨',
    relationType: 'acquaintance',
    intimacy: 2,
    lastContactOffset: 210,
    topics: [],
    note: '小区邻居，只在楼道里打过招呼；没有互动记录，最近联系时间取自录入值。',
    contact: '',
    interactions: []
  },
  {
    id: 'demo-sunzhe',
    name: '孙哲',
    relationType: 'ex',
    intimacy: 3,
    lastContactOffset: 4,
    topics: ['边界感', '共同朋友'],
    note: '分手后仍在同一朋友圈，互动频繁但亲密度定位很低。',
    contact: '微信 / sunzhe_',
    interactions: [
      { dayOffset: 4, kind: 'message', durationMinutes: null, note: '问共同朋友的婚礼安排', feeling: 3 },
      { dayOffset: 7, kind: 'message', durationMinutes: null, note: '确认份子钱金额', feeling: 3 },
      { dayOffset: 11, kind: 'call', durationMinutes: 12, note: '沟通行程', feeling: 3 },
      { dayOffset: 16, kind: 'message', durationMinutes: null, note: '转发婚礼地址', feeling: 4 },
      { dayOffset: 21, kind: 'meet', durationMinutes: 30, note: '在婚礼上碰面', feeling: 2 },
      { dayOffset: 26, kind: 'apology', durationMinutes: null, note: '为之前的语气道歉', feeling: 4 }
    ]
  },
  {
    id: 'demo-luoyiming',
    name: '罗一鸣',
    relationType: 'other',
    intimacy: 5,
    lastContactOffset: 20,
    topics: ['摄影', '徒步', '旅行'],
    note: '摄影社认识的朋友，最近几次相处体验明显变差。',
    contact: '微信 / luo_photo',
    interactions: [
      { dayOffset: 20, kind: 'meet', durationMinutes: 90, note: '约拍，对方迟到很久', feeling: 2 },
      { dayOffset: 25, kind: 'message', durationMinutes: null, note: '催要照片，语气不太好', feeling: 2 },
      { dayOffset: 58, kind: 'activity', durationMinutes: 300, note: '一起爬山拍日出', feeling: 5 },
      { dayOffset: 75, kind: 'meet', durationMinutes: 150, note: '外拍交流器材', feeling: 5 }
    ]
  }
];

/**
 * 生成示例数据（确定性：只依赖传入的「今天」与时间戳，不使用任何系统时间/随机数）。
 */
export function buildDemoDataset(todayIso: string, timestampIso: string): DemoDataset {
  const persons: Person[] = [];
  const interactions: Interaction[] = [];
  let interactionCounter = 0;

  for (const seed of DEMO_PERSONS) {
    const fallbackDate = addDays(todayIso, -seed.lastContactOffset);
    persons.push({
      id: seed.id,
      name: seed.name,
      relationType: seed.relationType,
      intimacy: seed.intimacy,
      lastContactDate: fallbackDate,
      topics: [...seed.topics],
      note: seed.note,
      contact: seed.contact,
      createdAt: composeTimestamp(addDays(todayIso, -240), '09:00:00'),
      updatedAt: timestampIso
    });

    for (const item of seed.interactions) {
      interactionCounter += 1;
      const date = addDays(todayIso, -item.dayOffset);
      interactions.push({
        id: `demo-int-${String(interactionCounter).padStart(3, '0')}`,
        personId: seed.id,
        date,
        kind: item.kind,
        durationMinutes: item.durationMinutes,
        note: item.note,
        feeling: item.feeling,
        createdAt: composeTimestamp(date, '12:00:00')
      });
    }
  }

  return { persons, interactions };
}

/** 示例数据人数（用于 UI 提示与验收自检） */
export function demoPersonCount(): number {
  return DEMO_PERSONS.length;
}

/** 断言示例数据规模符合验收要求（12 人） */
export function isDemoDatasetComplete(): boolean {
  return DEMO_PERSONS.length === DEMO_PERSON_COUNT;
}
