export function Skeleton({
  width = '100%',
  height = 12,
  circle = false,
  className = '',
  style,
}) {
  return (
    <span
      className={`skeleton ${circle ? 'skeleton--circle' : ''} ${className}`.trim()}
      style={{
        display: 'block',
        width,
        height,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

export function SkeletonLines({ count = 3, className = '' }) {
  return (
    <div className={`stack stack--sm ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton
          key={index}
          width={index === count - 1 ? '62%' : '100%'}
          height={11}
        />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }) {
  return (
    <div className="table-wrap" aria-hidden="true">
      <table className="table">
        <thead>
          <tr>
            {Array.from({ length: columns }, (_, index) => (
              <th key={index}>
                <Skeleton width="58%" height={9} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>
              {Array.from({ length: columns }, (_, column) => (
                <td key={column}>
                  <Skeleton width={column === 0 ? '70%' : '46%'} height={12} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PageSkeleton({ title = 'Loading' }) {
  return (
    <div className="page" aria-busy="true" aria-label={title}>
      <div className="page-header">
        <div className="page-header__text">
          <Skeleton width={190} height={24} />
          <div style={{ marginTop: 9 }}>
            <Skeleton width={300} height={12} />
          </div>
        </div>
        <Skeleton width={120} height={38} />
      </div>
      <div className="stat-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="stat">
            <Skeleton width={90} height={10} />
            <Skeleton width={54} height={26} />
            <Skeleton width={110} height={9} />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card__header">
          <Skeleton width={150} height={14} />
          <Skeleton width={80} height={20} />
        </div>
        <TableSkeleton rows={5} columns={5} />
      </div>
    </div>
  );
}
