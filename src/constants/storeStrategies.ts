export interface StoreStrategy {
  tier: string;
  name: string;
  target: string;
  area: string;
  budget: string;
  signageStrategy: string;
  interiorStrategy: string;
  materialSourcing: string;
  costBreakdown: {
    hardDecor: string;
    props: string;
  };
  keyPrinciples: string[];
  // English version
  en: {
    name: string;
    target: string;
    materialSourcing: string;
    keyPrinciples: string[];
  };
}

export const STORE_STRATEGIES: Record<string, StoreStrategy> = {
  'L1': {
    tier: 'L1',
    name: '旗舰体验店 (Flagship Store)',
    target: '主要大城市核心商圈 (Major Cities)',
    area: '> 100㎡',
    budget: '$15,000 - $35,000',
    signageStrategy: '最高规格全套SI：场景化展示体验，国内定制铝塑板 + 亚克力发光字门头，优质用材与灯光',
    interiorStrategy: '场景化展示体验为主：大型体验区 + 独立收银区 + 全品类陈列区。包含生活方式场景化展示，超大店面空间。',
    materialSourcing: '95% 国内标准化定制 + 5% 本地辅料',
    costBreakdown: {
      hardDecor: '$100 - 200/㎡',
      props: '$80 - 150/㎡'
    },
    keyPrinciples: ['品牌传播', '场景化体验', '数字化运营'],
    en: {
      name: 'Flagship Store',
      target: 'Major City Centers',
      materialSourcing: '95% Domestic Standardized Customization + 5% Local Materials',
      keyPrinciples: ['Brand Communication', 'Scene-based Experience', 'Digital Operation']
    }
  },
  'L3': {
    tier: 'L3',
    name: '标准店 (Standard Store)',
    target: '次级区域中心/繁忙街道 (Secondary Regional Centers)',
    area: '40㎡ ~ 60㎡',
    budget: '$8,500 (以 40㎡ 为准)',
    signageStrategy: '红色铝塑板门头 + 3D亚克力发光字',
    interiorStrategy: '统一品牌货架与中岛陈列。高效零售：核心道具国内供，简化吊顶与地面工艺。',
    materialSourcing: '40% 国内产 + 60% 本地化',
    costBreakdown: {
      hardDecor: '$4,000',
      props: '$4,500'
    },
    keyPrinciples: ['品牌货架', '中岛陈列', '红色铝塑板'],
    en: {
      name: 'Standard Store',
      target: 'Secondary Regional Centers',
      materialSourcing: '40% Domestic Production + 60% Localization',
      keyPrinciples: ['Brand Shelves', 'Island Display', 'Red ACP Facade']
    }
  },
  'L4': {
    tier: 'L4',
    name: '专区店 (Special Zone Store)',
    target: '商场专区、Mall 专区、KA 专区 (Malls, KA Stores)',
    area: '10㎡ ~ 30㎡',
    budget: '$3,000 - $6,000',
    signageStrategy: '商场专区/KA 柜台物料：发光背景墙 + 立体 LOGO',
    interiorStrategy: '店中店模式：采用标准的柜体和背板物料，专注核心单品展示。',
    materialSourcing: '60% 国内产 + 40% 本地化',
    costBreakdown: {
      hardDecor: '$1,500 - $2,500',
      props: '$1,500 - $3,500'
    },
    keyPrinciples: ['店中店', 'KA 专柜', '高亮背板'],
    en: {
      name: 'Special Zone Store',
      target: 'Malls, KA Zones',
      materialSourcing: '60% Domestic Production + 40% Localization',
      keyPrinciples: ['Shop-in-Shop', 'KA Counter', 'Backlit Brand Wall']
    }
  },
  'L5': {
    tier: 'L5',
    name: '挂牌店 (Signage Store)',
    target: '乡村、社区、合作门店 (Villages, Communities, Partner Stores)',
    area: '5㎡ ~ 15㎡',
    budget: '$300 - $800',
    signageStrategy: '喷绘布店招：在现有门头安装 itel Home 喷绘布店招',
    interiorStrategy: '低成本植入：店主自备货架，仅进行品牌形象挂牌和少量物料支持。',
    materialSourcing: '5% 国内核心物料 + 95% 本地化',
    costBreakdown: {
      hardDecor: '$100 - $300',
      props: '$200 - $500'
    },
    keyPrinciples: ['喷绘布店招', '自备货架', '极低成本'],
    en: {
      name: 'Signage Store',
      target: 'Villages, Communities, Partner Stores',
      materialSourcing: '5% Domestic Core Materials + 95% Localization',
      keyPrinciples: ['Vinyl/Flex Signage', 'Owner Shelves', 'Minimal Cost']
    }
  }
};
