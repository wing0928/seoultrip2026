import { normalizePlaceType } from './placePresentation.js';

/**
 * Merge a background business lookup without allowing a newer manual type
 * selection to be replaced by a stale lookup response.
 */
export function mergeIdentityRefreshResult(initial, updated, current) {
  const typeWasChanged = normalizePlaceType(current?.type) !== normalizePlaceType(initial?.type);
  const typeIsManual = current?.typeManuallySet === true || typeWasChanged;
  if (!typeIsManual) return updated;

  return {
    ...updated,
    type: current.type,
    typeManuallySet: true
  };
}
