import { periods } from '../data/itinerary.js';

export default function Overview({ itinerary }) {
  return (
    <div className="stack">
      <section className="card">
        <div className="card-head">
          <h2>六日行程總覽</h2>
        </div>
        <p className="soft-text">把每天的大主題與上午、中午、下午、晚上壓縮成一頁。行程頁新增或修改後，這裡會同步更新。</p>
      </section>

      <div className="overview-grid">
        {itinerary.map((day) => (
          <article className="overview-day" key={day.id}>
            <div className="overview-day-head">
              <div>
                <p className="meta">{day.date}</p>
                <h3>{day.title}</h3>
              </div>
              <span>{day.areaFocus}</span>
            </div>

            <div className="overview-periods">
              {periods.map((period) => {
                const stops = day.stops.filter((stop) => stop.period === period);
                return (
                  <section className="overview-period" key={period}>
                    <h4>{period}</h4>
                    {stops.length ? (
                      <ul>
                        {stops.map((stop) => {
                          const transport = stop.transportFromPrevious;
                          return (
                            <li key={stop.id} className={transport ? 'has-transport' : ''}>
                              <strong>{stop.time}</strong>
                              <span>
                                {stop.name || stop.nameZh || stop.nameKo}
                                {(stop.nameKo || stop.nameZh) && (
                                  <small>
                                    {stop.nameKo && stop.nameKo}
                                    {stop.nameKo && stop.nameZh && '／'}
                                    {stop.nameZh && stop.nameZh}
                                  </small>
                                )}
                              </span>
                              {transport && (
                                <em>
                                  {transport.mode}
                                  {transport.duration ? ` · ${transport.duration}` : ''}
                                  {transport.note && <small>{transport.note}</small>}
                                </em>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p>未安排</p>
                    )}
                  </section>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
