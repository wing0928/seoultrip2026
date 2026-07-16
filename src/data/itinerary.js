import { routeMapUrl, searchMapUrl } from '../utils/maps.js';

export const periods = ['上午', '中午', '下午', '晚上'];

function stop(id, time, period, name, type, area, note, extra = {}) {
  return { id, time, period, name, type, area, note, ...extra };
}

function normalizeStopTime(time = '') {
  const matched = String(time).match(/^(\d{1,2})(?::|時)\s*(\d{1,2})/);
  if (!matched) return time;
  const hours = Math.min(23, Math.max(0, Number(matched[1])));
  const minutes = Math.min(59, Math.max(0, Number(matched[2])));
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

const rawDays = [
  {
    id: 'day-1',
    date: '2026/8/17',
    title: '抵達首爾、機場交通、入住',
    areaFocus: '機場 / 住宿附近',
    note: '第一天保留體力，重點是順利抵達、買交通卡、入住與附近簡單吃飯。',
    stops: [
      stop('d1-1', '上午', '上午', '抵達仁川 / 金浦機場', '交通', '機場', '確認行李、換匯或領 WOWPASS，先把 T-money / 交通卡處理好。'),
      stop('d1-2', '中午', '中午', '機場前往住宿', '交通', '住宿附近', '依實際住宿補 AREX、機場巴士或地鐵路線。'),
      stop('d1-3', '下午', '下午', '飯店入住與休息', '休息', '住宿附近', '放行李、整理網路與充電設備，不安排遠距離移動。'),
      stop('d1-4', '晚上', '晚上', '住宿附近晚餐散步', '美食', '住宿附近', '找附近湯飯、炸雞或便利商店補給，早點休息。')
    ]
  },
  {
    id: 'day-2',
    date: '2026/8/18',
    title: '景福宮、北村韓屋村、三清洞',
    areaFocus: '景福宮 / 北村 / 安國',
    note: '古宮與韓屋村排在同一天，移動距離短，也適合拍照與慢慢散步。',
    stops: [
      stop('d2-1', '09:30', '上午', '景福宮', '景點', '景福宮', '早上光線好、人較少，可加看守門將交接儀式。', { nameKo: '경복궁', nameZh: '景福宮' }),
      stop('d2-2', '12:00', '中午', '安國豬肉湯飯', '美食', '安國', '把豬肉湯飯安排成早午餐或午餐，暖胃又不會太趕。'),
      stop('d2-3', '14:00', '下午', '北村韓屋村', '景點', '北村', '穿好走的鞋，坡道多；拍照時留意居民生活區。', { nameKo: '북촌한옥마을', nameZh: '北村韓屋村' }),
      stop('d2-4', '16:00', '下午', '三清洞咖啡與小店', '咖啡廳', '三清洞', '逛選物店、咖啡廳休息，節奏放慢。'),
      stop('d2-5', '18:30', '晚上', '仁寺洞 / 鐘路晚餐', '美食', '鐘路', '可找韓定食、煎餅或傳統茶館收尾。')
    ]
  },
  {
    id: 'day-3',
    date: '2026/8/19',
    title: '聖水洞一日：咖啡、選物、快閃店',
    areaFocus: '聖水洞',
    note: '聖水洞很適合排半天到一天，咖啡廳、品牌店、快閃與倉庫改造空間密集。',
    stops: [
      stop('d3-1', '10:30', '上午', '聖水站', '交通', '聖水', '從住宿出發到聖水站，先確認回程末班或轉乘方式。', { nameKo: '성수역', nameZh: '聖水站' }),
      stop('d3-2', '11:00', '上午', '聖水洞咖啡街', '咖啡廳', '聖水', '找一間想拍照的咖啡廳開場，避開下午尖峰。'),
      stop('d3-3', '13:00', '中午', '聖水洞午餐', '美食', '聖水', '可選韓式餐廳、漢堡、義式或熱門排隊店。'),
      stop('d3-4', '15:00', '下午', '聖水選物店與品牌旗艦店', '逛街', '聖水', 'Tamburins、ADER、服飾選物與期間限定快閃都可放這段。'),
      stop('d3-5', '18:30', '晚上', '建大 / 聖水烤肉晚餐', '美食', '聖水', '把烤肉安排在這晚，移動少、吃完可以直接回住宿。')
    ]
  },
  {
    id: 'day-4',
    date: '2026/8/20',
    title: '漢南洞、梨泰院、漢江傍晚',
    areaFocus: '漢南洞 / 梨泰院 / 漢江',
    note: '漢南洞與梨泰院距離近，下午接漢江很順，晚上可以看夜景或吃異國料理。',
    stops: [
      stop('d4-1', '10:30', '上午', '漢南洞小店散步', '逛街', '漢南', '選物店、服飾、香氛與生活風格店集中，適合慢逛。'),
      stop('d4-2', '12:30', '中午', '漢南洞午餐', '美食', '漢南', '可找熱門韓食、早午餐或排隊餐廳。'),
      stop('d4-3', '14:30', '下午', '梨泰院街區', '逛街', '梨泰院', '順路逛古著、雜貨、咖啡廳，也能安排 Leeum 美術館。'),
      stop('d4-4', '17:00', '下午', '漢江公園', '景點', '漢江', '傍晚散步、便利商店買飲料，天氣好可看夕陽。'),
      stop('d4-5', '19:00', '晚上', '梨泰院晚餐', '美食', '梨泰院', '找異國料理或韓式小酒館，不排太晚。')
    ]
  },
  {
    id: 'day-5',
    date: '2026/8/21',
    title: '延南洞、弘大下午到晚上',
    areaFocus: '延南洞 / 弘大',
    note: '弘大適合下午到晚上，先從延南洞慢慢逛，再接弘大商圈與晚餐。',
    stops: [
      stop('d5-1', '10:30', '上午', '延南洞咖啡與巷弄', '咖啡廳', '延南', '巷弄咖啡、甜點、文具小店，早上人潮較舒服。'),
      stop('d5-2', '12:30', '中午', '延南洞午餐', '美食', '延南', '可找韓式家常、義式、日式或熱門排隊店。'),
      stop('d5-3', '15:00', '下午', '弘大商圈', '逛街', '弘大', '服飾、美妝、唱片、文創小物，適合集中購物。'),
      stop('d5-4', '17:30', '下午', '弘大拍貼 / 街頭表演', '拍照點', '弘大', '拍貼機、街頭表演與年輕商圈氛圍很適合晚上。'),
      stop('d5-5', '19:30', '晚上', '弘大晚餐與宵夜', '美食', '弘大', '最後一個完整晚上，可以安排烤腸、炸雞或小酒館。')
    ]
  },
  {
    id: 'day-6',
    date: '2026/8/22',
    title: '退房、簡單吃飯、前往機場',
    areaFocus: '住宿附近 / 機場',
    note: '最後一天不排滿，保留退房、寄物、交通緩衝與採買時間。',
    stops: [
      stop('d6-1', '上午', '上午', '整理行李與退房', '休息', '住宿附近', '確認護照、充電器、退稅單、伴手禮與行李重量。'),
      stop('d6-2', '中午', '中午', '住宿附近簡單午餐', '美食', '住宿附近', '選不用排隊的店，避免影響去機場時間。'),
      stop('d6-3', '下午', '下午', '最後採買 / 咖啡休息', '逛街', '住宿附近', '只排附近區域，買完直接取行李。'),
      stop('d6-4', '下午', '下午', '住宿前往機場', '交通', '機場', '依回程航班往前抓足交通與報到時間。')
    ]
  }
];

export function enrichItinerary(days) {
  return days.map((day) => ({
    ...day,
    stops: day.stops.map((item, index, items) => {
      const query = `${item.nameKo || item.name || item.nameZh} ${item.area || ''}`.trim();
      const previous = items[index - 1];
      return {
        ...item,
        time: normalizeStopTime(item.time),
        mapUrl: searchMapUrl(query),
        routeUrl: previous ? routeMapUrl(`${previous.nameKo || previous.name} ${previous.area || ''}`.trim(), query) : searchMapUrl(query)
      };
    })
  }));
}

export const itineraryDays = enrichItinerary(rawDays);

export function makeDailyRoutes(days) {
  return days.map((day) => ({
    date: day.date,
    title: day.title,
    route: day.stops.map((stopItem) => stopItem.name).join(' → ')
  }));
}

export const dailyRoutes = makeDailyRoutes(itineraryDays);
