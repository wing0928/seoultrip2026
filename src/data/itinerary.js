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
    title: '長榮 BR172 抵達仁川、前往明洞入住',
    areaFocus: '高雄 / 仁川機場 T1 / 明洞',
    note: '去程 15:50 從高雄小港 Terminal 1 起飛，19:45 抵達仁川 Terminal 1；入境後直接前往 SL Hotel 明洞。',
    stops: [
      stop('d1-1', '15:50', '下午', '長榮 BR172 高雄起飛', '交通', '高雄小港機場', '高雄小港國際機場 Terminal 1 起飛；機型 Airbus A321，經濟艙 Basic。'),
      stop('d1-2', '19:45', '晚上', '抵達仁川國際機場 Terminal 1', '交通', '仁川機場', '抵達後辦理入境、領取行李，再處理 WOWPASS、T-money 或交通卡。', { nameKo: '인천국제공항 제1여객터미널', nameZh: '仁川國際機場 Terminal 1' }),
      stop('d1-3', '20:45', '晚上', '仁川機場前往 SL Hotel 明洞', '交通', '明洞', '依抵達時間選擇 AREX 轉地鐵、機場巴士或計程車，前往 SL호텔 명동。', { nameKo: 'SL호텔 명동', nameZh: 'SL Hotel 明洞' }),
      stop('d1-4', '22:15', '晚上', 'SL Hotel 明洞入住', '休息', '明洞', '辦理入住、整理行李；若需要用餐，以飯店附近便利商店或宵夜為主。', { nameKo: 'SL호텔 명동', nameZh: 'SL Hotel 明洞' })
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
    title: '退房、前往仁川機場、搭乘 BR145 回高雄',
    areaFocus: '明洞 / 仁川機場 T1 / 高雄',
    note: '回程 12:05 從仁川 Terminal 1 起飛，14:00 抵達高雄；早上預留交通、報到與安檢時間。',
    stops: [
      stop('d6-1', '06:30', '上午', '整理行李與 SL Hotel 明洞退房', '休息', '明洞', '確認護照、充電器、退稅單、伴手禮與行李重量；早餐可前一晚先準備。', { nameKo: 'SL호텔 명동', nameZh: 'SL Hotel 明洞' }),
      stop('d6-2', '07:00', '上午', 'SL Hotel 明洞前往仁川機場', '交通', '明洞 / 仁川機場', '前往仁川國際機場 Terminal 1，預留週六早晨交通與行李移動時間。', { nameKo: '인천국제공항 제1여객터미널', nameZh: '仁川國際機場 Terminal 1' }),
      stop('d6-3', '09:00', '上午', '仁川機場 Terminal 1 報到與安檢', '交通', '仁川機場', '長榮 BR145 辦理報到、託運、安檢與出境；完成後再安排簡單早餐或免稅店。', { nameKo: '인천국제공항 제1여객터미널', nameZh: '仁川國際機場 Terminal 1' }),
      stop('d6-4', '12:05', '中午', '長榮 BR145 起飛，返回高雄', '交通', '仁川機場', '仁川 Terminal 1 起飛，預計 14:00 抵達高雄小港 Terminal 1；機型 Airbus A321。')
    ]
  }
];

const legacyTripDays = {
  'day-1': {
    title: '抵達首爾、機場交通、入住',
    areaFocus: '機場 / 住宿附近',
    note: '第一天保留體力，重點是順利抵達、買交通卡、入住與附近簡單吃飯。',
    stops: {
      'd1-1': { time: '上午', name: '抵達仁川 / 金浦機場' },
      'd1-2': { time: '中午', name: '機場前往住宿' },
      'd1-3': { time: '下午', name: '飯店入住與休息' },
      'd1-4': { time: '晚上', name: '住宿附近晚餐散步' }
    }
  },
  'day-6': {
    title: '退房、簡單吃飯、前往機場',
    areaFocus: '住宿附近 / 機場',
    note: '最後一天不排滿，保留退房、寄物、交通緩衝與採買時間。',
    stops: {
      'd6-1': { time: '上午', name: '整理行李與退房' },
      'd6-2': { time: '中午', name: '住宿附近簡單午餐' },
      'd6-3': { time: '下午', name: '最後採買 / 咖啡休息' },
      'd6-4': { time: '下午', name: '住宿前往機場' }
    }
  }
};

export function migrateTripItinerary(days = []) {
  return days.map((day) => {
    const legacyDay = legacyTripDays[day.id];
    const updatedDay = rawDays.find((item) => item.id === day.id);
    if (!legacyDay || !updatedDay) return day;

    const updatedStops = new Map(updatedDay.stops.map((item) => [item.id, item]));
    return {
      ...day,
      title: day.title === legacyDay.title ? updatedDay.title : day.title,
      areaFocus: day.areaFocus === legacyDay.areaFocus ? updatedDay.areaFocus : day.areaFocus,
      note: day.note === legacyDay.note ? updatedDay.note : day.note,
      stops: day.stops.map((item) => {
        const legacyStop = legacyDay.stops[item.id];
        const updatedStop = updatedStops.get(item.id);
        if (!legacyStop || !updatedStop || item.name !== legacyStop.name || item.time !== legacyStop.time) return item;
        return { ...item, ...updatedStop };
      })
    };
  });
}

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
