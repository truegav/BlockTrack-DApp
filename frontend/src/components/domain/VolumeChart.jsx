import { useMemo } from 'react';

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

export function VolumeChart({ orders, days = 14 }) {
  const data = useMemo(() => {
    const buckets = [];
    const today = new Date();
    for (let index = days - 1; index >= 0; index -= 1) {
      const date = new Date(today);
      date.setDate(date.getDate() - index);
      buckets.push({
        date,
        key: startOfDay(date),
        count: 0,
      });
    }
    const map = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    for (const order of orders) {
      const key = startOfDay(new Date(order.createdAt * 1000));
      const bucket = map.get(key);
      if (bucket) bucket.count += 1;
    }
    return buckets;
  }, [orders, days]);

  const max = Math.max(1, ...data.map((bucket) => bucket.count));
  const total = data.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <div
      className="chart"
      role="img"
      aria-label={`Orders created over the last ${days} days. ${total} total.`}
    >
      <div className="chart__bars">
        {data.map((bucket, index) => {
          const height = bucket.count ? Math.max(9, (bucket.count / max) * 100) : 2;
          return (
            <div className="chart__col" key={bucket.key}>
              <div className="chart__track">
                <div
                  className={`chart__bar ${bucket.count ? '' : 'chart__bar--empty'}`.trim()}
                  style={{ height: `${height}%` }}
                  title={`${bucket.date.toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                  })}: ${bucket.count} order${bucket.count === 1 ? '' : 's'}`}
                />
              </div>
              <span className="chart__label" aria-hidden="true">
                {index % 2 === 0 ? bucket.date.getDate() : ''}
              </span>
            </div>
          );
        })}
      </div>
      <div className="chart__legend">
        <span className="row" style={{ gap: 6 }}>
          <span className="chart__swatch" aria-hidden="true" />
          Orders created
        </span>
        <span className="tabular">{total} in {days} days</span>
      </div>
    </div>
  );
}
