import { catchtableUrlForPlace } from '../utils/maps.js';

export default function CatchtableButton({ place, className = 'link-button ghost' }) {
  const fallbackUrl = catchtableUrlForPlace(place);

  if (!fallbackUrl) return null;

  return (
    <a
      className={className}
      href={fallbackUrl}
    >
      CATCHTABLE
    </a>
  );
}
