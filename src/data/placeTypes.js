export const PLACE_TYPES = [
  '景點',
  '餐廳',
  '小吃',
  '咖啡廳',
  '服裝',
  '選物店',
  '購物中心',
  '其他'
];

export const ITINERARY_PLACE_TYPES = [...PLACE_TYPES.filter((type) => type !== '其他'), '交通', '休息', '其他'];

export const CLOTHING_SUBTAGS = ['男裝', '女裝', '鞋子', '綜合'];

export const WISHLIST_PRIORITIES = ['必去', '想去', '有空再去'];
