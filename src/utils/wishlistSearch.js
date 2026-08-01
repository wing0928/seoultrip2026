import { formatPlaceName } from './placePresentation.js';

export function normalizeSearchText(value = '') {
  return String(value || '')
    .toLocaleLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[|｜、,，。．·・/\\()[\]{}「」『』]/g, '');
}

export function matchesWishlistQuery(item, query = '') {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const searchText = [
    item?.name,
    item?.nameZh,
    item?.nameKo,
    item?.nameZhSimplified,
    item?.lookupName,
    formatPlaceName(item),
    item?.note,
    item?.recommendationSource,
    item?.area,
    item?.catchtableUrl,
    ...(Array.isArray(item?.clothingTags) ? item.clothingTags : [])
  ].filter(Boolean).map(normalizeSearchText).join(' ');

  return searchText.includes(normalizedQuery);
}
