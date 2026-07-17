import { MapPin } from 'lucide-react';
import { districts } from '../data/districts.js';

export default function DistrictExplorer({ selectedId = 'myeongdong', onSelect }) {
  const selected = districts.find((district) => district.id === selectedId) || districts[0];
  const mapDistricts = [...districts].sort((left, right) => Number(Boolean(right.isBase)) - Number(Boolean(left.isBase)));
  const select = (id) => onSelect?.(id);

  return (
    <section className="district-explorer" aria-labelledby="district-title">
      <div className="district-heading">
        <div>
          <p className="eyebrow">Area map</p>
          <h2 id="district-title">這次旅行的地區</h2>
        </div>
        <p>選取地區，快速查看街區特色與推薦景點。</p>
      </div>

      <div className="district-layout">
        <div className="district-map-wrap">
          <svg className="district-map" viewBox="0 0 500 260" role="img" aria-label="首爾旅遊地區分區線圖">
            {mapDistricts.map((district) => {
              const active = district.id === selectedId;
              return (
                <g
                  key={district.id}
                  className={`district-shape ${district.isBase ? 'district-base' : ''} ${active ? 'active' : ''}`}
                  style={{ '--district-color': district.color, '--district-active': district.activeColor, transformOrigin: `${district.label.x}px ${district.label.y}px` }}
                  role="button"
                  tabIndex="0"
                  aria-label={district.name}
                  aria-pressed={active}
                  onClick={() => select(district.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      select(district.id);
                    }
                  }}
                >
                  <path d={district.path} />
                  {!district.isBase && <circle cx={district.label.x} cy={district.label.y - 14} r="3.5" />}
                  <text x={district.label.x} y={district.label.y + 7} textAnchor="middle">{district.name}</text>
                </g>
              );
            })}
            <path className="han-river" d="M54 184 C132 169 193 201 263 190 C340 177 394 192 449 164" />
            <text x="388" y="190" className="river-label">漢江</text>
          </svg>
          <div className="district-legend" aria-label="地區圖例">
            {districts.map((district) => (
              <button key={district.id} className={`${district.id === selectedId ? 'active' : ''} ${district.isBase ? 'legend-other' : ''}`} onClick={() => select(district.id)}>
                <span style={{ background: district.color }} />#{district.name}
              </button>
            ))}
          </div>
        </div>

        <article className="district-detail" style={{ '--district-color': selected.color }} aria-live="polite">
          <p className="meta"><MapPin size={15} /> {selected.position}</p>
          <h3>{selected.name}</h3>
          <p className="name-subtitle">{selected.nameKo}</p>
          <p>{selected.character}</p>
          <h4>推薦景點</h4>
          <ul>{selected.spots.map((spot) => <li key={spot}>{spot}</li>)}</ul>
        </article>
      </div>
    </section>
  );
}
