export const districts = [
  {
    id: 'hongdae',
    name: '弘大商圈',
    nameKo: '홍대',
    color: '#C18B2D',
    activeColor: '#91651A',
    position: '首爾西側',
    character: '大學街、獨立小店與夜間表演聚集的街區。',
    path: 'M63 108 C72 91 91 79 113 81 C140 82 158 97 170 121 C166 143 153 162 134 174 C107 180 84 171 70 157 C59 143 57 125 63 108 Z',
    label: { x: 111, y: 130 },
    spots: ['弘大步行街', '延南洞林蔭道', '京義線森林公園', 'AK Plaza 弘大']
  },
  {
    id: 'bukchon',
    name: '北村韓屋與景福宮',
    nameKo: '북촌한옥마을 · 경복궁',
    color: '#3F7C76',
    activeColor: '#285E59',
    position: '首爾中心偏北',
    character: '宮闕、韓屋巷弄與山勢形成層次分明的歷史區。',
    path: 'M177 70 C197 51 229 44 258 52 C279 58 290 74 288 94 C282 111 267 123 248 128 C220 128 196 119 180 102 C171 91 170 80 177 70 Z',
    label: { x: 232, y: 82 },
    spots: ['景福宮', '北村韓屋村', '國立民俗博物館', '三清洞', '青瓦台']
  },
  {
    id: 'myeongdong',
    name: '明洞',
    nameKo: '명동',
    color: '#B45B4B',
    activeColor: '#8E3D34',
    position: '首爾中心',
    character: '棋盤狀商圈連接南山，適合集中購物與街頭小吃。',
    path: 'M169 121 C190 116 214 115 239 119 C259 121 275 132 282 149 C286 163 277 177 259 188 C239 194 215 193 196 187 C177 180 163 169 157 156 C157 141 161 129 169 121 Z',
    label: { x: 221, y: 151 },
    spots: ['明洞聖堂', '明洞步行街', '南山纜車', '新世界百貨本店', '南大門市場']
  },
  {
    id: 'seongsu',
    name: '聖水洞',
    nameKo: '성수동',
    color: '#527FA5',
    activeColor: '#345E82',
    position: '首爾東側、漢江北岸',
    character: '舊工業街廓改造的咖啡、品牌快閃與首爾林區域。',
    path: 'M286 101 C315 82 350 75 382 80 C415 84 438 102 449 128 C448 145 435 161 413 174 C383 185 348 185 318 177 C299 173 287 168 281 161 C285 146 279 135 264 124 C270 114 278 106 286 101 Z',
    label: { x: 355, y: 126 },
    spots: ['首爾林', '聖水聯邦', '大林倉庫', 'Dior 聖水', 'Common Ground']
  },
  {
    id: 'other',
    name: '其他',
    nameKo: '기타 지역',
    color: '#8A9298',
    activeColor: '#626B72',
    position: '首爾其他區域',
    character: '尚未歸入四個主要行程區域的地點，先集中在這裡，之後再調整。',
    path: 'M47 126 C52 94 78 69 115 52 C157 35 203 33 246 41 C284 48 320 42 349 37 C384 42 418 57 440 78 C460 97 468 119 458 143 C449 166 429 184 403 194 C368 207 332 213 291 222 C253 229 219 218 185 216 C148 220 111 217 82 201 C58 187 45 158 47 126 Z',
    label: { x: 118, y: 200 },
    spots: ['自由探索', '尚未分類的願望地點'],
    isBase: true
  }
];

export function districtForArea(area = '') {
  const aliases = {
    '弘大': 'hongdae',
    '弘大商圈': 'hongdae',
    '聖水': 'seongsu',
    '聖水洞': 'seongsu',
    '北村': 'bukchon',
    '景福宮': 'bukchon',
    '北村／景福宮': 'bukchon',
    '北村韓屋與景福宮': 'bukchon',
    '明洞': 'myeongdong',
    '其他': 'other',
    '待確認': 'other'
  };
  return districts.find((district) => district.id === aliases[area]) || districts.find((district) => district.id === 'other');
}
